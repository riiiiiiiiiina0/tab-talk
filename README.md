# 🗂️💬 TabTalk

A browser extension for any **Chromium-based browser** (Chrome, Edge, Brave, etc.) that lets you **chat with your open browser tabs**. Select a couple of pages, hit **Use as context** and watch them appear inside ChatGPT (or Gemini) as handy Markdown attachments. Perfect for asking things like:

- "Summarise these docs"
- "Compare these products"
- "Explain this blog post like I'm 5"

<a href="https://buymeacoffee.com/riiiiiiiiiina" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## 🎥 Demo

[![Watch the demo on YouTube](https://img.youtube.com/vi/te0KYbN8FzQ/0.jpg)](https://www.youtube.com/watch?v=te0KYbN8FzQ)

---

## ✨ Features

- 🔍 Lists every open tab in the current window (excluding the active one – because ChatGPT is probably there!).
- 😴 Detects and marks sleeping/discarded tabs so you know they might take a moment to wake up.
- ✔️ Multi-select via friendly checkboxes.
- 🚀 Converts each selected page to **clean Markdown** thanks to [Turndown](https://github.com/mixmark-io/turndown) with GFM support.
- 📎 Seamlessly pastes the Markdown into ChatGPT/Gemini as **file attachments** using a synthetic clipboard event – no manual copy-paste required.
- ⏳ Inline loading indicator and timeout handling, so you’re never left wondering.
- 🛡️ Everything happens locally – no data is sent anywhere except to the AI tab you choose.

---

## 🛠️ Installation

1. Clone or download this repo.
2. Open your Chromium-based browser (e.g., Chrome, Edge, Brave) and head to its extensions page (`chrome://extensions`, `edge://extensions`, etc.).
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and select the project folder (`chat-with-tabs`).
5. A cute 🗂️ icon should pop up in your toolbar – you’re ready to roll!

---

## 🚶‍♀️ Quick walk-through

1. Open the pages you want to discuss.
2. Navigate to ChatGPT (or Gemini) in a separate tab.
3. Click the **TabTalk** extension icon.
4. Tick the pages you want, then hit **Use as context**.
5. Watch the files appear in the AI chat. Ask away! 🎉

---

## 👩‍💻 Development

```bash
# Install type definitions
npm install
```

The extension is pure vanilla JS (+ a touch of [Tailwind](https://tailwindcss.com/) & [daisyUI](https://daisyui.com/)), so there’s **no build step**. Just reload your unpacked extension after making changes.

---

## 🤝 Contributing

Got ideas? Found a bug? PRs and issues are very welcome – let’s make browsing + AI even more fun together! ✨

---

## ⚠️ Disclaimer

This project is **not** affiliated with OpenAI, Google, or any other company. Use at your own risk and respect each website’s terms of service.

---

## 📜 License

[MIT](LICENSE) – do whatever, but please drop a star ⭐ if this helped you!
