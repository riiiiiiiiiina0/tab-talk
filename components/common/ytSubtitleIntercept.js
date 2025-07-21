/**
 * @typedef {Object} YtSubtitleResponseBody
 * @property {YtSubtitleEvent[]} events
 */

/**
 * @typedef {Object} YtSubtitleEvent
 * @property {number} tStartMs - start time from the beginning of the video in milliseconds
 * @property {number} dDurationMs - duration of the event in milliseconds
 * @property {YtSubtitleSegment[]} segs
 */

/**
 * @typedef {Object} YtSubtitleSegment
 * @property {string} utf8 - the text of the segment
 */

const YT_SUBTITLE_RULE_ID = 1000;

// cache subtitle data here for every opened youtube tab, key is video id
const YT_SUBTITLE_CACHE = new Map();

/**
 * Common handler for both DNR debug and webRequest approaches.
 * Duplicates the request to obtain its body and caches the caption text.
 * @param {string|undefined} url
 * @param {number|undefined} tabId
 */
async function handleSubtitleRequest(url, tabId) {
  try {
    if (typeof tabId !== 'number' || tabId === chrome.tabs.TAB_ID_NONE || !url)
      return;

    // get video id from url
    const parsedUrl = new URL(url);
    const videoId = parsedUrl.searchParams.get('v');
    if (!videoId) return;

    // Duplicate the request to obtain the response body. We rely on host
    // permissions ("<all_urls>") so no additional CORS handling is required.
    const res = await fetch(url, { credentials: 'include' }).catch(() => null);
    if (!res) return;

    /** @type {YtSubtitleResponseBody} */
    const json = await res.json();

    const captionText = json.events
      .map((event) => {
        // convert tStartMs to HH:mm:ss format
        const startTime = new Date(event.tStartMs).toISOString().substr(11, 8);
        return `${startTime}: ${event.segs
          .map((seg) => seg.utf8)
          .join(' ')
          .replaceAll('\n', ' ')}`;
      })
      .join('\n');

    // Maintain an insertion-ordered cache capped at 20 entries. Updating an
    // existing video moves it to the most-recent position.
    if (YT_SUBTITLE_CACHE.has(videoId)) {
      YT_SUBTITLE_CACHE.delete(videoId);
    }
    YT_SUBTITLE_CACHE.set(videoId, captionText);
    if (YT_SUBTITLE_CACHE.size > 20) {
      // The first key in the Map is the oldest entry.
      const oldestKey = YT_SUBTITLE_CACHE.keys().next().value;
      YT_SUBTITLE_CACHE.delete(oldestKey);
    }
    // console.log('[background] YouTube subtitle cached', videoId, '\n', captionText);
  } catch (err) {
    console.error('[background] Error handling subtitle request', err);
  }
}

// Always use the WebRequest API (MV3-compatible) to observe YouTube subtitle
// requests in both development and production builds.
try {
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      handleSubtitleRequest(details.url, details.tabId);
    },
    {
      urls: ['*://*.youtube.com/api/timedtext*'],
      types: ['xmlhttprequest'],
    },
  );
  console.log(
    '[background] YouTube subtitle interceptor registered via webRequest',
  );
} catch (err) {
  console.error('[background] Failed to register webRequest listener', err);
}

// Provide cached caption data to content scripts on demand
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'get-youtube-caption') return;

  const { videoId } = message;
  if (typeof videoId !== 'string' || !videoId) {
    sendResponse({ caption: null });
    return;
  }

  const caption = YT_SUBTITLE_CACHE.get(videoId) || null;
  sendResponse({ caption });
});
