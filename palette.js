(() => {
  const PALETTE_ID = "rh-palette-backdrop";
  let edInstance = null; // To hold our editor session

  /**
   * Reads text from a contenteditable element, preserving line breaks.
   */
  function getTextFromEditable(element) {
    const clone = element.cloneNode(true);
    // Convert <br> tags to newlines
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    // Ensure block elements create newlines
    clone
      .querySelectorAll("p, div, pre, h1, h2, h3, h4, h5, h6")
      .forEach((block) => {
        block.append("\n");
      });

    // --- FIX IS HERE ---
    // Trim the final text content to remove leading/trailing whitespace and newlines
    // from the HTML source formatting before splitting.
    const cleanText = clone.textContent.trim();

    return cleanText.split("\n");
  }

  /**
   * Writes a text buffer back into a contenteditable element.
   */
  function setTextInEditable(element, buffer) {
    const escapeHTML = (str) => {
      const p = document.createElement("p");
      p.textContent = str;
      return p.innerHTML;
    };
    element.innerHTML = buffer.map(escapeHTML).join("<br>");
  }

  function closePalette() {
    document.getElementById(PALETTE_ID)?.remove();
  }

  /**
   * Renders text to the output screen, replacing previous content.
   * If text is null/empty, it hides the output area.
   */
  function renderOutput(outputElement, text) {
    const container = document.getElementById("rh-palette-container");
    if (!container) return;

    if (text) {
      container.classList.add("is-showing-output");
      outputElement.textContent = text;
      outputElement.scrollTop = outputElement.scrollHeight;
    } else {
      // If there's no output, hide the output area
      container.classList.remove("is-showing-output");
      outputElement.textContent = "";
    }
  }

  async function createPalette() {
    if (document.getElementById(PALETTE_ID)) {
      return;
    }

    const focusedElement = document.activeElement;
    let initialBuffer = [];
    let sessionMode = "clipboard-edit";
    let activeElement = null;

    if (focusedElement) {
      if (
        focusedElement.tagName === "TEXTAREA" ||
        focusedElement.tagName === "INPUT"
      ) {
        sessionMode = "textfield-value";
        activeElement = focusedElement;
        initialBuffer = focusedElement.value.split("\n");
      } else if (focusedElement.isContentEditable) {
        sessionMode = "textfield-editable";
        activeElement = focusedElement;
        initialBuffer = getTextFromEditable(focusedElement);
      } else {
        // If not a recognized editable element, default to the clipboard
        sessionMode = "clipboard-edit";
        try {
          initialBuffer = (await navigator.clipboard.readText()).split("\n");
        } catch (e) {
          initialBuffer = ["Error reading clipboard."];
        }
      }
    } else {
      // If nothing is focused, default to the clipboard
      sessionMode = "clipboard-edit";
      try {
        initialBuffer = (await navigator.clipboard.readText()).split("\n");
      } catch (e) {
        initialBuffer = ["Error reading clipboard."];
      }
    }

    edInstance = new Ed(initialBuffer, { verboseErrors: true });

    const backdrop = document.createElement("div");
    backdrop.id = PALETTE_ID;
    const container = document.createElement("div");
    container.id = "rh-palette-container";
    const output = document.createElement("pre");
    output.id = "rh-palette-output";
    const input = document.createElement("input");
    input.id = "rh-palette-input";
    input.placeholder = edInstance.getPrompt();
    input.autocomplete = "off";

    const processAndRender = async (command) => {
      const payload = {};
      let shouldBroadcast = false;
      const result = edInstance.process(command);
      if (result.status === "input") {
        input.placeholder = ""; // Clear placeholder to indicate text input is expected
        renderOutput(output, null); // Clear any previous output
        return;
      }
      if (
        !edInstance.inputMode &&
        command.startsWith("/") &&
        command.endsWith("/H") &&
        command.length > 2
      ) {
        payload.type = "highlight";
        payload.regexString = command.substring(1, command.length - 2);
        shouldBroadcast = true;
      } else if (result.buffer) {
        payload.type = "write";
        payload.buffer = result.buffer;
        payload.sessionMode = sessionMode;
        shouldBroadcast = true;
      }

      if (shouldBroadcast) {
        // Tell the background script to broadcast this action to all frames
        chrome.runtime.sendMessage({ action: "broadcast-and-close", payload });
        return; // Stop execution here, wait for the broadcast message
      }

      let newOutput = null;

      if (result.error) {
        newOutput = result.error;
      } else if (result.output) {
        newOutput = result.output;
      }

      // This single call now handles clearing, rendering, and hiding the output area.
      renderOutput(output, newOutput);

      if (result.status === "input") {
        input.placeholder = "";
      } else if (result.status === "quit") {
        closePalette();
        return;
      }

      if (result.buffer) {
        const newText = result.buffer.join("\n");
        if (sessionMode === "textfield-value") {
          activeElement.value = newText;
        } else if (sessionMode === "textfield-editable") {
          setTextInEditable(activeElement, result.buffer);
        } else {
          // clipboard-edit
          await navigator.clipboard.writeText(newText);
        }
        closePalette();
        return;
      }

      input.placeholder = edInstance.getPrompt();
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePalette();
    });
    ["keydown", "keyup", "keypress"].forEach((evt) =>
      backdrop.addEventListener(evt, (e) => e.stopPropagation()),
    );

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePalette();
        return;
      }
      if (e.key !== "Enter") return;

      e.preventDefault();
      const command = input.value;
      input.value = "";
      // We no longer echo the command here; the output is handled entirely by processAndRender.
      processAndRender(command);
    });

    container.appendChild(output);
    container.appendChild(input);
    backdrop.appendChild(container);
    document.body.appendChild(backdrop);
    setTimeout(() => input.focus(), 0);
  }

  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      if (request.action === "toggle-palette" && document.hasFocus()) {
        createPalette();
      } else if (request.action === "execute-and-close") {
        const { payload } = request;
        if (payload.type === "highlight") {
          window.regexHighlighter.remove();
          window.regexHighlighter.apply(payload.regexString);
        } else if (payload.type === "write") {
          const newText = payload.buffer.join("\n");
          // Only the focused element can be written to, so check for `document.hasFocus()`
          // to avoid writing to multiple text fields across frames.
          const focusedElement = document.activeElement;
          if (document.hasFocus() && focusedElement) {
            if (payload.sessionMode === "textfield-value") {
              focusedElement.value = newText;
            } else if (payload.sessionMode === "textfield-editable") {
              setTextInEditable(focusedElement, payload.buffer);
            } else {
              // clipboard-edit
              await navigator.clipboard.writeText(newText);
            }
          }
        }
        closePalette(); // All frames close their palette
      }
    },
  );
})();
