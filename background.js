const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const controllers = new Map();

function getKey() {
  return new Promise(resolve => {
    chrome.storage.local.get({ te_settings: {} }, ({ te_settings }) => {
      resolve((te_settings.apiKey || "").trim() || null);
    });
  });
}

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
    ...(options.num_predict && options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
    stream: false,
  };

  getKey().then(key => {
    if (!key) {
      controllers.delete(tabId);
      sendResponse({ ok: false, error: "No API key — open the extension popup → API tab and save your Groq key." });
      return;
    }
    fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
      .then(async r => {
        if (!r.ok) {
          if (r.status === 429) {
            const wait = r.headers.get("retry-after") || r.headers.get("x-ratelimit-reset-requests") || "60";
            throw new Error("rate_limited:" + Math.ceil(Number(wait) || 60));
          }
          throw new Error("Groq " + r.status);
        }
        return r.json();
      })
      .then(data => {
        controllers.delete(tabId);
        sendResponse({ ok: true, text: data.choices?.[0]?.message?.content || "" });
      })
      .catch(err => {
        controllers.delete(tabId);
        if (err.name === "AbortError") return;
        sendResponse({ ok: false, error: err.message });
      });
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

    const key = await getKey();
    if (!key) {
      port.postMessage({ error: "No API key — open the extension popup → API tab and save your Groq key." });
      return;
    }

    const { messages, options = {} } = payload;
    const body = {
      model: payload.model || "llama-3.3-70b-versatile",
      messages,
      temperature: options.temperature ?? 0.3,
      ...(options.num_predict && options.num_predict > 0 ? { max_tokens: options.num_predict } : {}),
      stream: true,
    };

    try {
      const resp = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        if (resp.status === 429) {
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
        if (done) { port.postMessage({ done: true }); break; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          const trimmed = line.replace(/^data:\s*/, "").trim();
          if (!trimmed || trimmed === "[DONE]") {
            if (trimmed === "[DONE]") { port.postMessage({ done: true }); return; }
            continue;
          }
          try {
            const d = JSON.parse(trimmed);
            const token = d.choices?.[0]?.delta?.content;
            if (token) port.postMessage({ token });
          } catch (_) {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") port.postMessage({ error: e.message });
    }
  });

  port.onDisconnect.addListener(() => ctrl?.abort());
});
