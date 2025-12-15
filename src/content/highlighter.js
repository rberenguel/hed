(() => {
  const HIGHLIGHT_CLASS = "rh-highlight-span";
  let lastRegexString = null; // Keep for backward compatibility
  let activeHighlights = new Map(); // id -> { regexString }
  let observer = null;
  let debounceTimer = null;

  function createTextMap(rootElement) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let fullText = "";
    const nodeMap = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        node.parentElement.closest(
          'script, style, noscript, [class*="rh-palette"]',
        )
      )
        continue;
      nodeMap.push({ node: node, start: fullText.length });
      fullText += node.nodeValue;
    }
    return { fullText, nodeMap };
  }

  function findDomRange(nodeMap, startOffset, endOffset) {
    let startNodeInfo, endNodeInfo;
    for (const info of nodeMap) {
      const nodeEndOffset = info.start + info.node.nodeValue.length;
      if (!startNodeInfo && nodeEndOffset > startOffset) {
        startNodeInfo = { node: info.node, offset: startOffset - info.start };
      }
      if (!endNodeInfo && nodeEndOffset >= endOffset) {
        endNodeInfo = { node: info.node, offset: endOffset - info.start };
        break;
      }
    }
    return { startNodeInfo, endNodeInfo };
  }

  // Helper to unwrap a single span
  function unwrapSpan(span) {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    parent.normalize();
  }

  // Apply highlights for a specific ID
  function applyHighlightById(id, regexString) {
    if (!regexString) return;

    // Store in activeHighlights map
    activeHighlights.set(id, { regexString });

    // Remove existing highlights for this ID
    removeHighlightById(id, false);

    const rootElement = document.body;
    let regex;
    try {
      regex = new RegExp(regexString, "gd");
    } catch (e) {
      // Silently ignore invalid regex
      return;
    }

    const { fullText, nodeMap } = createTextMap(rootElement);
    if (!fullText) return;

    const matches = [...fullText.matchAll(regex)];

    for (const match of matches.reverse()) {
      for (let i = match.indices.length - 1; i > 0; i--) {
        const group = match.indices[i];
        if (!group) continue;

        try {
          const [start, end] = group;
          const { startNodeInfo, endNodeInfo } = findDomRange(
            nodeMap,
            start,
            end,
          );

          if (
            startNodeInfo &&
            endNodeInfo &&
            startNodeInfo.node.isConnected &&
            endNodeInfo.node.isConnected
          ) {
            const range = document.createRange();
            range.setStart(startNodeInfo.node, startNodeInfo.offset);
            range.setEnd(endNodeInfo.node, endNodeInfo.offset);

            const span = document.createElement("span");
            span.className = `${HIGHLIGHT_CLASS} rh-highlight-g${i}`;
            span.dataset.highlightId = id; // Add ID attribute

            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
          }
        } catch (e) {
          console.warn(
            "Could not highlight a match, likely due to dynamic page content.",
            { match, error: e },
          );
        }
      }
    }
  }

  // Remove highlights for a specific ID
  function removeHighlightById(id, removeFromMap = true) {
    document
      .querySelectorAll(`.${HIGHLIGHT_CLASS}[data-highlight-id="${id}"]`)
      .forEach(unwrapSpan);

    if (removeFromMap) {
      activeHighlights.delete(id);
    }
  }

  // Re-apply all active highlights (for MutationObserver)
  function reapplyAllHighlights() {
    if (observer) observer.disconnect();

    // Clear all highlight spans
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(unwrapSpan);

    // Re-apply each active pattern
    activeHighlights.forEach((data, id) => {
      applyHighlightById(id, data.regexString);
    });

    startObserver();
  }

  // Backward compatibility: apply single highlight (for live preview)
  function applyHighlights(regexString) {
    lastRegexString = regexString; // Store the regex for re-application
    if (!lastRegexString) return;

    if (observer) observer.disconnect();

    removeHighlights(false); // Remove old highlights without stopping the observer

    const rootElement = document.body;
    let regex;
    try {
      regex = new RegExp(lastRegexString, "gd");
    } catch (e) {
      // Silently ignore invalid regex during live preview
      return;
    }

    const { fullText, nodeMap } = createTextMap(rootElement);
    if (!fullText) return;

    const matches = [...fullText.matchAll(regex)];

    for (const match of matches.reverse()) {
      for (let i = match.indices.length - 1; i > 0; i--) {
        const group = match.indices[i];
        if (!group) continue;

        try {
          const [start, end] = group;
          const { startNodeInfo, endNodeInfo } = findDomRange(
            nodeMap,
            start,
            end,
          );

          if (
            startNodeInfo &&
            endNodeInfo &&
            startNodeInfo.node.isConnected &&
            endNodeInfo.node.isConnected
          ) {
            const range = document.createRange();
            range.setStart(startNodeInfo.node, startNodeInfo.offset);
            range.setEnd(endNodeInfo.node, endNodeInfo.offset);

            const span = document.createElement("span");
            span.className = `${HIGHLIGHT_CLASS} rh-highlight-g${i}`;

            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
          }
        } catch (e) {
          console.warn(
            "Could not highlight a match, likely due to dynamic page content.",
            { match, error: e },
          );
        }
      }
    }
    startObserver(); // Ensure the observer is running
  }

  function removeHighlights(stopObserving = true) {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(unwrapSpan);
    if (stopObserving) {
      lastRegexString = null;
      stopObserver();
    }
  }

  function startObserver() {
    if (observer) {
      // If the observer already exists, just re-observe
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      return;
    }

    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // If we have multi-highlights active, reapply all
        if (activeHighlights.size > 0) {
          reapplyAllHighlights();
        }
        // Otherwise use backward-compatible single highlight
        else if (lastRegexString) {
          applyHighlights(lastRegexString);
        }
      }, 500); // Debounce for 500ms
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(debounceTimer);
  }

  window.regexHighlighter = {
    // New multi-highlight API
    applyById: (id, regexString) => {
      applyHighlightById(id, regexString);
      startObserver();
    },
    removeById: (id) => {
      removeHighlightById(id, true);
      if (activeHighlights.size === 0) {
        stopObserver();
      }
    },
    toggleById: (id, regexString) => {
      if (activeHighlights.has(id)) {
        removeHighlightById(id, true);
        if (activeHighlights.size === 0) {
          stopObserver();
        }
        return false; // Now off
      } else {
        applyHighlightById(id, regexString);
        startObserver();
        return true; // Now on
      }
    },
    isActive: (id) => activeHighlights.has(id),
    // Backward compatibility for live preview
    apply: applyHighlights,
    remove: removeHighlights,
  };
})();
