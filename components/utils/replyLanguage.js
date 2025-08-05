export const REPLY_LANG_DEFAULT = 'default';
export const REPLY_LANG_ENGLISH = 'english';
export const REPLY_LANG_CHINESE = 'chinese';
export const REPLY_LANG_CUSTOM = 'custom';

export const SUPPORTED_REPLY_LANGUAGE_PRESETS = [
  REPLY_LANG_DEFAULT,
  REPLY_LANG_ENGLISH,
  REPLY_LANG_CHINESE,
  REPLY_LANG_CUSTOM,
];

export const REPLY_LANGUAGE_META = {
  [REPLY_LANG_DEFAULT]: { name: 'Default' },
  [REPLY_LANG_ENGLISH]: { name: 'English' },
  [REPLY_LANG_CHINESE]: { name: 'Chinese' },
  [REPLY_LANG_CUSTOM]: { name: 'Custom' },
};

/**
 * Get the stored reply language.
 * Returns one of the preset keys or a custom string value if user defined.
 * @returns {Promise<string>}
 */
export function getReplyLanguage() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      resolve(REPLY_LANG_DEFAULT);
      return;
    }
    chrome.storage.sync.get(['replyLanguage'], (result) => {
      const value = result.replyLanguage || REPLY_LANG_DEFAULT;
      resolve(value);
    });
  });
}

/**
 * Store the reply language.
 * Accepts any non-empty string. Preset constants are recommended.
 * @param {string} value
 * @returns {Promise<void>}
 */
export function setReplyLanguage(value) {
  return new Promise((resolve, reject) => {
    if (typeof value !== 'string' || value.trim() === '') {
      reject(new Error('Invalid reply language value.'));
      return;
    }
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      reject(new Error('Chrome storage API not available.'));
      return;
    }
    chrome.storage.sync.set({ replyLanguage: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
