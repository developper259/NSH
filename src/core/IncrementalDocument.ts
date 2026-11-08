import { Tokenizer } from "./Tokenizer";
import {
  CachedLineState,
  IncrementalUpdate,
  InternalLineState,
} from "../types/incremental";
import { Token } from "../types/token";

const ROOT_STATE = ["root"];

export class IncrementalDocument {
  private readonly tokenizer: Tokenizer;
  private lines: InternalLineState[] = [];

  constructor(tokenizer: Tokenizer, text = "") {
    this.tokenizer = tokenizer;
    this.setText(text);
  }

  public getLineCount(): number {
    return this.lines.length;
  }

  public setText(text: string): void {
    this.lines = this.buildLines(text.split("\n"));
  }

  public getText(): string {
    let text = "";
    for (let index = 0; index < this.lines.length; index += 1) {
      if (index > 0) text += "\n";
      text += this.lines[index].text;
    }
    return text;
  }

  public getTokens(): Token[] {
    return this.getTokensForLines(0, this.lines.length);
  }

  public getLine(index: number): CachedLineState {
    if (!Number.isInteger(index) || index < 0 || index >= this.lines.length) {
      throw new RangeError("line index is outside the document");
    }
    return this.toCachedLine(this.lines[index], index);
  }

  public getLines(start = 0, end = this.lines.length): CachedLineState[] {
    validateRange(start, end, this.lines.length);
    const result: CachedLineState[] = [];
    for (let index = start; index < end; index += 1) {
      result.push(this.toCachedLine(this.lines[index], index));
    }
    return result;
  }

  public getTokensForLines(start: number, end: number): Token[] {
    validateRange(start, end, this.lines.length);
    const result: Token[] = [];
    for (let index = start; index < end; index += 1) {
      const line = this.lines[index];
      for (const token of line.tokens) {
        result.push({ ...token, line: index + 1 });
      }
    }
    return result;
  }

  public updateLines(
    startLine: number,
    deletedLines: number,
    insertedLines: string[],
  ): IncrementalUpdate {
    if (!Number.isInteger(startLine) || startLine < 0 || startLine > this.lines.length) {
      throw new RangeError("startLine must address an existing line or the end of the document");
    }
    if (!Number.isInteger(deletedLines) || deletedLines < 0) {
      throw new RangeError("deletedLines must be a non-negative integer");
    }
    if (deletedLines > this.lines.length - startLine) {
      throw new RangeError("deletedLines exceeds the document length");
    }
    validateInsertedLines(insertedLines);

    if (deletedLines === 0 && insertedLines.length === 0) {
      return emptyUpdate(startLine);
    }

    if (
      deletedLines === insertedLines.length &&
      insertedLines.length > 0 &&
      insertedLines.every((text, slot) => this.lines[startLine + slot].text === text)
    ) {
      return {
        startLine,
        deletedLines,
        insertedLines: insertedLines.length,
        retokenizedLines: 0,
        changedStartLine: startLine,
        changedEndLine: startLine,
      };
    }

    const stateBefore = this.stateBefore(startLine);
    const replacement: InternalLineState[] = [];
    let retokenizedLines = 0;
    let state = [...stateBefore];
    let changedEndLine = startLine;

    for (let local = 0; local < insertedLines.length; local += 1) {
      const newIndex = startLine + local;
      const lineText = insertedLines[local];
      const result = this.tokenizer.tokenizeLine(lineText, state, newIndex);
      replacement.push({
        text: lineText,
        tokens: result.tokens,
        stateAfter: [...result.finalStateStack],
      });
      retokenizedLines += 1;
      state = result.finalStateStack;
      changedEndLine = newIndex + 1;
    }

    const lineIndexSensitive = this.tokenizer.isLineIndexSensitive();
    const oldLineCount = this.lines.length;
    let newWriteIndex = startLine + insertedLines.length;
    let resumeOldIndex = startLine + deletedLines;

    for (;
      resumeOldIndex < oldLineCount;
      resumeOldIndex += 1, newWriteIndex += 1
    ) {
      const oldLine = this.lines[resumeOldIndex];
      const oldStateBefore = this.stateBefore(resumeOldIndex);
      const result = this.tokenizer.tokenizeLine(oldLine.text, state, newWriteIndex);
      retokenizedLines += 1;

      const statesMatch =
        sameState(oldStateBefore, state) &&
        sameState(oldLine.stateAfter, result.finalStateStack);
      const indexesMatch = !lineIndexSensitive || newWriteIndex === resumeOldIndex;
      const changedEndIndex = newWriteIndex + 1;

      if (statesMatch && indexesMatch) {
        changedEndLine = newWriteIndex;
        break;
      }

      replacement.push({
        text: oldLine.text,
        tokens: result.tokens,
        stateAfter: [...result.finalStateStack],
      });
      state = result.finalStateStack;
      changedEndLine = changedEndIndex;
    }

    if (replacement.length > 0 || deletedLines > 0) {
      this.lines = this.rebuildLines(startLine, replacement, resumeOldIndex);
    }

    return {
      startLine,
      deletedLines,
      insertedLines: insertedLines.length,
      retokenizedLines,
      changedStartLine: startLine,
      changedEndLine,
    };
  }

