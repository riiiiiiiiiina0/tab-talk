// Constants for developer options
const LOG_ONLY_DEFAULT = false;

/**
 * Get the logOnly flag from storage.
 * @returns {Promise<boolean>}
 */
export async function getLogOnly() {
  const { logOnly } = await chrome.storage.local.get({
    logOnly: LOG_ONLY_DEFAULT,
  });
  return logOnly;
}

/**
 * Set the logOnly flag in storage.
 * @param {boolean} logOnly
 * @returns {Promise<void>}
 */
export function setLogOnly(logOnly) {
  return chrome.storage.local.set({ logOnly });
}
