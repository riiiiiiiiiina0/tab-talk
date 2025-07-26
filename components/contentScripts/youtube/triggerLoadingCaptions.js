(function () {
  /**
   * Sleep helper.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Waits for an element matching `selector` to appear in the DOM.
   * @param {string} selector
   * @param {number} [timeout=15000] Timeout in ms
   * @returns {Promise<Element>}
   */
  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timed out waiting for: ${selector}`));
      }, timeout);
    });
  }

  // Removed page-level fetch/XHR interceptor injection. We'll now rely on the
  // background service worker (using chrome.declarativeNetRequest) to observe
  // subtitle requests and forward the data to this content script via
  // chrome.runtime.sendMessage.

  /**
   * Click the YouTube subtitles/CC button once it's available.
   */
  async function clickSubtitlesButton() {
    try {
      console.log('[triggerLoadingCaptions] waiting for subtitles button');
      const btn = /** @type {HTMLElement} */ (
        await waitForElement(
          '.ytp-subtitles-button[title]:not([title*="unavailable"])',
          5_000,
        )
      );
      console.log('[triggerLoadingCaptions] subtitles button found', btn);

      // Wait a bit to ensure controls are ready
      await sleep(300);
      btn.click();
      console.log('[triggerLoadingCaptions] subtitles button clicked');
    } catch (err) {
      console.warn('[triggerLoadingCaptions] subtitles button not found', err);
    }
  }

  function init() {
    // Only run on YouTube watch pages (defensive check – match is already filtered by manifest).
    // Removed invalid regex test for location.href
    if (
      !location.hostname.endsWith('youtube.com') ||
      !location.pathname.startsWith('/watch')
    ) {
      return;
    }

    console.log('[triggerLoadingCaptions] clicking subtitles button');
    clickSubtitlesButton();
  }

  init();
})();
