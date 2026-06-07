// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULTS = {
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
  apiKey:          "",
  modelSelect:     "llama-3.3-70b-versatile",
  temperature:     3,
  modelBackend:    "groq",
};

const ACTIONS = ["improve","rewrite","proofread","shorten","professional","friendly","translate","custom"];
const ACTION_LABELS = {
  improve:"Improve", rewrite:"Rewrite", proofread:"Proofread", shorten:"Shorten",
  professional:"Professional", friendly:"Friendly", translate:"Translate", custom:"Custom"
};

let settings = { ...DEFAULTS };
let saveTimer = null;

// ── Auto-save (debounced 400ms) ───────────────────────────────────────────────
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({
      te_settings:    settings,
      te_custom_prompt: settings.customDefault,
    }, () => showToast("✓ Applied"));
  }, 400);
}

// ── Load settings ─────────────────────────────────────────────────────────────
chrome.storage.local.get(["te_settings", "te_custom_prompt", "te_api_keys"], (r) => {
  if (r.te_settings)      settings = { ...DEFAULTS, ...r.te_settings };
  if (r.te_custom_prompt) settings.customDefault = r.te_custom_prompt;
  if (r.te_api_keys)      settings.apiKeys = r.te_api_keys;
  renderAll();
});

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ── Radio groups ──────────────────────────────────────────────────────────────
function initRadioGroup(id, key) {
  const group = document.getElementById(id);
  if (!group) return;
  group.querySelectorAll(".chip, .radio-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".chip, .radio-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      settings[key] = btn.dataset.val;
      scheduleSave();
    });
  });
}
initRadioGroup("suggestDelay",    "suggestDelay");
initRadioGroup("replyLength",     "replyLength");
initRadioGroup("replyTone",       "replyTone");
initRadioGroup("followUpHours",   "followUpHours");
initRadioGroup("shortenStrength", "shortenStrength");
initRadioGroup("modelBackend",    "modelBackend");

// ── Toggles ───────────────────────────────────────────────────────────────────
["autoSuggest","showTrigger","notifications","srEnabled","followUp"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => { settings[id] = el.checked; scheduleSave(); });
});

// ── Sliders ───────────────────────────────────────────────────────────────────
const minLengthSlider = document.getElementById("minLength");
const minLengthVal    = document.getElementById("minLengthVal");
minLengthSlider.addEventListener("input", () => {
  settings.minLength = parseInt(minLengthSlider.value);
  minLengthVal.textContent = minLengthSlider.value;
  scheduleSave();
});

const tempSlider = document.getElementById("temperature");
const tempVal    = document.getElementById("temperatureVal");
tempSlider.addEventListener("input", () => {
  settings.temperature = parseInt(tempSlider.value);
  tempVal.textContent = (parseInt(tempSlider.value) / 10).toFixed(1);
  scheduleSave();
});

// ── Selects & text inputs ─────────────────────────────────────────────────────
document.getElementById("translateTarget")?.addEventListener("change", (e) => {
  settings.translateTarget = e.target.value; scheduleSave();
});
document.getElementById("modelSelect")?.addEventListener("change", (e) => {
  settings.modelSelect = e.target.value; scheduleSave();
});
document.getElementById("customDefault")?.addEventListener("input", (e) => {
  settings.customDefault = e.target.value; scheduleSave();
});
// ── 3 API key slots ───────────────────────────────────────────────────────────
function saveKeys() {
  const keys = [
    document.getElementById("apiKey1").value.trim(),
    document.getElementById("apiKey2").value.trim(),
    document.getElementById("apiKey3").value.trim(),
  ].filter(Boolean);
  chrome.storage.local.set({ te_api_keys: keys }, () => showToast("✓ Keys saved"));
}

["apiKey1","apiKey2","apiKey3"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveKeys, 600);
  });
});

// ── Eye buttons ───────────────────────────────────────────────────────────────
document.querySelectorAll(".eye-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const inp = document.getElementById(btn.dataset.target);
    if (inp) inp.type = inp.type === "password" ? "text" : "password";
  });
});

// ── Action toggles ────────────────────────────────────────────────────────────
function buildActionToggles() {
  const container = document.getElementById("actionToggles");
  container.innerHTML = "";
  ACTIONS.forEach(action => {
    const isEnabled = !settings.disabledActions.includes(action);
    const item = document.createElement("div");
    item.className = "action-item";
    item.innerHTML = `
      <span class="action-item-label">${ACTION_LABELS[action]}</span>
      <label class="toggle">
        <input type="checkbox" ${isEnabled ? "checked" : ""}>
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>`;
    item.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        settings.disabledActions = settings.disabledActions.filter(a => a !== action);
      } else {
        if (!settings.disabledActions.includes(action)) settings.disabledActions.push(action);
      }
      scheduleSave();
    });
    container.appendChild(item);
  });
}

