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
    const clickDescription = async () => {
      // 1️⃣ Expand the video description (makes the transcript button visible)
      try {
        const description = await waitForElement(
          'ytd-watch-metadata #description',
          3_000,
        );
        /** @type {HTMLElement} */ (description).click();
      } catch (_) {
        /* description section not critical */
      }
    };

    const clickShowTranscriptButton = async () => {
      // 2️⃣ Click the "Show transcript" button (if available)
      try {
        const transcriptBtn = await waitForElement(
          'ytd-video-description-transcript-section-renderer #primary-button button',
          2_000,
        );
        /** @type {HTMLElement} */ (transcriptBtn).click();
      } catch (_) {
        /* transcript might be disabled */
      }
    };

    const waitForTranscriptList = async () => {
      try {
        // 3️⃣ Wait for the transcript list to load
        const list = await waitForElement(
          '.ytd-transcript-segment-list-renderer',
          3_000,
        );

        // Force-load lazy segments by scrolling once to the bottom
        list.scrollTop = list.scrollHeight;
        await sleep(300);
      } catch (_) {
        /* ignore */
      }
    };

    const getTitle = async () => {
      return (
        document
          .querySelector('ytd-watch-metadata #title')
          ?.textContent?.trim() ||
        document.title ||
        'no title'
      );
    };

    const getDescription = async () => {
      const desc =
        document.querySelector('ytd-watch-metadata #description')
          ?.textContent || 'no description';
      return desc
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n');
    };

    const getChannel = async () => {
      return (
        document
          .querySelector('ytd-channel-name yt-formatted-string')
          ?.textContent?.trim() || 'unknown channel'
      );
    };

    const getCaptionsFromBackgroundScript = async () => {
      // Try to fetch cached captions from the background service worker
      try {
        const videoId = new URLSearchParams(location.search).get('v');
        if (videoId) {
          const res = await chrome.runtime.sendMessage({
            type: 'get-youtube-caption',
            videoId,
          });
          if (res && typeof res.caption === 'string' && res.caption.length) {
            return res.caption;
          }
        }
      } catch (err) {
        /* ignore and fallback to DOM extraction */
        return null;
      }
    };

    const getCaptions = async () => {
      const list = document.querySelector(
        '.ytd-transcript-segment-list-renderer',
      );
      if (!list || !list.children) return 'no captions';

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
      return captions;
    };

    // Try to fetch cached captions from the background service worker first
    let captions = await getCaptionsFromBackgroundScript();

    // If no cached captions, try to extract them from the DOM
    if (!captions) {
      await clickDescription();
      await clickShowTranscriptButton();
      await waitForTranscriptList();
      captions = await getCaptions();
    }

    const title = await getTitle();
    const description = await getDescription();
    const channel = await getChannel();

    // Return newline-separated Markdown string
    return [
      `Video title: ${title}`,
      `Description: ${description}`,
      `Channel: ${channel}`,
      `Captions:\n${captions}`,
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
