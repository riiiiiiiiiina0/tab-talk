/**
 * Shared page content collection functionality for content scripts.
 * This module provides a common way to collect page content, handle selected text,
 * and send messages back to the background script.
 *
 * Content scripts should register their content getter function as window.getContent,
 * then this script will automatically collect and send the content.
 */

/**
 * Collects page content by calling window.getContent(),
 * includes any selected text, and sends the result to the background script.
 */
async function collectAndSendPageContent() {
  const result = {
    type: 'page-content-collected',
    title: document.title,
    url: document.location.href,
    content: '',
  };

  // Check if a content getter function has been registered
  if (typeof window['getContent'] !== 'function') {
    console.error('No window.getContent function registered');
    chrome.runtime.sendMessage(result);
    return;
  }

  const content = await window['getContent']();

  // Wrap the collected data in XML and include any user-selected text
  const sel = window.getSelection ? window.getSelection() : null;
  const selectedText = sel ? sel.toString().trim() : '';

  let formattedContent = [];
  if (selectedText) {
    formattedContent.push(`<selectedText>\n${selectedText}\n</selectedText>`);
  }
  formattedContent.push(`<content>\n${content || 'no content'}\n</content>`);

  // Send the content back to the background script
  chrome.runtime.sendMessage({
    ...result,
    content: formattedContent.join('\n\n'),
  });
}

// Auto-execute the collection when this script loads
// (after giving time for content scripts to register their functions)
setTimeout(collectAndSendPageContent, 100);
