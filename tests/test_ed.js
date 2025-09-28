// Note: This test file is designed to be run in a browser environment with Mocha and Chai.
// It requires 'ed.js' to be loaded first.

const { expect } = chai;

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
      expect(ed.buffer).to.deep.equal([
        "one",
        "inserted line",
        "two",
        "three",
      ]);
      expect(ed.currentLine).to.equal(1);
    });

    it("'c' (change) should enter input mode and replace lines", function () {
      let result = ed.process("1,2c"); // change lines 1 and 2
      expect(ed.inputMode).to.be.true;

      ed.process("replacement");
      result = ed.process(".");

      expect(ed.inputMode).to.be.false;
      expect(ed.buffer).to.deep.equal(["replacement", "three"]);
      expect(ed.currentLine).to.equal(0);
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
      expect(result.output).to.equal("find me");
      expect(ed.currentLine).to.equal(2);
    });

    it("'p' should print the current line by default", function () {
      ed.currentLine = 3;
      const result = ed.process("p");
      expect(result.output).to.equal("line 4");
    });

    it("a range should print all lines in that range", function () {
      const result = ed.process("2,4p");
      expect(result.output).to.equal("line 2\nfind me\nline 4");
      expect(ed.currentLine).to.equal(3);
    });

    it("'$' should refer to the last line", function () {
      const result = ed.process("$p");
      expect(result.output).to.equal("find me too");
      expect(ed.currentLine).to.equal(4);
    });

    it("',' and '%' should refer to all lines", function () {
      const allLines = ed.buffer.join("\n");
      let result = ed.process(",p");
      expect(result.output).to.equal(allLines);
      result = ed.process("%p");
      expect(result.output).to.equal(allLines);
    });

    it("a regex should find the next matching line", function () {
      ed.currentLine = 0;
      let result = ed.process("/find/");
      expect(result.output).to.equal("find me");
      expect(ed.currentLine).to.equal(2);
    });

    it("a regex range should print between two matches", function () {
      ed.currentLine = 0;
      const result = ed.process("/find/,/too/p");
      expect(result.output).to.equal("find me\nline 4\nfind me too");
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
      expect(result.output).to.equal("hello galaxy");
      expect(ed.buffer[0]).to.equal("hello galaxy");
    });

    it("should substitute globally on the current line with /g", function () {
      ed.currentLine = 2;
      const result = ed.process("s/world/galaxy/g");
      expect(result.output).to.equal("galaxy galaxy");
      expect(ed.buffer[2]).to.equal("galaxy galaxy");
    });

    it("should substitute over a range of lines", function () {
      const result = ed.process("1,2s/world/galaxy/");
      expect(result.output).to.equal("another galaxy"); // only prints last modified
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
});
