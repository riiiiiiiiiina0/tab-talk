// Listen for OS theme changes and notify the background service-worker.
// This runs on every page the extension has access to.

/**
 * Send a message to the background script whenever the OS theme changes.
 * We also send the initial state immediately so the background knows the current theme.
 */
(function initThemeListener() {
  /**
   * Dispatch the theme information to the background script.
   * @param {boolean} isDark Indicates whether the OS theme is dark.
   */
  const notifyBackground = (isDark) => {
    console.log(
      '[detectThemeChange] Sending message to background: isDark?',
      isDark,
    );
    try {
      chrome.runtime.sendMessage({ type: 'os-theme-changed', dark: isDark });
    } catch (err) {
      // In rare cases (e.g., incognito without permissions) the runtime might be unavailable.
      // Fail silently – the extension will still function without this signal.
      console.debug('[detectThemeChange] Unable to send message:', err);
    }
  };

  // Match media query for the dark color scheme.
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Send the current preference immediately.
  notifyBackground(mediaQuery.matches);

  // Listen for changes and notify the background script.
  mediaQuery.addEventListener('change', (event) => {
    notifyBackground(event.matches);
  });
})();
