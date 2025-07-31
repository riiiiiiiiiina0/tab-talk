import './common/actionButtonBehavior.js';
import './common/managerYouTube.js';
import {
  showLoadingBadge,
  clearLoadingBadge,
  updateActionIcon,
} from './common/actionButton.js';
import {
  LLM_PROVIDER_META,
  LLM_PROVIDER_CHATGPT,
  getLLMProvider,
} from './utils/llmProviders.js';
import { getLogOnly } from './utils/developerOptions.js';
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

// Double-click detection variables
let clickTimeout = null;
let clickCount = 0;
const DOUBLE_CLICK_DELAY = 500; // milliseconds

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
 * Download collected content as markdown files.
 * @param {(import('./common/pageContent.js').CollectedTabInfo | null)[]} contents
 */
async function downloadContentsAsMarkdown(contents) {
  try {
    const validContents = contents.filter((content) => content !== null);

    if (validContents.length === 0) {
      console.log('[background] no valid content to download');
      return;
    }

    for (let i = 0; i < validContents.length; i++) {
      const content = validContents[i];

      // Generate a safe filename
      const safeTitle =
        content.title
          .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename characters with '-'
          .substring(0, 100) // Limit length
          .trim() || 'page';

      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
        now.getDate(),
      )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const filename =
        validContents.length > 1
          ? `${safeTitle}_${i + 1}_${timestamp}.md`
          : `${safeTitle}_${timestamp}.md`;

      // Format the content as markdown
      const markdownContent = `# ${content.title}\n\n**URL:** ${
        content.url
      }\n\n**Extracted:** ${new Date().toISOString()}\n\n---\n\n${
        content.content
      }`;

      // Create data URL for download (service workers don't support URL.createObjectURL)
      const dataUrl =
        'data:text/markdown;charset=utf-8,' +
        encodeURIComponent(markdownContent);

      await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false,
      });
    }

    console.log(
      `[background] downloaded ${validContents.length} markdown file(s)`,
    );
  } catch (err) {
    console.error('[background] download error:', err);
  } finally {
    await clearLoadingBadge();
    isProcessing = false;
  }
}

/**
 * Handle single click action - original behavior
 * @param {chrome.tabs.Tab} activeTab
 */
async function handleSingleClick(activeTab) {
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

    const logOnly = await getLogOnly();
    if (logOnly) {
      console.log('[background] developer mode: logging content to console');
      console.log(collectedContents);
      await clearLoadingBadge();
      isProcessing = false;
      return;
    }

    // open llm page & paste in page content
    const llmProvider = await getLLMProvider();
    const meta = LLM_PROVIDER_META[llmProvider];
    if (!meta) {
      console.error('[background] llm provider not supported:', llmProvider);
      return;
    }
    let url = meta.url;
    // Add hint=search parameter for ChatGPT
    if (llmProvider === LLM_PROVIDER_CHATGPT) {
      url += '?hints=search';
    }
    const tab = await chrome.tabs.create({ url, active: true });
    if (tab.id) {
      llmTabId = tab.id; // record the tab so we know which one to watch
      injectScriptToPasteFilesAsAttachments(tab.id);
    }
  } catch (err) {
    console.error('[background] single click error:', err);
  }
}

/**
 * Handle double click action - download as markdown
 * @param {chrome.tabs.Tab} activeTab
 */
async function handleDoubleClick(activeTab) {
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
      console.log('[background] no tabs to process for download');
      return;
    }

    const tabIds = tabsToProcess.map((tab) => tab.id);

    const contents = await collectPageContentOneByOne(tabIds);
    await downloadContentsAsMarkdown(contents);
  } catch (err) {
    console.error('[background] double click error:', err);
  }
}

/**
 * Handle the action button click with double-click detection.
 * @param {chrome.tabs.Tab} activeTab
 */
chrome.action.onClicked.addListener(async (activeTab) => {
  // Ignore the click if we are already processing a previous request
  if (isProcessing) {
    console.log('[background] still processing, click ignored');
    return;
  }

  clickCount++;

  if (clickCount === 1) {
    // First click - wait to see if there's a second click
    clickTimeout = setTimeout(() => {
      // Single click
      console.log('[background] single click detected');
      handleSingleClick(activeTab);
      clickCount = 0;
    }, DOUBLE_CLICK_DELAY);
  } else if (clickCount === 2) {
    // Second click - it's a double click
    clearTimeout(clickTimeout);
    console.log('[background] double click detected');
    handleDoubleClick(activeTab);
    clickCount = 0;
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

// Ensure the correct icon is applied when the browser starts
chrome.runtime.onStartup.addListener(() => {
  updateActionIcon();
});
