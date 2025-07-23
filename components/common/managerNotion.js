// Store Notion page Markdown keyed by pageId so other parts of the extension can retrieve later.
const NOTION_PAGE_MARKDOWN_CACHE = new Map();

/**
 * Get the cached markdown for the given page id.
 * @param {string} pageId
 * @returns {string|null}
 */
export function getNotionPageMarkdown(pageId) {
  return NOTION_PAGE_MARKDOWN_CACHE.get(pageId) || null;
}

/**
 * Set the cached markdown for the given page id.
 * @param {string} pageId
 * @param {string} markdown
 */
export function setNotionPageMarkdown(pageId, markdown) {
  NOTION_PAGE_MARKDOWN_CACHE.set(pageId, markdown);
}

/**
 * Delete the cached markdown for the given page id.
 * @param {string} pageId
 */
export function deleteNotionPageMarkdown(pageId) {
  NOTION_PAGE_MARKDOWN_CACHE.delete(pageId);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'notion-page-chunks-markdown' && message.data) {
    console.log('[background] notion manager onMessage', message);
    const { pageId, markdown } = message.data;
    if (pageId) {
      setNotionPageMarkdown(pageId, markdown);
    }
  }
});

// Provide cached Notion page markdown to content scripts on demand
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'get-notion-page-markdown') return;

  console.log('[background] notion manager onMessage', message);
  const { pageId } = message;
  if (typeof pageId !== 'string' || !pageId) {
    sendResponse({ pageId, markdown: null });
    return;
  }

  const markdown = NOTION_PAGE_MARKDOWN_CACHE.get(pageId) || null;
  sendResponse({ pageId, markdown });
});

console.log('[background] notion manager initialized');
