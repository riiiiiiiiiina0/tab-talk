/**
 * @typedef {Object} YtSubtitleResponseBody
 * @property {YtSubtitleEvent[]} events
 */

/**
 * @typedef {Object} YtSubtitleEvent
 * @property {number} tStartMs - start time from the beginning of the video in milliseconds
 * @property {number} dDurationMs - duration of the event in milliseconds
 * @property {YtSubtitleSegment[]} [segs]
 */

/**
 * @typedef {Object} YtSubtitleSegment
 * @property {string} utf8 - the text of the segment
 */

// cache subtitle data here for every opened youtube tab, key is video id
const YT_SUBTITLE_CACHE = new Map();

/**
 * Parse the caption text from the given JSON response body.
 * @param {YtSubtitleResponseBody} json
 * @returns {string}
 */
function parseCaptionText(json) {
  let lastStartTime = '';
  const lines = [];

  json.events.forEach((event) => {
    const startTime = new Date(event.tStartMs).toISOString().substr(11, 8);
    const content =
      event.segs
        ?.map((seg) => seg.utf8)
        .join(' ')
        .replaceAll('\n', ' ') || '';

    if (startTime === lastStartTime) {
      lines[lines.length - 1] += ` ${content}`;
    } else {
      lines.push(`${startTime}: ${content}`);
    }

    lastStartTime = startTime;
  });

  return lines.join('\n');
}

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
    const captionText = parseCaptionText(json);
    setCachedCaption(videoId, captionText);
  } catch (err) {
    console.error('[background] Error handling subtitle request', err);
  }
}

/**
 * Get the cached caption for the given video id.
 * @param {string} videoId
 * @returns {string|null}
 */
export function getCachedCaption(videoId) {
  return YT_SUBTITLE_CACHE.get(videoId) || null;
}

/**
 * Set the cached caption for the given video id.
 * @param {string} videoId
 * @param {string} caption
 */
export function setCachedCaption(videoId, caption) {
  // Maintain an insertion-ordered cache capped at 20 entries. Updating an
  // existing video moves it to the most-recent position.
  if (YT_SUBTITLE_CACHE.has(videoId)) {
    YT_SUBTITLE_CACHE.delete(videoId);
  }
  YT_SUBTITLE_CACHE.set(videoId, caption);
  if (YT_SUBTITLE_CACHE.size > 50) {
    // The first key in the Map is the oldest entry.
    const oldestKey = YT_SUBTITLE_CACHE.keys().next().value;
    YT_SUBTITLE_CACHE.delete(oldestKey);
  }
  console.log(
    '[background] youtube caption cached',
    videoId,
    YT_SUBTITLE_CACHE.keys(),
  );
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
    '[background] youtube caption interceptor registered via webRequest',
  );
} catch (err) {
  console.error('[background] Failed to register webRequest listener', err);
}

// Provide cached caption data to content scripts on demand
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'get-youtube-caption') return;

  console.log('[background] youtube manager onMessage', message);
  const { videoId } = message;
  if (typeof videoId !== 'string' || !videoId) {
    sendResponse({ caption: null });
    return;
  }

  const caption = YT_SUBTITLE_CACHE.get(videoId) || null;
  sendResponse({ caption });
});
