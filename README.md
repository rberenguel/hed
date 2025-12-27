# <img src="media/hed.png" alt="Hed Icon" width="32" height="32"> HED: (Highlighter and Ed) Chrome extension

HED is a Chrome extension for users who prefer keyboard-driven, command-line text manipulation. It offers:

1.  A modal, [`ed`](<https://en.wikipedia.org/wiki/Ed_(software)>)-like editor for editing text in any text field, `contenteditable` block, or your system clipboard.
2.  An on-the-fly regex highlighter for instantly analyzing and marking up page content.

https://github.com/user-attachments/assets/2eaf9353-3851-4524-8b3f-82c553268a9c

([View on youtube](https://youtu.be/x56SmT67LJw))

---

## Core Features

- **Modal `ed` Interface**: Activate a minimalist, `ed`-like command palette with a simple shortcut (`Ctrl+H` by default). Use standard `ed` commands (`p`, `s/foo/bar/g`, `a`, `d`, etc.) to manipulate text.

- **Dynamic Page Highlighter**: Use the special command format `` `/your-regex/H` `` to instantly highlight all capture groups for a JavaScript regular expression across the page.

  - **Live Preview**: See matches appear in real-time as you type your regex, making it easier to get your expression just right before executing.
  - > **Heads up**: Be cautious with patterns that can match empty strings (like `(a*)` or `(.*)?`), as live previewing them can sometimes affect page performance.
  - **Capture Group Colors**: Each capture group is assigned a different color, allowing for sophisticated text analysis. For example, `` `/(lorem)|(ipsum)/H` `` will highlight "lorem" and "ipsum" with unique styles.
  - **Robust & Styled**: The highlighter works seamlessly across complex HTML elements and uses high-contrast styling for readability.

- **Stored Highlight Patterns**: Create a reusable library of regex patterns that can be toggled on/off per page.

  - **Pattern Library**: Use `e H` to edit your global highlight patterns file with standard `ed` commands. Each line is a separate regex pattern.
  - **Toggle Highlights**: Activate pattern 0 with `0H`, pattern 1 with `1H`, etc. Run the same command again to toggle off.
  - **Auto-Reapply**: Active highlights automatically reapply when you reload the page.
  - **Per-Page State**: Each page remembers which patterns are active independently.
  - **Color Rotation**: Each pattern ID gets a unique color (pattern 0 = blue, pattern 1 = green, pattern 2 = orange, etc.) making it easy to distinguish multiple active patterns.
  - **Perfect for Common Terms**: Store patterns for your name, project-specific terms, error keywords, or any text you frequently search for across different pages.

- **Regex-based Selection**: With the `` `/your-regex/S` `` command, you can select and copy text from the page.

  - **Capture Group Extraction**: It finds all matches for your regex and copies the content of the capture groups to your clipboard.
  - **CSV Formatting**: The copied text is formatted as a CSV, with each match on a new row and each capture group as a column. This is perfect for extracting structured data from a page.
  - **Live Preview**: Just like the highlighter, the selector shows you what will be matched as you type.
  - > **Heads up**: Be cautious with patterns that can match empty strings (like `(a*)` or `(.*)?`), as live previewing them can sometimes affect page performance.

- **Per-Page Notes**: Create and edit persistent, draggable "post-it" notes for any page.
  - **Multiple Notes**: Each page can have multiple numbered notes (0, 1, 2, etc.). Use `e` to edit note 0, `1e` to edit note 1, `2e` to edit note 2, and so on. Use `ce` to edit clipboard.
  - **ed Integration**: Load notes into the `ed` buffer. All standard commands (`a`, `d`, `s/old/new/g`, etc.) work as expected.
  - **Saving**: The `w` command saves the buffer back to the page's note. Empty notes are automatically removed.
  - **URL Prefix Grouping**: Notes are saved per URL by default, but you can configure URL prefix grouping to share notes across multiple pages—perfect for single-page applications with client-side routing (like Google Chat or GitHub repositories).
  - **Interactive Features**: Notes support special line types:
    - `- [ ]` / `- [x]` → Interactive checkboxes
    - `* text` → Clipboard copy button
    - `- text` → Bulleted list items
  - **Syntax Highlighting**: Code notes with solarized dark theme using Prism.js (supports C/C++, JavaScript, TypeScript, Python, Rust, Go, Java, Bash, JSON)
  - **Markdown Titles**: The first line of each note is treated as a title and supports color customization:

```markdown
# .b My Blue Note (blue)

# .g My Green Note (green)

# .r My Red Note (red)

# .t My Translucent Note (translucent)

# .scpp My C++ Code (solarized dark with C++ highlighting)

# .sjs My JavaScript (solarized dark with JS highlighting)

# .spy My Python Script (solarized dark with Python highlighting)

# .srust My Rust Code (solarized dark with Rust highlighting)

# .sgo My Go Program (solarized dark with Go highlighting)

# .sjava My Java Class (solarized dark with Java highlighting)

# .sbash My Shell Script (solarized dark with Bash highlighting)

# .sts My TypeScript (solarized dark with TypeScript highlighting)

# .sjson My JSON Data (solarized dark with JSON highlighting)

# My Default Note (yellow)
```

- **Context-Aware Editing**: The editor is smart about where it gets its text from:

  - **Text Fields**: If your cursor is in a `<textarea>`, `<input>`, or a `contenteditable` element, HED automatically loads its content into the buffer. The `w` command writes your changes directly back to the element.
  - **Notes**: If focused on a note, HED edits that note.
  - **Clipboard**: If you are not focused on an editable field, the editor loads its buffer from your system clipboard. The `w` command overwrites the clipboard with your edits.
  - **Override**: Use `ce` to force clipboard editing even when a field is focused.

- **Keyboard-Centric Workflow**: Designed from the ground up to be operated entirely by the keyboard.

  - Press `Enter` to execute a command.
  - The editor remains open for sequential commands until you explicitly write (`w`) or cancel.
  - Press `Escape` at any time to immediately close the palette without saving changes.

- **Plain Text Power**: The editor intentionally operates on plain text, stripping rich-text formatting (like bold or links) to give you the raw power and predictability of a line-based editor.

---

## How to Use

1.  Navigate to any web page.
2.  Focus a text area or `contenteditable` block you want to edit, or just click anywhere to use your clipboard.
3.  Press **`Ctrl+H`** to launch the HED palette.
4.  Type **`?`** to see all available HED features and commands.
5.  Enter standard `ed` commands, a highlight command (`/regex/H`), or a selection command (`/regex/S`).
6.  When finished, type `w` and press `Enter` to save your changes and close the editor.

## Configuration

Right-click the HED extension icon and select **Options** to access:

### URL Prefix Note Grouping

Share notes across multiple pages that start with the same URL prefix. This is useful for single-page applications with client-side routing.

**Examples:**

- `https://mail.google.com/chat/` keeps the same note across all Google Chat conversations
- `https://github.com/user/repo` shares notes across all pages in a repository
- `https://example.com/docs/` groups all documentation pages together

Simply add your desired URL prefixes in the options page, one per line.

### Note Management

View and manage all your saved notes in a sortable table:

- **Sort by URL, creation date, or last edited** by clicking column headers
- **Preview note content** to see the first 50 characters of each note
- **Quick navigation** by clicking any URL to open that page in a new tab
- **Delete notes** to remove unwanted notes with a single click
