import { LLM_PROVIDER_META } from '../utils/llmProviders.js';

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
 * Determine whether the extension action should be enabled for a given tab.
 * Disallow non-http(s) URLs and Chrome Web Store pages.
 * @param {chrome.tabs.Tab} tab
 * @returns {boolean}
 */
function isActionAllowedForTab(tab) {
  const url = tab?.url || '';
  const isHttp = url.startsWith('http://') || url.startsWith('https://');
  const isWebStore = url.startsWith('https://chrome.google.com/webstore');
  return isHttp && !isWebStore;
}

/**
 * Initialise the action button behavior.
 */
function initActionButtonBehavior() {
  // === Per-tab popup handling ===
  /**
   * Sets the extension action popup and enabled state depending on the tab URL.
   * If the tab URL is not allowed, clear the popup and disable the action so clicks have no effect.
   * @param {chrome.tabs.Tab} tab
   */
  function updatePopupForTab(tab) {
    if (!tab || typeof tab.id !== 'number') return;

    const allowed = isActionAllowedForTab(tab);

    if (allowed) {
      const popup = 'components/popup.html';
      chrome.action.enable(tab.id).catch(() => {});
      chrome.action.setPopup({ tabId: tab.id, popup }).catch(() => {});
    } else {
      // Clear popup and disable action so clicking has no effect
      chrome.action.setPopup({ tabId: tab.id, popup: '' }).catch(() => {});
      chrome.action.disable(tab.id).catch(() => {});
    }
  }

  // Initialise popup/enabled state for all existing tabs when the service-worker starts
  chrome.tabs.query({}, (tabs) => tabs.forEach(updatePopupForTab));

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, updatePopupForTab);
  });

  // Keep popup assignment up-to-date
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Re-evaluate whenever the URL changes or the page reloads
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
