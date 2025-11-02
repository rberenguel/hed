// Shared utility for determining note keys based on URL prefix grouping settings
(() => {
  const PREFIXES_KEY = "hed-url-prefixes";
  let prefixGroupingCache = null;
  let cacheTime = 0;
  const CACHE_TTL = 5000; // 5 seconds cache

  async function loadPrefixGrouping() {
    const now = Date.now();
    if (prefixGroupingCache && now - cacheTime < CACHE_TTL) {
      return prefixGroupingCache;
    }

    try {
      const data = await chrome.storage.local.get([PREFIXES_KEY]);
      prefixGroupingCache = data[PREFIXES_KEY] || [];
      cacheTime = now;
      return prefixGroupingCache;
    } catch (e) {
      console.error("HED: Error loading URL prefix grouping settings", e);
      return [];
    }
  }

  async function getNoteKey() {
    const prefixes = await loadPrefixGrouping();
    const currentUrl = window.location.href;

    // Check if current URL starts with any configured prefix
    const matchedPrefix = prefixes.find((prefix) => {
      return currentUrl.startsWith(prefix);
    });

    if (matchedPrefix) {
      // Use the matched prefix as the key
      return `hed-note:${matchedPrefix}`;
    } else {
      // Use full URL for page-specific notes
      return `hed-note:${currentUrl}`;
    }
  }

  // Invalidate cache when storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[PREFIXES_KEY]) {
      prefixGroupingCache = null;
    }
  });

  // Export to global scope
  window.hedNoteKeyUtils = {
    getNoteKey,
  };
})();
