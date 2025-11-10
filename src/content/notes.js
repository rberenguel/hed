(() => {
  // Store all state on the global object to avoid scope issues
  window.hedNotes = {
    notes: {}, // Store multiple note UIs by number: { 0: {noteUI, noteContent, ...}, 1: {...}, ... }
    getBodyTextFromDOM: null, // Will be set below
    ...window.hedNotes, // Preserve any existing properties
  };

  // These can remain local as they are only used in event listeners below
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const NOTE_CLASS = "hed-postit-note";
  const getNoteKey = async () => {
    if (window.hedNoteKeyUtils && window.hedNoteKeyUtils.getNoteKey) {
      return await window.hedNoteKeyUtils.getNoteKey();
    }
    // Fallback if utils not loaded yet
    return `hed-note:${window.location.href}`;
  };

  // Inline SVG icons from iconoir
  const ICONS = {
    copy: '<svg width="14" height="14" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.4 20H9.6C9.26863 20 9 19.7314 9 19.4V9.6C9 9.26863 9.26863 9 9.6 9H19.4C19.7314 9 20 9.26863 20 9.6V19.4C20 19.7314 19.7314 20 19.4 20Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 9V4.6C15 4.26863 14.7314 4 14.4 4H4.6C4.26863 4 4 4.26863 4 4.6V14.4C4 14.7314 4.26863 15 4.6 15H9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check:
      '<svg width="14" height="14" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13L9 17L19 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    square:
      '<svg width="14" height="14" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 3.6V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4V3.6C3 3.26863 3.26863 3 3.6 3H20.4C20.7314 3 21 3.26863 21 3.6Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    checkSquare:
      '<svg width="14" height="14" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 20.4V3.6C3 3.26863 3.26863 3 3.6 3H20.4C20.7314 3 21 3.26863 21 3.6V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M7 12.5L10 15.5L17 8.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /**
   * Renders the note body with special line types
   * @param {string} bodyText - The body text to render
   * @param {HTMLElement} container - The container element to render into
   * @param {string|null} language - Optional language for syntax highlighting (e.g., "cpp", "js")
   */
  function renderNoteBody(bodyText, container, language = null) {
    container.innerHTML = "";
    const lines = bodyText.split("\n");

    lines.forEach((line, index) => {
      const lineDiv = document.createElement("div");
      lineDiv.className = "hed-note-line";

      // Check for checkbox lines: - [ ] or - [x]
      const checkboxMatch = line.match(/^- \[([ x])\] (.*)$/);
      if (checkboxMatch) {
        const isChecked = checkboxMatch[1] === "x";
        const text = checkboxMatch[2];
        lineDiv.classList.add("hed-checkbox-line");
        lineDiv.dataset.checked = isChecked;
        lineDiv.dataset.lineIndex = index;

        const iconSpan = document.createElement("span");
        iconSpan.className = "hed-icon";
        iconSpan.innerHTML = isChecked ? ICONS.checkSquare : ICONS.square;
        lineDiv.appendChild(iconSpan);

        const textSpan = document.createElement("span");
        if (language && window.Prism && window.Prism.languages[language]) {
          textSpan.innerHTML = Prism.highlight(
            text,
            Prism.languages[language],
            language,
          );
        } else {
          textSpan.textContent = text;
        }
        lineDiv.appendChild(textSpan);

        lineDiv.addEventListener("click", handleCheckboxClick);
        container.appendChild(lineDiv);
        return;
      }

      // Check for copy lines: * text
      if (line.startsWith("* ")) {
        const text = line.substring(2);
        lineDiv.classList.add("hed-copy-line");

        const iconSpan = document.createElement("span");
        iconSpan.className = "hed-icon";
        iconSpan.innerHTML = ICONS.copy;
        lineDiv.appendChild(iconSpan);

        const textSpan = document.createElement("span");
        if (language && window.Prism && window.Prism.languages[language]) {
          textSpan.innerHTML = Prism.highlight(
            text,
            Prism.languages[language],
            language,
          );
        } else {
          textSpan.textContent = text;
        }
        lineDiv.appendChild(textSpan);

        lineDiv.addEventListener("click", () =>
          handleCopyClick(text, iconSpan),
        );
        container.appendChild(lineDiv);
        return;
      }

      // Check for list items: - text (but not checkbox)
      if (line.startsWith("- ")) {
        const text = line.substring(2);
        lineDiv.classList.add("hed-list-item");
        if (language && window.Prism && window.Prism.languages[language]) {
          lineDiv.innerHTML = Prism.highlight(
            text,
            Prism.languages[language],
            language,
          );
        } else {
          lineDiv.textContent = text;
        }
        container.appendChild(lineDiv);
        return;
      }

      // Regular line
      if (language && window.Prism && window.Prism.languages[language]) {
        lineDiv.innerHTML = Prism.highlight(
          line || " ",
          Prism.languages[language],
          language,
        );
      } else {
        lineDiv.textContent = line || "\u00A0"; // Non-breaking space for empty lines
      }
      container.appendChild(lineDiv);
    });
  }

  /**
   * Gets the note number from a DOM element or its parents
   * @param {HTMLElement} element
   * @returns {number|null}
   */
  function getNoteNumberFromElement(element) {
    const noteUI = element.closest(".hed-postit-note");
    if (noteUI && noteUI.dataset.noteNumber) {
      return parseInt(noteUI.dataset.noteNumber);
    }
    return null;
  }

  /**
   * Handles checkbox click events
   * @param {Event} event
   */
  async function handleCheckboxClick(event) {
    const lineDiv = event.currentTarget;
    const lineIndex = parseInt(lineDiv.dataset.lineIndex);
    const isChecked = lineDiv.dataset.checked === "true";
    const newChecked = !isChecked;

    // Update the UI immediately
    lineDiv.dataset.checked = newChecked;

    // Update the icon span innerHTML
    const iconSpan = lineDiv.querySelector(".hed-icon");
    if (iconSpan) {
      iconSpan.innerHTML = newChecked ? ICONS.checkSquare : ICONS.square;
    }

    // Find which note this belongs to
    const noteNumber = getNoteNumberFromElement(lineDiv);
    if (noteNumber === null) return;

    const noteState = window.hedNotes.notes[noteNumber];
    if (!noteState) return;

    // Update the stored text
    const titleText = noteState.noteTitleSpan.textContent.replace(
      /^\[\d+\] /,
      "",
    );
    const fullText = buildNoteText(
      titleText,
      getBodyTextFromDOMForNote(noteNumber),
      noteState.noteUI.dataset.color,
    );

    // Save to storage
    await saveNote(
      noteNumber,
      fullText,
      {
        x: noteState.noteUI.offsetLeft,
        y: noteState.noteUI.offsetTop,
      },
      noteState.noteUI.classList.contains("folded"),
    );
  }

  /**
   * Handles copy click events
   * @param {string} text - The text to copy
   * @param {HTMLElement} iconSpan - The icon element to update
   */
  async function handleCopyClick(text, iconSpan) {
    try {
      await navigator.clipboard.writeText(text);

      // Show checkmark feedback briefly
      const originalIcon = iconSpan.innerHTML;
      iconSpan.innerHTML = ICONS.check;

      setTimeout(() => {
        iconSpan.innerHTML = originalIcon;
      }, 1000); // Show checkmark for 1 second
    } catch (err) {
      console.error("HED: Failed to copy text", err);
    }
  }

  /**
   * Reconstructs the body text from the rendered DOM for a specific note
   * @param {number} noteNumber
   * @returns {string}
   */
  function getBodyTextFromDOMForNote(noteNumber) {
    const noteState = window.hedNotes.notes[noteNumber];
    if (!noteState || !noteState.noteContent) return "";

    const lines = [];
    const lineElements =
      noteState.noteContent.querySelectorAll(".hed-note-line");

    lineElements.forEach((lineDiv) => {
      if (lineDiv.classList.contains("hed-checkbox-line")) {
        const isChecked = lineDiv.dataset.checked === "true";
        const textSpan = lineDiv.querySelector("span:last-child");
        const text = textSpan ? textSpan.textContent : "";
        lines.push(`- [${isChecked ? "x" : " "}] ${text}`);
      } else if (lineDiv.classList.contains("hed-copy-line")) {
        const textSpan = lineDiv.querySelector("span:last-child");
        const text = textSpan ? textSpan.textContent : "";
        lines.push(`* ${text}`);
      } else if (lineDiv.classList.contains("hed-list-item")) {
        const text = lineDiv.textContent;
        lines.push(`- ${text}`);
      } else {
        const text = lineDiv.textContent;
        lines.push(text === "\u00A0" ? "" : text);
      }
    });

    return lines.join("\n");
  }

  // Expose function globally for palette.js
  window.hedNotes.getBodyTextFromDOMForNote = getBodyTextFromDOMForNote;

  /**
   * Parses the full note text into its components.
   * @param {string} fullText
   * @returns {{title: string, body: string, color: string, language: string|null}}
   */
  function parseNoteText(fullText) {
    if (!fullText || fullText.trim() === "") {
      return { title: "", body: "", color: "y", language: null };
    }

    const lines = fullText.split("\n");
    let title = "HED Note";
    let body = fullText;
    let color = "y"; // Default yellow
    let language = null;

    if (lines[0].startsWith("#")) {
      // Match color codes including solarized with language: .s, .scpp, .sjs, .spy, etc.
      const titleMatch = lines[0].match(
        /^#\s*(?:\.([bygrt]|s(?:cpp|js|py|ts|rust|go|java|bash|json)?))?\s*(.*)/,
      );
      if (titleMatch) {
        // titleMatch[1] is the color code (b, y, g, r, t, s, scpp, sjs, etc.)
        // titleMatch[2] is the title text
        const colorCode = titleMatch[1] || "y";
        color = colorCode;

        // Extract language from solarized color codes
        if (colorCode.startsWith("s") && colorCode.length > 1) {
          language = colorCode.substring(1); // "scpp" → "cpp", "sjs" → "js"
          // Map "js" to "javascript" and "ts" to "typescript" and "py" to "python" for Prism
          if (language === "js") language = "javascript";
          if (language === "ts") language = "typescript";
          if (language === "py") language = "python";
        }

        title = titleMatch[2].trim() || "HED Note";
        body = lines.slice(1).join("\n");
      } else {
        // Fallback for just "#" or "# " with no text
        body = lines.slice(1).join("\n");
      }
    }

    return { title, body, color, language };
  }

  /**
   * Re-assembles the note text from its components for saving.
   * @param {string} title
   * @param {string} body
   * @param {string} color
   * @returns {string}
   */
  function buildNoteText(title, body, color) {
    let titleLine = "# ";
    if (color && color !== "y") {
      titleLine += `.${color} `;
    }
    titleLine += title;

    // If body is empty and title is default, treat as empty note
    if (body.trim() === "" && title === "HED Note") {
      return "";
    }

    return `${titleLine}\n${body}`;
  }

  async function loadNote(noteNumber = 0) {
    const key = await getNoteKey();
    try {
      const data = await chrome.storage.local.get([key]);
      const notesObject = data[key] || {};
      return notesObject[noteNumber] || null; // Return null if note doesn't exist
    } catch (e) {
      console.error("HED: Error loading note", e);
      return null;
    }
  }

  async function loadAllNotes() {
    const key = await getNoteKey();
    try {
      const data = await chrome.storage.local.get([key]);
      const stored = data[key];

      if (!stored) {
        return {}; // No notes exist
      }

      // Migration: Check if this is old format (has 'text' property at root)
      if (stored.text !== undefined) {
        console.log("HED: Migrating old note format to new format");
        // Old format - migrate to new format with note number 0
        const migratedData = {
          0: stored,
        };
        // Save migrated data
        await chrome.storage.local.set({ [key]: migratedData });
        return migratedData;
      }

      return stored; // Already new format
    } catch (e) {
      console.error("HED: Error loading notes", e);
      return {};
    }
  }

  async function saveNote(noteNumber, text, position, folded) {
    const key = await getNoteKey();
    try {
      // Load all notes
      const data = await chrome.storage.local.get([key]);
      const notesObject = data[key] || {};

      // If text is empty, remove this specific note
      if (!text || text.trim() === "") {
        delete notesObject[noteNumber];
        // If no notes left, remove the key entirely
        if (Object.keys(notesObject).length === 0) {
          await chrome.storage.local.remove(key);
        } else {
          await chrome.storage.local.set({ [key]: notesObject });
        }
        return;
      }

      // Load existing note to preserve creation date
      const existingNote = notesObject[noteNumber];
      const now = Date.now();

      // Parse color from text to save it correctly
      const { color } = parseNoteText(text);
      notesObject[noteNumber] = {
        text,
        position,
        folded,
        color,
        createdAt: existingNote?.createdAt || now,
        editedAt: now,
      };

      await chrome.storage.local.set({ [key]: notesObject });
    } catch (e) {
      console.error("HED: Error saving note", e);
    }
  }

  function createNoteUI(noteNumber, noteData) {
    // Check if note already exists
    if (window.hedNotes.notes[noteNumber]) return; // Already exists

    const { title, body, color, language } = parseNoteText(noteData.text);

    // Do not create UI if there is no content
    if (noteData.text.trim() === "") {
      return;
    }

    // Create note state object
    const noteState = {};
    window.hedNotes.notes[noteNumber] = noteState;

    // Create UI elements
    noteState.noteUI = document.createElement("div");
    noteState.noteUI.className = NOTE_CLASS;
    noteState.noteUI.dataset.noteNumber = noteNumber; // Store note number

    // Add folded and color classes
    if (noteData.folded) {
      noteState.noteUI.classList.add("folded");
    }
    noteState.noteUI.classList.add(`hed-note-color-${color}`);
    noteState.noteUI.dataset.color = color; // Store color

    noteState.noteUI.style.left = `${noteData.position.x}px`;
    noteState.noteUI.style.top = `${noteData.position.y}px`;

    noteState.noteHeader = document.createElement("div");
    noteState.noteHeader.className = "hed-note-header";
    noteState.noteTitleSpan = document.createElement("span");
    noteState.noteTitleSpan.textContent = `[${noteNumber}] ${title}`;
    noteState.noteHeader.appendChild(noteState.noteTitleSpan);

    const controls = document.createElement("div");
    controls.className = "hed-note-controls";

    const foldButton = document.createElement("button");
    foldButton.className = "hed-note-fold";
    foldButton.textContent = noteData.folded ? "▧" : "–";
    foldButton.title = noteData.folded ? "Unfold" : "Fold";

    const editButton = document.createElement("button");
    editButton.className = "hed-note-edit";
    editButton.textContent = "✎";
    editButton.title = "Edit with HED (Ctrl+H)";

    controls.appendChild(foldButton);
    //controls.appendChild(editButton);
    noteState.noteHeader.appendChild(controls);

    noteState.noteContent = document.createElement("div");
    noteState.noteContent.className = "hed-note-content";
    renderNoteBody(body, noteState.noteContent, language);

    noteState.noteUI.appendChild(noteState.noteHeader);
    noteState.noteUI.appendChild(noteState.noteContent);
    document.body.appendChild(noteState.noteUI);

    // --- Event Listeners (capturing noteNumber and noteState in closure) ---

    noteState.noteHeader.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      isDragging = true;
      dragOffsetX = e.clientX - noteState.noteUI.offsetLeft;
      dragOffsetY = e.clientY - noteState.noteUI.offsetTop;
      noteState.noteUI.classList.add("dragging");
      noteState.noteUI.dataset.draggingNote = noteNumber; // Track which note is being dragged
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const draggingNote = document.querySelector("[data-dragging-note]");
      if (draggingNote) {
        draggingNote.style.left = `${e.clientX - dragOffsetX}px`;
        draggingNote.style.top = `${e.clientY - dragOffsetY}px`;
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (!isDragging) return;
      const draggingNote = document.querySelector("[data-dragging-note]");
      if (!draggingNote) return;

      isDragging = false;
      const draggedNoteNumber = parseInt(draggingNote.dataset.draggingNote);
      delete draggingNote.dataset.draggingNote;
      draggingNote.classList.remove("dragging");

      const draggedState = window.hedNotes.notes[draggedNoteNumber];
      if (draggedState) {
        const titleText = draggedState.noteTitleSpan.textContent.replace(
          /^\[\d+\] /,
          "",
        ); // Remove [N] prefix
        const fullText = buildNoteText(
          titleText,
          getBodyTextFromDOMForNote(draggedNoteNumber),
          draggedState.noteUI.dataset.color,
        );
        saveNote(
          draggedNoteNumber,
          fullText,
          {
            x: draggedState.noteUI.offsetLeft,
            y: draggedState.noteUI.offsetTop,
          },
          draggedState.noteUI.classList.contains("folded"),
        );
      }
    });

    foldButton.addEventListener("click", () => {
      noteState.noteUI.classList.toggle("folded");
      foldButton.textContent = noteState.noteUI.classList.contains("folded")
        ? "▧"
        : "–";
      foldButton.title = noteState.noteUI.classList.contains("folded")
        ? "Unfold"
        : "Fold";

      const titleText = noteState.noteTitleSpan.textContent.replace(
        /^\[\d+\] /,
        "",
      ); // Remove [N] prefix
      const fullText = buildNoteText(
        titleText,
        getBodyTextFromDOMForNote(noteNumber),
        noteState.noteUI.dataset.color,
      );
      saveNote(
        noteNumber,
        fullText,
        {
          x: noteState.noteUI.offsetLeft,
          y: noteState.noteUI.offsetTop,
        },
        noteState.noteUI.classList.contains("folded"),
      );
    });

    /*editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      noteState.noteContent.focus();
      chrome.runtime.sendMessage({ action: "toggle-palette" });
    });*/

    noteState.noteContent.setAttribute("tabindex", "-1");
  }

  /**
   * This is the globally exposed function for the palette to call.
   * It creates, updates, or removes the note UI based on the text.
   * @param {number} noteNumber
   * @param {string} fullText
   */
  window.hedNotes.createOrUpdateNote = (noteNumber, fullText) => {
    // Check for empty text first. If empty, remove the note UI.
    if (fullText.trim() === "") {
      const noteState = window.hedNotes.notes[noteNumber];
      if (noteState && noteState.noteUI) {
        noteState.noteUI.remove();
        delete window.hedNotes.notes[noteNumber];
      }
      return;
    }

    const { title, body, color, language } = parseNoteText(fullText);

    // If note doesn't exist, create it
    if (!window.hedNotes.notes[noteNumber]) {
      (async () => {
        let noteData = await loadNote(noteNumber); // Check storage for position
        if (!noteData) {
          // Default position, offset by note number
          noteData = {
            text: fullText,
            position: { x: 20 + noteNumber * 30, y: 20 + noteNumber * 30 },
            folded: false,
          };
        } else {
          noteData.text = fullText;
        }
        createNoteUI(noteNumber, noteData);
      })();
      return;
    }

    // If note exists, update it
    const noteState = window.hedNotes.notes[noteNumber];
    if (
      noteState &&
      noteState.noteTitleSpan &&
      noteState.noteContent &&
      noteState.noteUI
    ) {
      noteState.noteTitleSpan.textContent = `[${noteNumber}] ${title}`;
      renderNoteBody(body, noteState.noteContent, language);

      // Update color
      noteState.noteUI.dataset.color = color;

      // Reset color classes but preserve other classes
      const isFolded = noteState.noteUI.classList.contains("folded");
      noteState.noteUI.className = NOTE_CLASS;
      if (isFolded) {
        noteState.noteUI.classList.add("folded");
      }
      noteState.noteUI.classList.add(`hed-note-color-${color}`);
    }
  };

  // Load all notes when the page is ready
  (async () => {
    const allNotes = await loadAllNotes();
    for (const [noteNumberStr, noteData] of Object.entries(allNotes)) {
      const noteNumber = parseInt(noteNumberStr);
      if (noteData) {
        createNoteUI(noteNumber, noteData);
      }
    }
  })();
})();
