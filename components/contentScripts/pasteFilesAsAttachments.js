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
      console.log(
        '[pasteFilesAsAttachments] get-selected-tabs-data, received collected contents:',
        response,
      );
      const contents = Array.isArray(response?.contents)
        ? response.contents
        : [];
      if (contents.length === 0) {
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

      contents.forEach(
        /**
         * @param {import('../common/pageContent').CollectedTabInfo} item
         * @param {number} idx
         * @returns {void}
         */
        (item, idx) => {
          const { title, url, content } = item;

          if (!content) {
            console.warn(
              `[parseFilesAsAttachments] No markdown content found for tab ${
                idx + 1
              }.`,
              item,
            );
            return;
          }

          let file;
          if (!content.startsWith('data:application/pdf;')) {
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
            file = new File([fileContent], fileName, {
              type: 'text/markdown',
              lastModified: Date.now(),
            });
          } else {
            // parse base64 encoded string ("data:application/pdf;filename=generated.pdf;base64,...") into pdf file
            const base64Data = content.split(',')[1];
            const pdfBlob = atob(base64Data);
            const pdfFile = new File(
              [pdfBlob],
              `${title || `tab-${idx + 1}`}.pdf`,
              {
                type: 'application/pdf',
                lastModified: Date.now(),
              },
            );
            file = pdfFile;
          }

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true,
          });

          editor.dispatchEvent(pasteEvent);
        },
      );

      // Notify background that all markdown files have been pasted
      chrome.runtime.sendMessage({ type: 'markdown-paste-complete' });
    },
  );
})();