  private stateBefore(lineIndex: number): string[] {
    return lineIndex === 0 ? ROOT_STATE : this.lines[lineIndex - 1].stateAfter;
  }

  private buildLines(texts: string[]): InternalLineState[] {
    const result: InternalLineState[] = [];
    let currentState = [...ROOT_STATE];
    for (let index = 0; index < texts.length; index += 1) {
      const tokenized = this.tokenizer.tokenizeLine(texts[index], currentState, index);
      result.push({
        text: texts[index],
        tokens: tokenized.tokens,
        stateAfter: [...tokenized.finalStateStack],
      });
      currentState = tokenized.finalStateStack;
    }
    return result;
  }

  private rebuildLines(
    startLine: number,
    replacement: InternalLineState[],
    resumeOldIndex: number,
  ): InternalLineState[] {
    const nextLineCount =
      startLine + replacement.length + (this.lines.length - resumeOldIndex);
    const nextLines: InternalLineState[] = new Array(nextLineCount);

    for (let index = 0; index < startLine; index += 1) {
      nextLines[index] = this.lines[index];
    }
    for (let index = 0; index < replacement.length; index += 1) {
      nextLines[startLine + index] = replacement[index];
    }

    const afterTarget = startLine + replacement.length;
    for (let index = resumeOldIndex; index < this.lines.length; index += 1) {
      nextLines[afterTarget + (index - resumeOldIndex)] = this.lines[index];
    }

    return nextLines;
  }

  private toCachedLine(line: InternalLineState, lineIndex: number): CachedLineState {
    return {
      text: line.text,
      stateBefore: [...this.stateBefore(lineIndex)],
      stateAfter: [...line.stateAfter],
      tokens: line.tokens.map((token) => ({ ...token, line: lineIndex + 1 })),
    };
  }
}

function emptyUpdate(line: number): IncrementalUpdate {
  return {
    startLine: line,
    deletedLines: 0,
    insertedLines: 0,
    retokenizedLines: 0,
    changedStartLine: line,
    changedEndLine: line,
  };
}

function sameState(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateInsertedLines(insertedLines: string[]): void {
  if (!Array.isArray(insertedLines)) {
    throw new TypeError("insertedLines must be an array of single-line strings");
  }
  for (const line of insertedLines) {
    if (typeof line !== "string" || line.includes("\n")) {
      throw new TypeError("insertedLines must contain single-line strings");
    }
  }
}

function validateRange(start: number, end: number, length: number): void {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > length) {
    throw new RangeError("line range is outside the document");
  }
}
