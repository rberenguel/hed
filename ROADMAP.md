# HED Feature Roadmap

This document tracks planned features and enhancements for HED.

## Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress
- [-] Deferred

---

## Phase 1: Shell Commands Enhancement

### 1.1 Command Help System
- [x] Implement `!?` to show shell command help (DONE - v0.9.0)
  - Show all available shell commands
  - Brief description of each
  - Example usage
  - Keep it compact and focused

### 1.2 Text Manipulation Commands
- [x] `!sort` - Sort lines alphabetically (DONE - v0.7.0)
- [x] `!uniq` - Remove duplicate lines (DONE - v0.9.0)
- [x] `!reverse` - Reverse line order (DONE - v0.9.0)
- [x] `!shuffle` - Randomly shuffle lines (DONE - v0.9.0)
- [x] `!trim` - Trim leading/trailing whitespace from all lines (DONE - v0.9.0)

### 1.3 Case Conversion Commands
- [x] `!upper` - Convert all text to uppercase (DONE - v0.9.0)
- [x] `!lower` - Convert all text to lowercase (DONE - v0.9.0)
- [x] `!title` - Convert to Title Case (DONE - v0.9.0)

### 1.4 Encoding/Decoding Commands
- [ ] `!base64` - Encode to base64
- [ ] `!base64 -d` - Decode from base64
- [ ] `!url` - URL encode
- [ ] `!url -d` - URL decode
- [ ] `!rot13` - ROT13 cipher

### 1.5 Hashing Commands
- [ ] `!md5` - MD5 hash of text
- [ ] `!sha256` - SHA-256 hash of text

### 1.6 Analysis Commands
- [ ] `!count` - Show word/character/line count statistics
- [ ] `!number` - Add line numbers to text
- [ ] `!number -d` - Remove line numbers from text

### 1.7 JSON/Formatting Commands
- [ ] `!json` - Pretty-print JSON (with error handling)
- [ ] `!json -c` - Compact/minify JSON

**Implementation Notes:**
- Extend `_shellCommand()` in `ed.js`
- Each command operates on the selected range (or current line if no range)
- Add comprehensive error handling
- Update help text as commands are added

---

## Phase 2: Page Content Extraction

### 2.1 Link Extraction
- [ ] `!links` - Extract all URLs from current page
  - Include href, link text, and context
  - Options: `-a` (all), `-e` (external only), `-i` (internal only)
  - Output as CSV or plain list

### 2.2 Email Extraction
- [ ] `!emails` - Extract all email addresses from page
  - Deduplicate results
  - Optionally include context/surrounding text

### 2.3 Highlight/Capture Integration
- [ ] `!copy-highlights` - Copy all currently highlighted text to buffer
  - Preserve capture groups as columns (CSV-like)
  - Include match context if desired
- [ ] `/regex/C` - Capture and load into buffer (like /S but loads into editor)
  - Alternative to copying to clipboard
  - Allows further editing before saving

**Implementation Notes:**
- Create new module: `src/content/pageExtractor.js`
- Expose via `window.hedPageExtractor`
- Integrate with palette.js command processing
- Reuse existing DOM traversal code from highlighter.js

---

## Phase 3: Advanced Highlighting

### 3.1 Copy Highlighted Content
- [ ] Command to copy all highlighted text
- [ ] Option to include/exclude capture groups
- [ ] Load highlighted content into editor buffer

### 3.2 Highlight Enhancement (Future)
- [-] Custom colors per pattern (deferred - current rotation works well)
- [-] Negative highlighting / spotlight mode (deferred - complex)

**Implementation Notes:**
- Extend highlighter.js to track matched text
- Add command: `!copy-highlights` or `/H/C`
- Consider memory implications for large pages

---

## Phase 4: Diff Mode

### 4.1 Basic Diff
- [ ] `!diff` - Compare current buffer with clipboard
  - Show additions/deletions
  - Compact inline format
  - Color-coded output (red for deletions, green for additions)

### 4.2 Diff Output Formats
- [ ] Unified diff format
- [ ] Side-by-side comparison (if space permits)
- [ ] Simple line-by-line comparison

**Implementation Notes:**
- Create `src/content/diff.js` module
- Use simple diff algorithm (Myers or similar)
- Keep output compact and readable
- No merge functionality needed for v1

---

## Phase 5: Templates/Snippets (Future)

### 5.1 Template Storage
- [ ] Define template format (name, content, placeholders)
- [ ] Store templates in Chrome storage
- [ ] UI for managing templates (in options page?)

### 5.2 Template Insertion
- [ ] `!template <name>` - Insert template
- [ ] Placeholder replacement (e.g., `{{DATE}}`, `{{TIME}}`, `{{CURSOR}}`)
- [ ] Interactive placeholder filling

### 5.3 Built-in Templates
- [ ] Common date/time formats
- [ ] Code snippets (function boilerplate, etc.)
- [ ] Markdown structures (table, list, etc.)

**Implementation Notes:**
- Low priority - defer until core features are solid
- Could be a separate skill/module
- Template format: simple key-value with {{placeholders}}

---

## Implementation Priority Order

1. **Immediate (v0.9.0):** ✓ COMPLETED
   - [x] `!?` command help
   - [x] `!uniq`, `!reverse`, `!shuffle`, `!trim`
   - [x] `!upper`, `!lower`, `!title`
   - [x] Update help.js as commands are added

2. **Next (v0.10.0):**
   - [ ] `!links`, `!emails` page extraction
   - [ ] `/regex/C` capture to buffer
   - [ ] `!copy-highlights` for highlighted content

3. **Soon (v0.11.0):**
   - [ ] `!base64`, `!url` encoding/decoding
   - [ ] `!md5`, `!sha256` hashing
   - [ ] `!count` statistics
   - [ ] `!json` formatting

4. **Later (v0.12.0):**
   - [ ] `!diff` mode
   - [ ] `!number` line numbering
   - [ ] `!rot13`

5. **Future (v1.0+):**
   - [ ] Templates/snippets system

---

## Testing Checklist

For each shell command implementation:
- [ ] Works on single line (no range)
- [ ] Works on range (e.g., `1,5!command`)
- [ ] Works on entire buffer (`,!command`)
- [ ] Handles empty input gracefully
- [ ] Handles invalid input (shows error)
- [ ] Updates current line correctly
- [ ] Shown in `!?` help
- [ ] Added to main help (if major feature)
- [ ] Tested on complex/large inputs
- [ ] Performance is acceptable

---

## Notes

- Keep shell commands simple and focused
- Prefer pure JavaScript (no external dependencies)
- Maintain ed command philosophy (terse, composable)
- Prioritize features that leverage HED's unique position (page access + text editing)
- Consider memory/performance implications for large pages
- Document everything in help system
