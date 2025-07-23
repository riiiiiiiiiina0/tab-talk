export const ICON_STYLE_RAINBOW = 'rainbow';
export const ICON_STYLE_SIMPLE = 'simple';
export const ICON_STYLE_DEFAULT = ICON_STYLE_RAINBOW;
export const SUPPORTED_ICON_STYLES = [ICON_STYLE_RAINBOW, ICON_STYLE_SIMPLE];

export const ICON_STYLE_META = {
  [ICON_STYLE_RAINBOW]: { name: 'Rainbow' },
  [ICON_STYLE_SIMPLE]: { name: 'Simple' },
};

/**
 * Get the selected icon style from Chrome sync storage.
 * @returns {Promise<string>} Resolves to the selected icon style.
 */
export function getIconStyle() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      resolve(ICON_STYLE_DEFAULT);
      return;
    }
    chrome.storage.sync.get(['selectedIconStyle'], (result) => {
      const value = result.selectedIconStyle || ICON_STYLE_DEFAULT;
      resolve(value);
    });
  });
}

/**
 * Set the selected icon style in Chrome sync storage.
 * @param {string} value One of SUPPORTED_ICON_STYLES.
 * @returns {Promise<void>} Resolves when stored.
 */
export function setIconStyle(value) {
  return new Promise((resolve, reject) => {
    if (!SUPPORTED_ICON_STYLES.includes(value)) {
      reject(
        new Error(
          `Invalid icon style. Must be one of: ${SUPPORTED_ICON_STYLES.join(
            ', ',
          )}.`,
        ),
      );
      return;
    }
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      reject(new Error('Chrome storage API not available.'));
      return;
    }
    chrome.storage.sync.set({ selectedIconStyle: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
