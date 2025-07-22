// This script injects selected tab contents as Markdown file attachments into ChatGPT.
// It now waits for ChatGPT's prompt editor to exist before attempting to paste.

(async () => {
  /**
   * Waits for a DOM element matching the selector to appear, or resolves null after timeout.
   * @param {string} selector
   * @param {number} timeoutMs
   * @returns {Promise<HTMLElement|null>}
   */
  function waitForElement(selector, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const start = Date.now();
      function tryFind() {
        const el = /** @type {HTMLElement|null} */ (
          document.querySelector(selector)
        );
        if (el) {
          resolve(el);
        } else if (Date.now() - start >= timeoutMs) {
          resolve(null);
        } else {
          setTimeout(tryFind, 1000);
        }
      }
      setTimeout(tryFind, 1000);
    });
  }

  // Request selected tab data from the background service worker
  chrome.runtime.sendMessage(
    { type: 'get-selected-tabs-data' },
    async (response) => {
      const tabs = Array.isArray(response?.tabs) ? response.tabs : [];
      if (tabs.length === 0) {
        console.warn(
          '[parseFilesAsAttachments] No selected tab data received.',
        );
        return;
      }

      // Wait for the ChatGPT prompt editor to be ready
      const editor = await waitForElement('[contenteditable="true"]');
      if (!editor) {
        console.warn(
          '[parseFilesAsAttachments] Timed out waiting for prompt textarea.',
        );
        return;
      }

      tabs.forEach((tab, idx) => {
        const { title, url, content } = tab;

        if (!content) {
          console.warn(
            `[parseFilesAsAttachments] No content found for tab ${idx + 1}.`,
            tab,
          );
          return;
        }

        const fileContent = [
          `Please treat this as the content of a web page titled "${
            title || `Tab ${idx + 1}`
          }" (URL: ${url})`,
          `---`,
          content || '<no content>',
        ].join('\n\n');

        const fileName = `${(title || `tab-${idx + 1}`).replace(
          /[^a-z0-9\-_]+/gi,
          '_',
        )}.md`;
        const file = new File([fileContent], fileName, {
          type: 'text/markdown',
          lastModified: Date.now(),
        });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        });

        editor.dispatchEvent(pasteEvent);
      });

      // Notify background that all markdown files have been pasted
      chrome.runtime.sendMessage({ type: 'markdown-paste-complete' });
    },
  );
})();
