import {
  SUPPORTED_LLM_PROVIDERS,
  LLM_PROVIDER_DEFAULT,
  getLLMProvider,
  setLLMProvider,
  LLM_PROVIDER_META,
} from './utils/llmProviders.js';
import {
  SUPPORTED_ICON_STYLES,
  ICON_STYLE_DEFAULT,
  getIconStyle,
  setIconStyle,
  ICON_STYLE_META,
} from './utils/iconStyle.js';
import { getLogOnly, setLogOnly } from './utils/developerOptions.js';
import {
  SUPPORTED_REPLY_LANGUAGE_PRESETS,
  REPLY_LANG_DEFAULT,
  getReplyLanguage,
  setReplyLanguage,
  REPLY_LANGUAGE_META,
  REPLY_LANG_CUSTOM,
} from './utils/replyLanguage.js';

// Status message container for immediate save feedback
let statusTimeoutId = null;
// Track the last saved language value (could be preset or custom)
let lastSavedLanguageValue = REPLY_LANG_DEFAULT;
// Remember previous language when user toggles to Custom so we can revert if needed
let previousLanguageValue = REPLY_LANG_DEFAULT;

const llmOptions = /** @type {HTMLDivElement|null} */ (
  document.querySelector('#llm-options')
);

const iconStyleOptions = /** @type {HTMLDivElement|null} */ (
  document.querySelector('#icon-style-options')
);

const logOnlyCheckbox = /** @type {HTMLInputElement|null} */ (
  document.querySelector('#log-only-checkbox')
);

const languageOptions = /** @type {HTMLDivElement|null} */ (
  document.querySelector('#language-options')
);

const customLanguageInput = /** @type {HTMLInputElement|null} */ (
  document.querySelector('#custom-language-input')
);

/**
 * Create a label element for an LLM option.
 * @param {string} provider
 * @returns {HTMLLabelElement}
 */
const createLLMOption = (provider) => {
  const name = LLM_PROVIDER_META[provider].name;
  // Build a favicon URL (64×64) for the provider using its public site. This avoids bundling extra assets.
  const faviconUrl = (() => {
    try {
      const { hostname } = new URL(LLM_PROVIDER_META[provider].url);
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return '';
    }
  })();

  const label = document.createElement('label');
  label.classList.add(
    'label',
    'cursor-pointer',
    'p-4',
    'border',
    'border-gray-300',
    'dark:border-gray-600',
    'rounded-lg',
    'bg-white',
    'dark:bg-gray-700',
    'hover:bg-gray-50',
    'dark:hover:bg-gray-600',
    'transition-colors',
    'flex',
    'flex-row',
    'items-center',
    'justify-between',
  );
  label.innerHTML = `
    <div class="flex items-center space-x-2">
      ${
        faviconUrl
          ? `<img src="${faviconUrl}" alt="${name} icon" class="w-6 h-6 rounded">`
          : ''
      }
      <span class="label-text text-gray-600 dark:text-gray-300">${name}</span>
    </div>
    <input type="radio" name="llm-option" class="radio radio-primary" value="${provider}" />
  `;

  // Add immediate save listener to the radio input
  const radioInput = /** @type {HTMLInputElement|null} */ (
    label.querySelector('input[type="radio"]')
  );
  if (radioInput) {
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        saveSettingsImmediately();
      }
    });
  }

  return label;
};

/**
 * Update the value of the LLM option input element.
 * @param {string} provider
 * @param {boolean} checked
 */
function updateLLMOptionValue(provider, checked) {
  const input = document.querySelector(
    `input[name="llm-option"][value="${provider}"]`,
  );
  if (input) /** @type {HTMLInputElement} */ (input).checked = checked;
}

/**
 * Create a label element for an Icon Style option.
 * @param {string} style
 * @returns {HTMLLabelElement}
 */
const createIconStyleOption = (style) => {
  const name = ICON_STYLE_META[style].name;
  const iconSrc = `../icons/${style}/icon-32x32.png`;
  const label = document.createElement('label');
  label.classList.add(
    'label',
    'cursor-pointer',
    'p-4',
    'border',
    'border-gray-300',
    'dark:border-gray-600',
    'rounded-lg',
    'bg-white',
    'dark:bg-gray-700',
    'hover:bg-gray-50',
    'dark:hover:bg-gray-600',
    'transition-colors',
    'flex',
    'flex-row',
    'items-center',
    'justify-between',
  );
  label.innerHTML = `
    <div class="flex items-center space-x-2">
      <img src="${iconSrc}" alt="${name} icon" class="w-6 h-6" />
      <span class="label-text text-gray-600 dark:text-gray-300">${name}</span>
    </div>
    <input type="radio" name="icon-style-option" class="radio radio-primary" value="${style}" />
  `;

  // Add immediate save listener to the radio input
  const radioInput = /** @type {HTMLInputElement|null} */ (
    label.querySelector('input[type="radio"]')
  );
  if (radioInput) {
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        saveSettingsImmediately();
      }
    });
  }

  return label;
};

