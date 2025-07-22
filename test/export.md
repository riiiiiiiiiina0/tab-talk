# Tab Talk

Status: In progress
Last edited time: July 22, 2025 5:23 PM

![poster2.png](poster2.png)

# About

**Chat with Tabs** is a Chrome extension that enhances LLM chat interfaces by letting users *mention* specific tabs to share their browsing context. Once a tab is referenced, its content is automatically converted to markdown and added to the conversation—helping the model generate more accurate, context-aware replies based on what you’re actually viewing.

# Ideas

- Context
    - PDF

# Todo

## ✅ Experiment

- [x]  Setup extension
- [x]  Test getting current tab content and convert to markdown
- [x]  Test copying the markdown content to clipboard as file, then paste into ChatGPT as file attachment, programmatically
- [ ]  ~~Modify chatgpt’s upload attachment api to change the synthetic file’s name~~

## ✅ v1

- [x]  Support “mention a tab” in chatgpt
- [x]  Handle “sleeping tabs”
- [x]  Open chatgpt in side panel & auto reference current page as context
- [x]  Allow user to choose their LLM app in options page
- [x]  Support youtube page
    - [x]  Since we need to manipulate the dom, maybe we need to activate that (those) tabs first?
- [ ]  ~~Always open llm in new tab~~
- [x]  Keyboard shortcut
- [x]  Remove images, svgs, video, etc, since we don’t support them yet
- [ ]  ~~Handle llm not logged in case~~
- [x]  Release to store // pending review

## ✅ v2

- [x]  options page
- [x]  popup page
- [x]  background script logics
    - [x]  open popup page or collect selected tab / highlighted tabs when action button is clicked
    - [x]  collect page content of specific tab(s)
    - [x]  open llm page (or use current tab) & paste in page(s) content as attachment(s)
- [x]  support grabbing youtube caption without manipulating the dom // try this: [Extract caption from YouTube video](https://www.notion.so/Extract-caption-from-YouTube-video-2377aa7407c18099b1dfe3f163a9d991?pvs=21)
- [ ]  [~~try this new “simulate drop event” way to add file content into llm page~~](https://gemini.google.com/app/6040cfaf38da602b)
- [x]  [allow user to change their extension icon, and auto switch light/dark theme](https://chatgpt.com/share/e/687d9294-3798-8012-b658-37ee925511ba)
- [x]  handle video with no caption
- [x]  Make sure badge is cleared after collecting contents or timed out (also use a better looking emoji)
- [x]  Include selected text
- [x]  Support perplexity
- [x]  Support claude
- [x]  Stop handling action button click when still loading
- [x]  Clear badge if llm page is opened by closed before paste can be made

## v3

- [ ]  Improve extracted content quality
    - [ ]  Notion
    - [ ]  Google docs
    - [ ]  Gmail
    - [ ]  YouTube comments
    - [ ]  SeaTalk
- [ ]  Support **images** in the page
    - [ ]  page html — [`readablity`](https://github.com/mozilla/readability) → simplified html — [`jsPDF`](https://rawgit.com/MrRio/jsPDF/master/docs/index.html) → pdf

# Notes

[How to create markdown file in js and paste into chatgpt](https://www.notion.so/How-to-create-markdown-file-in-js-and-paste-into-chatgpt-2337aa7407c18063a95df9445cff8105?pvs=21)

[How to get caption from youtube page html (not working any more)](https://www.notion.so/How-to-get-caption-from-youtube-page-html-not-working-any-more-2367aa7407c1802596b2ece1b262baae?pvs=21)

[Extract caption from YouTube video](https://www.notion.so/Extract-caption-from-YouTube-video-2377aa7407c18099b1dfe3f163a9d991?pvs=21)