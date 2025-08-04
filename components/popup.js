// @ts-check

import {
  LLM_PROVIDER_META,
  getLLMProvider,
  SUPPORTED_LLM_PROVIDERS,
} from './utils/llmProviders.js';

/**
 * Check if a URL matches any supported LLM provider
 * @param {string} url
 * @returns {boolean}
 */
function isLLMPage(url) {
  if (!url) return false;
  for (const meta of Object.values(LLM_PROVIDER_META)) {
    if (url.startsWith(meta.url)) {
      return true;
    }
  }
  return false;
}

// Track the currently selected LLM provider
let selectedLLMProvider = null;

/**
 * Create LLM selection UI
 */
async function createLLMSelection() {
  const llmSelectionEl = document.getElementById('llm-selection');
  if (!llmSelectionEl) return;

  // Get the default LLM provider
  const defaultProvider = await getLLMProvider();
  selectedLLMProvider = defaultProvider;

  SUPPORTED_LLM_PROVIDERS.forEach((provider) => {
    const meta = LLM_PROVIDER_META[provider];
    const button = document.createElement('button');
    button.className = `btn btn-sm w-8 h-8 p-1 border-gray-300 ${
      provider === defaultProvider ? 'btn-info border-none' : ''
    }`;
    button.dataset.provider = provider;
    button.title = meta.name;

    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${meta.url}&sz=32`;
    img.alt = meta.name;
    img.className = 'w-full h-full object-contain';
    button.appendChild(img);

    // Add click handler
    button.addEventListener('click', () => {
      // Remove selection from all buttons
      llmSelectionEl.querySelectorAll('button').forEach((btn) => {
        btn.classList.remove('btn-info', 'border-none');
      });

      // Add selection to clicked button
      button.classList.add('btn-info', 'border-none');

      // Update selected provider
      selectedLLMProvider = provider;
    });

    llmSelectionEl.appendChild(button);
  });
}

// Automatically set DaisyUI theme based on system preference
(function autoTheme() {
  const applyTheme = () => {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    document.documentElement.setAttribute(
      'data-theme',
      prefersDark ? 'dark' : 'light',
    );
  };
  applyTheme();
  // Update theme if the system preference changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', applyTheme);
})();

(function init() {
  const listEl = /** @type {HTMLUListElement|null} */ (
    document.getElementById('tabs-list')
  );
  const useBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('let-llm-read-btn')
  );
  const downloadBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('download-markdown-btn')
  );

  if (!listEl || !useBtn || !downloadBtn) {
    console.error('Popup elements not found');
    return;
  }

  // Initialize LLM selection
  createLLMSelection();

  // Get highlighted tabs first to determine which should be pre-checked
  chrome.tabs.query(
    { currentWindow: true, highlighted: true },
    (highlightedTabs) => {
      chrome.tabs.query({ currentWindow: true }, (allTabs) => {
        // Get active tab
        const activeTab = allTabs.find((tab) => tab.active);

        // Determine which tabs should be pre-checked
        // If multiple tabs are highlighted, use those; otherwise use active tab
        // But exclude LLM pages from being pre-checked
        let tabsToPreCheck =
          highlightedTabs.length > 1
            ? highlightedTabs
            : activeTab
            ? [activeTab]
            : [];

        // Filter out LLM pages from pre-checked tabs
        tabsToPreCheck = tabsToPreCheck.filter(
          (tab) => tab.url && !isLLMPage(tab.url),
        );
        const tabsToCheck = tabsToPreCheck.map((tab) => tab.id);

        allTabs
          .filter((tab) => tab.url && tab.url.startsWith('http'))
          .forEach((tab) => {
            // Check if this tab should be pre-checked
            const shouldBeChecked = tabsToCheck.includes(tab.id);
            const li = document.createElement('li');

            // A tab is considered "sleeping" if it is discarded or frozen
            const isSleeping = tab.discarded || tab.frozen;

            // The placeholder for the favicon
            const faviconPlaceholder = `<div class="size-5 rounded-full bg-base-300"></div>`;

            // If favicon is available, create an <img> tag.
            // Otherwise, use the placeholder.
            const faviconEl = tab.favIconUrl
              ? `<img src="${tab.favIconUrl}" class="size-5 rounded-sm favicon-img" data-tab-id="${tab.id}" />`
              : faviconPlaceholder;

            li.innerHTML = `
        <label class="flex flex-row gap-2 cursor-pointer items-center bg-base-200 hover:bg-base-300 transition-colors p-2 rounded-md ${
          isSleeping ? 'opacity-50' : ''
        }">
          <!-- checkbox -->
          <input type="checkbox" class="checkbox checkbox-sm" data-tab-id="${
            tab.id
          }" ${shouldBeChecked ? 'checked' : ''}>

          <!-- favicon + optional sleeping indicator -->
          <div class="relative w-5 h-5 min-w-5">
            ${faviconEl}
            ${
              isSleeping
                ? '<span class="absolute -top-2 -right-2 text-[8px] text-gray-500 animate-bounce select-none">💤</span>'
                : ''
            }
          </div>

          <!-- title & url -->
          <div class="flex flex-col min-w-0">
            <span class="font-bold line-clamp-1">${
              tab.title || '(No title)'
            }</span>
            <span class="text-xs text-gray-500 truncate">${tab.url || ''}</span>
        </div>
        </label>
              `;
            listEl.appendChild(li);

            // Add error handler for favicon images to avoid CSP violations
            if (tab.favIconUrl) {
              const imgEl = li.querySelector('.favicon-img');
              if (imgEl) {
                imgEl.addEventListener('error', function () {
                  this.outerHTML = faviconPlaceholder;
                });
              }
            }
          });

        // After all tabs are added, scroll to ensure the first checked tab is visible
        setTimeout(() => {
          const firstCheckedCheckbox = listEl.querySelector(
            'input[type="checkbox"]:checked',
          );
          if (firstCheckedCheckbox) {
            const listItem = firstCheckedCheckbox.closest('li');
            if (listItem) {
              listItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });
            }
          }
        }, 100); // Small delay to ensure DOM is fully rendered
      });
    },
  );

  function getSelectedTabIds() {
    const checked = /** @type {HTMLInputElement[]} */ ([
      ...document.querySelectorAll('#tabs-list input[type="checkbox"]:checked'),
    ]);

    // Extract the numeric tab IDs from the checked checkboxes
    return checked
      .map((cb) => parseInt(cb.dataset.tabId || '', 10))
      .filter((id) => !Number.isNaN(id));
  }

  useBtn.addEventListener('click', () => {
    const tabIds = getSelectedTabIds();

    // Nothing selected – simply close the popup
    if (tabIds.length === 0) {
      window.close();
      return;
    }

    // Ask the background service-worker to collect the context and process it
    chrome.runtime.sendMessage({
      type: 'collect-page-content',
      tabIds,
      llmProvider: selectedLLMProvider,
    });

    // Close the popup – the background script will take it from here
    window.close();
  });

  downloadBtn.addEventListener('click', () => {
    const tabIds = getSelectedTabIds();

    // Nothing selected – simply close the popup
    if (tabIds.length === 0) {
      window.close();
      return;
    }

    // Ask the background service-worker to download as markdown
    chrome.runtime.sendMessage({ type: 'download-markdown', tabIds });

    // Close the popup – the background script will take it from here
    window.close();
  });
})();