/**
 * Create a label element for a Reply Language option.
 * @param {string} lang
 * @returns {HTMLLabelElement}
 */
const createLanguageOption = (lang) => {
  const name = REPLY_LANGUAGE_META[lang]?.name || 'Custom';
  const label = document.createElement('label');
  label.classList.add(
    'label',
    'cursor-pointer',
    'p-4',
    'border',
    'border-gray-300',
    'dark:border-gray-600',
    'rounded-lg',
    'bg-white',
    'dark:bg-gray-700',
    'hover:bg-gray-50',
    'dark:hover:bg-gray-600',
    'transition-colors',
    'flex',
    'flex-row',
    'items-center',
    'justify-between',
  );
  label.innerHTML = `
    <span class="label-text text-gray-600 dark:text-gray-300">${name}</span>
    <input type="radio" name="language-option" class="radio radio-primary" value="${lang}" />
  `;

  // Immediate save and toggle custom input visibility
  const radioInput = /** @type {HTMLInputElement|null} */ (
    label.querySelector('input[type="radio"]')
  );
  if (radioInput) {
    radioInput.addEventListener('change', () => {
      if (!radioInput.checked) return;

      if (lang === REPLY_LANG_CUSTOM) {
        // Remember the language before switching to custom
        previousLanguageValue = lastSavedLanguageValue;

        // Show the input and pre-fill with previous custom value if any
        if (customLanguageInput) {
          customLanguageInput.classList.remove('hidden');
          if (
            !SUPPORTED_REPLY_LANGUAGE_PRESETS.includes(lastSavedLanguageValue)
          ) {
            customLanguageInput.value = lastSavedLanguageValue;
          } else {
            customLanguageInput.value = '';
          }
          customLanguageInput.focus();
        }
      } else {
        // Hide custom input and save immediately for preset languages
        customLanguageInput?.classList.add('hidden');
        saveSettingsImmediately();
      }
    });
  }

  return label;
};

/**
 * Update the value of the language option input element.
 * @param {string} lang
 * @param {boolean} checked
 */
function updateLanguageOptionValue(lang, checked) {
  const input = document.querySelector(
    `input[name="language-option"][value="${lang}"]`,
  );
  if (input) /** @type {HTMLInputElement} */ (input).checked = checked;
}

/**
 * Commit the custom language value when user finishes editing.
 */
function commitCustomLanguage() {
  if (!customLanguageInput) return;
  const text = customLanguageInput.value.trim();
  if (text) {
    setReplyLanguage(text)
      .then(() => {
        lastSavedLanguageValue = text;
        previousLanguageValue = text;
        showStatus('Settings saved!');
      })
      .catch((err) => console.error('Error saving custom language', err));
  } else {
    // Empty input – revert to previous language
    updateLanguageOptionValue(previousLanguageValue, true);
    if (previousLanguageValue !== REPLY_LANG_CUSTOM) {
      customLanguageInput.classList.add('hidden');
    }
  }
}

/**
 * Update the value of the Icon Style option input element.
 * @param {string} style
 * @param {boolean} checked
 */
function updateIconStyleOptionValue(style, checked) {
  const input = document.querySelector(
    `input[name="icon-style-option"][value="${style}"]`,
  );
  if (input) /** @type {HTMLInputElement} */ (input).checked = checked;
}

/**
 * Show a temporary status message
 * @param {string} text
 * @param {boolean} isError
 */
