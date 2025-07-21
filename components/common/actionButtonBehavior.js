import { LLM_PROVIDER_META } from './llmProviders.js';

/**
 * Helper: Check if a URL matches any supported LLM provider
 * @param {string} url
 * @returns {string|null}
 */
function getMatchingLLMProvider(url) {
  if (!url) return null;
  for (const [provider, meta] of Object.entries(LLM_PROVIDER_META)) {
    if (url.startsWith(meta.url)) {
      return provider;
    }
  }
  return null;
}

/**
 * Initialise the action button behavior.
 */
function initActionButtonBehavior() {
  // === Per-tab popup handling ===
  /**
   * Sets the extension action popup depending on whether the given tab is a supported app.
   * If the tab is ChatGPT/Gemini the usual popup is shown, otherwise we clear the popup so
   * that `chrome.action.onClicked` fires.
   * @param {chrome.tabs.Tab} tab
   */
  function updatePopupForTab(tab) {
    if (!tab || typeof tab.id !== 'number' || !tab.url) return;
    let popup = '';
    try {
      const provider = getMatchingLLMProvider(tab.url);
      if (provider) popup = 'components/popup.html';
    } catch {
      // ignore non-standard URLs (chrome:// etc.)
    }
    chrome.action.setPopup({ tabId: tab.id, popup }).catch(() => {});
  }

  // Initialise popup for all existing tabs when the service-worker starts
  chrome.tabs.query({}, (tabs) => tabs.forEach(updatePopupForTab));

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, updatePopupForTab);
  });

  // Keep popup assignment up-to-date
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Re-evaluate the popup whenever the URL changes *or* the page reloads (status changes).
    // Relying only on changeInfo.url misses pure reloads where the URL stays the same,
    // which left the default popup in place and prevented the action click handler
    // from firing. Also handle the initial "loading" event so that the service-worker
    // can correct the popup right after it wakes up.
    if (
      changeInfo.url !== undefined ||
      changeInfo.status === 'loading' ||
      changeInfo.status === 'complete'
    ) {
      updatePopupForTab(tab);
    }
  });

  console.log('action button behavior initialized');
}

initActionButtonBehavior();
