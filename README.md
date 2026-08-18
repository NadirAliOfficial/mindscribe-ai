# Mindscribe AI

AI-powered Chrome extension for smart replies and text enhancement — works across Fiverr, LinkedIn, WhatsApp, Telegram, Discord, Slack, Messenger, Instagram DMs, and any text field on the web.

## Features

### Smart Reply (💬)
Reads the conversation context and generates a tailored reply with one click. Appears only on chat/messaging pages — never on irrelevant pages.

Supported platforms:
- Fiverr Inbox
- LinkedIn Messaging
- WhatsApp Web
- Telegram Web
- Discord (channels & DMs)
- Slack
- Facebook Messenger
- Instagram DMs

Reply length, tone, and content adapt to the conversation automatically. Short client messages get short replies; long detailed messages get full contextual responses. Tone adjusts by platform — professional for LinkedIn/Fiverr, conversational for WhatsApp/Discord.

### Text Enhancement
Select any text on any website and get instant AI-powered rewrites:
- Improve — cleaner phrasing, same meaning
- Rewrite — fresh take, same intent
- Proofread — fix grammar and spelling
- Formal / Casual / Concise modes
- Translate & Reply — detect language, reply in kind

### Smart Autocomplete
Suggests completions as you type based on context.

## Setup

1. Clone this repo
2. Go to `chrome://extensions/` (or `brave://extensions/`)
3. Enable **Developer Mode** → **Load unpacked** → select this folder
4. Open the extension popup and paste your [Groq API key](https://console.groq.com) (free)

## Configuration

Open the extension popup to set:
- Groq API key (up to 3 keys, auto-rotated on rate limit)
- Reply tone: Auto / Professional / Friendly / Casual
- Model: GPT-OSS 120B (default), GPT-OSS 20B

## License

MIT

