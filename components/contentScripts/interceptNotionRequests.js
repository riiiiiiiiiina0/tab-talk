// Create a script element to inject into the main page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL(
  'components/contentScripts/notionFetchInterceptor.js',
);
script.type = 'text/javascript';

// Inject the script into the page
(document.head || document.documentElement).appendChild(script);

// Remove the script tag after it loads (optional cleanup)
script.onload = () => {
  script.remove();
};
