// content.js (Corrected and Simplified)
(function () {
  // Prevents the script from running multiple times if injected again.
  if (window.robustHighlighterHasRun) {
    console.log("Highlighter script already active.");
    return;
  }
  window.robustHighlighterHasRun = true;

  const HIGHLIGHT_CLASS = "robust-highlighter-span";
  const TARGET_SELECTOR = "body";
  // IMPORTANT: Added the 'd' flag for match indices.
  const REGEX_TO_HIGHLIGHT = /(Indonesia Italiano)/dgi;
  const COLORS = ["#FFFF00B3", "#ADD8E6B3", "#90EE90B3"];

  /**
   * Creates a map from a flat text string's character offsets back to the DOM text nodes.
   */
  function createTextMap(rootElement) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let fullText = "";
    const nodeMap = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      // Skip text inside scripts or styles
      if (node.parentElement.closest("script, style, noscript")) {
        continue;
      }
      nodeMap.push({ node: node, start: fullText.length });
      fullText += node.nodeValue;
    }
    return { fullText, nodeMap };
  }

  /**
   * Finds the start and end DOM text nodes and offsets for a given range in the flat text string.
   */
  function findDomRange(nodeMap, startOffset, endOffset) {
    let startNodeInfo, endNodeInfo;
    for (const info of nodeMap) {
      const nodeEndOffset = info.start + info.node.nodeValue.length;
      if (!startNodeInfo && nodeEndOffset > startOffset) {
        startNodeInfo = { node: info.node, offset: startOffset - info.start };
      }
      if (!endNodeInfo && nodeEndOffset >= endOffset) {
        endNodeInfo = { node: info.node, offset: endOffset - info.start };
        break; // Stop once we've found the end node
      }
    }
    return { startNodeInfo, endNodeInfo };
  }

  /**
   * Main function to apply all highlights.
   */
  // content.js (Only the applyHighlights function is shown for brevity)

  // ... (keep createTextMap and findDomRange functions as they are) ...

  /**
   * Main function to apply all highlights.
   */
  function applyHighlights() {
    console.log("Applying highlights...");
    const rootElement = document.querySelector(TARGET_SELECTOR);
    if (!rootElement) return;

    const { fullText, nodeMap } = createTextMap(rootElement);
    if (!fullText) return;

    const matches = [...fullText.matchAll(REGEX_TO_HIGHLIGHT)];

    for (const match of matches.reverse()) {
      const captureGroups = match.indices.slice(1);
      for (const group of captureGroups.reverse()) {
        if (!group) continue;

        const [start, end] = group;
        const { startNodeInfo, endNodeInfo } = findDomRange(
          nodeMap,
          start,
          end,
        );

        if (startNodeInfo && endNodeInfo) {
          const range = document.createRange();
          range.setStart(startNodeInfo.node, startNodeInfo.offset);
          range.setEnd(endNodeInfo.node, endNodeInfo.offset);

          const span = document.createElement("span");
          span.className = HIGHLIGHT_CLASS;
          span.style.backgroundColor =
            COLORS[captureGroups.indexOf(group) % COLORS.length];

          try {
            // --- CHANGE IS HERE ---
            // This is more robust than surroundContents for ranges that cross element boundaries.
            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
            // --- END OF CHANGE ---
          } catch (e) {
            console.error("Highlighter failed to wrap range:", e, { range });
          }
        }
      }
    }
    console.log(`Finished. Applied highlights for ${matches.length} matches.`);
  }

  // ... (the rest of the script remains the same) ...

  applyHighlights();
})();
