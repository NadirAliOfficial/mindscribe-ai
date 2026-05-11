# Text Enhancer

A Chrome/Brave browser extension that enhances, proofreads, and rewrites text in any input box — powered by the **Groq API** (llama-3.3-70b-versatile). Works on Fiverr, LinkedIn, Gmail, and everywhere else.

Built by **Nadir Ali Khan**

---

## Features

- Works on **any website** — Fiverr, LinkedIn, Gmail, Upwork, anywhere
- **Always-visible draggable toolbar** with action buttons — no clicking needed
- **Auto-suggest** — detects typos and grammar errors automatically, shows a fix inline
- **Smart Reply** (Fiverr only) — reads chat history and generates a contextual reply with live streaming
- 5 toolbar actions: Rewrite, Proofread, Professional, Shorten, Clean
- **Per-site toggle** — disable auto-suggest on any site with one click (✨/⊘ button)
- Skips OTP fields, search boxes, PIN inputs — only activates on real text fields
- Toolbar position persists across page refreshes

---

## Setup

### 1. Add your Groq API key

Open `config.js` and add your key(s):

```js
const DEFAULT_KEYS = [
  "gsk_your_key_here",
];
```

Get a free key at [console.groq.com](https://console.groq.com). Add multiple keys for automatic rotation when rate limited.

### 2. Load the Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `text-enhancer` folder
5. Go to **Details → Site access → On all sites**

---

## Actions

| Action | What it does |
|---|---|
| **Rewrite** | Rephrases with different wording, same meaning |
| **Proofread** | Fixes grammar, spelling, and punctuation only |
| **Professional** | Rewrites in formal business tone |
| **Shorten** | Removes filler, keeps all key points |
| **Clean** | Strips terminal formatting, divider lines, alignment padding |

---

## Auto-Suggest

After you stop typing, if an error is detected the extension streams a corrected version in a suggestion bar below the input. Press **Tab** to accept or **✕** to dismiss.

Error detection is purely linguistic — no hardcoded word lists:
- Words with no vowels (`ys`, `teh`)
- Sentence starts with lowercase
- Missing space after punctuation
- Triple repeated letters (`coool`)
- Very low vowel density in longer words

---

## Smart Reply (Fiverr only)

Click the **💬** button that appears in the corner of the message box. It reads the chat history, detects the situation (complaint, revision, pricing, etc.), and streams a reply directly into the input box.

---

## File Structure

```
text-enhancer/
├── manifest.json     # Extension config (Manifest V3)
├── content.js        # UI, toolbar, auto-suggest, Smart Reply logic
├── background.js     # Service worker — Groq API calls with key rotation
├── config.js         # API keys (gitignored — stays local only)
├── portfolio.js      # Optional portfolio context for Smart Reply
├── styles.css        # Dark toolbar and suggestion bar styles
├── popup.html/js     # Settings popup
└── icons/
```

---

## Privacy

Text is sent to the Groq API for processing. No data is stored or logged beyond what Groq's standard API handling provides. Your API keys are stored locally in `config.js` (gitignored) and in `chrome.storage.local`.

---

## Author

**Nadir Ali Khan**
GitHub: [NadirAliOfficial](https://github.com/NadirAliOfficial)
