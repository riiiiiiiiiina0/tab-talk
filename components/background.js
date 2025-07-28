import './common/actionButtonBehavior.js';
import './common/managerYouTube.js';
import {
  showLoadingBadge,
  clearLoadingBadge,
  updateActionIcon,
} from './common/actionButton.js';
import { LLM_PROVIDER_META, getLLMProvider } from './utils/llmProviders.js';
import {
  collectPageContent,
  injectScriptToPasteFilesAsAttachments,
} from './common/pageContent.js';

let collectedContents = [];

// Flag to indicate we are in the middle of collecting page contents / waiting for paste to complete
let isProcessing = false;

// Track the LLM provider tab that we inject the paste script into so that we
// can clear the loading badge if the tab is closed before the paste completes.
let llmTabId = null;

/**
 * Collect page content from the given tabs one by one.
 * @param {(number|undefined)[]} tabsToProcess
 * @returns {Promise<(import('./common/pageContent.js').CollectedTabInfo | null)[]>}
 */
async function collectPageContentOneByOne(tabsToProcess) {
  // Mark processing so subsequent action clicks are ignored until we finish and clear the badge
  isProcessing = true;
  // Show a loading badge while we process the tabs and until the content is pasted into the LLM page.
  await showLoadingBadge();

  const results = [];
  try {
    for (const tab of tabsToProcess) {
      const content = await collectPageContent(tab);
      results.push(content);
    }

    // In case of fail to collect content from page or timeout, make sure the badge is cleared.
    if (results.some((r) => r === null || r.content === '')) {
      await clearLoadingBadge();
      isProcessing = false;
    }

    return results;
  } catch (err) {
    // Clear the badge if something goes wrong so we don't leave it stuck.
    await clearLoadingBadge();
    isProcessing = false;
    throw err;
  }
}

/**
 * Handle the action button click.
 * This will be called when user click the action button when NOT in LLM provider page.
 * @param {chrome.tabs.Tab} activeTab
 */
let lastClickTime = 0;

async function downloadTabsAsMarkdown(tabs) {
  const tabIds = tabs.map((tab) => tab.id);
  const contents = await collectPageContentOneByOne(tabIds);

  for (const content of contents) {
    if (content) {
      const blob = new Blob([content.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: `${content.title}.md`,
        saveAs: true,
      });
    }
  }
}

chrome.action.onClicked.addListener(async (activeTab) => {
  const now = new Date().getTime();
  const timeSinceLastClick = now - lastClickTime;
  lastClickTime = now;

  if (timeSinceLastClick < 500) {
    // Double-click
    try {
      const highlighted = await chrome.tabs.query({
        currentWindow: true,
        highlighted: true,
      });
      const tabsToProcess = highlighted.length > 1 ? highlighted : [activeTab];
      const httpTabs = tabsToProcess.filter((tab) =>
        (tab.url || '').startsWith('http'),
      );
      if (httpTabs.length > 0) {
        await downloadTabsAsMarkdown(httpTabs);
      }
    } catch (err) {
      console.error('[background] on double-click error:', err);
    }
    return;
  }

  // Single-click
  // Ignore the click if we are already processing a previous request
  if (isProcessing) {
    console.log('[background] still processing, click ignored');
    return;
  }
  try {
    const highlighted = await chrome.tabs.query({
      currentWindow: true,
      highlighted: true,
    });

    let tabsToProcess = highlighted.length > 1 ? highlighted : [activeTab];
    tabsToProcess = tabsToProcess.filter((tab) =>
      (tab.url || '').startsWith('http'),
    );

    if (tabsToProcess.length === 0) {
      console.log('[background] no tabs to process');
      return;
    }

    const tabIds = tabsToProcess.map((tab) => tab.id);

    collectedContents = await collectPageContentOneByOne(tabIds);

    // open llm page & paste in page content
    const llmProvider = await getLLMProvider();
    const meta = LLM_PROVIDER_META[llmProvider];
    if (!meta) {
      console.error('[background] llm provider not supported:', llmProvider);
      return;
    }
    const url = meta.url;
    const tab = await chrome.tabs.create({ url, active: true });
    if (tab.id) {
      llmTabId = tab.id; // record the tab so we know which one to watch
      injectScriptToPasteFilesAsAttachments(tab.id);
    }
  } catch (err) {
    console.error('[background] action.onClicked error:', err);
  }
});

/**
 * Handle the runtime message.
 * The collect-page-content message is sent from popup page after user selected tabs from the list.
 * @param {any} message
 * @param {chrome.runtime.MessageSender} sender
 * @param {Function} sendResponse
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'icon-style-changed') {
    updateActionIcon();
    return;
  }

  // keep the current tab id first, we might need to jump back to it
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tabId = tabs[0].id;
    if (!tabId) return;

    if (
      message.type === 'collect-page-content' &&
      Array.isArray(message.tabIds)
    ) {
      showLoadingBadge();

      collectPageContentOneByOne(message.tabIds).then((contents) => {
        collectedContents = contents;
        chrome.tabs.update(tabId, { active: true }, () => {
          injectScriptToPasteFilesAsAttachments(tabId);
          llmTabId = tabId; // record the tab so we know which one to watch
        });
      });
    } else if (message.type === 'get-selected-tabs-data') {
      sendResponse({ tabs: collectedContents });
    } else if (message.type === 'markdown-paste-complete') {
      clearLoadingBadge();
      isProcessing = false;
      llmTabId = null;
    }
  });

  return true;
});

// If the LLM tab is closed before we receive the "markdown-paste-complete"
// message, make sure we clear the loading badge so it doesn't remain stuck.
chrome.tabs.onRemoved.addListener((removedTabId) => {
  if (removedTabId === llmTabId && isProcessing) {
    clearLoadingBadge();
    isProcessing = false;
    llmTabId = null;
  }
});

// Ensure the correct icon is applied immediately after the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  updateActionIcon();
});
