#  <img src="media/hed.png" alt="Hed Icon" width="32" height="32"> HED: (Highlighter and Ed) Chrome extension

HED is a Chrome extension for users who prefer keyboard-driven, command-line text manipulation. It offers:

1.  A modal, [`ed`](https://en.wikipedia.org/wiki/Ed_(software))-like editor for editing text in any text field, `contenteditable` block, or your system clipboard.
2.  An on-the-fly regex highlighter for instantly analyzing and marking up page content.

https://github.com/user-attachments/assets/2eaf9353-3851-4524-8b3f-82c553268a9c

([View on youtube](https://youtu.be/x56SmT67LJw))

---

## Core Features

* **Modal `ed` Interface**: Activate a minimalist, `ed`-like command palette with a simple shortcut (`Ctrl+H` by default). Use standard `ed` commands (`p`, `s/foo/bar/g`, `a`, `d`, etc.) to manipulate text.

* **Dynamic Page Highlighter**: By entering a special command in the format ``` `/your-regex/H` ```, you can instantly highlight all matches for a JavaScript regular expression across the entire page.
    * **Capture Group Colors**: Each capture group in your regex is assigned a different color from a customizable theme (e.g., Solarized Dark), allowing for sophisticated text analysis. For example, ``` `/(lorem)|(ipsum)/H` ``` will highlight "lorem" and "ipsum" with unique styles.
    * **Robust & Styled**: The highlighter works seamlessly across complex HTML elements (links, bold text, etc.) and uses high-contrast styling for reasonable readability on any website.

* **Context-Aware Editing**: The editor is smart about where it gets its text from:
    * **Text Fields**: If your cursor is in a `<textarea>`, `<input>`, or a `contenteditable` element, WebEd automatically loads its content into the buffer. The `w` command writes your changes directly back to the element.
    * **Clipboard**: If you are not focused on an editable field, the editor loads its buffer from your system clipboard. The `w` command overwrites the clipboard with your edits.

* **Keyboard-Centric Workflow**: Designed from the ground up to be operated entirely by the keyboard.
    * Press `Enter` to execute a command.
    * The editor remains open for sequential commands until you explicitly write (`w`) or cancel.
    * Press `Escape` at any time to immediately close the palette without saving changes.

* **Plain Text Power**: The editor intentionally operates on plain text, stripping rich-text formatting (like bold or links) to give you the raw power and predictability of a line-based editor.

---

## How to Use

1.  Navigate to any web page.
2.  Focus a text area or `contenteditable` block you want to edit, or just click anywhere to use your clipboard.
3.  Press **`Ctrl+H`** to launch the WebEd palette.
4.  Enter standard `ed` commands and press `Enter`.
5.  When finished, type `w` and press `Enter` to save your changes and close the editor.
