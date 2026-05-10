(function () {
  "use strict";

  // Don't run inside our own extension pages
  if (window.location.protocol === "chrome-extension:") return;

  const MODEL = "llama-3.3-70b-versatile";

  const ACTIONS = [
    { label: "Rewrite",      type: "rewrite",      icon: "🔄" },
    { label: "Proofread",    type: "proofread",    icon: "✅" },
    { label: "Professional", type: "professional", icon: "💼" },
    { label: "Shorten",      type: "shorten",      icon: "✂️" },
    { label: "Clean",        type: "clean",        icon: "🧹" },
  ];

  const SHOTS = {
    rewrite: [], proofread: [], professional: [], shorten: [], clean: [],
  };

  // ── Live settings (synced in real-time via storage.onChanged) ───────────
  const CFG = {
    autoSuggest:     true,
    suggestDelay:    1500,
    minLength:       8,
    showTrigger:     true,
    notifications:   true,
    srEnabled:       true,
    replyLength:     "auto",
    replyTone:       "auto",
    followUp:        true,
    followUpHours:   24,
    shortenStrength: "medium",
    translateTarget: "auto",
    customDefault:   "Make this text more concise and impactful.",
    disabledActions: [],
    modelSelect:     "llama-3.3-70b-versatile",
    temperature:     3,
  };

  function applySettings(s) {
    if (!s) return;
    Object.assign(CFG, s);
    if (srBtn)   srBtn.style.display   = CFG.srEnabled   && (focused || lastFocused) ? "flex" : "none";
    if (toolbar) toolbar.style.display = CFG.showTrigger && (focused || lastFocused) ? "flex" : "none";
  }

  try {
    chrome.storage.local.get(["te_settings", "te_custom_prompt", "te_templates", "te_site_usage", "te_disabled_sites"], r => {
      if (r.te_settings)       applySettings(r.te_settings);
      if (r.te_custom_prompt)  CFG.customDefault = r.te_custom_prompt;
      if (r.te_site_usage)     siteUsage = r.te_site_usage;
      if (r.te_templates)      templates = r.te_templates;
      if (r.te_disabled_sites) siteDisabled = r.te_disabled_sites.includes(window.location.hostname);
    });
  } catch (_) {}

  // Real-time: apply changes the moment popup saves
  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.te_settings?.newValue)    applySettings(changes.te_settings.newValue);
      if (changes.te_custom_prompt?.newValue) CFG.customDefault = changes.te_custom_prompt.newValue;
      if (changes.te_templates?.newValue)   templates = changes.te_templates.newValue;
    });
  } catch (_) {}

  let customPrompt = CFG.customDefault;

  const SYSTEM_MSG = {
    rewrite:      "Rephrase the text in <input> tags using different wording. Keep the same meaning, length, and speaker perspective. Output ONLY the rewritten text. Do NOT include <input> tags or any explanation.",
    proofread:    "Fix all grammar, spelling, and punctuation in the text in <input> tags. Do not change wording or style. Output ONLY the corrected text without <input> tags and without any explanation.",
    shorten:      "Shorten the text in <input> tags. Keep ALL points and information — only remove filler and redundancy. Keep the speaker's voice. Output ONLY the shortened text. Do NOT include <input> tags or any explanation.",
    professional: "Rewrite the text in <input> tags to sound formal and professional. Keep the same meaning, the same number of sentences, and the same length — do not add new sentences or new content. Output ONLY the rewritten text. Do NOT include <input> tags or any explanation.",
    clean:        "Clean up the text in <input> tags that was copied from a terminal or chat. Remove extra whitespace, alignment padding, and separator lines (lines made only of dashes, equals signs, or underscores). Keep ALL message content word-for-word — do not rephrase, summarize, or alter any wording. Output ONLY the cleaned text.",
  };

  let toolbar     = null; // always-visible action bar below input
  let srBtn       = null; // dedicated Smart Reply 💬 button
  let suggest     = null; // auto-suggestion bar
  let focused     = null; // currently focused editable element
  let lastFocused = null; // persists after blur so toolbar clicks still have a target

  let suggestFor       = null;  // element the suggestion targets
  let suggestText      = "";    // suggested replacement text
  let suggestGenId     = 0;     // increments each request — stale responses are dropped
  let lastSuggestInput = "";    // last text we suggested for (avoid re-triggering)
  let streamPort       = null;  // active streaming port (disconnect to cancel)
  let undoStack        = [];    // multi-level undo: [{el, text}, ...] max 5
  let suggestDragged   = false; // true after user drags the bar — skip auto-reposition
  let toolbarDragged   = false; // true after user drags the toolbar — skip auto-reposition
  let srStreaming      = false; // true while smart reply is streaming into input
  let originalForDiff  = "";    // text before suggestion — for diff view
  let siteUsage        = {};    // per-site action usage counts {hostname: {type: count}}
  let templates        = [];    // saved reply templates [{label, text}]
  let awayMode         = false; // auto-generate holding reply when new message arrives
  let siteDisabled     = false; // auto-suggest disabled for this hostname
  let responseTimerInt = null;  // setInterval for the waiting-time badge on SR button
  let followUpTimer    = null;  // setTimeout for follow-up reminder

  // (loaded centrally above via chrome.storage.local.get)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isEditable(el) {
    if (!el) return false;
    const id = el.id;
    if (id === "te-toolbar" || id === "te-suggest") return false;
    if (el.closest && el.closest("#te-suggest, #te-toolbar")) return false;
    // On LinkedIn, skip all contentEditable divs — the AI commenter handles those
    if (el.isContentEditable && window.location.hostname.includes("linkedin.com")) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      // Only meaningful text-entry types (no search, number, date, range, color, file…)
      if (!["text", "email", "url", "tel", ""].includes(t)) return false;

      const nm     = (el.name          || "").toLowerCase();
      const eid    = (el.id            || "").toLowerCase();
      const ph     = (el.placeholder   || "").toLowerCase();
      const ac     = (el.autocomplete  || "").toLowerCase();
      const maxLen = parseInt(el.maxLength);

      // Skip search inputs
      if (/\bsearch\b|\bquery\b|\bfind\b/.test(ph))         return false;
      if (/^(q|s|search|query|find|keyword)$/.test(nm))     return false;
      if (/^(q|s|search|query|find|keyword)$/.test(eid))    return false;

      // Skip OTP / PIN / verification code inputs
      if (ac === "one-time-code")                            return false;
      if (/\botp\b|\bpin\b|\bverif/.test(`${nm} ${eid}`))   return false;
      if (maxLen === 1)                                      return false; // single-digit OTP box
      if (maxLen > 0 && maxLen <= 6 &&
          (t === "tel" || el.getAttribute("inputmode") === "numeric")) return false;

      return true;
    }
    return false;
  }

  function getText(el) {
    if (!el) return "";
    const raw = el.isContentEditable ? (el.innerText || el.textContent || "") : (el.value || "");
    return raw.replace(/<[^>]+>/g, ""); // strip any echoed HTML/XML tags
  }

  function setText(el, newText) {
    if (!el) return;
    if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, newText);
      if (!el.textContent.includes(newText)) {
        el.textContent = newText;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    } else {
      el.focus();
      el.select();
      document.execCommand("insertText", false, newText);
      if (el.value !== newText) {
        el.value = newText;
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  // Low-level write — no events fired, used for live streaming into the input
  function setTextLive(el, text) {
    if (!el) return;
    if (el.isContentEditable) { el.innerText = text; }
    else { el.value = text; }
  }

  // ── Action toolbar ────────────────────────────────────────────────────────

  function getToolbar() {
    if (toolbar) return toolbar;
    toolbar = document.createElement("div");
    toolbar.id = "te-toolbar";

    ACTIONS.forEach(({ label, type, icon }) => {
      const btn = document.createElement("button");
      btn.className = "te-action-btn";
      btn.dataset.type = type;
      const iconEl = document.createElement("span");
      iconEl.className = "te-btn-icon";
      iconEl.textContent = icon;
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      btn.appendChild(iconEl);
      btn.appendChild(labelEl);
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        runAction(type);
      });
      toolbar.appendChild(btn);
    });

    // Per-site auto-suggest toggle
    const sep = document.createElement("div");
    sep.style.cssText = "width:1px;height:18px;background:#3a3a3a;margin:0 2px;flex-shrink:0;";
    toolbar.appendChild(sep);

    const siteToggle = document.createElement("button");
    siteToggle.id = "te-site-toggle";
    siteToggle.className = "te-action-btn";
    siteToggle.style.padding = "5px 8px";
    function updateSiteToggle() {
      siteToggle.innerHTML = siteDisabled
        ? '<span class="te-btn-icon" style="opacity:0.5">⊘</span>'
        : '<span class="te-btn-icon">✨</span>';
      siteToggle.title = siteDisabled
        ? "Auto-suggest off for this site — click to enable"
        : "Auto-suggest on — click to disable for this site";
      siteToggle.style.opacity = siteDisabled ? "0.5" : "1";
    }
    updateSiteToggle();
    siteToggle.addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      siteDisabled = !siteDisabled;
      updateSiteToggle();
      try {
        chrome.storage.local.get("te_disabled_sites", (r) => {
          let sites = r.te_disabled_sites || [];
          if (siteDisabled) { if (!sites.includes(window.location.hostname)) sites.push(window.location.hostname); }
          else              { sites = sites.filter(s => s !== window.location.hostname); }
          chrome.storage.local.set({ te_disabled_sites: sites });
        });
      } catch (_) {}
    });
    toolbar.appendChild(siteToggle);

    // Drag to reposition
    let tDrag = null;
    let tMoved = false;
    toolbar.addEventListener("mousedown", (e) => {
      if (e.target.closest(".te-action-btn")) return; // don't drag when clicking buttons
      e.preventDefault();
      const r = toolbar.getBoundingClientRect();
      tDrag  = { ox: e.clientX - r.left, oy: e.clientY - r.top };
      tMoved = false;
      toolbar.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!tDrag) return;
      tMoved = true;
      toolbarDragged = true;
      const x = Math.max(4, Math.min(e.clientX - tDrag.ox, window.innerWidth  - toolbar.offsetWidth  - 4));
      const y = Math.max(4, Math.min(e.clientY - tDrag.oy, window.innerHeight - toolbar.offsetHeight - 4));
      toolbar.style.left = x + "px";
      toolbar.style.top  = y + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!tDrag) return;
      tDrag = null; tMoved = false;
      toolbar.style.cursor = "";
      if (toolbarDragged) {
        try {
          chrome.storage.local.set({ te_toolbar_pos: { left: toolbar.style.left, top: toolbar.style.top } });
        } catch (_) {}
      }
    });

    // Restore saved position
    try {
      chrome.storage.local.get("te_toolbar_pos", (r) => {
        if (r.te_toolbar_pos?.left) {
          toolbar.style.left = r.te_toolbar_pos.left;
          toolbar.style.top  = r.te_toolbar_pos.top;
          toolbarDragged     = true;
        }
      });
    } catch (_) {}

    document.documentElement.appendChild(toolbar);
    return toolbar;
  }

  function getSrBtn() {
    if (srBtn) return srBtn;
    srBtn = document.createElement("div");
    srBtn.id    = "te-sr-btn";
    srBtn.title = "Smart Reply";
    srBtn.textContent = "💬";
    srBtn.style.cssText = `
      position:fixed;z-index:2147483647;display:none;
      width:30px;height:30px;align-items:center;justify-content:center;
      background:#1e1e1e;color:#fff;font-size:15px;border-radius:50%;
      cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.35);
      user-select:none;border:1px solid #444;transition:background 0.15s;
    `;
    srBtn.addEventListener("mouseenter", () => { if (!awayMode) srBtn.style.background = "#2d2d2d"; });
    srBtn.addEventListener("mouseleave", () => { if (!awayMode) srBtn.style.background = "#1e1e1e"; });
    srBtn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
    srBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      runSmartReply(focused || lastFocused);
    });
    // Right-click / long-press context menu
    srBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault(); e.stopPropagation();
      showSrContextMenu(e.clientX, e.clientY);
    });
    document.documentElement.appendChild(srBtn);
    return srBtn;
  }

  function showSrContextMenu(x, y) {
    const existing = document.getElementById("te-sr-ctx");
    if (existing) existing.remove();
    const el = focused || lastFocused;
    const ctx = document.createElement("div");
    ctx.id = "te-sr-ctx";
    ctx.style.cssText = `position:fixed;left:${x}px;top:${y}px;
      background:#1e1e1e;border:1px solid #444;border-radius:8px;
      z-index:2147483647;font-size:13px;color:#e0e0e0;overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);min-width:180px;font-family:inherit;`;

    const items = [
      { icon: "📋", label: "Summarize chat",          action: () => runSummary(el) },
      { icon: awayMode ? "🟣" : "💤", label: awayMode ? "Away Mode: ON (click to off)" : "Away Mode: OFF (click to on)", action: () => toggleAwayMode(el) },
      { icon: "💾", label: "Save last reply as template", action: () => {
        const text = getText(el).trim();
        if (text) { saveTemplate(text); showToast("Template saved!"); }
      }},
      { icon: "📂", label: `Templates (${templates.length})`, action: () => showTemplatesPicker(el) },
      { icon: "🌐", label: "Translate & reply",       action: () => runSmartReplyTranslate(el) },
    ];

    items.forEach(({ icon, label, action }) => {
      const row = document.createElement("div");
      row.style.cssText = "padding:8px 14px;cursor:pointer;display:flex;gap:8px;align-items:center;";
      row.innerHTML = `<span>${icon}</span><span>${label}</span>`;
      row.addEventListener("mouseenter", () => { row.style.background = "#2a2a2a"; });
      row.addEventListener("mouseleave", () => { row.style.background = ""; });
      row.addEventListener("mousedown", (e) => { e.preventDefault(); ctx.remove(); action(); });
      ctx.appendChild(row);
    });

    document.documentElement.appendChild(ctx);
    setTimeout(() => document.addEventListener("mousedown", function rm(e) {
      if (!ctx.contains(e.target)) { ctx.remove(); document.removeEventListener("mousedown", rm); }
    }), 50);
  }

  function showTemplatesPicker(el) {
    if (!templates.length) { showToast("No templates saved yet."); return; }
    const overlay = document.createElement("div");
    overlay.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:#1e1e1e;border:1px solid #444;border-radius:10px;padding:14px 16px;
      z-index:2147483647;min-width:280px;max-width:400px;font-family:inherit;color:#e0e0e0;font-size:13px;`;
    overlay.innerHTML = `<div style="font-weight:600;margin-bottom:10px;color:#7ab3e0">📂 Saved Templates</div>`;
    templates.forEach((t, i) => {
      const row = document.createElement("div");
      row.style.cssText = "padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid #333;margin-bottom:6px;line-height:1.4;";
      row.textContent = t.label;
      row.addEventListener("mouseenter", () => { row.style.background = "#2a2a2a"; });
      row.addEventListener("mouseleave", () => { row.style.background = ""; });
      row.addEventListener("mousedown", (e) => { e.preventDefault(); overlay.remove(); setText(el, t.text); el.focus(); });
      overlay.appendChild(row);
    });
    const close = document.createElement("div");
    close.style.cssText = "text-align:right;margin-top:8px;";
    close.innerHTML = `<button style="background:#333;border:1px solid #555;color:#ccc;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">Close</button>`;
    close.querySelector("button").addEventListener("mousedown", (e) => { e.preventDefault(); overlay.remove(); });
    overlay.appendChild(close);
    document.documentElement.appendChild(overlay);
  }

  function showToast(msg) {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;bottom:80px;right:20px;background:#1e1e1e;color:#e0e0e0;
      border:1px solid #444;border-radius:8px;padding:8px 14px;font-size:12px;
      z-index:2147483647;font-family:inherit;box-shadow:0 2px 12px rgba(0,0,0,0.4);`;
    t.textContent = msg;
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  async function runSmartReplyTranslate(el) {
    const chatMsgs = extractChatHistory(el);
    const lastThem = chatMsgs.filter(m => m.role === "them").pop();
    if (!lastThem) return;
    const lang = lastThem.content;
    // Inject language hint into smart reply
    const s = getSrBtn();
    const orig = s.textContent;
    s.textContent = "⏳"; s.style.pointerEvents = "none";
    const result = await new Promise((resolve, reject) => {
      let port;
      try { port = runtimeConnect("te-stream"); }
      catch (e) { reject(e); return; }
      let raw = ""; let settled = false;
      const done = v => { if (!settled) { settled = true; port.disconnect(); resolve(v); } };
      const fail = e => { if (!settled) { settled = true; port.disconnect(); reject(e); } };
      const timer = setTimeout(() => fail(new Error("Timeout")), 60000);
      port.onMessage.addListener(msg => {
        if (msg.error) { clearTimeout(timer); fail(new Error(parseError(msg.error))); return; }
        if (msg.token) raw += msg.token;
        if (msg.done)  { clearTimeout(timer); done(clean(raw)); }
      });
      port.onDisconnect.addListener(() => { clearTimeout(timer); if (!settled) fail(new Error("Disconnected")); });
      const lines = chatMsgs.slice(-6).map(m => `${m.role === "me" ? "You" : "Them"}: ${m.content}`).join("\n");
      port.postMessage({
        messages: [
          { role: "system", content: "Detect the language Them is using. Write You's reply in that SAME language. Output ONLY the reply text." },
          { role: "user",   content: `Conversation:\n${lines}\n\nWrite You's reply in the same language as Them:` },
        ],
        options: { temperature: 0.65, num_predict: 150 },
      });
    }).catch(() => null);
    s.textContent = orig; s.style.pointerEvents = "";
    if (result) { setText(el, result); scheduleFollowUp(el); }
  }

  function positionToolbar(el) {
    const t = getToolbar();
    const s = getSrBtn();
    if (CFG.showTrigger) t.style.display = "flex";
    if (CFG.srEnabled)   s.style.display = "flex";
    if (!toolbarDragged) {
      const r = el.getBoundingClientRect();
      t.style.top  = Math.min(r.bottom + 6, window.innerHeight - 46) + "px";
      t.style.left = Math.max(8, r.left) + "px";
    }
    const r = el.getBoundingClientRect();
    s.style.top  = Math.max(4, r.bottom - 34) + "px";
    s.style.left = Math.max(4, r.right - 34)  + "px";
  }

  function hideToolbar() {
    if (toolbar) toolbar.style.display = "none";
    if (srBtn)   srBtn.style.display   = "none";
  }

  // ── Suggestion bar ────────────────────────────────────────────────────────

  function getSuggest() {
    if (suggest) return suggest;
    suggest = document.createElement("div");
    suggest.id = "te-suggest";

    const label = document.createElement("span");
    label.id = "te-suggest-label";
    label.textContent = "✨";

    const textEl = document.createElement("span");
    textEl.id = "te-suggest-text";

    const accept = document.createElement("button");
    accept.id = "te-suggest-accept";
    accept.textContent = "Accept (Tab)";
    accept.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (accept.classList.contains("undo") && undoStack.length) {
        const { el, text: original } = undoStack.pop();
        setText(el, original);
        lastSuggestInput = original;
        el.focus();
        if (undoStack.length) {
          updateUndoBtn(accept);
        } else {
          hideSuggest();
        }
      } else {
        applySuggestion();
      }
    });

    const dismiss = document.createElement("button");
    dismiss.id = "te-suggest-dismiss";
    dismiss.textContent = "✕";
    dismiss.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); hideSuggest(); });

    suggest.appendChild(label);
    suggest.appendChild(textEl);
    suggest.appendChild(accept);
    suggest.appendChild(dismiss);
    document.documentElement.appendChild(suggest);

    // ── Drag to reposition ──────────────────────────────────────────────────
    let drag = null;
    suggest.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return; // don't drag when clicking buttons
      e.preventDefault();
      const r = suggest.getBoundingClientRect();
      drag = { ox: e.clientX - r.left, oy: e.clientY - r.top };
      suggest.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!drag) return;
      suggestDragged = true;
      const x = Math.max(0, Math.min(e.clientX - drag.ox, window.innerWidth  - suggest.offsetWidth  - 4));
      const y = Math.max(0, Math.min(e.clientY - drag.oy, window.innerHeight - suggest.offsetHeight - 4));
      suggest.style.left = x + "px";
      suggest.style.top  = y + "px";
    });
    document.addEventListener("mouseup", () => {
      if (drag) { drag = null; suggest.style.cursor = ""; }
    });

    return suggest;
  }

  function positionSuggest(el) {
    if (!suggest || suggest.style.display === "none" || suggestDragged) return;
    const r = el.getBoundingClientRect();
    suggest.style.top      = (r.bottom + 6) + "px";
    suggest.style.left     = Math.max(8, r.left) + "px";
    suggest.style.maxWidth = Math.min(520, window.innerWidth - Math.max(8, r.left) - 12) + "px";
  }

  const ACTION_LABELS = { proofread: "Proofread", shorten: "Shorten", rewrite: "Rewrite", professional: "Professional", clean: "Clean" };

  function showSuggestLoading(el, action) {
    suggestFor    = el;
    suggestDragged = false; // reset drag so bar re-anchors below the input
    const s = getSuggest();
    s.style.borderColor = "";
    s.querySelector("#te-suggest-label").textContent = "✨ " + (ACTION_LABELS[action] || "");
    s.querySelector("#te-suggest-text").textContent  = "Analyzing…";
    const accept = s.querySelector("#te-suggest-accept");
    accept.textContent       = "Accept (Tab)";
    accept.style.background  = "";
    accept.style.display     = "none";
    s.querySelector("#te-suggest-dismiss").textContent = "✕";
    const r = el.getBoundingClientRect();
    s.style.top      = (r.bottom + 6) + "px";
    s.style.left     = Math.max(8, r.left) + "px";
    s.style.maxWidth = Math.min(520, window.innerWidth - Math.max(8, r.left) - 12) + "px";
    s.style.display  = "flex";
  }

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function wordDiffHtml(original, updated) {
    const a = original.split(/\s+/);
    const b = updated.split(/\s+/);
    const setA = new Set(a);
    return b.map(w => setA.has(w) ? escHtml(w) : `<mark>${escHtml(w)}</mark>`).join(" ");
  }

  function showSuggestResult(text) {
    if (!suggest || suggest.style.display === "none") return;
    suggestText = text;
    const textEl = suggest.querySelector("#te-suggest-text");
    if (originalForDiff && text.length > 5) {
      textEl.innerHTML = wordDiffHtml(originalForDiff, text);
    } else {
      textEl.textContent = text;
    }
    suggest.querySelector("#te-suggest-accept").style.display = "";
  }

  function hideSuggest() {
    streamPort?.disconnect();
    streamPort       = null;
    suggestDragged   = false;
    lastSuggestInput = ""; // reset so same text can re-trigger after dismiss
    if (suggest) {
      suggest.style.display = "none";
      const accept = suggest.querySelector("#te-suggest-accept");
      if (accept) { accept.classList.remove("undo"); accept.style.background = ""; }
    }
    suggestFor  = null;
    suggestText = "";
    suggestGenId++;
  }

  function updateUndoBtn(accept) {
    const levels = undoStack.length;
    accept.textContent      = levels > 1 ? `Undo (${levels})` : "Undo";
    accept.style.background = "#333";
    accept.classList.add("undo");
    accept.style.display    = "";
  }

  function showUndoState(el, original) {
    const s = getSuggest();
    s.style.borderColor = "#22c55e";
    s.querySelector("#te-suggest-label").textContent = "✓";
    s.querySelector("#te-suggest-text").textContent  = "Applied";
    const accept = s.querySelector("#te-suggest-accept");
    updateUndoBtn(accept);
    s.querySelector("#te-suggest-dismiss").textContent = "✕";
    if (!suggestDragged) {
      const r = el.getBoundingClientRect();
      s.style.top  = (r.bottom + 6) + "px";
      s.style.left = Math.max(8, r.left) + "px";
    }
    s.style.display = "flex";
    setTimeout(() => { if (!undoStack.length) hideSuggest(); }, 5000);
  }

  function applySuggestion() {
    if (suggestFor && suggestText) {
      const el          = suggestFor;
      const original    = getText(el).trim();
      const replacement = suggestText;
      lastSuggestInput  = replacement;
      clearTimeout(suggestTimer);
      suggestGenId++;
      streamPort?.disconnect(); streamPort = null;
      suggestFor  = null;
      suggestText = "";
      // Push to undo stack
      undoStack.push({ el, text: original });
      if (undoStack.length > 5) undoStack.shift();
      setText(el, replacement);
      el.focus();
      trackUsage("auto");
      showUndoState(el, original);
    } else {
      hideSuggest();
    }
  }

  // ── Toolbar helpers ───────────────────────────────────────────────────────

  function resetToolbarBtns() {
    if (!toolbar) return;
    ACTIONS.forEach(({ label, type, icon }) => {
      const btn = toolbar.querySelector(`[data-type="${type}"]`);
      if (!btn) return;
      btn.disabled = false;
      btn.innerHTML = "";
      const iconEl = document.createElement("span");
      iconEl.className = "te-btn-icon";
      iconEl.textContent = icon;
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      btn.appendChild(iconEl);
      btn.appendChild(labelEl);
    });
  }


  // ── Dynamic options based on text size ───────────────────────────────────

  // ── Extension context guard ───────────────────────────────────────────────
  // chrome.runtime becomes undefined when the extension is reloaded while the
  // page is open. All AI calls go through this helper — it throws a clean error
  // that surfaces as "Refresh page to reconnect" instead of a cryptic crash.
  function runtimeConnect(name) {
    if (!chrome?.runtime?.connect) throw new Error("Refresh page to reconnect");
    return chrome.runtime.connect({ name });
  }
  function runtimeSendMessage(msg, cb) {
    if (!chrome?.runtime?.sendMessage) { cb({ ok: false, error: "Refresh page to reconnect" }); return; }
    chrome.runtime.sendMessage(msg, cb);
  }

  // Translate raw error strings (including rate_limited:N) into user-friendly messages
  let _rateLimitUntil = 0;
  function parseError(raw) {
    if (typeof raw === "string" && raw.startsWith("rate_limited:")) {
      const secs = parseInt(raw.split(":")[1]) || 60;
      _rateLimitUntil = Date.now() + secs * 1000;
      return `Rate limited — wait ${secs}s`;
    }
    return raw;
  }
  function isRateLimited() {
    return Date.now() < _rateLimitUntil;
  }
  function rateLimitMsg() {
    const secs = Math.ceil((_rateLimitUntil - Date.now()) / 1000);
    return `Rate limited — wait ${secs}s`;
  }

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function getShortenTarget(w, strength) {
    const ratios = { light: [0.65, 0.75], medium: [0.40, 0.55], aggressive: [0.20, 0.32] };
    const [lo, hi] = ratios[strength] || ratios.medium;
    const loW = Math.max(10, Math.round(w * lo));
    const hiW = Math.max(15, Math.round(w * hi));
    return `${loW} to ${hiW} words`;
  }

  // Returns the right system message — shorten gets a precise word-count target
  function getSystemMsg(type, text) {
    if (type === "shorten") {
      const w      = wordCount(text);
      const target = getShortenTarget(w, CFG.shortenStrength);
      const rule   = CFG.shortenStrength === "light"
        ? "Remove filler words and redundant phrases only."
        : CFG.shortenStrength === "aggressive"
        ? "Be very concise — cut everything except the essential points."
        : "Remove filler words and combine sentences where possible.";
      return `Shorten the text in <input> tags to approximately ${target}. IMPORTANT: Keep EVERY point, fact, and piece of information from the original — do NOT omit any content. ${rule} Keep the speaker's voice. Output ONLY the shortened text, no explanation.`;
    }
    return SYSTEM_MSG[type];
  }

  // Returns Ollama options scaled to the text length so large texts don't fail
  function getOllamaOptions(type, text) {
    const chars = text.length;
    const w     = wordCount(text);

    // Context window: input tokens ≈ chars/3.5, add headroom for system + shots + output
    const inputTokens = Math.ceil(chars / 3.5);
    const num_ctx = Math.min(32768, Math.max(2048, inputTokens * 2 + 1200));

    // Cap output tokens to prevent runaway generation and save quota
    let num_predict;
    if (type === "shorten") {
      const ratios = { light: 0.80, medium: 0.60, aggressive: 0.40 };
      const ratio  = ratios[CFG.shortenStrength] || 0.60;
      num_predict  = Math.max(60, Math.ceil(w * ratio * 1.4));
    } else if (type === "proofread") {
      num_predict = Math.max(80, Math.ceil(w * 1.2));
    } else {
      num_predict = Math.max(80, Math.ceil(w * 1.5)); // rewrite/professional/friendly can be slightly longer
    }

    return { temperature: 0.3, num_predict, num_ctx, keep_alive: -1 };
  }

  // ── Ollama ────────────────────────────────────────────────────────────────

  function callOllama(text, type) {
    return new Promise((resolve, reject) => {
      try {
        runtimeSendMessage({
          type: "ollama",
          payload: {
            model: MODEL,
            stream: false,
            options: getOllamaOptions(type, text),
            messages: [
              { role: "system", content: getSystemMsg(type, text) },
              ...SHOTS[type],
              { role: "user", content: `<input>${text}</input>` },
            ],
          },
        }, (resp) => {
          if (chrome.runtime?.lastError) return reject(new Error("Refresh page and retry"));
          if (!resp?.ok) return reject(new Error(resp?.error || "Ollama error"));
          resolve(clean(resp.text));
        });
      } catch (e) {
        reject(new Error("Refresh page and retry"));
      }
    });
  }

  function clean(text) {
    return text
      .replace(/<[^>]+>/g, "")                                                              // strip any HTML/XML tags the model echoes
      .replace(/^["'\u201C\u201D]|["'\u201C\u201D]$/g, "")
      .replace(/^(Text:|Result:|Output:)\s*/i, "")
      .replace(/^(Here(?:'s| is)[^:\n]*[:—]\s*)/i, "")
      .replace(/^(Sure[,!]?[^:\n]*[:—]?\s*)/i, "")
      .replace(/^(The (?:improved|rewritten|corrected|shortened|professional|friendly) (?:text|version)[^:\n]*[:—]\s*)/i, "")
      .trim();
  }

  // Same as clean() but trims only the left (for live stream preview)
  function cleanLeft(text) {
    return text
      .replace(/<[^>]+>/g, "")                                                              // strip any HTML/XML tags the model echoes
      .replace(/^["'\u201C\u201D]/, "")
      .replace(/^(Text:|Result:|Output:)\s*/i, "")
      .replace(/^(Here(?:'s| is)[^:\n]*[:—]\s*)/i, "")
      .replace(/^(Sure[,!]?[^:\n]*[:—]?\s*)/i, "")
      .replace(/^(The (?:improved|rewritten|corrected|shortened|professional|friendly) (?:text|version)[^:\n]*[:—]\s*)/i, "")
      .trimStart();
  }

  // ── Smart action detection ────────────────────────────────────────────────

  function typoScore(text) {
    let score = 0;
    const lo = text.toLowerCase();
    // Shorthand / chat abbreviations
    if (/\b(u|r|ur|pls|thx|ty|idk|omg|lol|btw|fyi|asap|tbh|imo|ngl|smh)\b/.test(lo)) score++;
    // Missing apostrophes in contractions
    if (/\b(dont|cant|wont|im|ive|its|theyre|youre|didnt|wasnt|isnt|wouldnt|couldnt|havent|shouldnt)\b/.test(lo)) score++;
    // All lowercase with meaningful length
    if (text.length > 20 && text === text.toLowerCase()) score++;
    // Common misspellings
    if (/\b(recieve|occured|seperate|definately|freind|wierd|beleive|untill|begining|goverment|occassion)\b/.test(lo)) score++;
    return score;
  }

  // Returns true if text is a URL, email, code, or OTP — skip auto-suggest
  function shouldSkip(text) {
    const t = text.trim();
    if (/^https?:\/\/\S+$/.test(t))                                                   return true; // URL
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))                                         return true; // email
    if (/[{}\[\]<>]|function\s*\(|=>\s*{|import\s+|const\s+|var\s+|def\s+/.test(t)) return true; // code
    if (/^\d{4,8}$/.test(t))                                                           return true; // OTP / PIN (pure digits)
    return false;
  }

  // Auto-suggest always proofreads — never auto-shortens
  function pickAction(text) {
    return "proofread";
  }

  // Returns true if suggestion is too similar to original to be worth showing
  function tooSimilar(original, suggestion) {
    const norm = s => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const a = norm(original);
    const b = norm(suggestion);
    if (a === b) return true;
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const shared = [...setA].filter(w => setB.has(w)).length;
    const union  = new Set([...setA, ...setB]).size;
    return shared / union >= 0.88;
  }

  // Open a streaming port to background, call onToken(rawSoFar) as tokens arrive,
  // onDone(cleanedFinal) when complete, onError(msg) on failure.
  // Returns the port — disconnect it to cancel.
  function streamOllama(text, type, onToken, onDone, onError) {
    let port;
    try { port = runtimeConnect("te-stream"); }
    catch (_) { onError("Reload page and retry"); return null; }

    let raw = "";

    port.onMessage.addListener((msg) => {
      if (msg.error) { onError(parseError(msg.error)); return; }
      if (msg.token) {
        raw += msg.token;
        const preview = cleanLeft(raw);
        if (preview) onToken(preview);
      }
      if (msg.done) onDone(clean(raw));
    });

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) onError("Reload page and retry");
    });

    port.postMessage({
      model: MODEL,
      messages: [
        { role: "system", content: getSystemMsg(type, text) },
        ...SHOTS[type],
        { role: "user", content: `<input>${text}</input>` },
      ],
      options: getOllamaOptions(type, text),
    });

    return port;
  }

  // ── Smart Reply: chat history extraction ─────────────────────────────────

  function extractChatHistory(inputEl) {
    const host = window.location.hostname;

    // ── WhatsApp Web ──────────────────────────────────────────────────────
    if (host.includes("web.whatsapp.com")) {
      const msgs = [];
      document.querySelectorAll("#main .message-in, #main .message-out").forEach(el => {
        const isMe = el.classList.contains("message-out");
        const text = (el.querySelector(".copyable-text") || el).innerText?.split("\n")[0]?.trim();
        if (text) msgs.push({ role: isMe ? "me" : "them", content: text });
      });
      return msgs.slice(-30);
    }

    // ── LinkedIn Messages ─────────────────────────────────────────────────
    if (host.includes("linkedin.com")) {
      const msgs = [];
      const container = document.querySelector(
        ".msg-s-message-list-container, .msg-overlay-conversation-bubble__content-wrapper"
      );
      if (container) {
        container.querySelectorAll(".msg-s-message-list__event").forEach(el => {
          const isMe = !!el.querySelector(".msg-s-event-listitem--outgoing, .msg-s-message-list__event--right");
          const text = el.querySelector(".msg-s-event-listitem__body, .msg-s-message-list__event-body")?.innerText?.trim();
          if (text) msgs.push({ role: isMe ? "me" : "them", content: text });
        });
        return msgs.slice(-30);
      }
    }

    // ── Fiverr + Generic ─────────────────────────────────────────────────
    // Walk up from input to find scrollable chat container
    let container = inputEl?.parentElement;
    const maxDepth = host.includes("fiverr.com") ? 20 : 12;
    for (let i = 0; i < maxDepth; i++) {
      if (!container || container === document.body) break;
      if (container.scrollHeight > container.clientHeight + 100 &&
          container.children.length > 2) break;
      container = container.parentElement;
    }
    if (!container || container === document.body) return [];

    // Narrow to the direct child that holds the input (excludes sidebars)
    let searchRoot = inputEl;
    while (searchRoot?.parentElement && searchRoot.parentElement !== container) {
      searchRoot = searchRoot.parentElement;
    }
    if (!searchRoot || searchRoot === container) searchRoot = container;
    if (!searchRoot) return [];

    // ── Strategy 1: "Me" / own-name label detection
    // Fiverr shows "Me" in Chrome but full name (e.g. "Nadir Ali Khan") in Brave.
    // Detect own-name from the page header if present.
    const pageOwnerName = (
      document.querySelector("[data-testid='username'], .username-text, .seller-name, .user-profile-name")
        ?.innerText?.trim() ||
      document.querySelector("h1, h2")?.innerText?.trim() ||
      ""
    ).toLowerCase();

    const myRowRoots = new Set();
    Array.from(searchRoot.querySelectorAll("*")).forEach(el => {
      if (el.children.length > 0) return;
      const t = el.innerText?.trim();
      if (!t) return;
      const isMe = t === "Me" || (pageOwnerName && t.toLowerCase() === pageOwnerName);
      if (!isMe) return;
      // Walk up and tag the next 5 ancestors as "my message" containers
      let node = el.parentElement;
      for (let i = 0; i < 5 && node && node !== searchRoot; i++) {
        myRowRoots.add(node);
        node = node.parentElement;
      }
    });

    function isMyRow(el) {
      let node = el;
      while (node && node !== searchRoot) {
        if (myRowRoots.has(node)) return true;
        node = node.parentElement;
      }
      return false;
    }

    const seen   = new Set();
    let   lastTs = null;
    const candidates = [];

    Array.from(searchRoot.querySelectorAll("*")).forEach(el => {
      // Leaf nodes only — skips containers whose innerText bundles username+timestamp+message
      if (!el || el.children.length > 0) return;
      const text = el.innerText?.trim();
      if (!text || text.length < 2 || seen.has(text)) return;

      const ts = parseMessageTimestamp(text);
      if (ts) { lastTs = ts; return; }

      if (text === "Me") return;
      if (/^[A-Z]{1,4}$/.test(text)) return;                                    // avatar initial / short all-caps label (NAK, etc.)
      if (/^\w+$/.test(text) && /\d/.test(text) && text.length < 30) return;    // username9000 style
      if (/^\d{1,2}:\d{2}(\s*(AM|PM))?$/i.test(text)) return;
      if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i.test(text)) return;
      if (/\d+(\.\d+)?\s*(MB|KB|GB)/i.test(text)) return;
      if (/^\d+\s*Files?$/i.test(text)) return;
      if (/^Attachment_\d+/.test(text)) return;
      if (/Screen Recording/i.test(text)) return;
      // Sidebar duration/delivery strings ("3 days", "7 hours ago", etc.)
      if (/^\d+\s*(days?|hours?|minutes?)\s*(ago)?$/i.test(text)) return;
      // Fiverr UI buttons and system strings
      if (/^(create an offer|send offer|add extras|view order|order details|request extension|learn more|share feedback|we have your back)$/i.test(text)) return;
      if (/joined the conversation/i.test(text)) return;
      if (/take a moment to browse/i.test(text)) return;
      // Sender labels (own name used as label, like "Me") — skip, already handled above
      if (pageOwnerName && text.toLowerCase() === pageOwnerName) return;
      // Bot/system messages that only contain the freelancer name + filler
      if (/^Nadir Ali Khan\s*(is|has|was|will|joined|left)?(\s|$)/i.test(text) && text.length < 60) return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 5) return;

      // Only include elements that are above (or at) the input — exclude any sidebar below/right
      if (inputEl) {
        const inputRect = inputEl.getBoundingClientRect();
        if (rect.top > inputRect.bottom + 20) return;   // below the input area
        if (rect.left > inputRect.right  + 5)  return;  // to the right of the input (sidebar)
      }

      // Skip elements with no timestamp — these are sidebar/UI elements before the chat starts
      if (lastTs === null) return;

      seen.add(text);
      candidates.push({ el, text, rect, timestamp: lastTs });
    });

    if (!candidates.length) return [];

    // If we found "Me" labels, use label-based detection
    if (myRowRoots.size > 0) {
      return candidates.slice(-30).map(c => ({
        role:      isMyRow(c.el) ? "me" : "them",
        content:   c.text,
        timestamp: c.timestamp,
      }));
    }

    // ── Strategy 2: Dynamic position-based (bubble chat layouts)
    // Filter out full-width rows that give misleading center X
    const rootWidth = searchRoot.getBoundingClientRect().width || window.innerWidth;
    const bubbles   = candidates.filter(c => c.rect.width <= rootWidth * 0.82);
    if (!bubbles.length) return candidates.slice(-30).map(c => ({ role: "them", content: c.text, timestamp: c.timestamp }));

    const centers     = bubbles.map(c => c.rect.left + c.rect.width / 2);
    const dynamicMidX = (Math.min(...centers) + Math.max(...centers)) / 2;

    return bubbles.slice(-30).map(c => ({
      role:      (c.rect.left + c.rect.width / 2) > dynamicMidX ? "me" : "them",
      content:   c.text,
      timestamp: c.timestamp,
    }));
  }

  // ── Smart Reply helpers ───────────────────────────────────────────────────

  function parseMessageTimestamp(text) {
    const m = text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    if (!m) return null;
    try { return new Date(`${m[1]} ${m[2]}, ${new Date().getFullYear()} ${m[3]}`); } catch (_) { return null; }
  }

  // ── 1. Situation detection (client-side, no extra API call) ───────────────
  function detectSituation(chatMsgs) {
    const themMsgs  = chatMsgs.filter(m => m.role === "them");
    const lastThem  = themMsgs[themMsgs.length - 1]?.content?.toLowerCase() || "";
    const allThem   = themMsgs.map(m => m.content.toLowerCase()).join(" ");

    if (/refund|scam|fake|report|fraud|unacceptable|terrible|awful|worst/.test(lastThem))                    return "complaint";
    if (/revise|revision|change|modify|redo|not quite|not right|different|adjust/.test(lastThem))             return "revision";
    if (/still waiting|still haven|haven't received|where is my|where.s my|delayed|running late|overdue/.test(lastThem)) return "delay_complaint";
    if (/not working|error|bug|broken|crash|doesn't work|doesn.t work/.test(lastThem))                       return "support";
    if (/price|cost|budget|discount|cheaper|how much|rate|fee|charge/.test(lastThem))                        return "pricing";
    if (/\bwhen (will|can|do|is|are|should|could)\b|deadline|urgent|asap|how long|how many days|delivery date|timeline/.test(lastThem)) return "timeline";
    if (/thank|great|perfect|amazing|love it|awesome|excellent|well done|good job/.test(lastThem)) return "praise";
    if (/\bhold\b|get back to you|get back to me|let me think|i'll think|will think|need time|think about it/.test(lastThem)) return "hold";
    if (themMsgs.length <= 2)                                                                       return "new_inquiry";
    if (/order|delivery|milestone|phase|submitted|progress|update/.test(allThem))                  return "active_order";
    return "general";
  }

  const SITUATION_GUIDE = {
    complaint:       "IMPORTANT: The client is upset. Open with a genuine apology, acknowledge their specific concern, and offer a clear resolution. Be calm and empathetic — never defensive.",
    revision:        "The client wants changes. Acknowledge their feedback positively, confirm you understand exactly what to change, and give a brief timeline.",
    delay_complaint: "The client is frustrated about a delay. Apologize briefly, give a clear status update and specific ETA. Be direct and reassuring.",
    support:         "The client has a technical issue. Confirm you understand the problem, explain what you will do to fix it or what info you need from them.",
    pricing:         "The client is asking about pricing. Be confident about your rates and focus on value delivered. Do not volunteer discounts.",
    timeline:        "The client is asking about delivery timeline. Give a specific realistic timeframe. Be confident and clear.",
    praise:          "The client is happy. Thank them warmly and briefly. Reinforce the good relationship. Keep it genuine and short.",
    new_inquiry:     "This is a new potential client. Be welcoming and answer their question directly. Show genuine interest in their project. Don't over-sell.",
    active_order:    "This is an ongoing project. Be concise and informative. Update them on status if relevant.",
    hold:            "The client is pausing or needs time to think. Acknowledge gracefully, confirm you'll wait for them, keep it brief. Don't push or add pressure.",
    general:         "",
  };

  // ── 2. Intent extraction (client-side) ────────────────────────────────────
  function extractIntent(chatMsgs) {
    const lastThem = chatMsgs.filter(m => m.role === "them").pop()?.content || "";
    const lo = lastThem.toLowerCase();
    const intents = [];
    if (/\?/.test(lastThem))                                           intents.push("asking a question");
    if (/price|cost|budget|how much/.test(lo))                         intents.push("pricing inquiry");
    if (/when|how long|deadline|timeline|deliver/.test(lo))            intents.push("timeline inquiry");
    if (/send|share|show|provide|attach|give me/.test(lo))             intents.push("requesting files or info");
    if (/example|sample|portfolio|past work|similar work/.test(lo))    intents.push("asking for examples");
    if (/revise|change|update|fix|redo|adjust/.test(lo))               intents.push("revision request");
    if (/can you|could you|please|would you/.test(lo))                 intents.push("making a request");
    return intents.join(", ") || "general message";
  }

  // ── 3. Client tone mirroring ──────────────────────────────────────────────
  function analyzeTone(chatMsgs) {
    const themMsgs = chatMsgs.filter(m => m.role === "them").slice(-5);
    if (!themMsgs.length) return "";
    const allText  = themMsgs.map(m => m.content).join(" ");
    const words    = allText.split(/\s+/).filter(Boolean);
    const sents    = allText.split(/[.!?]+/).filter(s => s.trim().length > 2);
    const avgLen   = sents.length ? words.length / sents.length : 10;
    const informal = /\b(hey|hi|lol|btw|fyi|gonna|wanna|yeah|yep|ok|okay|thx|ur\b|u |r )\b/i.test(allText);
    const formal   = /\b(dear|sincerely|regards|respectfully|pursuant|hereby|kindly)\b/i.test(allText);
    const emojis   = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]/u.test(allText);
    const notes    = [];
    if (formal)         notes.push("formal and professional");
    else if (informal)  notes.push("casual and informal");
    if (avgLen < 7)     notes.push("brief short sentences");
    if (emojis)         notes.push("uses emojis");
    return notes.length ? `Mirror the client's style: they write in a ${notes.join(", ")} way.` : "";
  }

  function buildSmartReplyMessages(chatMsgs, draftText) {
    const lastThemMsg = [...chatMsgs].reverse().find(m => m.role === "them");
    const situation   = detectSituation(chatMsgs);
    const intent      = extractIntent(chatMsgs);
    const toneNote    = CFG.replyTone === "auto" ? analyzeTone(chatMsgs) : "";

    let timeNote = "";
    if (lastThemMsg?.timestamp) {
      const mins = (Date.now() - lastThemMsg.timestamp.getTime()) / 60000;
      if (mins >= 120) {
        const hrs = Math.round(mins / 60);
        timeNote = `Client's message was sent ~${hrs}h ago — briefly acknowledge the wait.`;
      }
    }

    const recentMsgs = chatMsgs.slice(-6);
    const fmtDate = (ts) => ts ? ts.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
    const lines = recentMsgs.map(m => {
      const who  = m.role === "me" ? "You" : "Them";
      const date = fmtDate(m.timestamp);
      return date ? `[${date}] ${who}: ${m.content}` : `${who}: ${m.content}`;
    }).join("\n");

    const lastClientMsg = lastThemMsg?.content || "";
    const clientWords   = lastClientMsg.trim().split(/\s+/).filter(Boolean).length;

    let lengthGuide, maxTokens;
    if (CFG.replyLength === "short") {
      lengthGuide = "Reply in 1 short sentence only.";
      maxTokens   = 50;
    } else if (CFG.replyLength === "detailed") {
      lengthGuide = "Reply in 3–4 sentences covering all points thoroughly.";
      maxTokens   = 260;
    } else {
      // Proportional: target ~55% of client word count, clamped 6–160 words
      const target = clientWords > 0 ? Math.max(6, Math.round(clientWords * 0.55)) : 12;
      const lo     = Math.max(4,   Math.round(target * 0.8));
      const hi     = Math.min(160, Math.round(target * 1.2));
      maxTokens    = Math.max(40, Math.round(hi * 1.7));
      if (clientWords <= 3) {
        // Ultra-short ("Okay", "ok", "sure") — one sentence max
        lengthGuide = `STRICT: Reply in 1 very short sentence, maximum 8 words. Client said only "${lastClientMsg.trim()}" — match that brevity.`;
        maxTokens   = 40;
      } else {
        lengthGuide = `Reply in ${lo}–${hi} words. Client wrote ~${clientWords} words — your reply MUST be shorter than theirs.`;
      }
    }

    let toneGuide = "";
    if (CFG.replyTone === "professional") toneGuide = "Use a formal professional tone.";
    else if (CFG.replyTone === "friendly") toneGuide = "Use a warm friendly tone.";
    else if (CFG.replyTone === "casual")   toneGuide = "Use a casual relaxed tone.";

    let portfolioNote = "";
    try {
      const matcher = typeof window !== "undefined" && window.TE_PORTFOLIO_MATCH;
      if (matcher) {
        const scanText = [lastClientMsg, ...chatMsgs.slice(-3).map(m => m.content)].join(" ");
        const matches = matcher(scanText, 3);
        if (matches?.length) {
          const list = matches.map(m => `• ${m.desc} — ${m.url}`).join("\n");
          portfolioNote = `\n\n[Portfolio — include 1-2 links ONLY if client is explicitly asking about similar past work. Otherwise ignore.]\n${list}`;
        }
      }
    } catch (_) {}

    const todayStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const system = [
      `Today is ${todayStr} (context only — do NOT mention dates in reply).`,
      `You are writing as "You" directly responding to "Them".`,
      SITUATION_GUIDE[situation],
      `Client's intent: ${intent}.`,
      toneGuide || toneNote,
      lengthGuide,
      timeNote,
      `Do NOT repeat what You already said. Do NOT add greetings unless this is the very first message. Output ONLY the reply text.`,
      portfolioNote,
    ].filter(Boolean).join(" ");

    const userContent = lines
      ? `Conversation:\n${lines}${draftText ? `\n\nDraft: ${draftText}` : ""}\n\nWrite You's reply:`
      : draftText
        ? `Draft: "${draftText}"\nImprove and complete this reply.`
        : "Write a brief opening reply.";

    return { system, userContent, maxTokens };
  }

  // ── 4. Smart Reply with live streaming into the input ────────────────────
  async function runSmartReply(el) {
    if (!el) return;

    const s = getSrBtn();
    const origIcon = s.textContent;
    s.style.pointerEvents = "none";

    const draftText = getText(el).trim();
    const chatMsgs  = extractChatHistory(el);

    if (chatMsgs.length > 0 && chatMsgs[chatMsgs.length - 1].role === "me") {
      s.textContent = "✓";
      setTimeout(() => { s.textContent = origIcon; s.style.pointerEvents = ""; }, 1500);
      return;
    }

    const { system, userContent, maxTokens } = buildSmartReplyMessages(chatMsgs, draftText);

    if (draftText) {
      undoStack.push({ el, text: draftText });
      if (undoStack.length > 5) undoStack.shift();
    }

    s.textContent = "✍";
    srStreaming    = true;
    let raw        = "";

    const result = await new Promise((resolve, reject) => {
      let port;
      try { port = runtimeConnect("te-stream"); }
      catch (e) { reject(new Error("Reload page and retry: " + e.message)); return; }

      let settled = false;
      const done = (val) => { if (settled) return; settled = true; port.disconnect(); resolve(val); };
      const fail  = (err) => { if (settled) return; settled = true; port.disconnect(); reject(err);  };
      const timer = setTimeout(() => fail(new Error("Timed out — retry")), 60000);

      port.onMessage.addListener((msg) => {
        if (msg.error) { clearTimeout(timer); fail(new Error(parseError(msg.error))); return; }
        if (msg.token) {
          raw += msg.token;
          const preview = cleanLeft(raw);
          if (preview) setTextLive(el, preview); // stream tokens directly into the input
        }
        if (msg.done) { clearTimeout(timer); done(clean(raw)); }
      });

      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message;
        clearTimeout(timer);
        if (!settled) fail(new Error(err ? parseError(err) : "Port closed — reload page and retry"));
      });

      port.postMessage({
        messages: [
          { role: "system", content: system },
          { role: "user",   content: userContent },
        ],
        options: { temperature: 0.6, num_predict: maxTokens },
      });
    }).catch(err => {
      srStreaming = false;
      s.textContent = "⚠";
      s.style.pointerEvents = "";
      if (raw) setTextLive(el, clean(raw)); // keep whatever streamed so far
      else if (draftText) setTextLive(el, draftText); // restore draft on full failure
      setTimeout(() => { s.textContent = origIcon; }, 2000);
      return null;
    });

    srStreaming = false;

    if (result) {
      setText(el, result);
      lastSuggestInput = result; // prevent auto-suggest from re-triggering on SR output
      trackUsage("smartreply");
      scheduleFollowUp(el);
    }

    s.textContent = origIcon;
    s.style.pointerEvents = "";
  }

  // ── Action ────────────────────────────────────────────────────────────────

  async function runAction(type) {
    const el = focused || lastFocused;
    const text = getText(el).trim();
    if (!text) return;

    const t = getToolbar();
    const btn = t.querySelector(`[data-type="${type}"]`);
    if (!btn) return;
    t.querySelectorAll(".te-action-btn").forEach(b => (b.disabled = true));
    btn.innerHTML = '<span class="te-btn-icon">⏳</span><span>Working…</span>';

    try {
      const result = await callOllama(text, type);
      undoStack.push({ el, text });
      if (undoStack.length > 5) undoStack.shift();
      setText(el, result);
      resetToolbarBtns();
      trackUsage(type);
    } catch (err) {
      resetToolbarBtns();
      const errBtn = t.querySelector(`[data-type="${type}"]`);
      if (errBtn) {
        errBtn.innerHTML = "";
        const ic = document.createElement("span"); ic.className = "te-btn-icon"; ic.textContent = "⚠️";
        const lb = document.createElement("span"); lb.textContent = err.message;
        errBtn.appendChild(ic); errBtn.appendChild(lb);
      }
      setTimeout(resetToolbarBtns, 2500);
    }
  }

  function trackUsage(type) {
    const host = window.location.hostname;
    if (!siteUsage[host]) siteUsage[host] = {};
    siteUsage[host][type] = (siteUsage[host][type] || 0) + 1;
    try { chrome.storage.local.set({ te_site_usage: siteUsage }); } catch (_) {}
  }

  // ── Typing detection & auto-suggest ──────────────────────────────────────

  let typingTimer  = null;
  let suggestTimer = null;

  function handleTyping(el) {
    if (!isEditable(el)) return;
    if (srStreaming) return; // don't interfere while smart reply is streaming
    focused = el; lastFocused = el;

    clearTimeout(typingTimer);
    clearTimeout(suggestTimer);

    const text = getText(el).trim();

    // Only dismiss suggestion if text changed — prevents MutationObserver spurious
    // fires (page JS touching the contenteditable) from hiding an active suggestion
    const suggestVisible = suggest && suggest.style.display !== "none";
    if (!suggestVisible || text !== originalForDiff) hideSuggest();

    positionToolbar(el);

    // Auto-suggest: only when site is enabled, text is long enough, and there's a detectable error
    if (CFG.autoSuggest && !siteDisabled && text.length >= CFG.minLength && text !== lastSuggestInput && !shouldSkip(text) && typoScore(text) > 0) {
      suggestTimer = setTimeout(() => {
        if (focused !== el) return;
        if (isRateLimited()) { showSuggestLoading(el, "suggest"); showSuggestResult(rateLimitMsg()); setTimeout(hideSuggest, 2500); return; }
        const current = getText(el).trim();
        if (current.length < CFG.minLength || current === lastSuggestInput || shouldSkip(current)) return;

        const myId   = ++suggestGenId;
        const action = pickAction(current);
        lastSuggestInput = current;
        originalForDiff  = current;
        showSuggestLoading(el, action);

        streamPort?.disconnect();
        streamPort = streamOllama(
          current,
          action,
          (preview) => { // called each token
            if (suggestGenId !== myId) return;
            showSuggestResult(preview);
          },
          (final) => {   // called when complete
            if (suggestGenId !== myId) return;
            if (final && !tooSimilar(current, final)) showSuggestResult(final);
            else hideSuggest();
          },
          (errMsg) => {  // error
            if (suggestGenId !== myId) return;
            if (errMsg && errMsg.startsWith("Rate limited")) {
              showSuggestResult(errMsg);
              setTimeout(hideSuggest, 3000);
            } else {
              hideSuggest();
            }
          }
        );
      }, Number(CFG.suggestDelay) || 1500);
    }
  }

  function onInput(e) {
    const target = e?.target || document.activeElement;
    if (!isEditable(target)) return;
    handleTyping(target);
  }

  // listen on input + keyup + paste + compositionend
  // keyup is a fallback for Brave which sometimes doesn't fire 'input' on contenteditable
  document.addEventListener("input",          onInput);
  document.addEventListener("keyup",          (e) => {
    // Brave: catch all keys that could change text content
    const ignore = ["Shift","Control","Alt","Meta","CapsLock","Tab","Escape",
                    "ArrowLeft","ArrowRight","ArrowUp","ArrowDown",
                    "Home","End","PageUp","PageDown","F1","F2","F3","F4",
                    "F5","F6","F7","F8","F9","F10","F11","F12"];
    if (!ignore.includes(e.key)) onInput(e);
  });
  document.addEventListener("paste",          (e) => setTimeout(() => onInput(e), 50));
  document.addEventListener("compositionend", onInput);

  // Brave fallback: click also triggers toolbar in case focusin is suppressed
  document.addEventListener("click", (e) => {
    const el = e.target;
    if (!isEditable(el)) return;
    if (focused === el) return; // already handled by focusin
    focused = el; lastFocused = el;
    positionToolbar(el);
    watchFocusedEl(el);
  });

  // MutationObserver fallback: watch focused element's text content for changes
  // Catches Brave cases where neither input nor keyup fires
  let _inputObserver = null;
  function watchFocusedEl(el) {
    _inputObserver?.disconnect();
    if (!el || !el.isContentEditable) return;
    let _lastText = getText(el).trim();
    _inputObserver = new MutationObserver(() => {
      const t = getText(el).trim();
      if (t !== _lastText) { _lastText = t; handleTyping(el); }
    });
    _inputObserver.observe(el, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener("focusin", (e) => {
    if (!isEditable(e.target)) return;
    focused = e.target; lastFocused = e.target;
    positionToolbar(e.target);
    watchFocusedEl(e.target);
  });

  document.addEventListener("focusout", (e) => {
    _inputObserver?.disconnect(); _inputObserver = null;
    setTimeout(() => {
      const active = document.activeElement;
      if (
        (toolbar  && toolbar.contains(active))  ||
        (suggest  && suggest.contains(active))  ||
        isEditable(active)
      ) return;
      hideToolbar();
      hideSuggest();
      clearTimeout(suggestTimer);
      focused = null;
    }, 200);
  });

  window.addEventListener("scroll", () => {
    if (focused) { positionToolbar(focused); positionSuggest(focused); }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (focused) { positionToolbar(focused); positionSuggest(focused); }
  }, { passive: true });

  document.addEventListener("mousedown", (e) => {
    if (toolbar && toolbar.contains(e.target)) return;
    if (suggest && suggest.contains(e.target)) return;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resetToolbarBtns();
      hideSuggest();
      clearTimeout(typingTimer);
      clearTimeout(suggestTimer);
    }
    if (e.key === "Tab" && suggest && suggest.style.display !== "none" && suggestText) {
      e.preventDefault();
      applySuggestion();
    }
  });

  // ── Response timer ───────────────────────────────────────────────────────
  function fmtWait(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1)   return "< 1m";
    if (m < 60)  return `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60;
    return rm ? `${h}h ${rm}m` : `${h}h`;
  }

  function startResponseTimer(chatMsgs) {
    clearInterval(responseTimerInt);
    const s = srBtn;
    if (!s) return;

    // Only show timer if the LAST message is from the client — not from me
    const lastMsg = chatMsgs[chatMsgs.length - 1];
    if (!lastMsg || lastMsg.role !== "them" || !lastMsg.timestamp) {
      s.title = "Smart Reply";
      s.style.borderColor = "#444";
      return;
    }

    const update = () => {
      const waited = Date.now() - lastMsg.timestamp.getTime();
      const label  = fmtWait(waited);
      s.title = `Smart Reply — client waiting ${label}`;
      // Colour: green < 1h, amber 1–3h, red > 3h
      if (waited < 3600000)       s.style.borderColor = "#2ea043";
      else if (waited < 10800000) s.style.borderColor = "#e3a008";
      else                        s.style.borderColor = "#cf222e";
    };
    update();
    responseTimerInt = setInterval(update, 60000);
  }

  // ── Mood detector ────────────────────────────────────────────────────────
  function detectMood(chatMsgs) {
    const recent = chatMsgs.filter(m => m.role === "them").slice(-3).map(m => m.content.toLowerCase()).join(" ");
    if (/urgent|asap|immediately|right now|waiting|still|how long|when will|days? ago|hours? ago|\?\?\?|\?\?/.test(recent)) return "urgent";
    if (/disappointed|frustrated|unacceptable|terrible|awful|worst|refund|cancel|scam|fake|report/.test(recent)) return "angry";
    if (/thank|great|perfect|amazing|love|awesome|excellent|well done|good job/.test(recent)) return "happy";
    return "neutral";
  }

  const MOOD_ICON = { urgent: "⚡", angry: "🔴", happy: "🟢", neutral: "💬" };

  // ── Smart templates ──────────────────────────────────────────────────────
  function saveTemplate(text) {
    const label = text.slice(0, 40) + (text.length > 40 ? "…" : "");
    templates = [{ label, text }, ...templates.filter(t => t.text !== text)].slice(0, 10);
    try { chrome.storage.local.set({ te_templates: templates }); } catch (_) {}
  }

  function matchTemplates(chatMsgs) {
    if (!templates.length) return [];
    const last = chatMsgs.filter(m => m.role === "them").pop()?.content?.toLowerCase() || "";
    return templates.filter(t => {
      const words = last.split(/\s+/).filter(w => w.length > 4);
      return words.some(w => t.text.toLowerCase().includes(w));
    }).slice(0, 3);
  }

  // ── Follow-up reminder ───────────────────────────────────────────────────
  function scheduleFollowUp(el) {
    clearTimeout(followUpTimer);
    // If no reply from client in 24h, remind user to follow up
    followUpTimer = setTimeout(() => {
      if (Notification.permission === "granted") {
        new Notification("Follow-up reminder", {
          body: "No reply yet — consider sending a follow-up message.",
          icon: "https://www.fiverr.com/favicon.ico",
        });
      }
    }, 24 * 60 * 60 * 1000);
  }

  // ── Conversation summary ─────────────────────────────────────────────────
  async function runSummary(el) {
    const chatMsgs = extractChatHistory(el);
    if (!chatMsgs.length) return;
    const lines = chatMsgs.map(m => `${m.role === "me" ? "You" : "Them"}: ${m.content}`).join("\n");

    const s = getSrBtn();
    const orig = s.textContent;
    s.textContent = "⏳"; s.style.pointerEvents = "none";

    const result = await new Promise((resolve, reject) => {
      let port;
      try { port = runtimeConnect("te-stream"); }
      catch (e) { reject(e); return; }
      let raw = ""; let settled = false;
      const done = v => { if (!settled) { settled = true; port.disconnect(); resolve(v); } };
      const fail = e => { if (!settled) { settled = true; port.disconnect(); reject(e); } };
      const timer = setTimeout(() => fail(new Error("Timeout")), 30000);
      port.onMessage.addListener(msg => {
        if (msg.error) { clearTimeout(timer); fail(new Error(parseError(msg.error))); return; }
        if (msg.token) raw += msg.token;
        if (msg.done)  { clearTimeout(timer); done(clean(raw)); }
      });
      port.onDisconnect.addListener(() => { clearTimeout(timer); if (!settled) fail(new Error("Disconnected")); });
      port.postMessage({
        messages: [
          { role: "system", content: "Summarize this conversation in 3 concise bullet points. Output ONLY the bullets, no intro." },
          { role: "user",   content: lines },
        ],
        options: { temperature: 0.3, num_predict: 200 },
      });
    }).catch(() => null);

    s.textContent = orig; s.style.pointerEvents = "";

    if (result) {
      // Show summary in a small overlay
      const overlay = document.createElement("div");
      overlay.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        background:#1e1e1e;color:#e0e0e0;border:1px solid #444;border-radius:10px;
        padding:16px 20px;max-width:400px;width:90%;z-index:2147483647;font-size:13px;
        line-height:1.6;box-shadow:0 8px 32px rgba(0,0,0,0.6);white-space:pre-wrap;font-family:inherit;`;
      const title = document.createElement("div");
      title.style.cssText = "font-weight:600;margin-bottom:8px;color:#7ab3e0";
      title.textContent = "📋 Conversation Summary";
      const body = document.createElement("div");
      body.textContent = result;
      const footer = document.createElement("div");
      footer.style.cssText = "text-align:right;margin-top:12px";
      const closeBtn = document.createElement("button");
      closeBtn.style.cssText = "background:#333;border:1px solid #555;color:#ccc;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px";
      closeBtn.textContent = "Close";
      footer.appendChild(closeBtn);
      overlay.appendChild(title); overlay.appendChild(body); overlay.appendChild(footer);
      document.documentElement.appendChild(overlay);
      closeBtn.addEventListener("mousedown", () => overlay.remove());
      setTimeout(() => overlay.remove(), 15000);
    }
  }

  // ── Away mode auto-reply ─────────────────────────────────────────────────
  function toggleAwayMode(el) {
    awayMode = !awayMode;
    const s = getSrBtn();
    s.style.background = awayMode ? "#4a1e6e" : "#1e1e1e";
    s.title = awayMode ? "Smart Reply (Away Mode ON — auto-replying)" : "Smart Reply";
    if (awayMode && Notification.permission === "granted") {
      new Notification("Away Mode ON", { body: "Text Enhancer will auto-generate replies when clients message you." });
    }
  }

  // ── New message detector ─────────────────────────────────────────────────
  // Watch the DOM for new incoming messages and pulse the SR button
  let lastSeenMsgCount = 0;
  let newMsgObserver   = null;

  function startNewMessageWatcher(inputEl) {
    if (newMsgObserver) { newMsgObserver.disconnect(); newMsgObserver = null; }

    // Walk up to find the scrollable chat container
    let container = inputEl?.parentElement;
    for (let i = 0; i < 20; i++) {
      if (!container || container === document.body) break;
      if (container.scrollHeight > container.clientHeight + 100 && container.children.length > 2) break;
      container = container.parentElement;
    }
    if (!container || container === document.body) return;

    newMsgObserver = new MutationObserver(() => {
      const msgs     = extractChatHistory(inputEl);
      const themMsgs = msgs.filter(m => m.role === "them").length;

      // Update response timer + mood on every DOM change
      startResponseTimer(msgs);
      const mood = detectMood(msgs);
      const s    = getSrBtn();
      if (s) s.textContent = MOOD_ICON[mood] || "💬";

      if (themMsgs > lastSeenMsgCount && lastSeenMsgCount > 0) {
        // New message from client — pulse the SR button
        if (s && s.style.display !== "none") {
          s.style.animation   = "te-pulse 0.6s ease 3";
          s.style.background  = awayMode ? "#4a1e6e" : "#1a6e3c";
          setTimeout(() => {
            s.style.animation  = "";
            s.style.background = awayMode ? "#4a1e6e" : "#1e1e1e";
          }, 2000);
        }
        // Desktop notification
        if (Notification.permission === "granted") {
          const last = msgs.filter(m => m.role === "them").pop();
          const body = last?.content?.slice(0, 80) || "Client sent a message";
          const mood2 = detectMood(msgs);
          const prefix = mood2 === "urgent" ? "⚡ Urgent: " : mood2 === "angry" ? "🔴 " : "";
          new Notification("New message on Fiverr", {
            body: prefix + body,
            icon: "https://www.fiverr.com/favicon.ico",
            silent: false,
          });
        }
        // Away mode: auto-generate reply
        if (awayMode) runSmartReply(inputEl);
      }

      lastSeenMsgCount = themMsgs;
    });

    newMsgObserver.observe(container, { childList: true, subtree: true });
  }

  // Request notification permission only on Fiverr, and only when user interacts
  if (Notification.permission === "default" && window.location.hostname.includes("fiverr.com")) {
    document.addEventListener("click", function reqNotif() {
      Notification.requestPermission();
      document.removeEventListener("click", reqNotif);
    }, { once: true });
  }

  // Start watcher + timer + mood when an editable field is focused
  document.addEventListener("focusin", (e) => {
    if (!isEditable(e.target)) return;
    const msgs = extractChatHistory(e.target);
    lastSeenMsgCount = msgs.filter(m => m.role === "them").length;
    startResponseTimer(msgs);
    const mood = detectMood(msgs);
    const s = getSrBtn();
    if (s) s.textContent = MOOD_ICON[mood] || "💬";
    startNewMessageWatcher(e.target);
  });

  // ── Warmup: ask background to load the model so first real request is instant
  setTimeout(() => {
    try {
      runtimeSendMessage({
        type: "ollama",
        payload: {
          model: MODEL,
          stream: false,
          messages: [{ role: "user", content: "." }],
          options: { num_predict: 1, num_ctx: 256, keep_alive: -1 },
        },
      }, () => { chrome.runtime?.lastError; });
    } catch (_) {}
  }, 3000);

})();
