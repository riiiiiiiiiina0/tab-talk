// Storage key for saved prompts
const PROMPTS_STORAGE_KEY = 'savedPrompts';

// DOM elements
const promptsContainer = document.getElementById('prompts-container');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const addPromptBtn = document.getElementById('add-prompt-btn');
const emptyStateAddBtn = document.getElementById('empty-state-add-btn');

// Modal elements
const promptModal = document.getElementById('prompt-modal');
const modalTitle = document.getElementById('modal-title');
const promptNameInput = document.getElementById('prompt-name');
const promptContentInput = document.getElementById('prompt-content');
const savePromptBtn = document.getElementById('save-prompt-btn');
const cancelBtn = document.getElementById('cancel-btn');
const modalBackdrop = document.getElementById('modal-backdrop');

// Delete modal elements
const deleteModal = document.getElementById('delete-modal');
const deletePromptName = document.getElementById('delete-prompt-name');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const deleteModalBackdrop = document.getElementById('delete-modal-backdrop');

// Current state
let prompts = [];
let editingPromptId = null;
let deletingPromptId = null;
let filteredPrompts = [];

/**
 * Generate a unique ID for a prompt
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get all saved prompts from Chrome sync storage
 * @returns {Promise<Array>}
 */
async function getPrompts() {
  try {
    const result = await chrome.storage.sync.get([PROMPTS_STORAGE_KEY]);
    return result[PROMPTS_STORAGE_KEY] || [];
  } catch (error) {
    console.error('Error getting prompts:', error);
    return [];
  }
}

/**
 * Save prompts to Chrome sync storage
 * @param {Array} promptsArray
 * @returns {Promise<void>}
 */
async function savePrompts(promptsArray) {
  try {
    await chrome.storage.sync.set({ [PROMPTS_STORAGE_KEY]: promptsArray });
  } catch (error) {
    console.error('Error saving prompts:', error);
    throw error;
  }
}

/**
 * Create a new prompt
 * @param {string} name
 * @param {string} content
 * @returns {Promise<void>}
 */
