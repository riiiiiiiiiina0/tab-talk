/**
 * Wait until the given tab has finished loading (`status === 'complete'`).
 * @param {number} tabId
 * @returns {Promise<void>}
 */
export function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return resolve();
      if (tab.status === 'complete') return resolve();

      /**
       * @param {number} updatedTabId
       * @param {{status?: string}} changeInfo
       */
      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

/**
 * Wait until the given tab is ready to be used.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
export function waitForTabReady(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return resolve();

      const needsWake =
        tab.discarded || tab.frozen || tab.status === 'unloaded';

      if (needsWake) {
        // Reload after activation in case the page was frozen / discarded so we have fresh DOM
        chrome.tabs.reload(tabId, () => {
          waitForTabLoad(tabId).then(() => {
            resolve();
          });
        });
      } else {
        waitForTabLoad(tabId).then(resolve);
      }
    });
  });
}
