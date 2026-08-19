const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const OLLAMA_URL = "http://localhost:11434/api/chat";

let keyIndex = 0;

async function loadConfigKeys() {
  try {
    const r = await fetch(chrome.runtime.getURL("config.json"));
    if (r.ok) return await r.json();
  } catch (_) {}
  return [];
}

loadConfigKeys().then(configKeys => {
  chrome.storage.local.get(["te_api_keys", "te_settings"], r => {
    const keys = r.te_api_keys?.length ? r.te_api_keys : configKeys;
    const updates = {};
    if (!r.te_api_keys?.length && configKeys.length) updates.te_api_keys = configKeys;
    if (!r.te_settings?.apiKey && keys[0])           updates.te_settings = { ...(r.te_settings || {}), apiKey: keys[0] };
    if (Object.keys(updates).length) chrome.storage.local.set(updates);
  });
});

async function getKeys() {
  const [r, configKeys] = await Promise.all([
    new Promise(resolve => chrome.storage.local.get("te_api_keys", resolve)),
    loadConfigKeys(),
  ]);
  const stored = (r.te_api_keys || []).filter(k => k?.trim());
  const all = [...new Set([...configKeys, ...stored])];
  return all.length ? all : [];
}

async function getBackend() {
  return new Promise(resolve =>
    chrome.storage.local.get("te_settings", r =>
      resolve(r.te_settings?.modelBackend || "groq")
    )
  );
}

const controllers = new Map();

// ── Non-streaming (manual actions) ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "ollama") return;

  const tabId = sender.tab?.id ?? 0;
  controllers.get(tabId)?.abort();
  const ctrl = new AbortController();
  controllers.set(tabId, ctrl);

  const { messages, options = {} } = message.payload;

  (async () => {
    const backend = await getBackend();

    if (backend === "ollama") {
      const body = {
        model: "llama3.2:latest",
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.3,
          ...(options.num_predict != null && options.num_predict !== 0 ? { num_predict: options.num_predict } : {}),
        },
      };
      try {
        const r = await fetch(OLLAMA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        controllers.delete(tabId);
        if (r.ok) {
          const data = await r.json();
          sendResponse({ ok: true, text: data.message?.content || "" });
        } else {
          sendResponse({ ok: false, error: "Ollama " + r.status + " — is Ollama running?" });
        }
      } catch (e) {
        if (e.name === "AbortError") { controllers.delete(tabId); return; }
        controllers.delete(tabId);
        sendResponse({ ok: false, error: "Ollama not reachable — run: ollama serve" });
      }
      return;
    }

    // ── Groq path ────────────────────────────────────────────────────────────
    const keys = await getKeys();
    if (!keys.length) {
      controllers.delete(tabId);
      sendResponse({ ok: false, error: "No API key — add one in popup → API tab" });
      return;
    }

    const body = {
      model: message.payload.model || "openai/gpt-oss-120b",
      messages,
      temperature: options.temperature ?? 0.3,
      reasoning_effort: "low", // GPT-OSS reasoning tokens count against max_tokens — keep low so short outputs aren't starved
      ...(options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
      stream: false,
    };

    const startIdx = keyIndex;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[(startIdx + i) % keys.length];
      try {
        const r = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (r.ok) {
          const data = await r.json();
          controllers.delete(tabId);
          sendResponse({ ok: true, text: data.choices?.[0]?.message?.content || "" });
          return;
        }
        if (r.status === 429) {
          keyIndex = (startIdx + i + 1) % keys.length;
          if (i < keys.length - 1) continue;
          const wait = r.headers.get("retry-after") || r.headers.get("x-ratelimit-reset-requests") || "60";
          throw new Error("rate_limited:" + Math.ceil(Number(wait) || 60));
        }
        throw new Error("Groq " + r.status);
      } catch (e) {
        if (e.name === "AbortError") { controllers.delete(tabId); return; }
        if (i < keys.length - 1 && !e.message.startsWith("rate_limited")) continue;
        controllers.delete(tabId);
        sendResponse({ ok: false, error: e.message });
        return;
      }
    }
  })();

  return true;
});

// ── Streaming (auto-suggest + smart reply) ────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "te-stream") return;

  let ctrl = null;

  port.onMessage.addListener(async (payload) => {
    ctrl?.abort();
    ctrl = new AbortController();

    const backend = await getBackend();
    const { messages, options = {} } = payload;

    if (backend === "ollama") {
      const body = {
        model: "llama3.2:latest",
        messages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.3,
          ...(options.num_predict != null && options.num_predict !== 0 ? { num_predict: options.num_predict } : {}),
        },
      };
      try {
        const resp = await fetch(OLLAMA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!resp.ok) {
          port.postMessage({ error: "Ollama " + resp.status + " — is Ollama running?" });
          return;
        }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) { port.postMessage({ done: true }); return; }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const d = JSON.parse(t);
              if (d.done) { port.postMessage({ done: true }); return; }
              const token = d.message?.content;
              if (token) port.postMessage({ token });
            } catch (_) {}
          }
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        port.postMessage({ error: "Ollama not reachable — run: ollama serve" });
      }
      return;
    }

    // ── Groq streaming path ───────────────────────────────────────────────────
    const keys = await getKeys();
    if (!keys.length) { port.postMessage({ error: "No API key — add one in popup → API tab" }); return; }

    const body = {
      model: payload.model || "openai/gpt-oss-120b",
      messages,
      temperature: options.temperature ?? 0.3,
      reasoning_effort: "low", // GPT-OSS reasoning tokens count against max_tokens — keep low so short outputs aren't starved
      ...(options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
      stream: true,
    };

    const startIdx = keyIndex;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[(startIdx + i) % keys.length];
      try {
        const resp = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!resp.ok) {
          if (resp.status === 429) {
            keyIndex = (startIdx + i + 1) % keys.length;
            if (i < keys.length - 1) continue;
            const wait = resp.headers.get("retry-after") || resp.headers.get("x-ratelimit-reset-requests") || "60";
            port.postMessage({ error: "rate_limited:" + Math.ceil(Number(wait) || 60) });
            return;
          }
          port.postMessage({ error: "Groq " + resp.status });
          return;
        }

        const reader = resp.body.getReader();
        const dec    = new TextDecoder();
        let   buf    = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) { port.postMessage({ done: true }); return; }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            const t = line.replace(/^data:\s*/, "").trim();
            if (!t || t === "[DONE]") {
              if (t === "[DONE]") { port.postMessage({ done: true }); return; }
              continue;
            }
            try {
              const d     = JSON.parse(t);
              const token = d.choices?.[0]?.delta?.content;
              if (token) port.postMessage({ token });
            } catch (_) {}
          }
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        if (i < keys.length - 1) continue;
        port.postMessage({ error: e.message });
        return;
      }
    }
  });

  port.onDisconnect.addListener(() => ctrl?.abort());
});