function showStatus(text, isError = false) {
  // Clear any existing status message
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }

  // Remove any existing status message
  const existingStatus = document.querySelector('.status-message');
  if (existingStatus) {
    existingStatus.remove();
  }

  // Create new status message
  const statusDiv = document.createElement('div');
  statusDiv.className = `status-message alert ${
    isError ? 'alert-error' : 'alert-success'
  } fixed top-4 right-4 z-50 max-w-sm shadow-lg`;
  statusDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${
        isError
          ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
          : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
      }" />
    </svg>
    <span>${text}</span>
  `;

  document.body.appendChild(statusDiv);

  // Auto-remove after 2 seconds
  statusTimeoutId = setTimeout(() => {
    statusDiv.remove();
    statusTimeoutId = null;
  }, 2000);
}

/**
 * Save all settings immediately
 */
async function saveSettingsImmediately() {
  const selectedLLMInput = /** @type {HTMLInputElement|null} */ (
    document.querySelector('input[name="llm-option"]:checked')
  );
  const value = selectedLLMInput?.value || LLM_PROVIDER_DEFAULT;

  const selectedIconInput = /** @type {HTMLInputElement|null} */ (
    document.querySelector('input[name="icon-style-option"]:checked')
  );
  const iconValue = selectedIconInput?.value || ICON_STYLE_DEFAULT;

  const logOnlyValue = logOnlyCheckbox?.checked || false;

  const selectedLanguageInput = /** @type {HTMLInputElement|null} */ (
    document.querySelector('input[name="language-option"]:checked')
  );
  let languageValue = selectedLanguageInput?.value || REPLY_LANG_DEFAULT;
  if (languageValue === REPLY_LANG_CUSTOM) {
    languageValue = customLanguageInput?.value.trim() || REPLY_LANG_CUSTOM;
  }

  try {
    await Promise.all([
      setLLMProvider(value),
      setIconStyle(iconValue),
      setReplyLanguage(languageValue),
      setLogOnly(logOnlyValue),
    ]);

    setHeaderIconForStyle(iconValue);
    setFaviconForStyle(iconValue);
    updateThemeIcon(iconValue);

    try {
      chrome.runtime.sendMessage({ type: 'icon-style-changed' });
    } catch {}

    lastSavedLanguageValue = languageValue;
    previousLanguageValue = languageValue;
    showStatus('Settings saved!');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', true);
  }
}

/**
 * Updates the theme icon based on the current system theme
 * @param {string} style
 */
function updateThemeIcon(style) {
  const icon = /** @type {HTMLImageElement|null} */ (
    document.getElementById('theme-icon')
  );
  if (icon) {
    icon.src = `../icons/${style}/icon-128x128.png`;
  }
}

/**
 * Update data-* src attributes of the header icon based on selected style.
 * @param {string} style
 */
function setHeaderIconForStyle(style) {
  const icon = /** @type {HTMLImageElement|null} */ (
    document.getElementById('theme-icon')
  );
  if (!icon) return;
  const lightSrc = `../icons/${style}/icon-128x128.png`;
  const darkSrc = `../icons/${style}-dark/icon-128x128.png`;
  icon.dataset.lightSrc = lightSrc;
  icon.dataset.darkSrc = darkSrc;
}

/**
 * Update data-* href attributes of the favicon link based on selected style.
 * @param {string} style
 */
function setFaviconForStyle(style) {
  let favicon = /** @type {HTMLLinkElement|null} */ (
    document.getElementById('favicon')
  );
  if (!favicon) {
    favicon = /** @type {HTMLLinkElement} */ (document.createElement('link'));
    favicon.id = 'favicon';
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    document.head.appendChild(favicon);
  }
  favicon.href = `../icons/${style}/icon-32x32.png`;
}

async function init() {
  // Create the LLM options
  if (llmOptions) {
    SUPPORTED_LLM_PROVIDERS.forEach((llmProvider) => {
      const label = createLLMOption(llmProvider);
      llmOptions.appendChild(label);
    });
  }

  // Set the default LLM provider
  const llmProvider = await getLLMProvider();
  updateLLMOptionValue(llmProvider, true);

  // Create the Icon Style options
  if (iconStyleOptions) {
    SUPPORTED_ICON_STYLES.forEach((style) => {
      const label = createIconStyleOption(style);
      iconStyleOptions.appendChild(label);
    });
  }

  // Create the Reply Language options
  if (languageOptions) {
    SUPPORTED_REPLY_LANGUAGE_PRESETS.forEach((lang) => {
      const label = createLanguageOption(lang);
      languageOptions.appendChild(label);
    });
  }

  // Set the default Reply Language
  const replyLanguage = await getReplyLanguage();
  lastSavedLanguageValue = replyLanguage;
  previousLanguageValue = replyLanguage;
  if (SUPPORTED_REPLY_LANGUAGE_PRESETS.includes(replyLanguage)) {
    updateLanguageOptionValue(replyLanguage, true);
    if (replyLanguage === REPLY_LANG_CUSTOM && customLanguageInput) {
      customLanguageInput.classList.remove('hidden');
    }
  } else {
    updateLanguageOptionValue(REPLY_LANG_CUSTOM, true);
    if (customLanguageInput) {
      customLanguageInput.classList.remove('hidden');
      customLanguageInput.value = replyLanguage;
    }
  }

  if (customLanguageInput) {
    // Save when user presses Enter
    customLanguageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitCustomLanguage();
      }
    });
    // Or when the input loses focus
    customLanguageInput.addEventListener('blur', () => {
      commitCustomLanguage();
    });
  }

  // Set the default Icon Style
  const iconStyle = await getIconStyle();
  setHeaderIconForStyle(iconStyle);
  setFaviconForStyle(iconStyle);
  updateIconStyleOptionValue(iconStyle, true);
  updateThemeIcon(iconStyle);

  // Set the default log only option
  if (logOnlyCheckbox) {
    logOnlyCheckbox.checked = await getLogOnly();

    // Add immediate save listener to the checkbox
    logOnlyCheckbox.addEventListener('change', () => {
      saveSettingsImmediately();
    });
  }

  // Initialize theme icon and set up theme change listener
  updateThemeIcon(iconStyle);
}

init();
