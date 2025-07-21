import { waitForTabLoad, waitForTabReady } from './tab.js';
import { getCachedCaption } from './ytSubtitleIntercept.js';

/**
 * Collected tab info
 * @typedef {Object} CollectedTabInfo
 * @property {number} tabId
 * @property {string} title
 * @property {string} url
 * @property {string} markdown
 */

/**
 * Inject the given files into the given tab.
 * @param {number} tabId
 * @param {string[]} files
 * @returns {Promise<void>}
 */
export function injectContentScripts(tabId, files) {
  return new Promise((resolve) => {
    const inject = () => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files,
        },
        () => resolve(),
      );
    };

    waitForTabReady(tabId).then(inject);
  });
}

/**
 * Reload the tab if it is discarded/frozen and inject the extraction scripts.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
export function injectScriptToGetPageContent(tabId) {
  /*
   * For YouTube video pages, some DOM features (e.g., transcript loading) only
   * initialize when the tab is active/visible. Activate the tab first, then
   * proceed with the normal injection chain.
   */
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        // Fallback – just inject the scripts
        injectContentScripts(tabId, [
          'libs/turndown.7.2.0.js',
          'libs/turndown-plugin-gfm.1.0.2.js',
          'components/contentScripts/getPageContentAsMarkdown.js',
        ]).then(resolve);
        return;
      }

      const doInject = () =>
        injectContentScripts(tabId, [
          'libs/turndown.7.2.0.js',
          'libs/turndown-plugin-gfm.1.0.2.js',
          'components/contentScripts/getPageContentAsMarkdown.js',
        ]).then(resolve);

      const isYouTubeWatch = /^https?:\/\/(?:www\.)?youtube\.com\/watch/.test(
        tab.url || '',
      );
      const videoId = new URL(tab.url || '').searchParams.get('v');

      if (isYouTubeWatch && videoId) {
        // Try to determine whether captions for this video are already cached
        // in the background service worker. If they are, we can skip the
        // expensive "activate tab first" step and inject the extraction
        // scripts directly.

        // Ask the background script whether captions are cached.
        const caption = getCachedCaption(videoId);

        if (caption) {
          doInject();
        } else {
          chrome.tabs.update(tabId, { active: true }, () => doInject());
        }
      } else {
        doInject();
      }
    });
  });
}

/**
 * Inject the pasteFilesAsAttachments script into the given tab.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
export function injectScriptToPasteFilesAsAttachments(tabId) {
  return injectContentScripts(tabId, [
    'components/contentScripts/pasteFilesAsAttachments.js',
  ]);
}

/**
 * Collect the Markdown representation of the given tab's page.
 * Resolves to an object containing title, url, and markdown (or `null` on timeout).
 * @param {number|undefined} tabId
 * @param {number} [timeout=5000]
 * @returns {Promise<CollectedTabInfo|null>}
 */
export async function collectPageContent(tabId, timeout = 10_000) {
  return new Promise((resolve) => {
    if (typeof tabId !== 'number') {
      resolve(null);
      return;
    }

    /**
     * Handle the message coming back from the content script.
     * @param {any} message
     * @param {chrome.runtime.MessageSender} sender
     */
    const onMessage = (message, sender) => {
      if (sender?.tab?.id !== tabId) return;
      if (!message || typeof message.markdown !== 'string') return;

      clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(onMessage);

      const result = {
        tabId,
        title: message.title || '',
        url: message.url || '',
        markdown: message.markdown,
      };

      resolve(result);
    };

    chrome.runtime.onMessage.addListener(onMessage);

    // Fallback timeout – resolve with null if no response within 7 s
    const timeoutId = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve(null);
    }, timeout);

    // Start extraction chain
    injectScriptToGetPageContent(tabId);
  });
}