async function createPrompt(name, content) {
  const newPrompt = {
    id: generateId(),
    name: name.trim(),
    content: content.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  prompts.push(newPrompt);
  await savePrompts(prompts);
}

/**
 * Update an existing prompt
 * @param {string} id
 * @param {string} name
 * @param {string} content
 * @returns {Promise<void>}
 */
async function updatePrompt(id, name, content) {
  const promptIndex = prompts.findIndex((p) => p.id === id);
  if (promptIndex === -1) {
    throw new Error('Prompt not found');
  }

  prompts[promptIndex] = {
    ...prompts[promptIndex],
    name: name.trim(),
    content: content.trim(),
    updatedAt: new Date().toISOString(),
  };

  await savePrompts(prompts);
}

/**
 * Delete a prompt
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deletePrompt(id) {
  prompts = prompts.filter((p) => p.id !== id);
  await savePrompts(prompts);
}

/**
 * Filter prompts based on search term
 * @param {string} searchTerm
 */
function filterPrompts(searchTerm) {
  if (!searchTerm.trim()) {
    filteredPrompts = [...prompts];
  } else {
    const term = searchTerm.toLowerCase();
    filteredPrompts = prompts.filter(
      (prompt) =>
        prompt.name.toLowerCase().includes(term) ||
        prompt.content.toLowerCase().includes(term),
    );
  }
  renderPrompts();
}

/**
 * Create HTML for a single prompt card
 * @param {Object} prompt
 * @returns {string}
 */
function createPromptCard(prompt) {
  const truncatedContent =
    prompt.content.length > 150
      ? prompt.content.substring(0, 150) + '...'
      : prompt.content;

  const createdDate = new Date(prompt.createdAt).toLocaleDateString();

  return `
    <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-700" data-prompt-id="${
      prompt.id
    }">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2 truncate">${escapeHtml(
            prompt.name,
          )}</h3>
          <p class="text-gray-600 dark:text-gray-300 text-sm mb-3 leading-relaxed">${escapeHtml(
            truncatedContent,
          )}</p>
          <div class="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Created ${createdDate}
          </div>
        </div>
        <div class="flex items-center space-x-2 ml-4">
          <button class="btn btn-ghost btn-sm edit-prompt-btn" data-prompt-id="${
            prompt.id
          }" title="Edit prompt">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm text-error delete-prompt-btn" data-prompt-id="${
            prompt.id
          }" title="Delete prompt">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render all prompts to the DOM
 */
function renderPrompts() {
  if (filteredPrompts.length === 0) {
    promptsContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    promptsContainer.innerHTML = filteredPrompts
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(createPromptCard)
      .join('');

    // Add event listeners to edit and delete buttons
    addPromptCardEventListeners();
  }
}

/**
 * Add event listeners to prompt card buttons
 */
function addPromptCardEventListeners() {
  // Edit buttons
  document.querySelectorAll('.edit-prompt-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const promptId = btn.dataset.promptId;
      openEditModal(promptId);
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-prompt-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const promptId = btn.dataset.promptId;
      openDeleteModal(promptId);
    });
  });
}

/**
 * Open the add/edit modal
 * @param {string|null} promptId
 */
function openEditModal(promptId = null) {
  editingPromptId = promptId;

  if (promptId) {
    // Edit mode
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    modalTitle.textContent = 'Edit Prompt';
    promptNameInput.value = prompt.name;
    promptContentInput.value = prompt.content;
    savePromptBtn.textContent = 'Update Prompt';
  } else {
    // Add mode
    modalTitle.textContent = 'Add New Prompt';
    promptNameInput.value = '';
    promptContentInput.value = '';
    savePromptBtn.textContent = 'Save Prompt';
  }

  promptModal.classList.add('modal-open');
  promptNameInput.focus();
}

/**
 * Close the add/edit modal
 */
function closeEditModal() {
  promptModal.classList.remove('modal-open');
  editingPromptId = null;
  promptNameInput.value = '';
  promptContentInput.value = '';
}

/**
 * Open the delete confirmation modal
 * @param {string} promptId
 */
function openDeleteModal(promptId) {
  const prompt = prompts.find((p) => p.id === promptId);
  if (!prompt) return;

  deletingPromptId = promptId;
  deletePromptName.textContent = prompt.name;
  deleteModal.classList.add('modal-open');
}

/**
 * Close the delete confirmation modal
 */
function closeDeleteModal() {
  deleteModal.classList.remove('modal-open');
  deletingPromptId = null;
}

/**
 * Show a temporary status message
 * @param {string} message
 * @param {boolean} isError
 */
function showStatus(message, isError = false) {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `alert ${
    isError ? 'alert-error' : 'alert-success'
  } fixed top-4 right-4 z-50 max-w-sm shadow-lg`;
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${
        isError
          ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
          : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
      }" />
    </svg>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Validate prompt input
 * @param {string} name
 * @param {string} content
 * @returns {string|null} Error message or null if valid
 */
function validatePrompt(name, content) {
  if (!name.trim()) {
    return 'Prompt name is required';
  }
  if (name.trim().length > 50) {
    return 'Prompt name must be 50 characters or less';
  }
  if (!content.trim()) {
    return 'Prompt content is required';
  }
  if (content.trim().length > 2000) {
    return 'Prompt content must be 2000 characters or less';
  }

  // Check for duplicate names (excluding current prompt when editing)
  const existingPrompt = prompts.find(
    (p) =>
      p.name.toLowerCase() === name.trim().toLowerCase() &&
      p.id !== editingPromptId,
  );
  if (existingPrompt) {
    return 'A prompt with this name already exists';
  }

  return null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Load prompts
  prompts = await getPrompts();
  filteredPrompts = [...prompts];
  renderPrompts();

  // Search input
  searchInput.addEventListener('input', (e) => {
    filterPrompts(e.target.value);
  });

  // Add prompt buttons
  addPromptBtn.addEventListener('click', () => openEditModal());
  emptyStateAddBtn.addEventListener('click', () => openEditModal());

  // Modal close buttons
  cancelBtn.addEventListener('click', closeEditModal);
  modalBackdrop.addEventListener('click', closeEditModal);

  // Delete modal close buttons
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  deleteModalBackdrop.addEventListener('click', closeDeleteModal);

  // Save prompt button
  savePromptBtn.addEventListener('click', async () => {
    const name = promptNameInput.value;
    const content = promptContentInput.value;

    const validationError = validatePrompt(name, content);
    if (validationError) {
      showStatus(validationError, true);
      return;
    }

    try {
      if (editingPromptId) {
        await updatePrompt(editingPromptId, name, content);
        showStatus('Prompt updated successfully!');
      } else {
        await createPrompt(name, content);
        showStatus('Prompt saved successfully!');
      }

      prompts = await getPrompts();
      filterPrompts(searchInput.value);
      closeEditModal();
    } catch (error) {
      console.error('Error saving prompt:', error);
      showStatus('Error saving prompt. Please try again.', true);
    }
  });

  // Confirm delete button
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deletingPromptId) return;

    try {
      await deletePrompt(deletingPromptId);
      prompts = await getPrompts();
      filterPrompts(searchInput.value);
      closeDeleteModal();
      showStatus('Prompt deleted successfully!');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showStatus('Error deleting prompt. Please try again.', true);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape key closes modals
    if (e.key === 'Escape') {
      if (promptModal.classList.contains('modal-open')) {
        closeEditModal();
      } else if (deleteModal.classList.contains('modal-open')) {
        closeDeleteModal();
      }
    }

    // Ctrl/Cmd + N to add new prompt
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openEditModal();
    }
  });
});
