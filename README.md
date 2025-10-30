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

- **Regex-based Selection**: With the `` `/your-regex/S` `` command, you can select and copy text from the page.

  - **Capture Group Extraction**: It finds all matches for your regex and copies the content of the capture groups to your clipboard.
  - **CSV Formatting**: The copied text is formatted as a CSV, with each match on a new row and each capture group as a column. This is perfect for extracting structured data from a page.
  - **Live Preview**: Just like the highlighter, the selector shows you what will be matched as you type.
  - > **Heads up**: Be cautious with patterns that can match empty strings (like `(a*)` or `(.*)?`), as live previewing them can sometimes affect page performance.

- **Per-Page Notes**: Create and edit a persistent, draggable "post-it" note for any page.
  - **ed Integration**: Use the `e` command to load the current page's note into the `ed` buffer. All standard commands (`a`, `d`, `s/old/new/g`, etc.) can be used to edit it.
  - **Saving**: When in note-edit mode, the `w` command saves the buffer back to the page's note. If the note is empty, `w` will delete the note and remove it from the page.
  - **Markdown Titles**: The first line of the note is treated as a title. You can set its color using a simple syntax:

```markdown
# .b My Blue Note (blue)

# .g My Green Note (green)

# .r My Red Note (red)

# .t My Translucent Note (translucent)

# My Default Note (yellow)
```

- **Context-Aware Editing**: The editor is smart about where it gets its text from:

  - **Text Fields**: If your cursor is in a `<textarea>`, `<input>`, or a `contenteditable` element, HED automatically loads its content into the buffer. The `w` command writes your changes directly back to the element.
  - **Clipboard**: If you are not focused on an editable field, the editor loads its buffer from your system clipboard. The `w` command overwrites the clipboard with your edits.

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
4.  Enter standard `ed` commands, a highlight command (`/regex/H`), or a selection command (`/regex/S`).
5.  When finished, type `w` and press `Enter` to save your changes and close the editor.
