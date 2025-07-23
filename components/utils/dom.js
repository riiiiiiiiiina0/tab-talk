/**
 * Waits for a DOM element matching `selector` to appear.
 * @param {string} selector
 * @param {number} [timeout=5000] Time in ms to wait before rejecting
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const initial = document.querySelector(selector);
    if (initial) return resolve(initial);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for selector: ${selector}`));
    }, timeout);
  });
}
