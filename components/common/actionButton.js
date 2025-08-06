const loadingBadgeSequence = [
  '🕛',
  '🕐',
  '🕑',
  '🕒',
  '🕓',
  '🕔',
  '🕕',
  '🕖',
  '🕗',
  '🕘',
  '🕙',
  '🕚',
];
let loadingBadgeIndex = 0;
let loadingBadgeInterval = 0;

function startLoadingBadgeAnimation() {
  clearInterval(loadingBadgeInterval);
  loadingBadgeIndex = 0;

  loadingBadgeInterval = setInterval(() => {
    loadingBadgeIndex = (loadingBadgeIndex + 1) % loadingBadgeSequence.length;
    setActionButtonBadge(loadingBadgeSequence[loadingBadgeIndex]);
  }, 100);
}

function stopLoadingBadgeAnimation() {
  clearInterval(loadingBadgeInterval);
  loadingBadgeIndex = 0;
}

/**
 * Show a loading badge on the action button.
 */
export async function showLoadingBadge() {
  startLoadingBadgeAnimation();
}

/**
 * Set the action button badge text and background color.
 * @param {string} text - The text to display on the badge.
 */
export function setActionButtonBadge(text) {
  chrome.action.setBadgeText({ text }).catch(() => {});
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab && tab.id !== undefined) {
        chrome.action.setBadgeText({ text, tabId: tab.id }).catch(() => {});
      }
    }
  });
}

/**
 * Clear the loading badge on the action button.
 */
export async function clearLoadingBadge() {
  stopLoadingBadgeAnimation();
  await chrome.action.setBadgeText({ text: '' }).catch(() => {});

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab && tab.id !== undefined) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {});
      }
    }
  });
}
