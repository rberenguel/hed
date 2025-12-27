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

  function renderOutput(outputElement, text, isHTML = false) {
    const container = document.getElementById("rh-palette-container");
    if (!container) return;

    if (text) {
      container.classList.add("is-showing-output");
      if (isHTML) {
        outputElement.innerHTML = text;
      } else {
        outputElement.textContent = text;
      }
      outputElement.scrollTop = outputElement.scrollHeight;
    } else {
      container.classList.remove("is-showing-output");
      outputElement.textContent = "";
    }
  }

  const getNoteKey = async () => {
    if (window.hedNoteKeyUtils && window.hedNoteKeyUtils.getNoteKey) {
      return await window.hedNoteKeyUtils.getNoteKey();
    }
    // Fallback if utils not loaded yet
    return `hed-note:${window.location.href}`;
  };

  let currentNoteNumber = 0; // Track which note we're editing

  async function loadNoteBuffer(noteNumber) {
    const key = await getNoteKey();
    try {
      const data = await chrome.storage.local.get([key]);
      let notesObject = data[key] || {};

      // Migration: Check if this is old format (has 'text' property at root)
      if (notesObject.text !== undefined) {
        console.log("HED: Migrating old note format to new format");
        // Old format - migrate to new format with note number 0
        const oldNote = notesObject;
        notesObject = { 0: oldNote };
        // Save migrated data
        await chrome.storage.local.set({ [key]: notesObject });
      }

      if (notesObject[noteNumber] && notesObject[noteNumber].text) {
        return notesObject[noteNumber].text.split("\n");
      }
      return [""]; // Return empty buffer if no note
    } catch (e) {
      return ["Error loading note."];
    }
  }

  async function saveNoteBuffer(noteNumber, buffer) {
    const key = await getNoteKey();
    const text = buffer.join("\n").trim();

    try {
      // Load all notes
      const data = await chrome.storage.local.get([key]);
      const notesObject = data[key] || {};
      const now = Date.now();

      const noteData = notesObject[noteNumber] || {
        position: { x: 20 + noteNumber * 30, y: 20 + noteNumber * 30 },
        folded: false,
        createdAt: now,
      };
      noteData.text = text;
      noteData.editedAt = now;
      // Ensure createdAt exists for old notes
      if (!noteData.createdAt) {
        noteData.createdAt = now;
      }

      // Save or remove note
      if (text === "") {
        delete notesObject[noteNumber];
        // If no notes left, remove the key entirely
        if (Object.keys(notesObject).length === 0) {
          await chrome.storage.local.remove(key);
        } else {
          await chrome.storage.local.set({ [key]: notesObject });
        }
      } else {
        notesObject[noteNumber] = noteData;
        await chrome.storage.local.set({ [key]: notesObject });
      }

      // Tell the notes.js UI to update itself
      if (window.hedNotes && window.hedNotes.createOrUpdateNote) {
        window.hedNotes.createOrUpdateNote(noteNumber, text);
      }

      return text === ""
        ? `Note ${noteNumber} deleted.`
        : `Note ${noteNumber} saved. ${buffer.length} lines.`;
    } catch (e) {
      console.error("HED Error saving note:", e);
      return "Error saving note.";
    }
  }

  async function _switchToNoteEditMode(
    inputElement,
    outputElement,
    noteNumber = 0,
  ) {
    sessionMode = "note-edit";
    activeElement = null; // No active element, we're editing the note
    currentNoteNumber = noteNumber; // Store which note we're editing
    const noteBuffer = await loadNoteBuffer(noteNumber);
    edInstance = new Ed(noteBuffer, { verboseErrors: true });

    const container = document.getElementById("rh-palette-container");
    if (container) {
      container.classList.add("is-editing-note");
    }

    // If note is empty, automatically enter append mode
    const isEmpty = noteBuffer.join("").trim() === "";
    if (isEmpty) {
      const result = edInstance.process("a");
      renderOutput(outputElement, `New note [${noteNumber}] (append mode)`);
      inputElement.placeholder = ""; // Clear placeholder in input mode
    } else {
      const msg = `Note [${noteNumber}] loaded (${noteBuffer.length} lines)`;
      renderOutput(outputElement, msg);
      inputElement.placeholder = edInstance.getPrompt();
    }
  }

  async function _switchToClipboardEditMode(inputElement, outputElement) {
    sessionMode = "clipboard-edit";
    activeElement = null;

    let clipboardBuffer = [];
    try {
      clipboardBuffer = (await navigator.clipboard.readText()).split("\n");
    } catch (e) {
      clipboardBuffer = ["Error reading clipboard."];
    }

    edInstance = new Ed(clipboardBuffer, { verboseErrors: true });

    const container = document.getElementById("rh-palette-container");
    if (container) {
      container.classList.remove("is-editing-note");
      container.classList.remove("is-editing-highlights");
    }

    const msg = `Clipboard loaded (${clipboardBuffer.length} lines)`;
    renderOutput(outputElement, msg);
    inputElement.placeholder = edInstance.getPrompt();
  }

  async function _switchToHighlightEditMode(inputElement, outputElement) {
    sessionMode = "highlight-edit";
    activeElement = null;

    const patterns = await window.hedHighlightPatterns.loadPatterns();
    const buffer = patterns.length > 0 ? patterns : [""];
    edInstance = new Ed(buffer, { verboseErrors: true });

    const container = document.getElementById("rh-palette-container");
    if (container) {
      container.classList.add("is-editing-highlights");
    }

    const isEmpty = buffer.join("").trim() === "";
    if (isEmpty) {
      edInstance.process("a");
      renderOutput(outputElement, "Highlight patterns (append mode)");
      inputElement.placeholder = "";
    } else {
      renderOutput(
        outputElement,
        `Highlight patterns (${buffer.length} patterns)`,
      );
      inputElement.placeholder = edInstance.getPrompt();
    }
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

      // Check for help command
      if (!edInstance.inputMode && command.trim() === "?") {
        if (window.hedHelp && window.hedHelp.getHelpHTML) {
          renderOutput(output, window.hedHelp.getHelpHTML(), true);
        } else {
          renderOutput(output, "Help not available");
        }
        return;
      }

      // Check for 'ce' command (edit clipboard)
      if (!edInstance.inputMode && command.trim().match(/^ce$/i)) {
        await _switchToClipboardEditMode(input, output);
        return;
      }

      // Check for 'e' or 'Ne' command (where N is a digit)
      if (!edInstance.inputMode) {
        const eMatch = command.trim().match(/^(\d*)e$/i);
        if (eMatch) {
          const noteNumber = eMatch[1] ? parseInt(eMatch[1]) : 0;
          await _switchToNoteEditMode(input, output, noteNumber);
          return;
        }

        // Check for 'e H' command (edit highlight patterns)
        if (command.trim().match(/^e\s+H$/i)) {
          await _switchToHighlightEditMode(input, output);
          return;
        }

        // Check for '1H', '2H', etc. (toggle pattern) - space optional
        const toggleMatch = command.trim().match(/^(\d+)\s*H$/i);
        if (toggleMatch) {
          const patternId = parseInt(toggleMatch[1]);
          const result = await window.hedHighlightPatterns.togglePattern(
            patternId,
          );

          if (result.error) {
            renderOutput(output, result.error);
          } else {
            renderOutput(output, result.message);
            setTimeout(closePalette, 800);
          }
          return;
        }
      }

      const result = edInstance.process(command);

      if (result.status === "input") {
        input.placeholder = "";
        // For single-line 'c' command, prepopulate the input
        if (result.prepopulate) {
          input.value = result.prepopulate;
        }
        // For multi-line 'c' command, show what's being changed
        if (result.output) {
          renderOutput(output, result.output);
        } else {
          renderOutput(output, null);
        }
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
        if (sessionMode === "highlight-edit") {
          await window.hedHighlightPatterns.savePatterns(result.buffer);
          const nonEmpty = result.buffer.filter((p) => p.trim() !== "").length;
          renderOutput(output, `Saved ${nonEmpty} patterns`);
          setTimeout(closePalette, 1000);
          return;
        } else if (sessionMode === "note-edit") {
          const saveMessage = await saveNoteBuffer(
            currentNoteNumber,
            result.buffer,
          );
          renderOutput(output, saveMessage);
          // Close immediately if deleted, otherwise after 1s
          const closeDelay = saveMessage.includes("deleted") ? 500 : 1000;
          setTimeout(closePalette, closeDelay);
          return;
        } else {
          // Write directly instead of broadcasting
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

      input.placeholder = edInstance.getPrompt();
    };

    let isPreviewingHighlight = false;

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        // Only remove highlights if we were actively previewing them
        if (isPreviewingHighlight) {
          window.regexHighlighter.remove();
          isPreviewingHighlight = false;
        }
        closePalette();
      }
    });
    ["keydown", "keyup", "keypress"].forEach((evt) =>
      backdrop.addEventListener(evt, (e) => e.stopPropagation()),
    );

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // Only remove highlights if we were actively previewing them
        if (isPreviewingHighlight) {
          window.regexHighlighter.remove();
          isPreviewingHighlight = false;
        }
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
        input.highlightTimeout = setTimeout(() => {
          window.regexHighlighter.apply(regexString);
          isPreviewingHighlight = true;
        }, 100);
      } else {
        clearTimeout(input.highlightTimeout);
        // Only remove highlights if we were actively previewing them
        if (isPreviewingHighlight) {
          window.regexHighlighter.remove();
          isPreviewingHighlight = false;
        }
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
        }
        closePalette();
      }
    },
  );
})();
