import { initActionButtonBehavior } from './common/actionButtonBehavior.js';
import { LLM_PROVIDER_META, getLLMProvider } from './common/llmProviders.js';
import {
  collectPageContent,
  injectContentScripts,
  injectScriptToPasteFilesAsAttachments,
} from './common/pageContent.js';

initActionButtonBehavior();

let collectedContents = [];

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
    console.log('tabsToProcess', tabsToProcess);

    if (tabsToProcess.length === 0) {
      console.log('[background] no tabs to process');
      return;
    }

    collectedContents = await Promise.all(
      tabsToProcess.map((tab) => collectPageContent(tab.id)),
    );
    console.log('collectedContents', collectedContents);

    // open llm page & paste in page content
    const llmProvider = await getLLMProvider();
    const meta = LLM_PROVIDER_META[llmProvider];
    if (!meta) {
      console.error('[background] llm provider not supported:', llmProvider);
      return;
    }
    const url = meta.url;
    const tab = await chrome.tabs.create({ url });
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

  if (
    message.type === 'collect-page-content' &&
    Array.isArray(message.tabIds)
  ) {
    console.log('collect-page-content', message);
    Promise.all(message.tabIds.map((tabId) => collectPageContent(tabId))).then(
      (contents) => {
        collectedContents = contents;
        console.log('collectedContents', collectedContents);

        // get current tab id, it should be the llm provider page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length === 0) return;
          const activeTab = tabs[0];
          if (activeTab.id) {
            injectScriptToPasteFilesAsAttachments(activeTab.id);
          }
        });
      },
    );
    return true;
  } else if (message.type === 'get-selected-tabs-data') {
    sendResponse({ tabs: collectedContents });
    return;
  }
});
