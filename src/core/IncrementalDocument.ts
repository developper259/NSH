import { Tokenizer } from "./Tokenizer";
import { CachedLineState, IncrementalUpdate } from "../types/incremental";
import { Token } from "../types/token";

interface InternalLineState {
  text: string;
  tokens: Token[];
  stateBefore: string[];
  stateAfter: string[];
}

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
    const sourceLines = text.split("\n");
    this.lines = this.buildLines(sourceLines, ["root"]);
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

    const lineDelta = insertedLines.length - deletedLines;

    if (
      deletedLines === insertedLines.length &&
      insertedLines.length > 0 &&
      insertedLines.every((text, slot) => this.lines[startLine + slot].text === text)
    ) {
      const before = startLine === 0 ? ["root"] : this.lines[startLine - 1].stateAfter;
      const afterStart = this.lines[startLine].stateBefore;
      const statesMatch = sameState(before, afterStart);
      if (statesMatch) {
        return {
          startLine,
          deletedLines,
          insertedLines: insertedLines.length,
          retokenizedLines: 0,
          changedStartLine: startLine,
          changedEndLine: startLine,
        };
      }
    }

    const stateBefore = startLine === 0 ? ["root"] : this.lines[startLine - 1].stateAfter;
    // This contains both structurally inserted lines and retokenized old lines.
    // It must therefore never be used to calculate the new document length.
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
        stateBefore: [...state],
        stateAfter: [...result.finalStateStack],
      });
      retokenizedLines += 1;
      state = result.finalStateStack;
      changedEndLine = newIndex + 1;
    }

    const oldLineCount = this.lines.length;
    let newWriteIndex = startLine + insertedLines.length;
    let resumeOldIndex = startLine + deletedLines;

    for (;
      resumeOldIndex < oldLineCount;
      resumeOldIndex += 1, newWriteIndex += 1
    ) {
      const oldLine = this.lines[resumeOldIndex];
      const lineText = oldLine.text;

      const result = this.tokenizer.tokenizeLine(lineText, state, newWriteIndex);
      const entry: InternalLineState = {
        text: lineText,
        tokens: result.tokens,
        stateBefore: [...state],
        stateAfter: [...result.finalStateStack],
      };
      retokenizedLines += 1;
      state = result.finalStateStack;

      if (
        oldLine.text === lineText &&
        sameState(oldLine.stateBefore, entry.stateBefore) &&
        sameState(oldLine.stateAfter, entry.stateAfter)
      ) {
        changedEndLine = newWriteIndex;
        break;
      }

      replacement.push(entry);
      changedEndLine = newWriteIndex + 1;
    }

    if (replacement.length > 0 || deletedLines > 0) {
      const nextLineCount = oldLineCount - deletedLines + insertedLines.length;
      const nextLines: InternalLineState[] = new Array(nextLineCount);

      for (let i = 0; i < startLine; i += 1) {
        nextLines[i] = this.lines[i];
      }
      for (let i = 0; i < replacement.length; i += 1) {
        nextLines[startLine + i] = replacement[i];
      }

      // resumeOldIndex points at the first old line which was not placed in the
      // replacement (either because state converged or because we reached EOF).
      const afterSource = resumeOldIndex;
      const afterTarget = startLine + replacement.length;
      for (let i = afterSource; i < this.lines.length; i += 1) {
        nextLines[afterTarget + (i - afterSource)] = this.lines[i];
      }

      this.lines = nextLines;
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

  private buildLines(texts: string[], state: string[]): InternalLineState[] {
    const result: InternalLineState[] = [];
    let currentState = [...state];
    for (let index = 0; index < texts.length; index += 1) {
      const tokenized = this.tokenizer.tokenizeLine(texts[index], currentState, index);
      result.push({
        text: texts[index],
        tokens: tokenized.tokens,
        stateBefore: [...currentState],
        stateAfter: [...tokenized.finalStateStack],
      });
      currentState = tokenized.finalStateStack;
    }
    return result;
  }

  private toCachedLine(line: InternalLineState, lineIndex: number): CachedLineState {
    return {
      text: line.text,
      stateBefore: [...line.stateBefore],
      stateAfter: [...line.stateAfter],
      tokens: line.tokens.map((token) => ({ ...token, line: lineIndex + 1 })),
    };
  }
}

function sameState(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateRange(start: number, end: number, length: number): void {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > length) {
    throw new RangeError("line range is outside the document");
  }
}
