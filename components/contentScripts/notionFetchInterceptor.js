// Store the original fetch function
const originalFetch = window.fetch;

// The target Notion API endpoint we want to intercept
const NOTION_CHUNKS_ENDPOINT = '/api/v3/loadCachedPageChunks';

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

      // Log or process the intercepted data
      console.log(
        '[Notion API request interceptor]',
        'Intercepted Notion loadCachedPageChunks response:',
        responseData,
      );

      // // You can also send this data to the extension's background script if needed
      // chrome.runtime.sendMessage({
      //   type: 'NOTION_PAGE_CHUNKS',
      //   data: responseData,
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
