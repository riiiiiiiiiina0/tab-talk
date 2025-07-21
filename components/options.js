import {
  SUPPORTED_LLM_PROVIDERS,
  LLM_PROVIDER_DEFAULT,
  getLLMProvider,
  setLLMProvider,
  LLM_PROVIDER_GEMINI,
  LLM_PROVIDER_CHATGPT,
  LLM_PROVIDER_META,
} from './common/llmProviders.js';
import {
  SUPPORTED_ICON_STYLES,
  ICON_STYLE_DEFAULT,
  getIconStyle,
  setIconStyle,
  ICON_STYLE_META,
} from './common/iconStyle.js';

// Save button in the new UI (first primary button)
const saveButton = /** @type {HTMLButtonElement|null} */ (
  document.querySelector('#save-btn')
);

const llmOptions = /** @type {HTMLDivElement|null} */ (
  document.querySelector('#llm-options')
);

const iconStyleOptions = /** @type {HTMLDivElement|null} */ (
  document.querySelector('#icon-style-options')
);

/**
 * Create a label element for an LLM option.
 * @param {string} provider
 * @returns {HTMLLabelElement}
 */
const createLLMOption = (provider) => {
  const name = LLM_PROVIDER_META[provider].name;

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
    <input type="radio" name="llm-option" class="radio radio-primary" value="${provider}" />
  `;
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
    <input type="radio" name="icon-style-option" class="radio radio-primary" value="${style}" />
  `;
  return label;
};

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

// Helper: briefly replace the button text to indicate success
/**
 * @param {string} text
 */
function showStatus(text) {
  if (!saveButton) return;
  const originalText = saveButton.textContent;
  saveButton.textContent = text;
  saveButton.disabled = true;
  setTimeout(() => {
    saveButton.textContent = originalText;
    saveButton.disabled = false;
  }, 1500);
}

/**
 * Updates the theme icon based on the current system theme
 */
function updateThemeIcon() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const icon = /** @type {HTMLImageElement|null} */ (
    document.getElementById('theme-icon')
  );
  if (icon && icon.dataset.darkSrc && icon.dataset.lightSrc) {
    icon.src = isDark ? icon.dataset.darkSrc : icon.dataset.lightSrc;
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

  // Set the default Icon Style
  const iconStyle = await getIconStyle();
  setHeaderIconForStyle(iconStyle);
  updateIconStyleOptionValue(iconStyle, true);
  updateThemeIcon();

  // Save on button click
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const selectedLLMInput = /** @type {HTMLInputElement|null} */ (
        document.querySelector('input[name="llm-option"]:checked')
      );
      const value = selectedLLMInput?.value || LLM_PROVIDER_DEFAULT;
      const selectedIconInput = /** @type {HTMLInputElement|null} */ (
        document.querySelector('input[name="icon-style-option"]:checked')
      );
      const iconValue = selectedIconInput?.value || ICON_STYLE_DEFAULT;
      Promise.all([setLLMProvider(value), setIconStyle(iconValue)])
        .then(() => {
          setHeaderIconForStyle(iconValue);
          updateThemeIcon();
          try {
            chrome.runtime.sendMessage({ type: 'icon-style-changed' });
          } catch {}
          showStatus('Saved!');
        })
        .catch(() => showStatus('Error'));
    });
  }

  // Initialize theme icon and set up theme change listener
  updateThemeIcon();
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateThemeIcon);
}

init();
