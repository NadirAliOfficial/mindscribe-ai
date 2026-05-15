# Text Enhancer

A Chrome/Brave browser extension that enhances, proofreads, and rewrites text in any input box. Supports two backends: **Groq** (free cloud API) and **Ollama** (fully local, no keys needed). Works on Fiverr, LinkedIn, Gmail, and everywhere else.

Built by **Nadir Ali Khan**

---

## Features

- Works on **any website** — Fiverr, LinkedIn, Gmail, Upwork, anywhere
- **Two AI backends** — switch between Groq (cloud) and Ollama (local) in one click
- **Always-visible draggable toolbar** with 5 action buttons
- **Auto-suggest** — detects typos, grammar errors, and missing punctuation automatically, shows a fix inline
- **Smart Reply** (Fiverr only) — reads chat history and generates a contextual reply with live streaming
- **Per-site toggle** — disable auto-suggest on any site with one click
- Skips OTP fields, search boxes, PIN inputs — only activates on real text fields
- Toolbar position persists across page refreshes

---

## Setup

### Option A — Groq (Cloud, Free)

1. Get a free API key at [console.groq.com](https://console.groq.com)
2. Open the extension popup → **API** tab
3. Paste your key into Key 1 (add up to 3 keys for automatic rotation when rate limited)
4. Make sure the backend is set to **☁️ Groq**

No config files needed — keys are saved in the browser only and never committed to git.

### Option B — Ollama (Local, No Keys)

1. Download Ollama from [ollama.com](https://ollama.com)
2. Pull a model:
   ```
   ollama pull llama3.2
   ```
3. Ollama runs automatically on startup — no manual `ollama serve` needed after first install
4. Open the extension popup → **API** tab → select **🖥️ Ollama (Local)**

On Apple Silicon (M1/M2/M3/M4) Ollama uses the Neural Engine — fast and battery efficient.

### Load the Extension

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
| **Proofread** | Fixes grammar, spelling, and punctuation |
| **Professional** | Rewrites in formal business tone |
| **Shorten** | Removes filler, keeps all key points |
| **Clean** | Strips terminal formatting, divider lines, alignment padding |

---

## Auto-Suggest

After you stop typing, if an error is detected the extension streams a corrected version in a bar below the input. Press **Tab** to accept or **✕** to dismiss.

Error detection (no API call needed for detection):
- Words with no vowels (`teh`, `ys`, `whn`)
- Sentence starts with lowercase
- Missing space after punctuation (`hello.World`)
- Triple repeated letters (`coool`, `heyyyy`)
- Very low vowel density in a word
- 5+ word sentence with no punctuation at all
- Repeated words (`the the`, `I I`)

---

## Smart Reply (Fiverr only)

Click the **💬** button in the corner of the message box. It reads the chat history, detects the situation (complaint, revision, pricing, timeline, praise, etc.), and streams a reply directly into the input.

Right-click the button for extra options: Summarize chat, Away Mode, Templates, Translate & reply.

---

## Popup Settings

| Tab | What you can configure |
|---|---|
| **General** | Auto-suggest on/off, trigger delay, min text length, notifications |
| **Smart Reply** | Reply length, tone, follow-up reminders |
| **Actions** | Enable/disable individual actions, shorten strength, translate target |
| **API** | Backend (Groq / Ollama), API keys, model, temperature |

---

## File Structure

```
text-enhancer/
├── manifest.json     # Extension config (Manifest V3)
├── content.js        # UI, toolbar, auto-suggest, Smart Reply logic
├── background.js     # Service worker — routes to Groq or Ollama
├── config.json       # Your personal API keys (gitignored — never committed)
├── portfolio.js      # Optional portfolio context for Smart Reply
├── styles.css        # Dark toolbar and suggestion bar styles
├── popup.html/js     # Settings popup
└── icons/
```

---

## Privacy

- **Groq backend**: text is sent to Groq's API for processing. Keys are stored locally in `chrome.storage.local` and in the gitignored `config.json` — never committed to git.
- **Ollama backend**: everything runs on your machine. No data leaves your device.

---

## Author

**Nadir Ali Khan**
GitHub: [NadirAliOfficial](https://github.com/NadirAliOfficial)
