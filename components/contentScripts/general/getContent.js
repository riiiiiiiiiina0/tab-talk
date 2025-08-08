(function () {
  /**
   * Get the content of a general page.
   * @returns {Promise<string|null>}
   */
  async function getGeneralPageContent() {
    // Get iframes from the original document to check their dimensions, as
    // getBoundingClientRect() will not work on a cloned, un-rendered document.
    const originalIframes = document.querySelectorAll('iframe');

    // Clone the document so we can mutate it freely
    const clone = /** @type {Document} */ (document.cloneNode(true));
    const clonedIframes = clone.querySelectorAll('iframe');

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // We must iterate over the original iframes to get their dimensions,
    // but perform the mutations on the corresponding iframes in the clone.
    for (let i = 0; i < originalIframes.length; i++) {
      const originalIframe = originalIframes[i];
      const clonedIframe = clonedIframes[i];
      if (!clonedIframe) continue; // Should not happen if clone is faithful

      const rect = originalIframe.getBoundingClientRect();
      const isLarge =
        rect.width > viewportWidth * 0.5 || rect.height > viewportHeight * 0.5;

      if (isLarge) {
        try {
          // Accessing contentDocument will throw a security error for cross-origin iframes
          const iframeDocument = originalIframe.contentDocument;
          if (iframeDocument && iframeDocument.body) {
            const content = iframeDocument.body.innerHTML;
            const div = clone.createElement('div');
            // Sanitize or process content if necessary, for now, direct inject
            div.innerHTML = content;
            clonedIframe.parentNode.replaceChild(div, clonedIframe);
          } else {
            // Fallback for edge cases where contentDocument is null
            clonedIframe.remove();
          }
        } catch (e) {
          // This is a cross-origin iframe. Replace with a placeholder link.
          const src = originalIframe.getAttribute('src');
          if (src) {
            const fallback = clone.createElement('div');
            fallback.innerHTML = `<p><i>Content from an embedded frame could not be included. <a href="${src}" target="_blank" rel="noopener noreferrer">View content</a></i></p>`;
            clonedIframe.parentNode.replaceChild(fallback, clonedIframe);
          } else {
            // If it's cross-origin and has no src, just remove it
            clonedIframe.remove();
          }
        }
      } else {
        // Remove small iframes
        clonedIframe.remove();
      }
    }

    // Remove other things that are useless in Markdown.
    // Note: 'iframe' is not in this list, as we have handled it above.
    clone
      .querySelectorAll(
        `script, style, noscript, svg, canvas, img, video, header, footer, nav, aside, [hidden], [aria-hidden="true"]`,
      )
      .forEach((el) => el.remove());

    const html = clone.body.innerHTML;

    /**
     * TurndownService is a constructor for creating a new Turndown service instance.
     * @class
     * @see {@link https://github.com/mixmark-io/turndown}
     * @see {@link https://unpkg.com/turndown@7.2.0/dist/turndown.js}
     * @ts-ignore
     */
    // @ts-ignore
    const turndownService = new TurndownService({
      headingStyle: 'atx', // # H1
      codeBlockStyle: 'fenced', // ```js
      bulletListMarker: '-', // - list item
      emDelimiter: '*', // *italic*
      strongDelimiter: '**', // **bold**
      hr: '---', // horizontal rule
      br: '\n', // line-break handling
      linkStyle: 'inlined', // [text](url) instead of ref links
      linkReferenceStyle: 'full',
    });

    // @ts-ignore
    turndownService.use(turndownPluginGfm.gfm);

    // Add a rule to drop empty paragraphs, tracking pixels, etc.
    turndownService.addRule('dropEmpty', {
      filter: (node) =>
        node.nodeName === 'P' &&
        !node.textContent.trim() &&
        !node.querySelector('img'),
      replacement: () => '',
    });

    const markdown = turndownService.turndown(html);

    console.log('markdown:\n', markdown);

    return markdown;
  }

  // Register content getter function for the shared collector
  window['getContent'] = getGeneralPageContent;
})();
