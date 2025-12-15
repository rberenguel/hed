(() => {
  const PATTERNS_KEY = "hed-highlight-patterns";
  const ACTIVE_PREFIX = "hed-active-highlights:";

  // Get storage key for active highlights (per-page)
  async function getActiveKey() {
    return `${ACTIVE_PREFIX}${window.location.href}`;
  }

  // Load global pattern list
  async function loadPatterns() {
    try {
      const data = await chrome.storage.local.get([PATTERNS_KEY]);
      const stored = data[PATTERNS_KEY];
      if (!stored || !stored.patterns) {
        return []; // Empty pattern list
      }
      return stored.patterns; // Array of regex strings
    } catch (e) {
      console.error("HED: Error loading highlight patterns", e);
      return [];
    }
  }

  // Save global pattern list
  async function savePatterns(patterns) {
    try {
      await chrome.storage.local.set({
        [PATTERNS_KEY]: { patterns },
      });
    } catch (e) {
      console.error("HED: Error saving highlight patterns", e);
    }
  }

  // Load per-page active pattern IDs
  async function loadActivePatterns() {
    const key = await getActiveKey();
    try {
      const data = await chrome.storage.local.get([key]);
      const stored = data[key];
      if (!stored || !stored.active) {
        return []; // No active patterns
      }
      return stored.active; // Array of pattern IDs (numbers)
    } catch (e) {
      console.error("HED: Error loading active patterns", e);
      return [];
    }
  }

  // Save per-page active pattern IDs
  async function saveActivePatterns(activeIds) {
    const key = await getActiveKey();
    try {
      if (activeIds.length === 0) {
        // No active patterns - remove key
        await chrome.storage.local.remove(key);
      } else {
        await chrome.storage.local.set({
          [key]: { active: activeIds },
        });
      }
    } catch (e) {
      console.error("HED: Error saving active patterns", e);
    }
  }

  // Toggle a pattern on current page
  async function togglePattern(patternId) {
    const patterns = await loadPatterns();
    const activeIds = await loadActivePatterns();

    if (patternId < 0 || patternId >= patterns.length) {
      return { error: `Pattern ${patternId} does not exist` };
    }

    if (patterns[patternId].trim() === "") {
      return { error: `Pattern ${patternId} is empty` };
    }

    const regexString = patterns[patternId];
    const isNowActive = window.regexHighlighter.toggleById(
      patternId,
      regexString,
    );

    // Update active list
    let newActiveIds;
    if (isNowActive) {
      newActiveIds = [...activeIds, patternId].sort((a, b) => a - b);
    } else {
      newActiveIds = activeIds.filter((id) => id !== patternId);
    }

    await saveActivePatterns(newActiveIds);

    return {
      success: true,
      active: isNowActive,
      message: `Pattern ${patternId} ${isNowActive ? "enabled" : "disabled"}`,
    };
  }

  // Initialize highlights on page load
  async function initHighlights() {
    const patterns = await loadPatterns();
    const activeIds = await loadActivePatterns();

    for (const id of activeIds) {
      if (id >= 0 && id < patterns.length && patterns[id].trim() !== "") {
        try {
          window.regexHighlighter.applyById(id, patterns[id]);
        } catch (e) {
          console.warn(`HED: Could not apply pattern ${id}:`, e);
        }
      }
    }
  }

  // Export API
  window.hedHighlightPatterns = {
    loadPatterns,
    savePatterns,
    loadActivePatterns,
    saveActivePatterns,
    togglePattern,
    initHighlights,
  };

  // Auto-apply highlights on page load
  (async () => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initHighlights);
    } else {
      await initHighlights();
    }
  })();
})();
