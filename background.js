chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-palette") {
    // Inject both CSS files
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["palette.css", "highlights.css"]
    });
    // Inject the logic scripts
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["ed.js", "highlighter.js", "palette.js"]
    });
  }
});