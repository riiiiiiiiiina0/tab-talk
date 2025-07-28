(function () {
  /**
   * Get the content of a general page.
   * @returns {Promise<string|null>}
   */
  async function getGeneralPageContent() {
    // Clone the document so we can mutate it freely
    const clone = /** @type {Document} */ (document.cloneNode(true));

    // Remove things that are useless in Markdown
    clone
      .querySelectorAll(
        `script, style, noscript, iframe, svg, canvas, img, video, header, footer, nav, aside, [hidden], [aria-hidden="true"]`,
      )
      .forEach((el) => el.remove());

    // @ts-ignore
    const article = new Readability(clone).parse();
    const html = article.content || '';

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

  async function getPageContent() {
    const content = await getGeneralPageContent();

    // Wrap the collected data in XML and include any user-selected text
    const sel = window.getSelection ? window.getSelection() : null;
    const selectedText = sel ? sel.toString().trim() : '';

    let formattedContent = [];
    if (selectedText) {
      formattedContent.push(`<selectedText>\n${selectedText}\n</selectedText>`);
    }
    formattedContent.push(`<content>\n${content || 'no content'}\n</content>`);

    // Send the content back to the background script
    chrome.runtime.sendMessage({
      type: 'page-content-collected',
      title: document.title,
      url: document.location.href,
      content: formattedContent.join('\n\n'),
    });
  }

  getPageContent();
})();
