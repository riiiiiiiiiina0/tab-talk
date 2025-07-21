import './common/actionButtonBehavior.js';
import './common/ytSubtitleIntercept.js';
import { LLM_PROVIDER_META, getLLMProvider } from './common/llmProviders.js';
import {
  collectPageContent,
  injectScriptToPasteFilesAsAttachments,
} from './common/pageContent.js';

let collectedContents = [];

async function collectPageContentOneByOne(tabsToProcess) {
  // Show a loading badge while we process the tabs
  try {
    // Display an hourglass emoji as badge text
    await chrome.action.setBadgeText({ text: '⏳' }).catch(() => {});
    // Optional: darker background so the white emoji stands out
    await chrome.action
      .setBadgeBackgroundColor({ color: '#4b5563' })
      .catch(() => {});

    const results = [];
    for (const tab of tabsToProcess) {
      const content = await collectPageContent(tab);
      results.push(content);
    }
    return results;
  } finally {
    // Clear the badge once we're finished (or if an error occurs)
    await chrome.action.setBadgeText({ text: '' }).catch(() => {});
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

  // keep the current tab id first, we might need to jump back to it
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tabId = tabs[0].id;
    if (!tabId) return;

    if (
      message.type === 'collect-page-content' &&
      Array.isArray(message.tabIds)
    ) {
      collectPageContentOneByOne(message.tabIds).then((contents) => {
        collectedContents = contents;
        chrome.tabs.update(tabId, { active: true }, () => {
          injectScriptToPasteFilesAsAttachments(tabId);
        });
      });
    } else if (message.type === 'get-selected-tabs-data') {
      sendResponse({ tabs: collectedContents });
    }
  });

  return true;
});
