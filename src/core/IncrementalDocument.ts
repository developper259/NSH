import { Tokenizer } from "./Tokenizer";
import { CachedLineState, IncrementalUpdate } from "../types/incremental";

export class IncrementalDocument {
  private readonly tokenizer: Tokenizer;
  private lines: CachedLineState[] = [];

  constructor(tokenizer: Tokenizer, text = "") {
    this.tokenizer = tokenizer;
    this.setText(text);
  }

  public setText(text: string): void {
    const sourceLines = text.split("\n");
    this.lines = this.buildLines(sourceLines, 0, ["root"]);
  }

  public getText(): string {
    return this.lines.map((line) => line.text).join("\n");
  }

  public getLines(): CachedLineState[] {
    return this.lines.map((line) => ({
      ...line,
      stateBefore: [...line.stateBefore],
      stateAfter: [...line.stateAfter],
      tokens: line.tokens.map((token) => ({ ...token })),
    }));
  }

  public getTokens(): import("../types/token").Token[] {
    return this.lines.flatMap((line) => line.tokens.map((token) => ({ ...token })));
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

    const oldLines = this.lines;
    const nextTexts = oldLines.map((line) => line.text);
    nextTexts.splice(startLine, deletedLines, ...insertedLines);

    const stateBefore = startLine === 0 ? ["root"] : oldLines[startLine - 1].stateAfter;
    const rebuilt: CachedLineState[] = oldLines.slice(0, startLine);
    let retokenizedLines = 0;
    let state = [...stateBefore];

    for (let index = startLine; index < nextTexts.length; index += 1) {
      const previous = oldLines[index];
      const line = nextTexts[index];
      const result = this.tokenizer.tokenizeLine(line, state, index);
      const entry: CachedLineState = {
        text: line,
        tokens: result.tokens,
        stateBefore: [...state],
        stateAfter: [...result.finalStateStack],
      };
      rebuilt.push(entry);
      retokenizedLines += 1;
      state = result.finalStateStack;

      if (index >= startLine + insertedLines.length && previous &&
        previous.text === line && sameState(previous.stateAfter, entry.stateAfter)) {
        const remaining = nextTexts.slice(index + 1);
        const oldRemaining = oldLines.slice(index + 1);
        if (remaining.length === oldRemaining.length &&
          remaining.every((text, offset) => text === oldRemaining[offset].text)) {
          rebuilt.push(...oldRemaining.map((oldLine, offset) => cloneLine(oldLine, index + 1 + offset)));
          break;
        }
      }
    }

    this.lines = rebuilt;
    return {
      startLine,
      deletedLines,
      insertedLines: insertedLines.length,
      retokenizedLines,
    };
  }

  private buildLines(texts: string[], startLine: number, state: string[]): CachedLineState[] {
    const result: CachedLineState[] = [];
    let currentState = [...state];
    for (let index = startLine; index < texts.length; index += 1) {
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
}

function sameState(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cloneLine(line: CachedLineState, lineIndex: number): CachedLineState {
  return {
    text: line.text,
    stateBefore: [...line.stateBefore],
    stateAfter: [...line.stateAfter],
    tokens: line.tokens.map((token) => ({ ...token, line: lineIndex + 1 })),
  };
}
