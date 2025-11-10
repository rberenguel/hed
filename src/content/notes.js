(() => {
  // Store all state on the global object to avoid scope issues
  window.hedNotes = {
    noteUI: null,
    noteContent: null,
    noteHeader: null,
    noteTitleSpan: null,
    getBodyTextFromDOM: null, // Will be set below
    ...window.hedNotes, // Preserve any existing properties
  };

  // These can remain local as they are only used in event listeners below
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const NOTE_ID = "hed-postit-note";
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
    square: '<svg width="14" height="14" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 3.6V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4V3.6C3 3.26863 3.26863 3 3.6 3H20.4C20.7314 3 21 3.26863 21 3.6Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    checkSquare: '<svg width="14" height="14" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 20.4V3.6C3 3.26863 3.26863 3 3.6 3H20.4C20.7314 3 21 3.26863 21 3.6V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M7 12.5L10 15.5L17 8.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /**
   * Renders the note body with special line types
   * @param {string} bodyText - The body text to render
   * @param {HTMLElement} container - The container element to render into
   */
  function renderNoteBody(bodyText, container) {
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
        textSpan.textContent = text;
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
        textSpan.textContent = text;
        lineDiv.appendChild(textSpan);

        lineDiv.addEventListener("click", () => handleCopyClick(text));
        container.appendChild(lineDiv);
        return;
      }

      // Check for list items: - text (but not checkbox)
      if (line.startsWith("- ")) {
        const text = line.substring(2);
        lineDiv.classList.add("hed-list-item");
        lineDiv.textContent = text;
        container.appendChild(lineDiv);
        return;
      }

      // Regular line
      lineDiv.textContent = line || "\u00A0"; // Non-breaking space for empty lines
      container.appendChild(lineDiv);
    });
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

    // Update the stored text
    const fullText = buildNoteText(
      window.hedNotes.noteTitleSpan.textContent,
      getBodyTextFromDOM(),
      window.hedNotes.noteUI.dataset.color,
    );

    // Save to storage
    await saveNote(
      fullText,
      {
        x: window.hedNotes.noteUI.offsetLeft,
        y: window.hedNotes.noteUI.offsetTop,
      },
      window.hedNotes.noteUI.classList.contains("folded"),
    );
  }

  /**
   * Handles copy click events
   * @param {string} text - The text to copy
   */
  async function handleCopyClick(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("HED: Failed to copy text", err);
    }
  }

  /**
   * Reconstructs the body text from the rendered DOM
   * @returns {string}
   */
  function getBodyTextFromDOM() {
    const lines = [];
    const lineElements = window.hedNotes.noteContent.querySelectorAll(".hed-note-line");

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

  // Expose getBodyTextFromDOM globally for palette.js if needed
  window.hedNotes.getBodyTextFromDOM = getBodyTextFromDOM;

  /**
   * Parses the full note text into its components.
   * @param {string} fullText
   * @returns {{title: string, body: string, color: string}}
   */
  function parseNoteText(fullText) {
    if (!fullText || fullText.trim() === "") {
      return { title: "", body: "", color: "y" };
    }

    const lines = fullText.split("\n");
    let title = "HED Note";
    let body = fullText;
    let color = "y"; // Default yellow

    if (lines[0].startsWith("#")) {
      const titleMatch = lines[0].match(/^#\s*(?:\.([bygrt]))?\s*(.*)/);
      if (titleMatch) {
        // titleMatch[1] is the color code (b, y, g, r, t)
        // titleMatch[2] is the title text
        color = titleMatch[1] || "y";
        title = titleMatch[2].trim() || "HED Note";
        body = lines.slice(1).join("\n");
      } else {
        // Fallback for just "#" or "# " with no text
        body = lines.slice(1).join("\n");
      }
    }

    return { title, body, color };
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

  async function loadNote() {
    const key = await getNoteKey();
    try {
      const data = await chrome.storage.local.get([key]);
      return data[key] || null; // Return null if no note exists
    } catch (e) {
      console.error("HED: Error loading note", e);
      return null;
    }
  }

  async function saveNote(text, position, folded) {
    const key = await getNoteKey();
    try {
      // If text is empty, remove the note from storage
      if (!text || text.trim() === "") {
        await chrome.storage.local.remove(key);
        return;
      }

      // Load existing note to preserve creation date
      const data = await chrome.storage.local.get([key]);
      const existingNote = data[key];
      const now = Date.now();

      // Parse color from text to save it correctly
      const { color } = parseNoteText(text);
      await chrome.storage.local.set({
        [key]: {
          text,
          position,
          folded,
          color,
          createdAt: existingNote?.createdAt || now,
          editedAt: now,
        },
      });
    } catch (e) {
      console.error("HED: Error saving note", e);
    }
  }

  function createNoteUI(noteData) {
    if (document.getElementById(NOTE_ID)) return; // Already exists

    const { title, body, color } = parseNoteText(noteData.text);

    // Do not create UI if there is no content
    if (noteData.text.trim() === "") {
      return;
    }

    // Use window.hedNotes state
    window.hedNotes.noteUI = document.createElement("div");
    window.hedNotes.noteUI.id = NOTE_ID;

    // Add folded and color classes
    window.hedNotes.noteUI.className = noteData.folded ? "folded" : "";
    window.hedNotes.noteUI.classList.add(`hed-note-color-${color}`);
    window.hedNotes.noteUI.dataset.color = color; // Store color

    window.hedNotes.noteUI.style.left = `${noteData.position.x}px`;
    window.hedNotes.noteUI.style.top = `${noteData.position.y}px`;

    window.hedNotes.noteHeader = document.createElement("div");
    window.hedNotes.noteHeader.className = "hed-note-header";
    window.hedNotes.noteTitleSpan = document.createElement("span");
    window.hedNotes.noteTitleSpan.textContent = title;
    window.hedNotes.noteHeader.appendChild(window.hedNotes.noteTitleSpan);

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
    window.hedNotes.noteHeader.appendChild(controls);

    window.hedNotes.noteContent = document.createElement("div");
    window.hedNotes.noteContent.className = "hed-note-content";
    renderNoteBody(body, window.hedNotes.noteContent);

    window.hedNotes.noteUI.appendChild(window.hedNotes.noteHeader);
    window.hedNotes.noteUI.appendChild(window.hedNotes.noteContent);
    document.body.appendChild(window.hedNotes.noteUI);

    // --- Event Listeners (now referencing hedNotes state) ---

    window.hedNotes.noteHeader.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      isDragging = true;
      dragOffsetX = e.clientX - window.hedNotes.noteUI.offsetLeft;
      dragOffsetY = e.clientY - window.hedNotes.noteUI.offsetTop;
      window.hedNotes.noteUI.classList.add("dragging");
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      window.hedNotes.noteUI.style.left = `${e.clientX - dragOffsetX}px`;
      window.hedNotes.noteUI.style.top = `${e.clientY - dragOffsetY}px`;
    });

    document.addEventListener("mouseup", (e) => {
      if (!isDragging) return;
      isDragging = false;
      window.hedNotes.noteUI.classList.remove("dragging");

      const fullText = buildNoteText(
        window.hedNotes.noteTitleSpan.textContent,
        getBodyTextFromDOM(),
        window.hedNotes.noteUI.dataset.color,
      );
      saveNote(
        fullText,
        {
          x: window.hedNotes.noteUI.offsetLeft,
          y: window.hedNotes.noteUI.offsetTop,
        },
        window.hedNotes.noteUI.classList.contains("folded"),
      );
    });

    foldButton.addEventListener("click", () => {
      window.hedNotes.noteUI.classList.toggle("folded");
      foldButton.textContent = window.hedNotes.noteUI.classList.contains(
        "folded",
      )
        ? "▧"
        : "–";
      foldButton.title = window.hedNotes.noteUI.classList.contains("folded")
        ? "Unfold"
        : "Fold";

      const fullText = buildNoteText(
        window.hedNotes.noteTitleSpan.textContent,
        getBodyTextFromDOM(),
        window.hedNotes.noteUI.dataset.color,
      );
      saveNote(
        fullText,
        {
          x: window.hedNotes.noteUI.offsetLeft,
          y: window.hedNotes.noteUI.offsetTop,
        },
        window.hedNotes.noteUI.classList.contains("folded"),
      );
    });

    /*editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      window.hedNotes.noteContent.focus();
      chrome.runtime.sendMessage({ action: "toggle-palette" });
    });*/

    window.hedNotes.noteContent.setAttribute("tabindex", "-1");
  }

  /**
   * This is the globally exposed function for the palette to call.
   * It creates, updates, or removes the note UI based on the text.
   * @param {string} fullText
   */
  window.hedNotes.createOrUpdateNote = (fullText) => {
    // Check for empty text first. If empty, remove the note UI.
    if (fullText.trim() === "") {
      // Use window.hedNotes state
      if (window.hedNotes.noteUI) {
        window.hedNotes.noteUI.remove();
        window.hedNotes.noteUI = null;
        window.hedNotes.noteContent = null;
        window.hedNotes.noteHeader = null;
        window.hedNotes.noteTitleSpan = null;
      }
      return;
    }

    const { title, body, color } = parseNoteText(fullText);

    // If note doesn't exist, create it
    if (!window.hedNotes.noteUI) {
      (async () => {
        let noteData = await loadNote(); // Check storage for position
        if (!noteData) {
          noteData = {
            text: fullText,
            position: { x: 20, y: 20 },
            folded: false,
          };
        } else {
          noteData.text = fullText;
        }
        createNoteUI(noteData);
      })();
      return;
    }

    // If note exists, update it
    if (
      window.hedNotes.noteTitleSpan &&
      window.hedNotes.noteContent &&
      window.hedNotes.noteUI
    ) {
      window.hedNotes.noteTitleSpan.textContent = title;
      renderNoteBody(body, window.hedNotes.noteContent);

      // Update color
      window.hedNotes.noteUI.dataset.color = color;
      window.hedNotes.noteUI.className =
        window.hedNotes.noteUI.classList.contains("folded") ? "folded" : ""; // Reset classes
      window.hedNotes.noteUI.classList.add(`hed-note-color-${color}`); // Add new color
    }
  };

  // Load the note when the page is ready
  (async () => {
    const noteData = await loadNote();
    if (noteData) {
      createNoteUI(noteData);
    }
  })();
})();
