class Ed {
  constructor(initialBuffer = [], config = {}) {
    this.buffer = [...initialBuffer];
    this.currentLine = this.buffer.length > 0 ? this.buffer.length - 1 : 0;
    this.inputMode = false;
    this.inputBuffer = [];
    this.showPrompt = config.showPrompt !== false;
    this.verboseErrors = !!config.verboseErrors;
    this.lastCommandForInput = null;
    this.lastError = null;
  }

  process(line) {
    if (this.inputMode) {
      return this._handleInputMode(line);
    } else {
      return this._processCommand(line);
    }
  }

  getPrompt() {
    if (this.inputMode) {
      return "";
    }
    return this.showPrompt ? "*" : "";
  }

  _processCommand(commandStr) {
    commandStr = commandStr.trim();

    if (commandStr === "") {
      if (this.buffer.length > 0) {
        this.currentLine = (this.currentLine + 1) % this.buffer.length;
        const output = this._print(this.currentLine + 1, this.currentLine + 1);
        return output.error ? output : { output };
      } else {
        return this._error("empty buffer");
      }
    }

    const { address, command } = this._parseCommand(commandStr);
    if (command === "error") {
      return this._error(address); // address holds the error message here
    }

    let range;
    try {
      range = this._parseAddress(address);
    } catch (e) {
      return this._error(e.message);
    }

    switch (command[0]) {
      case "a":
      case "i":
      case "c":
        this.inputMode = true;
        this.lastCommandForInput = { command: command[0], range };
        return { status: "input" };
      case "d":
        const delOutput = this._deleteLines(range.start, range.end);
        return delOutput.error ? delOutput : { output: "" };
      case "p":
        const printOutput = this._print(range.start, range.end);
        return printOutput.error ? printOutput : { output: printOutput };
      case "n":
        const numPrintOutput = this._numberPrint(range.start, range.end);
        return numPrintOutput.error
          ? numPrintOutput
          : { output: numPrintOutput };
      case "s":
        return this._substituteCommand(command, range);
      case "q":
        return {
          output:
            "Type 'w' to save (simulated) and 'q' again to exit.\nOr 'Q' to quit without saving.",
        };
      case "Q":
        this.buffer = [];
        this.currentLine = 0;
        return { output: "Simulator reset." };
      case "w":
        return { output: "File saved (simulated).", buffer: this.buffer };
      case "h":
        return { output: this._getHelpMessage() };
      case "H":
        this.verboseErrors = !this.verboseErrors;
        return {
          output: `Verbose errors ${this.verboseErrors ? "enabled" : "disabled"}.`,
        };
      case "P":
        this.showPrompt = !this.showPrompt;
        return { output: "" };
      default:
        return this._error("unknown command");
    }
  }

  _parseCommand(commandStr) {
    let address = "";
    let command = "";
    let rest = "";
    let cmdIndex = -1;
    let inRegex = false;

    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];

      if (char === "/") {
        inRegex = !inRegex;
        continue;
      }

