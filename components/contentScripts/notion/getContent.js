(function () {
  async function getNotionPageContent() {
    // Check if we're on a Notion page
    if (!location.hostname.includes('notion.so')) return null;

    // get current page id from url
    const pageToken = location.pathname.split('/').pop() || '';
    const rawId = pageToken.split('-').pop() || '';
    const pageId = rawId.replace(
      /^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/,
      '$1-$2-$3-$4-$5',
    );

    if (!pageId || pageId.length !== 36) {
      console.warn('Could not extract valid page ID from URL');
      return null;
    }

    // Helper function to make API requests to Notion
    async function notionApiRequest(endpoint, payload) {
      try {
        const response = await fetch(
          `https://www.notion.so/api/v3/${endpoint}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            credentials: 'include', // Include cookies for authentication
          },
        );

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Notion API request failed for ${endpoint}:`, error);
        return null;
      }
    }

    // Convert block type to markdown
    function blockToMarkdown(block, allBlocks) {
      if (!block || !block.value) return '';

      const blockValue = block.value;
      const blockType = blockValue.type;
      const properties = blockValue.properties || {};
      const format = blockValue.format || {};

      // Enhanced rich text processing with formatting support
      function getRichTextContent(textArray) {
        if (!textArray || !Array.isArray(textArray)) return '';
        return textArray
          .map((item) => {
            if (typeof item === 'string') return item;
            if (Array.isArray(item) && item.length > 0) {
              let text = item[0];
              // Apply formatting if present
              if (item.length > 1 && Array.isArray(item[1])) {
                const formatting = item[1];
                formatting.forEach((format) => {
                  if (format[0] === 'b') text = `**${text}**`; // bold
                  if (format[0] === 'i') text = `*${text}*`; // italic
                  if (format[0] === 'c') text = `\`${text}\``; // code
                  if (format[0] === 's') text = `~~${text}~~`; // strikethrough
                  if (format[0] === '_') text = `<u>${text}</u>`; // underline
                  if (format[0] === 'a') text = `[${text}](${format[1]})`; // link
                  if (format[0] === 'h') {
                    // highlight/background color
                    const color = format[1];
                    if (color === 'yellow') text = `==${text}==`; // highlight
                  }
                });
              }
              return text;
            }
            return '';
          })
          .join('');
      }

      // Process child blocks
      function processChildren(blockId) {
        if (!blockValue.content) return '';

        const childMarkdown = blockValue.content
          .map((childId) => {
            const childBlock = allBlocks[childId];
            return blockToMarkdown(childBlock, allBlocks);
          })
          .filter(Boolean)
          .join('\n');

        return childMarkdown;
      }

      const title = getRichTextContent(properties.title);
      const caption = getRichTextContent(properties.caption);
      const children = processChildren(blockValue.id);

      switch (blockType) {
        // Page blocks
        case 'page':
          if (blockValue.id === pageId) {
            // This is the main page, return its children
            return children;
          } else {
            // This is a sub-page, treat as link
            return `[${title}](https://www.notion.so/${blockValue.id.replace(
              /-/g,
              '',
            )})`;
          }

        // Text blocks
        case 'paragraph':
        case 'text':
          if (!title && !children) return '';
          return title ? `${title}\n\n${children}` : children;

        // Heading blocks
        case 'heading_1':
        case 'header':
          return `# ${title}\n\n${children}`;

        case 'heading_2':
        case 'sub_header':
          return `## ${title}\n\n${children}`;

        case 'heading_3':
        case 'sub_sub_header':
          return `### ${title}\n\n${children}`;

        // List blocks
        case 'bulleted_list_item':
        case 'bulleted_list':
          const bulletChildren = children
            ? children
                .split('\n')
                .filter(Boolean)
                .map((line) => `  ${line}`)
                .join('\n')
            : '';
          return `- ${title}${bulletChildren ? '\n' + bulletChildren : ''}`;

        case 'numbered_list_item':
        case 'numbered_list':
          const numberedChildren = children
            ? children
                .split('\n')
                .filter(Boolean)
                .map((line) => `  ${line}`)
                .join('\n')
            : '';
          return `1. ${title}${
            numberedChildren ? '\n' + numberedChildren : ''
          }`;

        case 'to_do':
          const checked = blockValue.properties?.checked?.[0]?.[0] === 'Yes';
          const checkbox = checked ? '[x]' : '[ ]';
          const todoChildren = children
            ? children
                .split('\n')
                .filter(Boolean)
                .map((line) => `  ${line}`)
                .join('\n')
            : '';
          return `- ${checkbox} ${title}${
            todoChildren ? '\n' + todoChildren : ''
          }`;

        // Quote block
        case 'quote':
          const quoteLines = title
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n');
          return `${quoteLines}\n\n${children}`;

        // Code block
        case 'code':
          const language =
            format.code_language || properties.language?.[0]?.[0] || '';
          const codeContent = getRichTextContent(
            properties.code || properties.title,
          );
          return `\`\`\`${language}\n${codeContent}\n\`\`\`\n\n${children}`;

        // Callout block
        case 'callout':
          const icon = format.page_icon || blockValue.icon?.emoji || '💡';
          const bgColor = format.block_color;
          let calloutPrefix = `> ${icon} `;
          if (bgColor && bgColor !== 'default') {
            calloutPrefix = `> **${icon} ${title}**\n> `;
          }
          return `${calloutPrefix}${title}\n\n${children}`;

        // Toggle block
        case 'toggle':
          return `<details>\n<summary>${title}</summary>\n\n${children}\n</details>\n\n`;

        // Divider
        case 'divider':
          return '---\n\n';

        // Media blocks
        case 'image':
          const imageUrl =
            format.display_source ||
            blockValue.image?.external?.url ||
            blockValue.image?.file?.url ||
            '';
          return `![${
            caption || title || 'Image'
          }](${imageUrl})\n\n${children}`;

        case 'video':
          const videoUrl =
            format.display_source ||
            blockValue.video?.external?.url ||
            blockValue.video?.file?.url ||
            '';
          return `[📹 Video: ${title || 'Video'}](${videoUrl})\n\n${children}`;

        case 'file':
          const fileUrl =
            format.display_source ||
            blockValue.file?.external?.url ||
            blockValue.file?.file?.url ||
            '';
          const fileName = title || blockValue.file?.name || 'File';
          return `[📁 ${fileName}](${fileUrl})\n\n${children}`;

        case 'pdf':
          const pdfUrl =
            format.display_source ||
            blockValue.pdf?.external?.url ||
            blockValue.pdf?.file?.url ||
            '';
          return `[📄 PDF: ${title || 'PDF'}](${pdfUrl})\n\n${children}`;

        // Link blocks
        case 'bookmark':
          const bookmarkUrl =
            format.bookmark_url || blockValue.bookmark?.url || '';
          const bookmarkTitle = title || bookmarkUrl;
          return `[🔖 ${bookmarkTitle}](${bookmarkUrl})\n\n${children}`;

        case 'link_to_page':
          const linkedPageId = blockValue.link_to_page?.page_id || '';
          return `[📄 ${
            title || 'Linked Page'
          }](https://www.notion.so/${linkedPageId.replace(
            /-/g,
            '',
          )})\n\n${children}`;

        case 'embed':
          const embedUrl = blockValue.embed?.url || format.display_source || '';
          return `[🔗 ${title || embedUrl}](${embedUrl})\n\n${children}`;

        // Layout blocks
        case 'column_list':
          return `${children}\n\n`;

        case 'column':
          return children;

        // Table blocks
        case 'table':
          console.log('table block', blockValue);
          // For tables, we need to process the table_row children specially
          if (!children) return '';
          const columnOrder = blockValue.format.table_block_column_order || [];
          const tableRows =
            blockValue.content
              ?.map((childId) => {
                const childBlock = allBlocks[childId];
                if (childBlock?.value?.type === 'table_row') {
                  console.log('table_row block', childBlock);
                  const cellValues = columnOrder
                    .map((columnId) => {
                      const textArr =
                        childBlock.value.properties[columnId] || [];
                      return getRichTextContent(textArr) || ' ';
                    })
                    .join(' | ');
                  return `| ${cellValues} |`;
                }
                return '';
              })
              .filter(Boolean) || [];

          if (tableRows.length === 0) return children;

          // Add header separator
          const headerSeparator =
            '| ' +
            tableRows[0]
              .split('|')
              .slice(1, -1)
              .map(() => '---')
              .join(' | ') +
            ' |';
          tableRows.splice(1, 0, headerSeparator);

          return tableRows.join('\n') + '\n\n';

        case 'table_row':
          // This should be handled by the table case above
          const cells = properties || {};
          const cellValues = Object.keys(cells)
            .sort()
            .map((key) => getRichTextContent(cells[key]) || ' ')
            .join(' | ');
          return `| ${cellValues} |`;

        // Special blocks
        case 'equation':
          const expression =
            blockValue.expression || properties.title?.[0]?.[0] || '';
          return `$$${expression}$$\n\n${children}`;

        case 'table_of_contents':
          return `**Table of Contents**\n\n${children}`;

        case 'breadcrumb':
          return `🏠 Breadcrumb\n\n${children}`;

        case 'synced_block':
          const syncedFrom = blockValue.synced_from;
          if (syncedFrom) {
            return `*[Synced from another block]*\n\n${children}`;
          }
          return children;

        case 'template':
          return `**Template:** ${title}\n\n${children}`;

        default:
          // For unknown block types, just return the text content
          console.warn(`Unknown block type: ${blockType}`);
          return title ? `${title}\n\n${children}` : children;
      }
    }

    try {
      // 1. Fetch the top level page content
      console.log('Fetching Notion page content for ID:', pageId);

      const pageChunkResponse = await notionApiRequest('loadPageChunk', {
        pageId: pageId,
        limit: 100,
        cursor: { stack: [] },
        chunkNumber: 0,
        verticalColumns: false,
      });

      if (!pageChunkResponse || !pageChunkResponse.recordMap) {
        console.warn('Failed to fetch page chunk or invalid response');
        return null;
      }

      let allBlocks = { ...pageChunkResponse.recordMap.block };
      let missingBlockIds = new Set();

      // 2. Identify missing blocks by traversing the content
      function findMissingBlocks(blockId, visited = new Set()) {
        if (visited.has(blockId) || !allBlocks[blockId]) return;
        visited.add(blockId);

        const block = allBlocks[blockId];
        if (block && block.value && block.value.content) {
          block.value.content.forEach((childId) => {
            if (!allBlocks[childId]) {
              missingBlockIds.add(childId);
            } else {
              findMissingBlocks(childId, visited);
            }
          });
        }
      }

      findMissingBlocks(pageId);

      // 3. Fetch missing blocks if any
      if (missingBlockIds.size > 0) {
        console.log('Fetching missing blocks:', Array.from(missingBlockIds));

        const missingBlocksResponse = await notionApiRequest(
          'getRecordValues',
          {
            requests: Array.from(missingBlockIds).map((id) => ({
              table: 'block',
              id: id,
            })),
          },
        );

        if (missingBlocksResponse && missingBlocksResponse.results) {
          missingBlocksResponse.results.forEach((result) => {
            if (result.value) {
              allBlocks[result.value.id] = result;
            }
          });
        }

        // 4. Repeat the process to find any newly discovered missing blocks
        let iterations = 0;
        const maxIterations = 3; // Prevent infinite loops

        while (iterations < maxIterations) {
          const previousCount = Object.keys(allBlocks).length;
          missingBlockIds.clear();

          Object.keys(allBlocks).forEach((blockId) => {
            findMissingBlocks(blockId);
          });

          if (missingBlockIds.size === 0) break;

          const additionalBlocksResponse = await notionApiRequest(
            'getRecordValues',
            {
              requests: Array.from(missingBlockIds).map((id) => ({
                table: 'block',
                id: id,
              })),
            },
          );

          if (additionalBlocksResponse && additionalBlocksResponse.results) {
            additionalBlocksResponse.results.forEach((result) => {
              if (result.value) {
                allBlocks[result.value.id] = result;
              }
            });
          }

          const currentCount = Object.keys(allBlocks).length;
          if (currentCount === previousCount) break; // No new blocks found

          iterations++;
        }
      }

      // 5. Convert blocks to markdown
      const rootBlock = allBlocks[pageId];
      if (!rootBlock) {
        console.warn('Root page block not found');
        return null;
      }

      const pageTitle = rootBlock.value?.properties?.title
        ? rootBlock.value.properties.title
            .map((item) => (typeof item === 'string' ? item : item[0]))
            .join('')
        : 'Untitled';

      const markdown = blockToMarkdown(rootBlock, allBlocks);

      // Add page title at the top
      const finalMarkdown = `# ${pageTitle}\n\n${markdown}`;

      console.log('Successfully converted Notion page to markdown');
      console.log(finalMarkdown);
      return finalMarkdown.trim();
    } catch (error) {
      console.error('Error fetching Notion page content:', error);
      return null;
    }
  }

  // Register content getter function for the shared collector
  window['getContent'] = getNotionPageContent;
})();
