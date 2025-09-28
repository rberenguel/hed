chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-palette") {
    chrome.tabs.sendMessage(tab.id, { action: "toggle-palette" });
  }
});
