const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

let keyIndex = 0;

// Load keys from gitignored config.json, seed into storage, fall back to popup entry
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
  // Always merge config.json keys with any popup-entered keys so all are tried on 429
  const all = [...new Set([...configKeys, ...stored])];
  return all.length ? all : [];
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
  const body = {
    model: message.payload.model || "llama-3.3-70b-versatile",
    messages,
    temperature: options.temperature ?? 0.3,
    ...(options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
    stream: false,
  };

  getKeys().then(async keys => {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[(keyIndex + i) % keys.length];
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
          keyIndex = (keyIndex + i + 1) % keys.length;
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
  });

  return true;
});

// ── Streaming (auto-suggest + smart reply) ────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "te-stream") return;

  let ctrl = null;

  port.onMessage.addListener(async (payload) => {
    ctrl?.abort();
    ctrl = new AbortController();

    const keys = await getKeys();
    const { messages, options = {} } = payload;
    const body = {
      model: payload.model || "llama-3.3-70b-versatile",
      messages,
      temperature: options.temperature ?? 0.3,
      ...(options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
      stream: true,
    };

    for (let i = 0; i < keys.length; i++) {
      const key = keys[(keyIndex + i) % keys.length];
      try {
        const resp = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!resp.ok) {
          if (resp.status === 429) {
            keyIndex = (keyIndex + i + 1) % keys.length;
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
