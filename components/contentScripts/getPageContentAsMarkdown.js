(function () {
  /**
   * Simple sleep helper.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Waits for a DOM element matching `selector` to appear.
   * @param {string} selector
   * @param {number} [timeout=15000] Time in ms to wait before rejecting
   * @returns {Promise<Element>}
   */
  function waitForElement(selector, timeout = 15000) {
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

  async function getYouTubeContent() {
    // 1️⃣ Expand the video description (makes the transcript button visible)
    try {
      const description = await waitForElement(
        'ytd-watch-metadata #description',
        5_000,
      );
      /** @type {HTMLElement} */ (description).click();
    } catch (_) {
      /* description section not critical */
    }

    // 2️⃣ Click the "Show transcript" button (if available)
    try {
      const transcriptBtn = await waitForElement(
        'ytd-video-description-transcript-section-renderer #primary-button button',
        3_000,
      );
      /** @type {HTMLElement} */ (transcriptBtn).click();
    } catch (_) {
      /* transcript might be disabled */
    }

    // 3️⃣ Wait for the transcript list to load
    const list = await waitForElement(
      '.ytd-transcript-segment-list-renderer',
      5_000,
    );

    // Force-load lazy segments by scrolling once to the bottom
    try {
      list.scrollTop = list.scrollHeight;
      await sleep(300);
    } catch (_) {
      /* ignore */
    }

    // 4️⃣ Gather all segments (timestamp + text)
    const captions = Array.from(list.children)
      .map((child) => {
        const ts = child
          .querySelector('.segment-timestamp')
          ?.textContent?.trim();
        const txt = child.querySelector('.segment-text')?.textContent?.trim();
        return ts && txt ? `${ts}: ${txt}` : null;
      })
      .filter(Boolean)
      .join('\n');

    // Collect title, description, etc.
    const title = document
      .querySelector('ytd-watch-metadata #title')
      ?.textContent?.trim();
    const description = (
      document.querySelector('ytd-watch-metadata #description')?.textContent ||
      ''
    )
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');
    const channel = document
      .querySelector('ytd-channel-name yt-formatted-string')
      ?.textContent?.trim();

    // Return newline-separated Markdown string
    return [
      `Video title: ${title}`,
      `Description: ${description}`,
      `Channel: ${channel}`,
      `Captions: ${captions}`,
    ].join('\n\n');
  }

  async function getGeneralPageContent() {
    // Clone the document so we can mutate it freely
    const clone = /** @type {Document} */ (document.cloneNode(true));

    // Remove things that are useless in Markdown
    clone
      .querySelectorAll(
        `script, style, noscript, iframe, svg, canvas, img, video, header, footer, nav, aside, [hidden], [aria-hidden="true"]`,
      )
      .forEach((el) => el.remove());

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

    const markdown = turndownService.turndown(clone.body.innerHTML);

    return markdown;
  }

  async function getPageContent() {
    let markdown = '';
    if (
      /(?:www\.)?youtube\.com$/.test(location.hostname) &&
      location.pathname.startsWith('/watch')
    ) {
      markdown = await getYouTubeContent();
    } else {
      markdown = await getGeneralPageContent();
    }

    // Send the markdown back to the background script
    chrome.runtime.sendMessage({
      type: 'page-content-collected',
      title: document.title,
      url: document.location.href,
      markdown,
    });
  }

  getPageContent();
})();
