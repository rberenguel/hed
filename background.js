const lastInvocation = {};
const DEBOUNCE_MS = 100; // A slightly more generous debounce window

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-palette") {
    chrome.tabs.sendMessage(tab.id, { action: "toggle-palette" });
  }
});

// This listens for messages from a content script (palette.js) and broadcasts them.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // When a palette wants to broadcast an action (like applying a highlight and closing)
  if (request.action === "broadcast-and-close") {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "execute-and-close",
        payload: request.payload,
      });
    }
  }
});

// Clean up the timestamp when a tab is closed to prevent memory leaks.
chrome.tabs.onRemoved.addListener((tabId) => {
  delete lastInvocation[tabId];
});
