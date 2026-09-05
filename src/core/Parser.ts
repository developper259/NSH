import { Token } from '../types/token';

export interface ParsedLine {
  lineNumber: number;
  tokens: Token[];
}

export interface ParsedCode {
  lines: ParsedLine[];
  totalLines: number;
}

export class Parser {
  private tokens: Token[];
  private sourceLineCount: number | undefined;

  constructor(tokens: Token[], source?: string) {
    this.tokens = tokens;
    this.sourceLineCount = source === undefined ? undefined : source.split("\n").length;
  }

  public parse(): ParsedCode {
    const linesMap = new Map<number, Token[]>();

    for (const token of this.tokens) {
      if (!linesMap.has(token.line)) {
        linesMap.set(token.line, []);
      }
      linesMap.get(token.line)!.push(token);
    }

    const lines: ParsedLine[] = [];
    let highestTokenLine = 0;
    for (const lineNumber of linesMap.keys()) {
      if (lineNumber > highestTokenLine) highestTokenLine = lineNumber;
    }
    const totalLines = Math.max(this.sourceLineCount || 0, highestTokenLine);

    for (let i = 1; i <= totalLines; i++) {
      lines.push({
        lineNumber: i,
        tokens: linesMap.get(i) || []
      });
    }

    return {
      lines,
      totalLines
    };
  }

  public setTokens(tokens: Token[]): void {
    this.tokens = tokens;
  }
}
