(() => {
  function createTextMap(rootElement) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let fullText = "";
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        node.parentElement.closest(
          'script, style, noscript, [class*="rh-palette"]',
        )
      )
        continue;
      fullText += node.nodeValue;
    }
    return { fullText };
  }

  function selectAndCopy(regexString) {
    return new Promise((resolve, reject) => {
      let regex;
      try {
        regex = new RegExp(regexString, "gd");
      } catch (e) {
        reject(`Invalid Regex: ${e.message}`);
        return;
      }

      const { fullText } = createTextMap(document.body);
      if (!fullText) {
        resolve("No text found on page.");
        return;
      }

      const matches = [...fullText.matchAll(regex)];

      if (matches.length === 0) {
        resolve("No matches found.");
        return;
      }

      const results = [];
      for (const match of matches) {
        const groups = match.slice(1);
        if (groups.length > 0) {
          results.push(groups);
        }
      }

      if (results.length === 0) {
        resolve("No capturing groups matched.");
        return;
      }

      const csvContent = results
        .map((row) =>
          row
            .map((val) => `"${(val || "").toString().replace(/"/g, '""')}"`) // Corrected escaping for double quotes within the string
            .join(","),
        )
        .join("\n"); // Corrected escaping for newline character

      navigator.clipboard
        .writeText(csvContent)
        .then(() => {
          resolve(`Copied ${results.length} matches to clipboard.`);
        })
        .catch((err) => {
          console.error("Clipboard write failed:", err);
          reject("Failed to copy to clipboard.");
        });
    });
  }

  window.regexSelector = {
    selectAndCopy: selectAndCopy,
  };
})();
