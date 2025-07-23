export const LLM_PROVIDER_CHATGPT = 'chatgpt';
export const LLM_PROVIDER_GEMINI = 'gemini';
export const LLM_PROVIDER_PERPLEXITY = 'perplexity';
export const LLM_PROVIDER_CLAUDE = 'claude';
export const LLM_PROVIDER_DEFAULT = LLM_PROVIDER_CHATGPT;
export const SUPPORTED_LLM_PROVIDERS = [
  LLM_PROVIDER_CHATGPT,
  LLM_PROVIDER_GEMINI,
  LLM_PROVIDER_PERPLEXITY,
  LLM_PROVIDER_CLAUDE,
];

export const LLM_PROVIDER_META = {
  [LLM_PROVIDER_CHATGPT]: {
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
  },
  [LLM_PROVIDER_GEMINI]: {
    name: 'Gemini',
    url: 'https://gemini.google.com',
  },
  [LLM_PROVIDER_PERPLEXITY]: {
    name: 'Perplexity',
    url: 'https://www.perplexity.ai',
  },
  [LLM_PROVIDER_CLAUDE]: {
    name: 'Claude',
    url: 'https://claude.ai',
  },
};

// Get the selected LLM value from Chrome sync storage. Returns a Promise that resolves to 'chatgpt' (default) or 'gemini'.
/**
 * @returns {Promise<string>} Resolves to the selected LLM provider.
 */
export function getLLMProvider() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      resolve(LLM_PROVIDER_CHATGPT);
      return;
    }
    chrome.storage.sync.get(['selectedLLM'], (result) => {
      const value = result.selectedLLM || LLM_PROVIDER_DEFAULT;
      resolve(value);
    });
  });
}

// Set the selected LLM value in Chrome sync storage. Accepts only 'chatgpt' or 'gemini'. Returns a Promise.
/**
 * @param {string} value - The LLM value to set ('chatgpt', 'gemini', 'perplexity', or 'claude').
 * @returns {Promise<void>} Resolves when the value is set.
 */
export function setLLMProvider(value) {
  return new Promise((resolve, reject) => {
    if (!SUPPORTED_LLM_PROVIDERS.includes(value)) {
      reject(
        new Error(
          `Invalid LLM value. Must be one of: ${SUPPORTED_LLM_PROVIDERS.join(
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
    chrome.storage.sync.set({ selectedLLM: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
