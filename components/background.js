import './common/actionButtonBehavior.js';
import './common/ytSubtitleIntercept.js';
import { LLM_PROVIDER_META, getLLMProvider } from './common/llmProviders.js';
import {
  collectPageContent,
  injectScriptToPasteFilesAsAttachments,
} from './common/pageContent.js';
import { getIconStyle } from './common/iconStyle.js';

let collectedContents = [];
let lastIsDark = false;

/**
 * Update the extension action icon based on theme and selected icon style.
 * @param {boolean} isDark Whether the OS theme is dark.
 */
async function updateActionIcon(isDark) {
  const style = await getIconStyle();
  const baseName = style === 'simple' ? 'simple' : 'rainbow';
  const iconName = isDark ? `${baseName}-dark` : baseName;
  const iconDict = {
    16: `/icons/${iconName}/icon-16x16.png`,
    32: `/icons/${iconName}/icon-32x32.png`,
    48: `/icons/${iconName}/icon-48x48.png`,
    128: `/icons/${iconName}/icon-128x128.png`,
  };

  chrome.action.setIcon({ path: iconDict });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id !== undefined) {
      chrome.action.setIcon({ path: iconDict, tabId: tab.id });
    }
  });
}

/**
 * Show a loading badge on the action button.
 * @param {number} [tabId] - The tab ID to show the badge on.
 */
async function showLoadingBadge(tabId) {
  // On Vivaldi, the badge is not updated on current tab on the action button, unless we set it on the current tab.
  if (tabId) {
    await chrome.action.setBadgeText({ text: '⏳', tabId }).catch(() => {});
    await chrome.action
      .setBadgeBackgroundColor({ color: '#4CAF50', tabId })
      .catch(() => {});
  }

  await chrome.action.setBadgeText({ text: '⏳' }).catch(() => {});
  await chrome.action
    .setBadgeBackgroundColor({ color: '#4CAF50' })
    .catch(() => {});
}

async function collectPageContentOneByOne(tabsToProcess) {
  // Show a loading badge while we process the tabs and until the content is pasted into the LLM page.
  await showLoadingBadge();

  const results = [];
  try {
    for (const tab of tabsToProcess) {
      const content = await collectPageContent(tab);
      results.push(content);
    }
    return results;
  } catch (err) {
    // Clear the badge if something goes wrong so we don't leave it stuck.
    await chrome.action.setBadgeText({ text: '' }).catch(() => {});
    throw err;
  }
}

/**
 * Handle the action button click.
 * This will be called when user click the action button when NOT in LLM provider page.
 * @param {chrome.tabs.Tab} activeTab
 */
chrome.action.onClicked.addListener(async (activeTab) => {
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

  // Handle OS theme changes (sent from detectThemeChange.js)
  if (
    message.type === 'os-theme-changed' &&
    typeof message.dark === 'boolean'
  ) {
    lastIsDark = !!message.dark;
    updateActionIcon(lastIsDark);
    return;
  }

  if (message.type === 'icon-style-changed') {
    updateActionIcon(lastIsDark);
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
      showLoadingBadge(tabId);

      collectPageContentOneByOne(message.tabIds).then((contents) => {
        collectedContents = contents;
        chrome.tabs.update(tabId, { active: true }, () => {
          injectScriptToPasteFilesAsAttachments(tabId);
        });
      });
    } else if (message.type === 'get-selected-tabs-data') {
      sendResponse({ tabs: collectedContents });
    } else if (message.type === 'markdown-paste-complete') {
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
      chrome.action.setBadgeText({ text: '' }).catch(() => {});
    }
  });

  return true;
});
