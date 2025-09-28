(() => {
  const HIGHLIGHT_CLASS = 'rh-highlight-span';

  function createTextMap(rootElement) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let fullText = '';
    const nodeMap = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('script, style, noscript, [class*="rh-palette"]')) continue;
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

  function applyHighlights(regexString) {
    const rootElement = document.body;
    let regex;
    try {
      regex = new RegExp(regexString, 'gd');
    } catch (e) {
      console.error("Invalid Regex:", e);
      return;
    }

    const { fullText, nodeMap } = createTextMap(rootElement);
    if (!fullText) return;

    const matches = [...fullText.matchAll(regex)];

    for (const match of matches.reverse()) {
      // --- FIX #2: MULTI-WORD HIGHLIGHTING ---
      // Start loop from 1 to skip the full match (group 0)
      // and only color the specific capture groups.
      for (let i = match.indices.length - 1; i > 0; i--) {
        const group = match.indices[i];
        if (!group) continue;

        // --- FIX #1: RACE CONDITION ---
        // Wrap each match in a try/catch to make it resilient.
        try {
          const [start, end] = group;
          const { startNodeInfo, endNodeInfo } = findDomRange(nodeMap, start, end);

          // Check if nodes still exist and are connected to the DOM
          if (startNodeInfo && endNodeInfo && startNodeInfo.node.isConnected && endNodeInfo.node.isConnected) {
            const range = document.createRange();
            range.setStart(startNodeInfo.node, startNodeInfo.offset);
            range.setEnd(endNodeInfo.node, endNodeInfo.offset);
            
            const span = document.createElement('span');
            span.className = `${HIGHLIGHT_CLASS} rh-highlight-g${i}`;
            
            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);
          }
        } catch (e) {
          console.warn("Could not highlight a match, likely due to dynamic page content.", { match, error: e });
        }
      }
    }
  }
  
  function removeHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
      parent.normalize();
    });
  }

  window.regexHighlighter = { apply: applyHighlights, remove: removeHighlights };
})();