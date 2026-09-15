(function () {
  "use strict";

  // Don't run inside our own extension pages
  if (window.location.protocol === "chrome-extension:") return;

  const MODEL = "openai/gpt-oss-120b";

  const ICONS = {
    rewrite:      `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>`,
    proofread:    `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>`,
    professional: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 1A1.5 1.5 0 0 0 5 2.5V3H1.5A1.5 1.5 0 0 0 0 4.5v1.384l7.614 2.03a1.5 1.5 0 0 0 .772 0L16 5.884V4.5A1.5 1.5 0 0 0 14.5 3H11v-.5A1.5 1.5 0 0 0 9.5 1h-3zm0 1h3a.5.5 0 0 1 .5.5V3H6v-.5a.5.5 0 0 1 .5-.5z"/><path d="M0 12.5A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V6.85L8.129 8.947a.5.5 0 0 1-.258 0L0 6.85v5.65z"/></svg>`,
    shorten:      `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 3.5c-.614-.884-.074-1.962.858-2.5L8 7.226 11.642 1c.932.538 1.472 1.616.858 2.5L8.81 8H16v2H8.002l.03.03 4.987 5.5H11.82l-3.82-4.221L4.18 15.53H2.833L7.82 10.03 8.002 10H0V8h7.19L3.5 3.5z"/></svg>`,
    clean:        `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828l6.879-6.879zm.66 11.34L3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293l.16-.16z"/></svg>`,
    siteOn:       `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M7 5H3a3 3 0 0 0 0 6h4a4.995 4.995 0 0 1-.584-1H3a2 2 0 1 1 0-4h3.416c.156-.357.352-.692.584-1z"/><path d="M16 8A5 5 0 1 1 6 8a5 5 0 0 1 10 0z"/></svg>`,
    siteOff:      `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M9 5H5a5 5 0 0 0 0 10h4a4.994 4.994 0 0 0 2.584-1H5a4 4 0 1 1 0-8h6.584A4.992 4.992 0 0 0 9 5z"/></svg>`,
    chevron:      `<svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.646 6.646a.5.5 0 0 1 .708 0L8 9.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z"/></svg>`,
  };

  const ACTIONS = [
    { label: "Rewrite",      type: "rewrite",      icon: ICONS.rewrite,      desc: "Rephrase with different wording, same meaning" },
    { label: "Proofread",    type: "proofread",    icon: ICONS.proofread,    desc: "Fix grammar, spelling and punctuation" },
    { label: "Professional", type: "professional", icon: ICONS.professional, desc: "Rewrite in formal business tone" },
    { label: "Shorten",      type: "shorten",      icon: ICONS.shorten,      desc: "Cut filler words, keep every point" },
    { label: "Clean",        type: "clean",        icon: ICONS.clean,        desc: "Remove formatting noise and extra spaces" },
  ];

  const SHOTS = {
    enhance: [], rewrite: [], proofread: [], professional: [], shorten: [], clean: [],
  };

  // ── Live settings (synced in real-time via storage.onChanged) ───────────
  const CFG = {
    autoSuggest:     true,
    suggestDelay:    1000,
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
    modelSelect:     "openai/gpt-oss-120b",
    temperature:     3,
    modelBackend:    "groq",
  };

  function applySettings(s) {
    if (!s) return;
    Object.assign(CFG, s);
    if (srBtn)   srBtn.style.display   = CFG.srEnabled && isChatSite() && (focused || lastFocused) ? "flex" : "none";
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
    enhance:      "You are Mindscribe AI, an intelligent adaptive writing enhancer. Analyze the text in <input> tags and enhance it:\n1. TONE ADAPTATION: If the text is casual or friendly (e.g., informal chats, greetings like 'hey', 'bro', emojis), preserve that casual, warm, conversational tone — NEVER make it sound stiff, robotic, or overly corporate. If the text is professional, business, or formal (e.g., work emails, client inquiries, greetings like 'Hello', 'Dear'), make it articulate, polished, crisp, and professional.\n2. ERROR CORRECTION: Fix all spelling errors, typos, grammatical mistakes, missing punctuation, and capitalization.\n3. NATURAL POLISH: Improve clarity and flow while keeping the author's original meaning and authentic voice.\n4. FORMAT: Preserve the exact paragraph structure and blank lines. Output ONLY the enhanced text. Do NOT include <input> tags, quotes, or explanations.",
    rewrite:      "Rephrase the text in <input> tags using different wording. Keep the same meaning, length, and speaker perspective. IMPORTANT: Preserve the exact paragraph structure — keep blank lines between paragraphs exactly as in the original. Output ONLY the rewritten text. Do NOT include <input> tags or any explanation.",
    proofread:    "Fix all grammar, spelling, and punctuation in the text in <input> tags. Do not change wording or style. IMPORTANT: Preserve the exact paragraph structure — keep blank lines between paragraphs exactly as in the original. Output ONLY the corrected text without <input> tags and without any explanation.",
    shorten:      "Shorten the text in <input> tags. Keep ALL points and information — only remove filler and redundancy. Keep the speaker's voice. IMPORTANT: Preserve the paragraph structure — keep blank lines between paragraphs. Output ONLY the shortened text. Do NOT include <input> tags or any explanation.",
    professional: "Rewrite the text in <input> tags to sound formal and professional. Keep the same meaning, the same number of sentences, and the same length — do not add new sentences or new content. IMPORTANT: Preserve the exact paragraph structure — keep blank lines between paragraphs exactly as in the original. Output ONLY the rewritten text. Do NOT include <input> tags or any explanation.",
    clean:        "Clean up the text in <input> tags that was copied from a terminal or chat. Remove extra whitespace, alignment padding, and separator lines (lines made only of dashes, equals signs, or underscores). IMPORTANT: Keep blank lines between paragraphs — do NOT merge paragraphs together. Keep ALL message content word-for-word — do not rephrase, summarize, or alter any wording. Output ONLY the cleaned text.",
  };

  // Shorter, stricter prompts for small local Ollama models which ignore long instructions
  const SYSTEM_MSG_OLLAMA = {
    enhance:      "Fix all typos, spelling, and grammar in <input> tags. If casual, keep it casual and friendly. If formal, make it professional. Output ONLY the corrected text without explanations.",
    rewrite:      "Rewrite the text inside <input> tags using different words. Same meaning, same length. Output ONLY the rewritten text, nothing else.",
    proofread:    "Fix ONLY spelling and punctuation errors in the text inside <input> tags. Do NOT rephrase, reword, or change any words. Do NOT add or remove content. Output ONLY the corrected text.",
    shorten:      "Remove filler words from the text inside <input> tags to make it shorter. Keep ALL the original information and every key word. Output ONLY the shortened text.",
    professional: "Rewrite the text inside <input> tags to sound more formal. Same meaning, same length. Output ONLY the rewritten text.",
    clean:        "Remove separator lines (---, ===) and extra spaces from the text inside <input> tags. Keep all words exactly as written. Output ONLY the cleaned text.",
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

  function isChatSite() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // Fiverr — inbox/conversation pages only
    if (host.includes("fiverr.com"))
      return /\/(inbox|conversation|messaging)(\/|$)/i.test(path);

    // WhatsApp Web — entire site is the messaging UI
    if (host === "web.whatsapp.com") return true;

    // LinkedIn — messaging section only
    if (host.includes("linkedin.com"))
      return /^\/(messaging|msg)(\/|$)/i.test(path);

    // Telegram Web — entire site is the messaging UI
    if (host === "web.telegram.org" || host === "k.telegram.org" || host === "z.telegram.org")
      return true;

    // Messenger — individual thread pages only
    if (host.includes("messenger.com"))
      return /^\/t\//i.test(path);

    // Instagram — direct messages only
    if (host.includes("instagram.com"))
      return /^\/direct\//i.test(path);

    // Discord — channel or DM pages only
    if (host.includes("discord.com"))
      return /^\/(channels|@me)(\/|$)/i.test(path);

    // Slack — main app interface
    if (host.includes("app.slack.com")) return true;

    return false;
  }

  // Walk up to the topmost contenteditable ancestor.
  // LinkedIn (and others) fire focusin on a child <p>/<span> inside the composer,
  // not on the contenteditable root — this ensures we always work with the root.
  function editableRoot(el) {
    if (!el) return el;
    let node = el;
    while (node.parentElement && node.parentElement.isContentEditable) {
      node = node.parentElement;
    }
    return node;
  }

  function isEditable(el) {
    if (!el) return false;
    const id = el.id;
    if (id === "te-toolbar" || id === "te-suggest" || id === "te-caret-mirror") return false;
    if (el.closest && el.closest("#te-suggest, #te-toolbar, #te-caret-mirror")) return false;
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

      // Restore cursor to end so backspace works immediately
      const sel = window.getSelection();
      const endRange = document.createRange();
      endRange.selectNodeContents(el);
      endRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(endRange);
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

  function makeActionBtn({ label, type, icon, desc }) {
    const btn = document.createElement("button");
    btn.className = "te-action-btn";
    btn.dataset.type = type;
    btn.title = desc || label;
    const iconEl = document.createElement("span");
    iconEl.className = "te-btn-icon";
    iconEl.innerHTML = icon;
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    btn.appendChild(iconEl);
    btn.appendChild(labelEl);
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      runAction(type);
    });
    return btn;
  }

  function getToolbar() {
    if (toolbar) return toolbar;
    toolbar = document.createElement("div");
    toolbar.id = "te-toolbar";

    // Smart Icon-Only Logo Toggle
    const smartBtn = document.createElement("button");
    smartBtn.id = "te-smart-btn";
    smartBtn.className = "te-smart-btn";
    smartBtn.dataset.type = "enhance";
    smartBtn.title = "Mindscribe AI — Click to enhance text";

    const logoImg = document.createElement("img");
    logoImg.className = "te-btn-logo";
    try {
      logoImg.src = chrome.runtime.getURL("icons/icon48.png");
    } catch (_) {
      logoImg.src = "icons/icon48.png";
    }
    logoImg.alt = "Mindscribe AI";

    smartBtn.appendChild(logoImg);

    smartBtn.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      runAction("enhance");
    });
    smartBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    toolbar.appendChild(smartBtn);

    // Drag to reposition (temporary manual adjustment)
    let tDrag = null;
    let tMoved = false;
    toolbar.addEventListener("mousedown", (e) => {
      if (e.target.closest("#te-smart-btn")) return; // don't drag when clicking the button
      e.preventDefault();
      const r = toolbar.getBoundingClientRect();
      tDrag  = { ox: e.clientX - r.left, oy: e.clientY - r.top };
      tMoved = false;
      toolbar.style.cursor = "grabbing";
      toolbar.classList.add("te-dragging");
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
      toolbar.classList.remove("te-dragging");
    });

    // Clear any previously saved static position so toolbar dynamically follows text
    try { chrome.storage.local.remove("te_toolbar_pos"); } catch (_) {}

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
      width:32px;height:32px;align-items:center;justify-content:center;
      background:rgba(13,13,13,0.97);color:#fff;font-size:15px;border-radius:50%;
      cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06);
      user-select:none;border:1px solid rgba(255,255,255,0.1);
      transition:background 0.15s,transform 0.1s,box-shadow 0.15s;
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    `;
    srBtn.addEventListener("mouseenter", () => { if (!awayMode) { srBtn.style.background = "rgba(108,71,255,0.2)"; srBtn.style.borderColor = "rgba(108,71,255,0.4)"; srBtn.style.transform = "scale(1.1)"; } });
    srBtn.addEventListener("mouseleave", () => { if (!awayMode) { srBtn.style.background = "rgba(13,13,13,0.97)"; srBtn.style.borderColor = "rgba(255,255,255,0.1)"; srBtn.style.transform = ""; } });
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
        model: CFG.modelSelect || MODEL,
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

  // ── Caret & Cursor Coordinate Tracking ────────────────────────────────────

  const CARET_STYLE_PROPS = [
    "direction", "boxSizing", "fontFamily", "fontSize", "fontSizeAdjust",
    "fontStretch", "fontStyle", "fontVariant", "fontWeight", "letterSpacing",
    "lineHeight", "textAlign", "textDecoration", "textIndent", "textTransform",
    "wordBreak", "wordSpacing", "wordWrap", "overflowWrap", "tabSize"
  ];

  let caretMirror = null;
  function getCaretMirror() {
    if (caretMirror && caretMirror.parentNode) return caretMirror;
    caretMirror = document.createElement("div");
    caretMirror.id = "te-caret-mirror";
    caretMirror.style.cssText = `
      position: absolute !important;
      top: -99999px !important;
      left: -99999px !important;
      visibility: hidden !important;
      pointer-events: none !important;
      z-index: -9999 !important;
    `;
    (document.body || document.documentElement).appendChild(caretMirror);
    return caretMirror;
  }

  function getInputOrTextareaCaret(el) {
    if (!el) return null;
    const isInput = el.tagName === "INPUT";
    let pos = 0;
    try {
      pos = typeof el.selectionEnd === "number" ? el.selectionEnd : (el.value || "").length;
    } catch (_) {
      pos = (el.value || "").length;
    }

    const text = el.value || "";
    const textBefore = text.slice(0, pos);
    const textAfter  = text.slice(pos);

    const mirror = getCaretMirror();
    const style  = window.getComputedStyle(el);
    const rect   = el.getBoundingClientRect();

    mirror.style.boxSizing = style.boxSizing || "border-box";
    mirror.style.width = isInput ? "auto" : (rect.width + "px");
    mirror.style.height = "auto";
    mirror.style.whiteSpace = isInput ? "pre" : "pre-wrap";
    mirror.style.wordWrap = isInput ? "normal" : "break-word";
    mirror.style.overflowWrap = isInput ? "normal" : "break-word";

    for (let i = 0; i < CARET_STYLE_PROPS.length; i++) {
      const prop = CARET_STYLE_PROPS[i];
      mirror.style[prop] = style[prop];
    }
    mirror.style.paddingTop = style.paddingTop;
    mirror.style.paddingRight = style.paddingRight;
    mirror.style.paddingBottom = style.paddingBottom;
    mirror.style.paddingLeft = style.paddingLeft;
    mirror.style.borderTopWidth = style.borderTopWidth;
    mirror.style.borderRightWidth = style.borderRightWidth;
    mirror.style.borderBottomWidth = style.borderBottomWidth;
    mirror.style.borderLeftWidth = style.borderLeftWidth;
    mirror.style.borderStyle = style.borderStyle;

    mirror.textContent = textBefore;
    const marker = document.createElement("span");
    marker.style.cssText = "display:inline !important;padding:0 !important;margin:0 !important;border:0 !important;";
    if (textAfter.length > 0) {
      marker.textContent = textAfter[0];
    } else if (textBefore.endsWith("\n")) {
      marker.textContent = "\uFEFF";
    } else {
      marker.textContent = "\u200B";
    }
    mirror.appendChild(marker);
    if (textAfter.length > 1) {
      mirror.appendChild(document.createTextNode(textAfter.slice(1)));
    }

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    const relX = markerRect.left - mirrorRect.left;
    const relY = markerRect.top - mirrorRect.top;

    const caretX = rect.left + relX - (el.scrollLeft || 0);
    const caretY = rect.top + relY - (el.scrollTop || 0);
    const caretHeight = markerRect.height || parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.2) || 18;

    return {
      left: caretX,
      right: caretX,
      top: caretY,
      bottom: caretY + caretHeight,
      height: caretHeight
    };
  }

  function getContentEditableCaret(el) {
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    if (!el.contains(range.startContainer) && el !== range.startContainer) {
      return null;
    }

    // 1. Direct getClientRects
    try {
      const rects = range.getClientRects();
      if (rects && rects.length > 0) {
        const r = rects[rects.length - 1];
        if (r.top || r.bottom || r.left || r.right) {
          const h = r.height || (r.bottom - r.top) || 18;
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: h };
        }
      }
    } catch (_) {}

    // 2. getBoundingClientRect
    try {
      const b = range.getBoundingClientRect();
      if (b && (b.top || b.bottom || b.left || b.right)) {
        const h = b.height || (b.bottom - b.top) || 18;
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: h };
      }
    } catch (_) {}

    // 3. Sub-range character measurement (non-invasive)
    try {
      const node = range.startContainer;
      const offset = range.startOffset;
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.length > 0) {
        const subRange = document.createRange();
        if (offset > 0) {
          subRange.setStart(node, offset - 1);
          subRange.setEnd(node, offset);
          const sr = subRange.getClientRects();
          if (sr && sr.length > 0) {
            const r = sr[sr.length - 1];
            const h = r.height || (r.bottom - r.top) || 18;
            return { left: r.right, right: r.right, top: r.top, bottom: r.bottom, height: h };
          }
        } else {
          subRange.setStart(node, 0);
          subRange.setEnd(node, Math.min(1, node.nodeValue.length));
          const sr = subRange.getClientRects();
          if (sr && sr.length > 0) {
            const r = sr[0];
            const h = r.height || (r.bottom - r.top) || 18;
            return { left: r.left, right: r.left, top: r.top, bottom: r.bottom, height: h };
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
        const targetChild = node.childNodes[Math.max(0, offset - 1)];
        if (targetChild && targetChild.nodeType === Node.ELEMENT_NODE) {
          const cr = targetChild.getBoundingClientRect();
          if (cr.top || cr.bottom || cr.left || cr.right) {
            const h = cr.height || (cr.bottom - cr.top) || 18;
            return { left: cr.right, right: cr.right, top: cr.top, bottom: cr.bottom, height: h };
          }
        }
      }
    } catch (_) {}

    // 4. TreeWalker to find last text node
    try {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let lastNode = null;
      while (walker.nextNode()) {
        if (walker.currentNode.nodeValue && walker.currentNode.nodeValue.trim().length > 0) {
          lastNode = walker.currentNode;
        }
      }
      if (lastNode) {
        const r = document.createRange();
        r.selectNodeContents(lastNode);
        r.collapse(false);
        const rects = r.getClientRects();
        if (rects && rects.length > 0) {
          const lastRect = rects[rects.length - 1];
          const h = lastRect.height || (lastRect.bottom - lastRect.top) || 18;
          return { left: lastRect.right, right: lastRect.right, top: lastRect.top, bottom: lastRect.bottom, height: h };
        }
      }
    } catch (_) {}

    return null;
  }

  function getCaretCoordinates(el) {
    if (!el) return null;
    try {
      if (el.isContentEditable) return getContentEditableCaret(el);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return getInputOrTextareaCaret(el);
      if (document.activeElement && document.activeElement !== el && isEditable(document.activeElement)) {
        return getCaretCoordinates(document.activeElement);
      }
    } catch (_) {}
    return null;
  }

  let _posRaf = null;
  function schedulePositionToolbar(el) {
    if (_posRaf) cancelAnimationFrame(_posRaf);
    _posRaf = requestAnimationFrame(() => {
      _posRaf = null;
      const target = el || focused || (isEditable(document.activeElement) ? document.activeElement : null);
      if (target) positionToolbar(target);
    });
  }

  // Dynamic positioning: keeps toolbar showing just next to the text being written
  // and smoothly follows the cursor / text movement across all websites.
  function positionToolbar(el, anchorEl) {
    const t = getToolbar();
    const s = getSrBtn();

    const live = isEditable(document.activeElement) ? document.activeElement : (anchorEl || el);
    if (!live) return;

    // Rewrite/Proofread/etc act on existing text — nothing to show for an empty field.
    // Smart Reply is unaffected: it drafts a NEW reply from conversation context,
    // so it stays available even when the compose box itself is empty.
    const text = getText(el).trim();
    const hasText = text.length > 0;
    if (CFG.showTrigger && hasText)      t.style.display = "flex";
    else                                 t.style.display = "none";
    if (CFG.srEnabled && isChatSite())  s.style.display = "flex";
    else                                s.style.display = "none";

    const fieldRect = live.getBoundingClientRect();
    s.style.top  = Math.max(4, fieldRect.bottom - 34) + "px";
    s.style.left = Math.max(4, fieldRect.right  - 34) + "px";

    if (!hasText || toolbarDragged) return;

    const tRect   = t.getBoundingClientRect();
    const tWidth  = tRect.width  || 30;
    const tHeight = tRect.height || 30;

    const caret = getCaretCoordinates(live) || getCaretCoordinates(anchorEl) || getCaretCoordinates(el);

    if (caret) {
      // Primary: place with comfortable clearance away from cursor (+14px right, elevated -6px)
      // so it never blocks or contradicts the cursor while typing, leaving writing 100% clear.
      let targetLeft = caret.right + 14;
      let targetTop  = caret.top - (tHeight - caret.height) / 2 - 6;

      // If placing to the right overflows the viewport or is too close to the right edge:
      // Flip to position directly below the caret line
      if (targetLeft + tWidth > window.innerWidth - 8) {
        targetTop  = caret.bottom + 8;
        targetLeft = Math.max(8, Math.min(caret.left, window.innerWidth - tWidth - 8));
      }

      // If placing above would overflow top of viewport, flip to below
      if (targetTop < 8) {
        targetTop = caret.bottom + 8;
      }

      // Final clamping within viewport
      targetLeft = Math.max(8, Math.min(targetLeft, window.innerWidth - tWidth - 8));
      targetTop  = Math.max(8, Math.min(targetTop, window.innerHeight - tHeight - 8));

      t.style.left = Math.round(targetLeft) + "px";
      t.style.top  = Math.round(targetTop) + "px";
    } else {
      // Fallback if caret coordinates cannot be obtained
      const fallbackTop  = Math.max(8, fieldRect.top - tHeight - 4);
      const fallbackLeft = Math.max(8, Math.min(fieldRect.right - tWidth - 8, window.innerWidth - tWidth - 8));
      t.style.left = Math.round(fallbackLeft) + "px";
      t.style.top  = Math.round(fallbackTop) + "px";
    }
  }

  function hideToolbar() {
    if (toolbar) toolbar.style.display = "none";
    if (srBtn)   srBtn.style.display   = "none";
  }

  // ── Suggestion card ───────────────────────────────────────────────────────

  function getSuggest() {
    if (suggest) return suggest;
    suggest = document.createElement("div");
    suggest.id = "te-suggest";

    // Header row: action label + dismiss
    const header = document.createElement("div");
    header.className = "te-sug-hd";

    const label = document.createElement("span");
    label.id = "te-suggest-label";
    label.textContent = "✨";

    const dismiss = document.createElement("button");
    dismiss.id = "te-suggest-dismiss";
    dismiss.textContent = "✕";
    dismiss.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); hideSuggest(); });

    header.appendChild(label);
    header.appendChild(dismiss);

    // Body: full scrollable suggestion text
    const body = document.createElement("div");
    body.className = "te-sug-bd";

    const textEl = document.createElement("div");
    textEl.id = "te-suggest-text";
    body.appendChild(textEl);

    // Footer: accept button
    const footer = document.createElement("div");
    footer.className = "te-sug-ft";

    const accept = document.createElement("button");
    accept.id = "te-suggest-accept";
    accept.textContent = "Accept  Tab ↹";
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

    footer.appendChild(accept);
    suggest.appendChild(header);
    suggest.appendChild(body);
    suggest.appendChild(footer);
    document.documentElement.appendChild(suggest);

    // Restore saved position
    try {
      chrome.storage.local.get("te_suggest_pos", (r) => {
        if (r.te_suggest_pos?.left) {
          suggest.style.left = r.te_suggest_pos.left;
          suggest.style.top  = r.te_suggest_pos.top;
          suggestDragged     = true;
        }
      });
    } catch (_) {}

    // Drag to reposition
    let drag = null;
    suggest.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
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
      if (!drag) return;
      drag = null;
      suggest.style.cursor = "";
      if (suggestDragged) {
        try {
          chrome.storage.local.set({ te_suggest_pos: { left: suggest.style.left, top: suggest.style.top } });
        } catch (_) {}
      }
    });

    return suggest;
  }

  function _suggestWidth(el) {
    const r = el.getBoundingClientRect();
    const w = Math.min(400, Math.max(260, r.width));
    return Math.min(w, window.innerWidth - Math.max(8, r.left) - 12);
  }

  function positionSuggest(el) {
    if (!suggest || suggest.style.display === "none" || suggestDragged) return;
    const r = el.getBoundingClientRect();
    suggest.style.top   = (r.bottom + 6) + "px";
    suggest.style.left  = Math.max(8, r.left) + "px";
    suggest.style.width = _suggestWidth(el) + "px";
  }

  const ACTION_LABELS = { enhance: "Smart Enhance", proofread: "Proofread", shorten: "Shorten", rewrite: "Rewrite", professional: "Professional", clean: "Clean" };

  function showSuggestLoading(el, action) {
    suggestFor = el;
    const s = getSuggest();
    s.dataset.state     = "loading";
    s.style.borderColor = "";
    s.querySelector("#te-suggest-label").textContent = (ACTION_LABELS[action] || "Suggest");
    s.querySelector("#te-suggest-text").textContent  = "Analyzing…";
    const accept = s.querySelector("#te-suggest-accept");
    accept.textContent = "Accept  Tab ↹";
    accept.classList.remove("undo");
    if (!suggestDragged) {
      const r = el.getBoundingClientRect();
      s.style.top   = (r.bottom + 6) + "px";
      s.style.left  = Math.max(8, r.left) + "px";
      s.style.width = _suggestWidth(el) + "px";
    }
    s.style.display = "flex";
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
    suggest.dataset.state = "ready";
    const textEl = suggest.querySelector("#te-suggest-text");
    if (originalForDiff && text.length > 5) {
      textEl.innerHTML = wordDiffHtml(originalForDiff, text);
    } else {
      textEl.textContent = text;
    }
  }

  function hideSuggest() {
    streamPort?.disconnect();
    streamPort       = null;
    lastSuggestInput = "";
    if (suggest) {
      suggest.style.display = "none";
      delete suggest.dataset.state;
      const accept = suggest.querySelector("#te-suggest-accept");
      if (accept) { accept.classList.remove("undo"); }
    }
    suggestFor  = null;
    suggestText = "";
    suggestGenId++;
  }

  function updateUndoBtn(accept) {
    const levels = undoStack.length;
    accept.textContent = levels > 1 ? `Undo  (${levels})` : "Undo";
    accept.classList.add("undo");
  }

  function showUndoState(el, original) {
    const s = getSuggest();
    s.dataset.state     = "applied";
    s.style.borderColor = "";
    s.querySelector("#te-suggest-label").textContent = "✓ Applied";
    s.querySelector("#te-suggest-text").textContent  = "Suggestion applied. Click Undo to revert.";
    const accept = s.querySelector("#te-suggest-accept");
    updateUndoBtn(accept);
    if (!suggestDragged) {
      const r = el.getBoundingClientRect();
      s.style.top   = (r.bottom + 6) + "px";
      s.style.left  = Math.max(8, r.left) + "px";
      s.style.width = _suggestWidth(el) + "px";
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
    const btn = toolbar.querySelector("#te-smart-btn") || toolbar.querySelector(`[data-type="enhance"]`);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("te-loading");
      btn.innerHTML = "";
      const logoImg = document.createElement("img");
      logoImg.className = "te-btn-logo";
      try {
        logoImg.src = chrome.runtime.getURL("icons/icon48.png");
      } catch (_) {
        logoImg.src = "icons/icon48.png";
      }
      logoImg.alt = "Mindscribe AI";
      btn.appendChild(logoImg);
    }
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
    if (CFG.modelBackend === "ollama") {
      return SYSTEM_MSG_OLLAMA[type] || SYSTEM_MSG[type];
    }
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
    } else {
      // Rewrites stay roughly input-sized — cap well under Groq's free-tier
      // 8K tokens-per-minute limit, which an omitted/unbounded max_tokens can
      // exceed outright and get rejected as "Request too large".
      num_predict = Math.min(2000, Math.max(150, inputTokens * 2));
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
            model: CFG.modelSelect || MODEL,
            stream: false,
            options: getOllamaOptions(type, text),
            messages: [
              { role: "system", content: getSystemMsg(type, text) },
              ...(Array.isArray(SHOTS?.[type]) ? SHOTS[type] : []),
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
    const words = text.trim().split(/\s+/);

    // Lowercase-only letters of each word — uppercase stripped so "Mr" → "r" (length 1, ignored)
    const lowerLetters = w => w.replace(/[^a-z]/g, "");

    // 1. Any 2+ char all-lowercase word with zero vowels → almost certainly a typo ("ys", "teh", "whn")
    if (words.some(w => { const l = lowerLetters(w); return l.length >= 2 && !/[aeiou]/.test(l); })) score++;

    // 2. First visible character is lowercase → missing capitalisation
    if (/^[a-z]/.test(text.trimStart())) score++;

    // 3. Punctuation immediately followed by a letter with no space ("hello.World", "ok,go")
    if (/[.!?,;][A-Za-z]/.test(text)) score++;

    // 4. Three or more of the same letter in a row ("coool", "heyyyy") → unintentional repeat
    if (/([a-zA-Z])\1{2,}/.test(text)) score++;

    // 5. Word of 5+ letters whose vowel ratio is below 20% ("strngth" → 0%, "rhythm" edge case)
    if (words.some(w => {
      const l = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
      return l.length >= 5 && (l.match(/[aeiou]/g) || []).length / l.length < 0.2;
    })) score++;

    // 6. Sentence of 5+ words with no punctuation at all — almost certainly needs proofreading
    if (words.length >= 5 && !/[.!?,;]/.test(text)) score++;

    // 7. Repeated word back-to-back ("the the", "I I")
    if (/\b(\w+)\s+\1\b/i.test(text)) score++;

    // 8. Mid-sentence uppercase after a short all-lowercase word
    //    "im Is play" → "im" (2 chars, all lowercase) then "Is" (capitalized) = broken caps/autocorrect
    //    Skips when prev word starts with uppercase ("Hi John" is fine — "Hi" starts with uppercase)
    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1].replace(/[^a-zA-Z]/g, "");
      if (prev.length >= 1 && prev.length <= 3 && /^[a-z]+$/.test(prev) && /^[A-Z]/.test(words[i])) {
        score++;
        break;
      }
    }

    // 9. Common words typed without apostrophe or capitalisation ("im", "dont", "cant", "wont", "youre", "ive", "id", "thats")
    if (/\b(im|dont|cant|wont|youre|ive|id|thats|its|hes|shes|theyre|were|whats|theres|hows|lets)\b/.test(text.toLowerCase())) score++;

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

  // Auto-suggest uses Smart Enhance — detects tone and fixes errors
  function pickAction(text) {
    return "enhance";
  }

  // Returns true if suggestion is too similar to original to be worth showing
  function tooSimilar(original, suggestion) {
    // Exact match — nothing changed at all
    if (original.trim() === suggestion.trim()) return true;
    const wordNorm = s => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const wa = wordNorm(original);
    const wb = wordNorm(suggestion);
    // Same words but different punctuation/capitalisation — proofread fixed it, show it
    if (wa === wb) return false;
    // Different words — check overlap; hide only if nearly identical
    const setA = new Set(wa.split(/\s+/));
    const setB = new Set(wb.split(/\s+/));
    const shared = [...setA].filter(w => setB.has(w)).length;
    const union  = new Set([...setA, ...setB]).size;
    return shared / union >= 0.95;
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

    try {
      port.postMessage({
        model: CFG.modelSelect || MODEL,
        messages: [
          { role: "system", content: getSystemMsg(type, text) },
          ...(Array.isArray(SHOTS?.[type]) ? SHOTS[type] : []),
          { role: "user", content: `<input>${text}</input>` },
        ],
        options: getOllamaOptions(type, text),
      });
    } catch (e) {
      onError(e.message || "Failed to start enhancement");
    }

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
        // Get logged-in user's name from nav profile image (most reliable source).
        // LinkedIn always puts the user's full name as the alt text of their avatar.
        const myName = (
          document.querySelector(".global-nav__me-menu img, .global-nav__me-menu-btn img")?.alt?.trim() ||
          document.querySelector(".global-nav__me-menu .t-16")?.innerText?.trim() ||
          ""
        ).toLowerCase();
        const myFirstName = myName.split(/\s+/)[0];

        // Extract sender name from a message group's avatar.
        // LinkedIn puts the sender's name in: img alt, or aria-label "View [Name]'s profile".
        const getSenderName = (group) => {
          const img = group.querySelector("img");
          if (!img) return ""; // no avatar → continuation of same sender block
          const fromAlt = img.alt?.trim().toLowerCase();
          if (fromAlt) return fromAlt;
          // Fallback: aria-label on the avatar anchor "View [Name]'s profile"
          const label = img.closest("a[aria-label]")?.getAttribute("aria-label") || "";
          return label.replace(/^View\s+/i, "").replace(/'s\s+profile\s*$/i, "").trim().toLowerCase();
        };

        let currentRole = "them";
        let debugCount = 0;

        container.querySelectorAll(".msg-s-message-list__event").forEach(group => {
          const bodyEl = group.querySelector(
            ".msg-s-event-listitem__body, .msg-s-message-list__event-body, " +
            "[class*='event-listitem__body'], [class*='eventListItem__body']"
          );
          const text = bodyEl?.innerText?.trim();
          if (!text || text.length < 2) return;

          // Debug first 4 groups to expose actual DOM signals
          if (debugCount < 4) {
            debugCount++;
            console.log(`[TE LI] group[${debugCount}] text="${text.slice(0,25)}"`, {
              groupAria: group.getAttribute("aria-label")?.slice(0, 100),
              innerTextStart: group.innerText?.slice(0, 120).replace(/\n/g, "↵"),
              imgs: Array.from(group.querySelectorAll("img")).slice(0, 3).map(i => ({ alt: i.alt, ariaLink: i.closest("a")?.getAttribute("aria-label")?.slice(0, 60) })),
              aAriaLabels: Array.from(group.querySelectorAll("a[aria-label]")).slice(0, 3).map(a => a.getAttribute("aria-label")?.slice(0, 60)),
              myName, myFirstName,
            });
          }

          const senderName = getSenderName(group);
          const hasAvatar = !!group.querySelector("img");

          if (hasAvatar && senderName) {
            // Avatar present → new sender block; compare name to decide role
            if (myFirstName && senderName.startsWith(myFirstName)) {
              currentRole = "me";
            } else if (myName && senderName === myName) {
              currentRole = "me";
            } else {
              currentRole = "them";
            }
          }
          // No avatar (or blank alt) → continuation of same sender, keep currentRole

          // Override with class modifier if present (belt-and-suspenders)
          if (/--outgoing|--right/.test(group.className) ||
              !!group.querySelector("[class*='--outgoing'], [class*='--right']")) {
            currentRole = "me";
          }

          msgs.push({ role: currentRole, content: text });
        });

        if (msgs.length) return msgs.slice(-30);
      }
    }

    // ── Telegram Web ──────────────────────────────────────────────────────
    if (host === "web.telegram.org" || host === "k.telegram.org" || host === "z.telegram.org") {
      const msgs = [];
      document.querySelectorAll(".bubble").forEach(el => {
        const isMe = el.classList.contains("is-out");
        const text = el.querySelector(".message, .text-content")?.innerText?.trim();
        if (text && text.length > 1) msgs.push({ role: isMe ? "me" : "them", content: text });
      });
      if (msgs.length) return msgs.slice(-30);
    }

    // ── Discord ───────────────────────────────────────────────────────────
    if (host.includes("discord.com")) {
      const msgs = [];
      document.querySelectorAll("[class*='messageListItem']").forEach(el => {
        const authorEl = el.querySelector("[class*='username'], [class*='headerText'] [class*='roleColor'], h3[class*='header'] span");
        const contentEl = el.querySelector("[class*='messageContent'], [id^='message-content-']");
        const text = contentEl?.innerText?.trim();
        if (!text) return;
        // "You" label appears when hovering but the safest signal is checking the author
        // Use a data attribute Discord sets on your own messages
        const isMe = el.dataset.isOwner === "true"
          || !!el.closest("[data-is-owner='true']")
          || (authorEl?.innerText?.trim().toLowerCase() === "you");
        msgs.push({ role: isMe ? "me" : "them", content: text });
      });
      if (msgs.length) return msgs.slice(-30);
    }

    // ── Slack ─────────────────────────────────────────────────────────────
    if (host.includes("app.slack.com")) {
      const msgs = [];
      document.querySelectorAll("[data-qa='message_container']").forEach(el => {
        // Slack marks the viewer's own messages with aria-label containing "You" as sender
        const senderLabel = el.querySelector("[data-qa='message_sender_name']")?.innerText?.trim().toLowerCase();
        const isMe = senderLabel === "you" || el.classList.contains("c-message_kit--self");
        const text = el.querySelector(".p-rich_text_section")?.innerText?.trim();
        if (text) msgs.push({ role: isMe ? "me" : "them", content: text });
      });
      if (msgs.length) return msgs.slice(-30);
    }

    // ── Messenger / Instagram DMs — position-based via generic fallback ───

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

    // On Fiverr the message list and composer are siblings — the narrowed child that
    // contains the input is just the compose box, which has no messages.
    // Search from container directly; position filters below handle sidebar exclusion.
    let searchRoot = host.includes("fiverr.com") ? container : (() => {
      let n = inputEl;
      while (n?.parentElement && n.parentElement !== container) n = n.parentElement;
      return (!n || n === container) ? container : n;
    })();
    if (!searchRoot) return [];

    // ── Strategy 1: "Me" / own-name label detection
    // Fiverr shows "Me" in Chrome but full name (e.g. "Nadir Ali Khan") in Brave.
    // Detect own-name from the page header if present.
    const pageOwnerName = (
      document.querySelector(
        "[data-testid='username'], .username-text, .seller-name, .user-profile-name, " +
        "[class*='userName'], [class*='username'], [class*='profileName'], [class*='user-name'], " +
        "[data-testid='user-name'], [aria-label*='profile']"
      )?.innerText?.trim() || ""
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

      if (text === "Me" || text === "Me:") return;
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

      // Skip elements with no timestamp — these are sidebar/UI elements before the chat starts.
      // If no timestamp was ever seen, allow it through as a fallback (handles browsers with
      // different timestamp formats like Brave which may render them differently).
      if (lastTs !== null) {
        seen.add(text);
        candidates.push({ el, text, rect, timestamp: lastTs });
      } else {
        seen.add(text);
        candidates.push({ el, text, rect, timestamp: null });
      }
    });

    // Remove candidates that appeared before any timestamp only if we have timestamped ones;
    // otherwise keep all (Brave fallback — timestamp format not recognised).
    const timestamped = candidates.filter(c => c.timestamp !== null);
    const finalCandidates = timestamped.length ? timestamped : candidates;

    if (!finalCandidates.length) return [];

    // Merge consecutive fragments from the same sender into a single message.
    // Fiverr renders multi-paragraph messages as separate leaf nodes, so without this
    // the "last them message" ends up being the sign-off ("Sebastien") rather than the
    // full update — causing the AI to produce a max-8-word reply.
    function mergeConsecutive(msgs) {
      return msgs.reduce((acc, m) => {
        const last = acc[acc.length - 1];
        if (last && last.role === m.role) {
          last.content += "\n" + m.content;
        } else {
          acc.push({ role: m.role, content: m.content, timestamp: m.timestamp });
        }
        return acc;
      }, []);
    }

    // If we found "Me" labels, use label-based detection
    if (myRowRoots.size > 0) {
      return mergeConsecutive(finalCandidates.slice(-30).map(c => ({
        role:      isMyRow(c.el) ? "me" : "them",
        content:   c.text,
        timestamp: c.timestamp,
      })));
    }

    // ── Strategy 2: Dynamic position-based (bubble chat layouts)
    const rootWidth = searchRoot.getBoundingClientRect().width || window.innerWidth;
    const bubbles   = finalCandidates.filter(c => c.rect.width <= rootWidth * 0.82);
    if (!bubbles.length) {
      return mergeConsecutive(finalCandidates.slice(-30).map(c => ({ role: "them", content: c.text, timestamp: c.timestamp })));
    }

    const centers     = bubbles.map(c => c.rect.left + c.rect.width / 2);
    const dynamicMidX = (Math.min(...centers) + Math.max(...centers)) / 2;

    return mergeConsecutive(bubbles.slice(-30).map(c => ({
      role:      (c.rect.left + c.rect.width / 2) > dynamicMidX ? "me" : "them",
      content:   c.text,
      timestamp: c.timestamp,
    })));
  }

  // ── Smart Reply helpers ───────────────────────────────────────────────────

  function parseMessageTimestamp(text) {
    // "Jan 28, 10:30 AM" or "Jan 28 10:30"
    const m1 = text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    if (m1) { try { return new Date(`${m1[1]} ${m1[2]}, ${new Date().getFullYear()} ${m1[3]}`); } catch (_) {} }
    // "Today" / "Yesterday" labels
    if (/^today$/i.test(text.trim())) return new Date();
    if (/^yesterday$/i.test(text.trim())) { const d = new Date(); d.setDate(d.getDate() - 1); return d; }
    // "10:30 AM" or "10:30" — standalone time = today
    const m2 = text.match(/^(\d{1,2}:\d{2}(\s*(AM|PM))?)$/i);
    if (m2) { try { return new Date(new Date().toDateString() + " " + m2[1]); } catch (_) {} }
    // "28 Jun, 15:01" or "28 Jun 2024" or "28 Jun"
    const m3 = text.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:,?\s+(\d{4}|\d{1,2}:\d{2}))?/i);
    if (m3) {
      try {
        const day = m3[1], month = m3[2], extra = m3[3] || "";
        const isYear = /^\d{4}$/.test(extra);
        const isTime = /^\d{1,2}:\d{2}$/.test(extra);
        const year = isYear ? extra : new Date().getFullYear();
        const time = isTime ? extra : "00:00";
        return new Date(`${month} ${day}, ${year} ${time}`);
      } catch (_) {}
    }
    return null;
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
    const host        = window.location.hostname;
    const lastThemMsg = [...chatMsgs].reverse().find(m => m.role === "them");
    const situation   = detectSituation(chatMsgs);
    const intent      = extractIntent(chatMsgs);
    const toneNote    = CFG.replyTone === "auto" ? analyzeTone(chatMsgs) : "";

    let timeNote = "";
    if (lastThemMsg?.timestamp) {
      const mins = (Date.now() - lastThemMsg.timestamp.getTime()) / 60000;
      if (mins >= 720) {
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

    // Collect all consecutive trailing "them" messages (Fiverr splits multi-paragraph
    // messages into separate leaf nodes; merge here as a safety net).
    // Strip email-style sign-offs so they don't shrink the word count to 1-2 words.
    const stripSignoff = (t) => t.replace(/\n+(best regards?\b|kind regards?\b|regards?\b|sincerely\b|cheers\b|warm regards?\b|yours?\b(\s+truly\b)?|thank you,)[,.\s\S]*$/im, "").trim();
    // Walk backwards: skip any trailing "me" messages, then collect the last "them" block.
    const trailingThemParts = [];
    let seenThem = false;
    for (let i = chatMsgs.length - 1; i >= 0; i--) {
      const m = chatMsgs[i];
      if (m.role === "them") { trailingThemParts.unshift(m.content); seenThem = true; }
      else if (seenThem) break; // stop once we cross back into "me" after finding "them"
    }
    const lastClientMsg = stripSignoff(trailingThemParts.join("\n"));
    const clientWords   = lastClientMsg.trim().split(/\s+/).filter(Boolean).length;
    console.log("[TE SR] lastClientMsg:", JSON.stringify(lastClientMsg.slice(0, 200)), "| clientWords:", clientWords);

    let lengthGuide, maxTokens;
    if (CFG.replyLength === "short") {
      lengthGuide = "Reply in 1 short sentence only.";
      maxTokens   = 50;
    } else if (CFG.replyLength === "detailed") {
      lengthGuide = "Reply in 3–4 sentences covering all points thoroughly.";
      maxTokens   = 260;
    } else {
      if (clientWords <= 3) {
        // Ultra-short ("Okay", "ok", "sure") — one sentence max
        lengthGuide = `STRICT: Reply in 1 very short sentence, maximum 8 words. Client said only "${lastClientMsg.trim()}" — match that brevity.`;
        maxTokens   = 80;
      } else {
        // Concise by default — address the client's points without padding.
        // Scales up a little for longer client messages, but stays capped well short of an essay.
        const target = Math.max(20, Math.round(clientWords * 0.5));
        const lo     = Math.max(15, Math.round(target * 0.8));
        const hi     = Math.min(70, Math.round(target * 1.2));
        maxTokens    = Math.max(120, Math.round(hi * 1.8));
        lengthGuide  = `Write a concise reply of ${lo}–${hi} words. Address the client's main point directly — no padding, no restating what they said, no unnecessary elaboration. Do not cut off mid-thought.`;
      }
    }

    let toneGuide = "";
    if (CFG.replyTone === "professional") toneGuide = "Use a formal professional tone.";
    else if (CFG.replyTone === "friendly") toneGuide = "Use a warm friendly tone.";
    else if (CFG.replyTone === "casual")   toneGuide = "Use a casual relaxed tone.";

    // Platform tone override when user hasn't set a preference
    if (!toneGuide && CFG.replyTone === "auto") {
      if (host === "web.whatsapp.com" || host.includes("messenger.com") || host.includes("instagram.com"))
        toneGuide = "Use a natural, conversational tone — this is a personal messaging app, not a professional platform.";
      else if (host.includes("discord.com"))
        toneGuide = "Use a relaxed, casual tone appropriate for Discord.";
    }

    let portfolioNote = "";
    try {
      const matcher = typeof window !== "undefined" && window.TE_PORTFOLIO_MATCH;
      const clientAskedForPortfolio = /portfolio|example|sample|past work|similar work|show me|can i see/i.test(lastClientMsg);
      if (matcher && clientAskedForPortfolio) {
        const scanText = [lastClientMsg, ...chatMsgs.slice(-3).map(m => m.content)].join(" ");
        const matches = matcher(scanText, 3);
        if (matches?.length) {
          const list = matches.map(m => `• ${m.desc} — ${m.url}`).join("\n");
          portfolioNote = `\n\n[Portfolio links — include 1-2 ONLY because client explicitly asked for examples:]\n${list}`;
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
      `Do NOT repeat what You already said. Do NOT add greetings unless this is the very first message. Do NOT invent specific prices or dollar amounts — if pricing comes up say you'll send a custom quote after reviewing requirements. Do NOT apologize for delays unless the client explicitly complained about waiting. Output ONLY the reply text.`,
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

    console.log("[TE SR] chatMsgs count:", chatMsgs.length);
    chatMsgs.forEach((m, i) => console.log(`[TE SR]  [${i}][${m.role}] ${m.content.slice(0, 120)}`));

    const { system, userContent, maxTokens } = buildSmartReplyMessages(chatMsgs, draftText);

    console.log("[TE SR] system prompt:", system.slice(0, 300));
    console.log("[TE SR] userContent:", userContent.slice(0, 500));
    console.log("[TE SR] maxTokens:", maxTokens);

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
        model: CFG.modelSelect || MODEL,
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

    console.log("[TE SR] final result:", JSON.stringify(result));

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

  function runAction(type = "enhance") {
    const el = focused || lastFocused || (isEditable(document.activeElement) ? editableRoot(document.activeElement) : null);
    if (!el) return;
    const text = getText(el).trim();
    if (!text) return;

    const t = getToolbar();
    const btn = t.querySelector("#te-smart-btn") || t.querySelector(`[data-type="${type}"]`);
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add("te-loading");

    undoStack.push({ el, text });
    if (undoStack.length > 5) undoStack.shift();

    // Stream tokens straight into the field as they arrive instead of waiting
    // for the full response — makes Smart Enhance feel instant.
    streamOllama(
      text,
      type || "enhance",
      (partial) => {
        setTextLive(el, partial);
        schedulePositionToolbar(el);
      },
      (finalText) => {
        setText(el, finalText);
        resetToolbarBtns();
        trackUsage(type || "enhance");
        schedulePositionToolbar(el);
      },
      (errMsg) => {
        console.warn("[Mindscribe] Enhance error:", errMsg);
        resetToolbarBtns();
        const errBtn = t.querySelector("#te-smart-btn") || t.querySelector(`[data-type="${type}"]`);
        if (errBtn) {
          errBtn.innerHTML = '<span style="font-size:16px;">⚠️</span>';
        }
        setTimeout(resetToolbarBtns, 2500);
      }
    );
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

  function handleTyping(el, anchorEl) {
    if (!isEditable(el)) return;
    if (srStreaming) return; // don't interfere while smart reply is streaming
    focused = el; lastFocused = el;
    toolbarDragged = false; // typing always resumes tracking text position

    clearTimeout(typingTimer);
    clearTimeout(suggestTimer);

    const text = getText(el).trim();

    // Only dismiss suggestion if text changed — prevents MutationObserver spurious
    // fires (page JS touching the contenteditable) from hiding an active suggestion
    const suggestVisible = suggest && suggest.style.display !== "none";
    if (!suggestVisible || text !== originalForDiff) hideSuggest();

    positionToolbar(el, anchorEl);

    // Auto-suggest: only when site is enabled, text has a detectable error, and meets minimum length
    const _score = typoScore(text);
    if (CFG.autoSuggest && !siteDisabled && _score > 0 && text.length >= CFG.minLength && text !== lastSuggestInput && !shouldSkip(text)) {
      suggestTimer = setTimeout(() => {
        if (focused !== el) return;
        if (CFG.modelBackend !== "ollama" && isRateLimited()) { showSuggestLoading(el, "suggest"); showSuggestResult(rateLimitMsg()); setTimeout(hideSuggest, 2500); return; }
        const current = getText(el).trim();
        const cScore  = typoScore(current);
        if (current.length < CFG.minLength || current === lastSuggestInput || shouldSkip(current) || cScore === 0) return;

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
      }, Number(CFG.suggestDelay) || 1000);
    }
  }

  function onInput(e) {
    const target = e?.target || document.activeElement;
    if (!isEditable(target)) return;
    handleTyping(editableRoot(target), target);
  }

  // Capture phase so LinkedIn/modal sites can't stop propagation before we see the event
  document.addEventListener("input",          onInput,                              { capture: true });
  document.addEventListener("keyup",          (e) => {
    const navKeys = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"];
    if (navKeys.includes(e.key)) {
      if (focused || isEditable(document.activeElement)) {
        schedulePositionToolbar(focused || document.activeElement);
      }
      return;
    }
    const ignore = ["Shift","Control","Alt","Meta","CapsLock","Tab","Escape",
                    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"];
    if (!ignore.includes(e.key)) onInput(e);
  },                                                                                { capture: true });
  document.addEventListener("paste",          (e) => setTimeout(() => onInput(e), 50), { capture: true });
  document.addEventListener("compositionend", onInput,                              { capture: true });

  // Real-time caret tracking: whenever selection or cursor moves anywhere
  document.addEventListener("selectionchange", () => {
    const active = document.activeElement;
    if (isEditable(active) || focused) {
      schedulePositionToolbar(focused || active);
    }
  });

  // Capture phase: fires before LinkedIn/modal stopPropagation
  document.addEventListener("click", (e) => {
    if (!isEditable(e.target)) return;
    const el = editableRoot(e.target);
    const wasFocused = (focused === el);
    focused = el; lastFocused = el;
    toolbarDragged = false; // clicking inside input resumes following text
    schedulePositionToolbar(el);
    if (!wasFocused) watchFocusedEl(el);
  }, { capture: true });

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
    const el = editableRoot(e.target);
    focused = el; lastFocused = el;
    toolbarDragged = false;
    positionToolbar(el, e.target);
    watchFocusedEl(el);
  }, { capture: true });

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

  // Listen to both window and document scroll (with capture) so scrolled textareas / containers reposition toolbar
  document.addEventListener("scroll", () => {
    if (focused) { schedulePositionToolbar(focused); positionSuggest(focused); }
  }, { capture: true, passive: true });

  window.addEventListener("scroll", () => {
    if (focused) { schedulePositionToolbar(focused); positionSuggest(focused); }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (focused) { schedulePositionToolbar(focused); positionSuggest(focused); }
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
        model: CFG.modelSelect || MODEL,
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
    const el = editableRoot(e.target);
    const msgs = extractChatHistory(el);
    lastSeenMsgCount = msgs.filter(m => m.role === "them").length;
    startResponseTimer(msgs);
    const mood = detectMood(msgs);
    const s = getSrBtn();
    if (s) s.textContent = MOOD_ICON[mood] || "💬";
    startNewMessageWatcher(el);
  }, { capture: true });


})();
