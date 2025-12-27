// Note: This test file is designed to be run in a browser environment with Mocha and Chai.
// It requires 'ed.js' to be loaded first.

const { expect } = chai;

// Helper function to strip HTML from visualized whitespace output
function stripHTML(html) {
  if (typeof html !== "string") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent;
}

describe("Ed Class Core Functionality", function () {
  let ed;

  it("should initialize with an empty buffer", function () {
    ed = new Ed();
    expect(ed.buffer).to.deep.equal([]);
    expect(ed.currentLine).to.equal(0);
  });

  it("should initialize with a provided buffer", function () {
    const initial = ["line 1", "line 2"];
    ed = new Ed(initial);
    expect(ed.buffer).to.deep.equal(initial);
    expect(ed.currentLine).to.equal(1);
  });

  it("should initialize with config options", function () {
    ed = new Ed([], { verboseErrors: true, showPrompt: false });
    expect(ed.verboseErrors).to.be.true;
    expect(ed.showPrompt).to.be.false;
    expect(ed.getPrompt()).to.equal("");
  });

  describe("Append, Insert, Change, Delete", function () {
    beforeEach(function () {
      ed = new Ed(["one", "two", "three"]);
      ed.currentLine = 1; // on "two"
    });

    it("'a' (append) should enter input mode and add lines after current", function () {
      let result = ed.process("a");
      expect(ed.inputMode).to.be.true;
      expect(result.status).to.equal("input");

      ed.process("new line 1");
      ed.process("new line 2");
      result = ed.process(".");

      expect(ed.inputMode).to.be.false;
      expect(ed.buffer).to.deep.equal([
        "one",
        "two",
        "new line 1",
        "new line 2",
        "three",
      ]);
      expect(ed.currentLine).to.equal(3); // last line added
    });

    it("'i' (insert) should enter input mode and add lines before current", function () {
      let result = ed.process("2i"); // insert before line 2 ("two")
      expect(ed.inputMode).to.be.true;

      ed.process("inserted line");
      result = ed.process(".");

      expect(ed.inputMode).to.be.false;
      expect(ed.buffer).to.deep.equal(["one", "inserted line", "two", "three"]);
      expect(ed.currentLine).to.equal(1);
    });

    it("'c' (change) should enter input mode and replace lines", function () {
      let result = ed.process("1,2c"); // change lines 1 and 2
      expect(ed.inputMode).to.be.true;
      expect(result.output).to.equal("one\ntwo"); // Shows what's being changed

      ed.process("replacement");
      result = ed.process(".");

      expect(ed.inputMode).to.be.false;
      expect(ed.buffer).to.deep.equal(["replacement", "three"]);
      expect(ed.currentLine).to.equal(0);
    });

    it("'c' (change) on single line should prepopulate", function () {
      let result = ed.process("2c"); // change line 2 only
      expect(ed.inputMode).to.be.true;
      expect(result.prepopulate).to.equal("two"); // Prepopulates for single line
      expect(result.output).to.be.undefined;

      ed.process("changed");
      result = ed.process(".");

      expect(ed.inputMode).to.be.false;
      expect(ed.buffer).to.deep.equal(["one", "changed", "three"]);
    });

    it("'d' (delete) should remove lines", function () {
      ed.process("2,3d");
      expect(ed.buffer).to.deep.equal(["one"]);
      expect(ed.currentLine).to.equal(0);
    });
  });

  describe("Addressing and Printing", function () {
    beforeEach(function () {
      ed = new Ed(["line 1", "line 2", "find me", "line 4", "find me too"]);
    });

    it("a number should go to a line and print it", function () {
      const result = ed.process("3");
      expect(stripHTML(result.output)).to.equal("find me");
      expect(ed.currentLine).to.equal(2);
    });

    it("'p' should print the current line by default", function () {
      ed.currentLine = 3;
      const result = ed.process("p");
      expect(stripHTML(result.output)).to.equal("line 4");
    });

    it("a range should print all lines in that range", function () {
      const result = ed.process("2,4p");
      expect(stripHTML(result.output)).to.equal("line 2\nfind me\nline 4");
      expect(ed.currentLine).to.equal(3);
    });

    it("'$' should refer to the last line", function () {
      const result = ed.process("$p");
      expect(stripHTML(result.output)).to.equal("find me too");
      expect(ed.currentLine).to.equal(4);
    });

    it("',' and '%' should refer to all lines", function () {
      const allLines = ed.buffer.join("\n");
      let result = ed.process(",p");
      expect(stripHTML(result.output)).to.equal(allLines);
      result = ed.process("%p");
      expect(stripHTML(result.output)).to.equal(allLines);
    });

    it("a regex should find the next matching line", function () {
      ed.currentLine = 0;
      let result = ed.process("/find/");
      expect(stripHTML(result.output)).to.equal("find me");
      expect(ed.currentLine).to.equal(2);
    });

    it("a regex range should print between two matches", function () {
      ed.currentLine = 0;
      const result = ed.process("/find/,/too/p");
      expect(stripHTML(result.output)).to.equal("find me\nline 4\nfind me too");
      expect(ed.currentLine).to.equal(4);
    });
  });

  describe("Substitute Command", function () {
    beforeEach(function () {
      ed = new Ed(["hello world", "another world", "world world"]);
    });

    it("should substitute the first occurrence on the current line", function () {
      ed.currentLine = 0;
      const result = ed.process("s/world/galaxy/");
      expect(stripHTML(result.output)).to.equal("hello galaxy");
      expect(ed.buffer[0]).to.equal("hello galaxy");
    });

    it("should substitute globally on the current line with /g", function () {
      ed.currentLine = 2;
      const result = ed.process("s/world/galaxy/g");
      expect(stripHTML(result.output)).to.equal("galaxy galaxy");
      expect(ed.buffer[2]).to.equal("galaxy galaxy");
    });

    it("should substitute over a range of lines", function () {
      const result = ed.process("1,2s/world/galaxy/");
      expect(stripHTML(result.output)).to.equal("another galaxy"); // only prints last modified
      expect(ed.buffer).to.deep.equal([
        "hello galaxy",
        "another galaxy",
        "world world",
      ]);
    });

    it("should return an error if no match is found", function () {
      const result = ed.process("s/notfound/galaxy/");
      expect(result.error).to.exist;
      expect(result.error).to.include("?");
    });
  });

  describe("Error Handling", function () {
    beforeEach(function () {
      ed = new Ed(["one", "two"], { verboseErrors: true });
    });

    it("should return a verbose error for invalid commands", function () {
      const result = ed.process("x");
      expect(result.error).to.equal("? unknown command");
    });

    it("should return a verbose error for invalid addresses", function () {
      const result = ed.process("5p");
      expect(result.error).to.equal("? invalid address");
    });

    it("should return a simple '?' error when verboseErrors is false", function () {
      ed.process("H"); // Toggle verbose off
      const result = ed.process("x");
      expect(result.error).to.equal("?");
    });
  });

  describe("Bang Commands", function () {
    beforeEach(function () {
      ed = new Ed(["apple", "banana", "apple", "cherry", "BANANA"], {
        verboseErrors: true,
      });
    });

    it("!? should show help", function () {
      const result = ed.process("!?");
      expect(result.output).to.include("Bang Commands");
      expect(result.output).to.include("sort");
      expect(result.output).to.include("uniq");
    });

    it("!sort should sort lines alphabetically", function () {
      ed.process(",!sort");
      expect(ed.buffer).to.deep.equal([
        "BANANA",
        "apple",
        "apple",
        "banana",
        "cherry",
      ]);
    });

    it("!sort should work on a range", function () {
      ed.process("1,3!sort");
      expect(ed.buffer).to.deep.equal([
        "apple",
        "apple",
        "banana",
        "cherry",
        "BANANA",
      ]);
    });

    it("!uniq should remove duplicate lines", function () {
      ed.process(",!uniq");
      expect(ed.buffer).to.deep.equal(["apple", "banana", "cherry", "BANANA"]);
    });

    it("!reverse should reverse line order", function () {
      ed.process(",!reverse");
      expect(ed.buffer).to.deep.equal([
        "BANANA",
        "cherry",
        "apple",
        "banana",
        "apple",
      ]);
    });

    it("!shuffle should shuffle lines (length unchanged)", function () {
      const originalLength = ed.buffer.length;
      ed.process(",!shuffle");
      expect(ed.buffer.length).to.equal(originalLength);
      // Check all original elements are still present
      expect(ed.buffer).to.include.members([
        "apple",
        "banana",
        "cherry",
        "BANANA",
      ]);
    });

    it("!trim should remove whitespace", function () {
      ed = new Ed(["  hello  ", "world\t", "\n\ntest\n"], {
        verboseErrors: true,
      });
      ed.process(",!trim");
      expect(ed.buffer).to.deep.equal(["hello", "world", "test"]);
    });

    it("!upper should convert to uppercase", function () {
      ed.process(",!upper");
      expect(ed.buffer).to.deep.equal([
        "APPLE",
        "BANANA",
        "APPLE",
        "CHERRY",
        "BANANA",
      ]);
    });

    it("!lower should convert to lowercase", function () {
      ed.process(",!lower");
      expect(ed.buffer).to.deep.equal([
        "apple",
        "banana",
        "apple",
        "cherry",
        "banana",
      ]);
    });

    it("!title should convert to title case", function () {
      ed = new Ed(["hello world", "GOOD MORNING", "tHiS iS tEsT"], {
        verboseErrors: true,
      });
      ed.process(",!title");
      expect(ed.buffer).to.deep.equal([
        "Hello World",
        "Good Morning",
        "This Is Test",
      ]);
    });

    it("!invalid should return an error", function () {
      const result = ed.process("!invalid");
      expect(result.error).to.exist;
      expect(result.error).to.include("unknown command");
    });

    it("shell commands should work on current line if no range", function () {
      ed.currentLine = 1; // On "banana" (0-indexed)
      ed.process("!upper");
      expect(ed.buffer[1]).to.equal("BANANA");
      expect(ed.buffer[0]).to.equal("apple"); // Other lines unchanged
    });
  });

  describe("Whitespace Visualization", function () {
    beforeEach(function () {
      ed = new Ed(["  spaces  ", "tab\there", "normal"], {
        verboseErrors: true,
      });
    });

    it("p command should return HTML with visualized whitespace", function () {
      const result = ed.process("1p");
      expect(result.isHTML).to.be.true;
      expect(result.output).to.include('<span class="ws-vis">');
      expect(result.output).to.include("spaces");
    });

    it("n command should return HTML with line numbers and visualized whitespace", function () {
      const result = ed.process("1,2n");
      expect(result.isHTML).to.be.true;
      expect(result.output).to.include('<span class="line-num">1</span>');
      expect(result.output).to.include('<span class="line-num">2</span>');
      expect(result.output).to.include('<span class="ws-vis">');
    });

    it("should escape HTML characters in buffer content", function () {
      ed = new Ed(["<script>alert('xss')</script>"]);
      const result = ed.process("p");
      expect(result.output).to.include("&lt;script&gt;");
      expect(result.output).to.include("&lt;/script&gt;");
      expect(result.output).not.to.include("<script>");
    });

    it("should visualize tabs with tab class", function () {
      const result = ed.process("2p");
      expect(result.output).to.include('<span class="ws-vis ws-tab">');
    });

    it("s command should return HTML with visualized whitespace", function () {
      const result = ed.process("3s/normal/  spaced  /");
      expect(result.isHTML).to.be.true;
      expect(result.output).to.include('<span class="ws-vis">');
    });

    it("empty command should return HTML with visualized whitespace", function () {
      ed.currentLine = 2; // Start on line 2 (0-indexed), will advance to line 0 which has spaces
      const result = ed.process("");
      expect(result.isHTML).to.be.true;
      expect(result.output).to.include('<span class="ws-vis">');
    });
  });
});
