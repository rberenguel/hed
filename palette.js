(() => {
  const PALETTE_ID = "rh-palette-backdrop";
  let edInstance = null; // To hold our editor session
  let sessionMode = "clipboard-edit"; // Default session mode
  let activeElement = null; // Default active element

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

  function renderOutput(outputElement, text) {
    const container = document.getElementById("rh-palette-container");
    if (!container) return;

    if (text) {
      container.classList.add("is-showing-output");
      outputElement.textContent = text;
      outputElement.scrollTop = outputElement.scrollHeight;
    } else {
      container.classList.remove("is-showing-output");
      outputElement.textContent = "";
    }
  }

  const getNoteKey = () => `hed-note:${window.location.href}`;

  async function loadNoteBuffer() {
    const key = getNoteKey();
    try {
      const data = await chrome.storage.local.get([key]);
      if (data[key] && data[key].text) {
        return data[key].text.split("\n");
      }
      return [""]; // Return empty buffer if no note
    } catch (e) {
      return ["Error loading note."];
    }
  }

  async function saveNoteBuffer(buffer) {
    const key = getNoteKey();
    const text = buffer.join("\n").trim();

    try {
      // We must load existing data to preserve position/folded state
      const data = await chrome.storage.local.get([key]);
      const noteData = data[key] || {
        position: { x: 20, y: 20 },
        folded: false,
      };
      noteData.text = text;

      // Save or remove from storage
      if (text === "") {
        await chrome.storage.local.remove(key);
      } else {
        await chrome.storage.local.set({ [key]: noteData });
      }

      // Tell the notes.js UI to update itself
      if (window.hedNotes && window.hedNotes.createOrUpdateNote) {
        window.hedNotes.createOrUpdateNote(text);
      }

      return text === ""
        ? "Note deleted."
        : `Note saved. ${buffer.length} lines.`;
    } catch (e) {
      console.error("HED Error saving note:", e);
      return "Error saving note.";
    }
  }

  async function _switchToNoteEditMode(inputElement, outputElement) {
    sessionMode = "note-edit";
    activeElement = null; // No active element, we're editing the note
    const noteBuffer = await loadNoteBuffer();
    edInstance = new Ed(noteBuffer, { verboseErrors: true });

    const container = document.getElementById("rh-palette-container");
    if (container) {
      container.classList.add("is-editing-note");
    }
    const msg =
      noteBuffer.join("").trim() === ""
        ? "New note"
        : `Note loaded (${noteBuffer.length} lines)`;
    renderOutput(outputElement, msg);
    inputElement.placeholder = edInstance.getPrompt();
  }

  async function createPalette() {
    if (document.getElementById(PALETTE_ID)) {
      return;
    }

    const focusedElement = document.activeElement;
    let initialBuffer = [];
    sessionMode = "clipboard-edit";
    activeElement = null;

    if (focusedElement) {
      if (
        focusedElement.matches &&
        focusedElement.matches(".hed-note-content")
      ) {
        sessionMode = "note-edit";
        activeElement = focusedElement;
        initialBuffer = await loadNoteBuffer();
      } else if (
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
        sessionMode = "clipboard-edit";
        try {
          initialBuffer = (await navigator.clipboard.readText()).split("\n");
        } catch (e) {
          initialBuffer = ["Error reading clipboard."];
        }
      }
    } else {
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

    if (sessionMode === "note-edit") {
      container.classList.add("is-editing-note");
      if (initialBuffer.join("").trim() !== "") {
        renderOutput(output, `Note loaded (${initialBuffer.length} lines)`);
      } else {
        renderOutput(output, "New note");
      }
    }

    const processAndRender = async (command) => {
      const payload = {};
      let shouldBroadcast = false;

      if (!edInstance.inputMode && command.trim().toLowerCase() === "e") {
        await _switchToNoteEditMode(input, output);
        return;
      }

      const result = edInstance.process(command);

      if (result.status === "input") {
        input.placeholder = "";
        renderOutput(output, null);
        return;
      }

      if (result.status === "edit-file") {
        // This is the 'e' command
        await _switchToNoteEditMode(input, output);
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
      } else if (
        !edInstance.inputMode &&
        command.startsWith("/") &&
        command.endsWith("/S") &&
        command.length > 2
      ) {
        const regexString = command.substring(1, command.length - 2);
        try {
          const message = await window.regexSelector.selectAndCopy(regexString);
          payload.type = "selection-complete";
          payload.message = message;
          shouldBroadcast = true;
        } catch (error) {
          renderOutput(output, error);
          return;
        }
      } else if (result.buffer && command.trim().toLowerCase() === "w") {
        if (sessionMode === "note-edit") {
          const saveMessage = await saveNoteBuffer(result.buffer);
          renderOutput(output, saveMessage);
          // Close immediately if deleted, otherwise after 1s
          const closeDelay = saveMessage === "Note deleted." ? 500 : 1000;
          setTimeout(closePalette, closeDelay);
          return;
        } else {
          payload.type = "write";
          payload.buffer = result.buffer;
          payload.sessionMode = sessionMode;
          shouldBroadcast = true;
        }
      }

      if (shouldBroadcast) {
        chrome.runtime.sendMessage({ action: "broadcast-and-close", payload });
        return;
      }

      let newOutput = null;

      if (result.error) {
        newOutput = result.error;
      } else if (result.output) {
        newOutput = result.output;
      }

      renderOutput(output, newOutput);

      if (result.status === "input") {
        input.placeholder = "";
      } else if (result.status === "quit") {
        closePalette();
        return;
      }

      if (result.buffer) {
        // This case should now only be hit by broadcast 'w' commands
        const newText = result.buffer.join("\n");
        if (sessionMode === "textfield-value") {
          activeElement.value = newText;
        } else if (sessionMode === "textfield-editable") {
          setTextInEditable(activeElement, result.buffer);
        } else {
          await navigator.clipboard.writeText(newText);
        }
        closePalette();
        return;
      }

      input.placeholder = edInstance.getPrompt();
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        window.regexHighlighter.remove();
        closePalette();
      }
    });
    ["keydown", "keyup", "keypress"].forEach((evt) =>
      backdrop.addEventListener(evt, (e) => e.stopPropagation()),
    );

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        window.regexHighlighter.remove();
        closePalette();
        return;
      }
      if (e.key !== "Enter") return;

      e.preventDefault();
      const command = input.value;
      input.value = "";
      processAndRender(command);
    });

    input.addEventListener("input", (e) => {
      const command = e.target.value;
      const isSelector = command.endsWith("/S");
      const isHighlighter = command.endsWith("/H");

      if (
        command.startsWith("/") &&
        (isSelector || isHighlighter) &&
        command.length > 5
      ) {
        const regexString = command.substring(1, command.length - 2);
        clearTimeout(input.highlightTimeout);
        input.highlightTimeout = setTimeout(
          () => window.regexHighlighter.apply(regexString),
          100,
        );
      } else {
        clearTimeout(input.highlightTimeout);
        window.regexHighlighter.remove();
      }
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
          closePalette();
        } else if (payload.type === "selection-complete") {
          const output = document.getElementById("rh-palette-output");
          if (output) {
            renderOutput(output, payload.message);
            setTimeout(closePalette, 1500);
          } else {
            closePalette();
          }
        } else if (payload.type === "write") {
          const newText = payload.buffer.join("\n");
          const focusedElement = document.activeElement;
          if (document.hasFocus() && focusedElement) {
            if (payload.sessionMode === "textfield-value") {
              focusedElement.value = newText;
            } else if (payload.sessionMode === "textfield-editable") {
              if (
                !focusedElement.matches ||
                !focusedElement.matches(".hed-note-content")
              ) {
                setTextInEditable(focusedElement, payload.buffer);
              }
            } else {
              await navigator.clipboard.writeText(newText);
            }
          }
        }
        closePalette();
      }
    },
  );
})();
