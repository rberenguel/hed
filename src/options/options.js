(() => {
  const PREFIXES_KEY = "hed-url-prefixes";

  let prefixes = [];

  async function loadPrefixes() {
    try {
      const data = await chrome.storage.local.get([PREFIXES_KEY]);
      prefixes = data[PREFIXES_KEY] || [];
      renderPrefixList();
    } catch (e) {
      showStatus("Error loading URL prefixes", "error");
    }
  }

  async function savePrefixes() {
    try {
      await chrome.storage.local.set({ [PREFIXES_KEY]: prefixes });
      showStatus("Settings saved successfully", "success");
    } catch (e) {
      showStatus("Error saving settings", "error");
    }
  }

  function renderPrefixList() {
    const list = document.getElementById("domainList");

    if (prefixes.length === 0) {
      list.innerHTML =
        '<div class="empty-state">No URL prefixes configured yet</div>';
      return;
    }

    list.innerHTML = prefixes
      .map(
        (prefix) => `
        <div class="domain-item">
          <code>${escapeHtml(prefix)}</code>
          <button data-domain="${escapeHtml(prefix)}">Remove</button>
        </div>
      `,
      )
      .join("");

    // Attach remove handlers
    list.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prefix = btn.getAttribute("data-domain");
        removePrefix(prefix);
      });
    });
  }

  function addPrefix(prefix) {
    prefix = prefix.trim();

    // Basic validation
    if (!prefix) {
      showStatus("Please enter a URL prefix", "error");
      return;
    }

    // Check for valid URL format (must start with http:// or https://)
    if (!prefix.startsWith("http://") && !prefix.startsWith("https://")) {
      showStatus(
        "Invalid URL format. Must start with http:// or https://",
        "error",
      );
      return;
    }

    // Validate URL structure
    try {
      new URL(prefix);
    } catch (e) {
      showStatus(
        "Invalid URL format. Please enter a valid URL prefix.",
        "error",
      );
      return;
    }

    // Check for duplicates
    if (prefixes.includes(prefix)) {
      showStatus("URL prefix already exists", "error");
      return;
    }

    prefixes.push(prefix);
    prefixes.sort();
    savePrefixes();
    renderPrefixList();
    document.getElementById("newDomain").value = "";
  }

  function removePrefix(prefix) {
    prefixes = prefixes.filter((p) => p !== prefix);
    savePrefixes();
    renderPrefixList();
  }

  function showStatus(message, type) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;

    if (type === "success") {
      setTimeout(() => {
        status.className = "status";
      }, 3000);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Event listeners
  document.getElementById("addDomainBtn").addEventListener("click", () => {
    const input = document.getElementById("newDomain");
    addPrefix(input.value);
  });

  document.getElementById("newDomain").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = document.getElementById("newDomain");
      addPrefix(input.value);
    }
  });

  // Load prefixes on page load
  loadPrefixes();

  // --- Notes Management ---
  let notes = [];
  let sortColumn = "edited";
  let sortDirection = "desc";

  async function loadNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      notes = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith("hed-note:")) {
          const url = key.substring("hed-note:".length);
          notes.push({
            key,
            url,
            text: value.text || "",
            createdAt: value.createdAt || null,
            editedAt: value.editedAt || null,
          });
        }
      }

      renderNotesTable();
    } catch (e) {
      console.error("Error loading notes:", e);
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function getPreview(text) {
    if (!text) return "(empty)";
    // Remove markdown title if present
    const lines = text.split("\n");
    let contentLines = lines;
    if (lines[0] && lines[0].startsWith("#")) {
      contentLines = lines.slice(1);
    }
    const content = contentLines.join(" ").trim();
    return content.substring(0, 50) + (content.length > 50 ? "..." : "");
  }

  function sortNotes() {
    notes.sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case "url":
          aVal = a.url.toLowerCase();
          bVal = b.url.toLowerCase();
          break;
        case "preview":
          aVal = getPreview(a.text).toLowerCase();
          bVal = getPreview(b.text).toLowerCase();
          break;
        case "created":
          aVal = a.createdAt || 0;
          bVal = b.createdAt || 0;
          break;
        case "edited":
          aVal = a.editedAt || 0;
          bVal = b.editedAt || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  function renderNotesTable() {
    const tbody = document.getElementById("notesTableBody");

    if (notes.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-state">No notes saved yet</td></tr>';
      return;
    }

    sortNotes();

    tbody.innerHTML = notes
      .map(
        (note) => `
      <tr>
        <td class="note-url" title="${escapeHtml(note.url)}">
          <a href="${escapeHtml(note.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(note.url)}</a>
        </td>
        <td class="note-preview" title="${escapeHtml(note.text)}">${escapeHtml(getPreview(note.text))}</td>
        <td class="note-date">${formatDate(note.createdAt)}</td>
        <td class="note-date">${formatDate(note.editedAt)}</td>
        <td>
          <button class="delete-note-btn" data-key="${escapeHtml(note.key)}">Delete</button>
        </td>
      </tr>
    `,
      )
      .join("");

    // Attach delete handlers
    tbody.querySelectorAll(".delete-note-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.getAttribute("data-key");
        const note = notes.find((n) => n.key === key);
        const url = note ? note.url : key.substring("hed-note:".length);

        showConfirmModal(
          `Are you sure you want to delete the note for:<br><br><code>${escapeHtml(url)}</code>`,
          async () => {
            await deleteNote(key);
          },
        );
      });
    });

    // Update sort indicators
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.getAttribute("data-sort") === sortColumn) {
        th.classList.add(
          sortDirection === "asc" ? "sorted-asc" : "sorted-desc",
        );
      }
    });
  }

  async function deleteNote(key) {
    try {
      await chrome.storage.local.remove(key);
      showStatus("Note deleted successfully", "success");
      await loadNotes();
    } catch (e) {
      showStatus("Error deleting note", "error");
    }
  }

  // Modal confirmation
  function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const modalContent = document.getElementById("modalContent");
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");

    modalContent.innerHTML = message;
    modal.classList.add("show");

    const handleConfirm = () => {
      cleanup();
      onConfirm();
    };

    const handleCancel = () => {
      cleanup();
    };

    const handleBackdropClick = (e) => {
      if (e.target === modal) {
        cleanup();
      }
    };

    const cleanup = () => {
      modal.classList.remove("show");
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
      modal.removeEventListener("click", handleBackdropClick);
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    modal.addEventListener("click", handleBackdropClick);
  }

  // Setup table sorting
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const column = th.getAttribute("data-sort");
      if (sortColumn === column) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortColumn = column;
        sortDirection = "desc";
      }
      renderNotesTable();
    });
  });

  // Load notes on page load
  loadNotes();
})();
