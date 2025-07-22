// Store the original fetch function
const originalFetch = window.fetch;

// The target Notion API endpoint we want to intercept
const NOTION_CHUNKS_ENDPOINT = '/api/v3/loadCachedPageChunks';

// === Added: Minimal Notion → Markdown helper ===
/**
 * Convert Notion's recordMap object to a Markdown string.
 * This is **very** simplified – it handles common block types that appear in
 * personal notes (headings, paragraphs, lists, to-dos).
 *
 * @param {any} recordMap The recordMap returned by /loadCachedPageChunks.
 * @returns {string} Markdown string.
 */
function notionRecordMapToMarkdown(recordMap) {
  if (!recordMap || !recordMap.block) {
    return '';
  }

  const blocks = recordMap.block;

  // Helper to safely get the underlying block value
  const getBlock = (id) => {
    const wrapper = blocks[id];
    if (!wrapper) return undefined;
    // Some Notion exports use wrapper.value.value, others wrapper.value
    return wrapper.value?.value || wrapper.value;
  };

  // Extract plain text from the Notion rich-text array (ignores annotations)
  const getPlainText = (properties) => {
    if (!properties || !properties.title) return '';
    return properties.title.map((t) => (Array.isArray(t) ? t[0] : t)).join('');
  };

  // Choose root blocks (page blocks without a parent inside the recordMap)
  const rootBlockIds = Object.keys(blocks).filter((id) => {
    const b = getBlock(id);
    if (!b) return false;
    if (b.type !== 'page') return false;
    // If parent block exists inside the same recordMap, it's not root
    if (b.parent_id && blocks[b.parent_id]) return false;
    return true;
  });

  if (rootBlockIds.length === 0) {
    // Fallback: just pick the first block and render everything reachable
    rootBlockIds.push(Object.keys(blocks)[0]);
  }

  const visited = new Set();

  const lines = [];

  const renderBlockRecursive = (id, indent = 0) => {
    if (visited.has(id)) return; // Avoid cycles
    visited.add(id);

    const block = getBlock(id);
    if (!block || !block.type) return;

    const prefixSpaces = ' '.repeat(indent * 2);
    let line = '';

    switch (block.type) {
      case 'page':
        line = `# ${getPlainText(block.properties)}`;
        break;
      case 'header':
        line = `# ${getPlainText(block.properties)}`;
        break;
      case 'sub_header':
        line = `## ${getPlainText(block.properties)}`;
        break;
      case 'sub_sub_header':
        line = `### ${getPlainText(block.properties)}`;
        break;
      case 'text':
        line = `${getPlainText(block.properties)}`;
        break;
      case 'bulleted_list':
        line = `${prefixSpaces}- ${getPlainText(block.properties)}`;
        break;
      case 'numbered_list':
        line = `${prefixSpaces}1. ${getPlainText(block.properties)}`;
        break;
      case 'to_do': {
        const checked = block.properties?.checked?.[0]?.[0] === 'Yes';
        line = `${prefixSpaces}- [${checked ? 'x' : ' '}] ${getPlainText(
          block.properties,
        )}`;
        break;
      }
      default:
        // Unsupported block type – skip rendering but descend into children
        break;
    }

    if (line) {
      lines.push(line);
    }

    if (Array.isArray(block.content)) {
      // Increase indent for list item children; otherwise keep same indent
      const childIndent = ['bulleted_list', 'numbered_list', 'to_do'].includes(
        block.type,
      )
        ? indent + 1
        : indent;

      block.content.forEach((childId) =>
        renderBlockRecursive(childId, childIndent),
      );
    }
  };

  rootBlockIds.forEach((id, idx) => {
    if (idx > 0) lines.push(''); // blank line between pages
    renderBlockRecursive(id, 0);
  });

  return lines.join('\n').trim();
}

// Patch the global fetch function
window.fetch = async function (...args) {
  const [resource, config] = args;

  // Check if this is a request to the Notion API endpoint we're interested in
  if (resource === NOTION_CHUNKS_ENDPOINT) {
    try {
      // Make the original request
      const response = await originalFetch(...args);

      // Clone the response so we can read it multiple times
      const clonedResponse = response.clone();

      // Read the response body as JSON
      const responseData = await clonedResponse.json();

      // 👉 Parse the recordMap into Markdown
      const markdown = notionRecordMapToMarkdown(responseData?.recordMap);

      // Log or process the intercepted data
      console.log(
        '[Notion API request interceptor]',
        'Intercepted Notion loadCachedPageChunks response as markdown:',
        markdown,
      );

      // // You can also send this data to the extension's background script if needed
      // chrome.runtime.sendMessage({
      //   type: 'NOTION_PAGE_CHUNKS_MARKDOWN',
      //   data: markdown,
      // });

      // Return the original response so the page continues working normally
      return response;
    } catch (error) {
      console.error(
        '[Notion API request interceptor]',
        'Error intercepting Notion API request:',
        error,
      );
      // If something goes wrong, fall back to the original request
      return originalFetch(...args);
    }
  }

  // For all other requests, pass through to the original fetch
  return originalFetch(...args);
};

// Log that the interceptor is active
console.log('[Notion API request interceptor] initialized');