// ── Test API ──────────────────────────────────────────────────────────────────
document.getElementById("testBtn").addEventListener("click", async () => {
  const btn = document.getElementById("testBtn");
  btn.textContent = "Testing…"; btn.disabled = true;

  const keys = [
    document.getElementById("apiKey1").value.trim(),
    document.getElementById("apiKey2").value.trim(),
    document.getElementById("apiKey3").value.trim(),
  ].filter(Boolean);

  if (!keys.length) {
    btn.textContent = "✗ Add a key first"; btn.style.color = "#f87171";
    setTimeout(() => { btn.textContent = "Test Keys"; btn.style.color = ""; btn.disabled = false; }, 2500);
    return;
  }

  let passed = 0, failed = 0;
  for (let i = 0; i < keys.length; i++) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + keys[i] },
        body: JSON.stringify({ model: settings.modelSelect || "llama-3.3-70b-versatile", messages: [{ role: "user", content: "Hi" }], max_tokens: 5 }),
      });
      const status = document.getElementById("keyStatus" + (i + 1));
      if (r.ok) {
        passed++;
        if (status) { status.textContent = "✓ OK"; status.className = "key-status ok"; }
      } else {
        failed++;
        if (status) {
          status.textContent = r.status === 429 ? "Rate limited" : "✗ " + r.status;
          status.className = r.status === 429 ? "key-status warn" : "key-status err";
        }
      }
    } catch (_) { failed++; }
  }

  btn.textContent = passed + "/" + keys.length + " OK";
  btn.style.color = failed === 0 ? "#4ade80" : passed > 0 ? "#e3a008" : "#f87171";
  setTimeout(() => { btn.textContent = "Test Keys"; btn.style.color = ""; btn.disabled = false; }, 3000);
});

// ── Remove individual save buttons — auto-save handles everything ─────────────
document.querySelectorAll(".save-btn").forEach(btn => btn.remove());

// ── Toast + status badge ──────────────────────────────────────────────────────
function showToast(msg) {
  // Brief flash on the header badge
  const badge  = document.getElementById("statusBadge");
  const label  = document.getElementById("statusText");
  const dot    = badge?.querySelector(".status-dot");
  if (label) {
    label.textContent = msg;
    if (dot) dot.style.background = "#4ade80";
    clearTimeout(badge._t);
    badge._t = setTimeout(() => {
      label.textContent = "Active";
      if (dot) dot.style.background = "";
    }, 1500);
  }
  // Also flash the bottom toast
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 1500);
}

// ── Render all from settings ──────────────────────────────────────────────────
function renderAll() {
  // Toggles
  ["autoSuggest","showTrigger","notifications","srEnabled","followUp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = settings[id] !== false;
  });

  // Radio groups
  function setRadio(groupId, val) {
    const g = document.getElementById(groupId);
    if (!g) return;
    g.querySelectorAll(".chip, .radio-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.val === String(val));
    });
  }
  setRadio("suggestDelay",    String(settings.suggestDelay || 1500));
  setRadio("replyLength",     settings.replyLength    || "auto");
  setRadio("replyTone",       settings.replyTone      || "auto");
  setRadio("followUpHours",   String(settings.followUpHours || 24));
  setRadio("shortenStrength", settings.shortenStrength || "medium");
  setRadio("modelBackend",    settings.modelBackend   || "groq");

  // Sliders
  minLengthSlider.value    = settings.minLength   ?? 8;
  minLengthVal.textContent = settings.minLength   ?? 8;
  tempSlider.value         = settings.temperature ?? 3;
  tempVal.textContent      = ((settings.temperature ?? 3) / 10).toFixed(1);

  // Selects
  const ttEl = document.getElementById("translateTarget");
  if (ttEl) ttEl.value = settings.translateTarget || "auto";
  const msEl = document.getElementById("modelSelect");
  if (msEl) msEl.value = settings.modelSelect || "llama-3.3-70b-versatile";

  // Text inputs
  const cdEl = document.getElementById("customDefault");
  if (cdEl) cdEl.value = settings.customDefault || DEFAULTS.customDefault;

  // API key slots — load from te_api_keys array
  const keys = settings.apiKeys || [];
  ["apiKey1","apiKey2","apiKey3"].forEach((id, i) => {
    document.getElementById(id).value = keys[i] || "";
  });

  // Action toggles
  buildActionToggles();

  // Warn if no keys
  const badge = document.getElementById("statusBadge");
  const label = document.getElementById("statusText");
  const dot   = badge?.querySelector(".status-dot");
  const hasKey = (settings.apiKeys || []).some(k => k?.trim());
  if (!hasKey) {
    if (label) label.textContent = "No Key";
    if (dot)   dot.style.background = "#f87171", dot.style.boxShadow = "0 0 4px #f87171";
    if (badge) {
      badge.style.background    = "#1f0d0d";
      badge.style.borderColor   = "#3f1a1a";
      badge.style.color         = "#f87171";
    }
  }
}
