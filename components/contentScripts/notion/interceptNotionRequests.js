// Create a script element to inject into the main page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL(
  'components/contentScripts/notion/interceptNotionRequestsScript.js',
);
script.type = 'text/javascript';

// Inject the script into the page
(document.head || document.documentElement).appendChild(script);
console.log('[interceptNotionRequests] script injected');

// Remove the script tag after it loads (optional cleanup)
script.onload = () => {
  script.remove();
};

// Listen for messages from the injected page-context script and forward them
// to the extension background script. We only handle messages that we know
// originate from our own injection (verified via `source` field).
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const message = event.data;
  if (
    message &&
    message.source === 'tabtalk-extension' &&
    message.type === 'notion-page-chunks-markdown'
  ) {
    console.log(
      '[interceptNotionRequests] sending message to background',
      message,
    );
    chrome.runtime.sendMessage({
      type: message.type,
      data: message.data,
    });
  }
});
