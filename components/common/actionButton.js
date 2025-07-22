import { getIconStyle } from './iconStyle.js';

/**
 * Update the extension action icon based on theme and selected icon style.
 */
export async function updateActionIcon() {
  const style = await getIconStyle();
  const iconName = style === 'simple' ? 'simple' : 'rainbow';
  const iconDict = {
    16: `/icons/${iconName}/icon-16x16.png`,
    32: `/icons/${iconName}/icon-32x32.png`,
    48: `/icons/${iconName}/icon-48x48.png`,
    128: `/icons/${iconName}/icon-128x128.png`,
  };

  chrome.action.setIcon({ path: iconDict });
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab && tab.id !== undefined) {
        chrome.action.setIcon({ path: iconDict, tabId: tab.id });
      }
    }
  });
}

/**
 * Show a loading badge on the action button.
 */
export async function showLoadingBadge() {
  setActionButtonBadge('Loading');
}

/**
 * Set the action button badge text and background color.
 * @param {string} text - The text to display on the badge.
 */
export function setActionButtonBadge(text) {
  chrome.action.setBadgeText({ text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' }).catch(() => {});

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab && tab.id !== undefined) {
        chrome.action.setBadgeText({ text, tabId: tab.id }).catch(() => {});
        chrome.action
          .setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id })
          .catch(() => {});
      }
    }
  });
}

/**
 * Clear the loading badge on the action button.
 */
export async function clearLoadingBadge() {
  await chrome.action.setBadgeText({ text: '' }).catch(() => {});

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab && tab.id !== undefined) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {});
      }
    }
  });
}
