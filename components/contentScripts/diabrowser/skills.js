(function () {
  /**
   * Wait until at least `minCount` elements matching the selector exist in the DOM.
   * Falls back to MutationObserver when the initial query is insufficient.
   * @param {string} selector
   * @param {number} [minCount=1]
   * @param {number} [timeout=15000] - milliseconds before giving up
   * @returns {Promise<NodeListOf<Element>>}
   */
  function waitForElements(selector, minCount = 1, timeout = 15000) {
    return new Promise((resolve, reject) => {
      /**
       * Checks if the required elements are present.
       * @returns {boolean}
       */
      const check = () => {
        const nodes = document.querySelectorAll(selector);
        if (nodes.length >= minCount) {
          resolve(nodes);
          return true;
        }
        return false;
      };

      // Quick synchronous check first
      if (check()) return;

      // Observe DOM mutations if elements haven't loaded yet
      const observer = new MutationObserver(() => {
        if (check()) {
          observer.disconnect();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      // Timeout safeguard
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timed out waiting for selector: ${selector}`));
      }, timeout);
    });
  }

  /**
   * Main logic for diabrowser skill pages.
   */
  async function init() {
    // Stop if not on a diabrowser skill page
    if (
      !/^https:\/\/www\.diabrowser\.com\/skills\/[^/]+$/.test(location.href)
    ) {
      return;
    }

    console.log('init');
    try {
      // 1️⃣ Extract skill name & prompt
      const monoBodies = await waitForElements('.mono-body', 2);
      const name = monoBodies[0]?.textContent?.trim() ?? '';
      const prompt =
        /** @type {HTMLDivElement} */ (monoBodies[1])?.innerText?.trim() ?? '';

      // 2️⃣ Hook into the invite button
      const inviteAnchor = /** @type {HTMLAnchorElement} */ (
        (await waitForElements('a[href="/invite/skills"]', 1))[0]
      );

      if (!inviteAnchor) {
        console.warn('[TabTalk] Could not find invite anchor on skill page');
        return;
      }

      // Determine if this prompt is already saved
      const normalizedName = name.trim().replace(/^\//, '');
      const { savedPrompts = [] } = await chrome.storage.sync.get([
        'savedPrompts',
      ]);
      let existingPrompt = savedPrompts.find(
        (p) => p.name.toLowerCase() === normalizedName.toLowerCase(),
      );

      const buttonLabel = existingPrompt
        ? 'Edit in TabTalk'
        : 'Save to TabTalk';
      inviteAnchor.innerHTML = `
        <div class="relative z-10">
          <div class="relative flex items-center w-max">
            <span class="p2 whitespace-nowrap">${buttonLabel}</span>
          </div>
        </div>`;

      // Add a capture-phase listener so we run before site handlers
      inviteAnchor.addEventListener(
        'click',
        async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (existingPrompt) {
            // Open options prompts page with edit modal
            chrome.runtime.sendMessage({
              type: 'open-prompts-editor',
              id: existingPrompt.id,
            });
            return;
          }

          // Otherwise, save as a new prompt
          const generateId = () =>
            Date.now().toString(36) + Math.random().toString(36).substr(2);

          try {
            // Detect template placeholders like "[xxx]" and prompt user for values
            const collectPlaceholders = (str) => {
              const set = new Set();
              const regex = /\[([^\]]+)\]/g;
              let m;
              while ((m = regex.exec(str))) {
                set.add(m[1]);
              }
              return Array.from(set);
            };

            const placeholders = new Set([
              ...collectPlaceholders(normalizedName),
              ...collectPlaceholders(prompt.trim()),
            ]);

            const replacements = {};
            for (const ph of placeholders) {
              const userInput = window.prompt(
                `Enter value for "${ph}" (leave blank to keep template)`,
                '',
              );
              // Preserve template if cancelled or empty input
              replacements[ph] =
                userInput && userInput.trim() !== '' ? userInput : null;
            }

            const applyReplacements = (str) =>
              str.replace(/\[([^\]]+)\]/g, (_, p1) => {
                const val = replacements[p1];
                return val === null || val === undefined ? `[${p1}]` : val;
              });

            const finalName = applyReplacements(normalizedName) || 'Untitled';
            const finalContent = applyReplacements(prompt.trim());

            // Create and save the new prompt
            const newPrompt = {
              id: generateId(),
              name: finalName,
              content: finalContent,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            savedPrompts.unshift(newPrompt);
            await chrome.storage.sync.set({ savedPrompts });

            // Update in-memory reference so subsequent clicks go to edit flow
            existingPrompt = newPrompt;

            // Feedback: show "Saved" briefly, then turn into "Edit in TabTalk"
            const span = inviteAnchor.querySelector('span');
            if (span) span.textContent = 'Saved';
            setTimeout(() => {
              if (span) span.textContent = 'Edit in TabTalk';
            }, 2000);
          } catch (err) {
            console.error('[TabTalk] Failed to save prompt:', err);
          }
        },
        { capture: true },
      );
    } catch (err) {
      console.error('[TabTalk] diabrowser skill content script error:', err);
    }
  }

  // Run after DOMContentLoaded, or immediately if already parsed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * Observe SPA route changes and re-run init when URL changes.
   */
  function observeRouteChanges() {
    let lastUrl = location.href;

    const checkAndRun = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Slight delay to allow new DOM to render
        setTimeout(init, 100);
      }
    };

    // 1️⃣ Polling fallback (covers most SPA routers)
    setInterval(checkAndRun, 800);

    // 2️⃣ Monkey-patch history APIs for immediate detection
    const wrap = (method) => {
      const original = history[method];
      history[method] = function (...args) {
        // @ts-ignore – call original method
        const ret = original.apply(this, args);
        checkAndRun();
        return ret;
      };
    };
    wrap('pushState');
    wrap('replaceState');

    // 3️⃣ Back/forward navigation
    window.addEventListener('popstate', checkAndRun);
  }

  // Start observing route changes (once per script load)
  observeRouteChanges();
})();