      // Change this line to accept any letter as a potential command
      if (!inRegex && /[a-zA-Z]/.test(char)) {
        cmdIndex = i;
        break;
      }
    }

    if (cmdIndex !== -1) {
      address = commandStr.substring(0, cmdIndex);
      command = commandStr[cmdIndex];
      rest = commandStr.substring(cmdIndex + 1);
      if (command === "s") {
        command = "s" + rest;
      }
    } else {
      address = commandStr;
    }

    if (command === "" && address !== "") {
      command = "p";
    } else if (command === "" && address === "") {
      return { address: "", command: "", rest: "" };
    }

    return { address, command, rest };
  }

  _handleInputMode(line) {
    if (line === ".") {
      this.inputMode = false;
      const { command, range } = this.lastCommandForInput;

      if (command === "a") {
        this._append(this.inputBuffer, range.start);
      } else if (command === "i") {
        this._insert(this.inputBuffer, range.start);
      } else if (command === "c") {
        this._change(range.start, range.end, this.inputBuffer);
      }
      this.inputBuffer = [];
      return { output: "" };
    } else {
      this.inputBuffer.push(line);
      return { output: "", status: "input" };
    }
  }

  _error(message) {
    this.lastError = message || "unknown command";
    if (this.verboseErrors) {
      return { error: `? ${this.lastError}` };
    }
    return { error: "?" };
  }

  _print(start, end) {
    if (this.buffer.length === 0 && (start || end))
      return this._error("empty buffer");
    if (start < 1 || end > this.buffer.length || start > end) {
      return this._error("invalid address");
    }

    let output = [];
    for (let i = start - 1; i < end; i++) {
      output.push(this.buffer[i]);
    }
    this.currentLine = end - 1;
    return output.join("\n");
  }

  _numberPrint(start, end) {
    if (this.buffer.length === 0) return this._error("empty buffer");
    if (start < 1 || end > this.buffer.length || start > end) {
      return this._error("invalid address");
    }

    let output = [];
    for (let i = start - 1; i < end; i++) {
      output.push(`${i + 1}\t${this.buffer[i]}`);
    }
    this.currentLine = end - 1;
    return output.join("\n");
  }

  _append(text, line) {
    const appendAt = line !== undefined ? line : this.currentLine + 1;
    this.buffer.splice(appendAt, 0, ...text);
    this.currentLine = appendAt + text.length - 1;
  }

  _insert(text, line) {
    const insertAt = line > 0 ? line - 1 : 0;
    this.buffer.splice(insertAt, 0, ...text);
    this.currentLine = insertAt + text.length - 1;
  }

  _change(start, end, text) {
    if (start < 1 || end > this.buffer.length || start > end) {
      return this._error("invalid address");
    }
    this.buffer.splice(start - 1, end - start + 1, ...text);
    this.currentLine = start - 1 + text.length - 1;
    if (this.currentLine < 0) this.currentLine = 0;
  }

  _deleteLines(start, end) {
    if (this.buffer.length === 0) return this._error("empty buffer");
    if (start < 1 || end > this.buffer.length || start > end) {
      return this._error("invalid address");
    }
    this.buffer.splice(start - 1, end - start + 1);
    if (this.buffer.length === 0) {
      this.currentLine = 0;
    } else {
      this.currentLine = Math.min(start - 1, this.buffer.length - 1);
    }
    return "";
  }

  _substituteCommand(command, range) {
    const parts = command.match(/s\/([^\/]*)\/([^\/]*)\/(g?)$/);
    if (!parts) return this._error("invalid substitute command");

    const regexStr = parts[1];
    const replacement = parts[2];
    const global = parts[3] === "g";

    if (this.buffer.length === 0) return this._error("empty buffer");

    let regex;
    try {
      regex = new RegExp(regexStr, global ? "g" : "");
    } catch (e) {
      return this._error("invalid regex");
    }

    let anySuccess = false;
    let lastModifiedLine = -1;
    for (let i = range.start - 1; i < range.end; i++) {
      const originalLine = this.buffer[i];
      const newLine = originalLine.replace(regex, replacement);
      if (originalLine !== newLine) {
        this.buffer[i] = newLine;
        anySuccess = true;
        lastModifiedLine = i;
      }
    }

    if (anySuccess) {
      this.currentLine = lastModifiedLine;
      return { output: this.buffer[lastModifiedLine] };
    }

    return this._error("no match");
  }

  _parseAddress(addressStr) {
    console.log(addressStr);
    if (!addressStr) {
      return { start: this.currentLine + 1, end: this.currentLine + 1 };
    }
    if (addressStr === "," || addressStr === "%") {
      return { start: 1, end: this.buffer.length || 1 };
    }
    if (addressStr.includes(",")) {
      let [s, e] = addressStr.split(",");
      if (s === "") s = "1";
      if (e === "") e = "$";

      const startAddr = this._parseSingleAddress(s, this.currentLine);
      const endAddr = this._parseSingleAddress(e, startAddr - 1, true);
      if (startAddr > endAddr) throw new Error("invalid address range");
      return { start: startAddr, end: endAddr };
    }
    let addr = this._parseSingleAddress(addressStr, this.currentLine);
    return { start: addr, end: addr };
  }

  _parseSingleAddress(addr, startingLine, noWrap = false) {
    if (addr === ".") return startingLine + 1;
    if (addr === "$") return this.buffer.length;
    if (addr === "") return startingLine + 1;
    console.log(addr);
    const num = parseInt(addr, 10);
    if (!isNaN(num)) return num;

    if (addr.startsWith("/") && addr.endsWith("/")) {
      console.log("Address regex");
      const regexStr = addr.slice(1, -1);
      try {
        const regex = new RegExp(regexStr);
        // Search forward from starting line
        for (let i = startingLine + 1; i < this.buffer.length; i++) {
          if (this.buffer[i].match(regex)) {
            return i + 1;
          }
        }
        // If noWrap is false, wrap around and search from the beginning
        if (!noWrap) {
          for (let i = 0; i <= startingLine; i++) {
            if (this.buffer[i].match(regex)) {
              return i + 1;
            }
          }
        }
        // If still no match, throw error
        throw new Error("no match");
      } catch (e) {
        if (e.message === "no match") throw e;
        throw new Error("invalid regex in address");
      }
    }
    throw new Error("invalid address");
  }

  _getHelpMessage() {
    return `
ed commands:
 a      - Append text after current line
 i      - Insert text before current line
 c      - Change lines
 d      - Delete lines
 p      - Print lines
 n      - Number and print lines
 s/old/new/g - Substitute (g for global)
 w      - Write/Save (simulated)
 q      - Warn before quitting
 Q      - Quit without warning (resets simulator)
 .      - Exit input mode / refer to current line
 $      - Refer to last line
 1,$p   - Print all lines
 /regex/ - Search for regex (forward)
 H      - Toggle verbose error messages
 P      - Toggle prompt
 reset  - Reset buffer (custom command)
`;
  }
}
