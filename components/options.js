import {
  SUPPORTED_LLM_PROVIDERS,
  LLM_PROVIDER_DEFAULT,
  getLLMProvider,
  setLLMProvider,
  LLM_PROVIDER_GEMINI,
  LLM_PROVIDER_CHATGPT,
  LLM_PROVIDER_META,
} from './common/llmProviders.js';

// Save button in the new UI (first primary button)
const saveButton = /** @type {HTMLButtonElement|null} */ (
  document.querySelector('#save-btn')
);

const llmOptions = /** @type {HTMLDivElement|null} */ (
  document.querySelector('#llm-options')
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

async function init() {
  console.log('llmOptions', llmOptions);
  // Create the LLM options
  if (llmOptions) {
    console.log('supported llm providers', SUPPORTED_LLM_PROVIDERS);
    SUPPORTED_LLM_PROVIDERS.forEach((llmProvider) => {
      const label = createLLMOption(llmProvider);
      llmOptions.appendChild(label);
    });
  }

  // Set the default LLM provider
  const llmProvider = await getLLMProvider();
  console.log('llmProvider', llmProvider);
  updateLLMOptionValue(llmProvider, true);

  // Save on button click
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const selected = /** @type {HTMLInputElement|null} */ (
        document.querySelector('input[name="llm-option"]:checked')
      );
      const value = selected?.value || LLM_PROVIDER_DEFAULT;
      setLLMProvider(value).then(() => showStatus('Saved!'));
    });
  }
}

init();
