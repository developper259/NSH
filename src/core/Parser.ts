import { Token } from '../types/token';
import { ParsedCode, ParsedLine } from '../types/parser';
import { groupTokensByLine } from '../utils/TokenGrouping';

export class Parser {
  private tokens: Token[];
  private sourceLineCount: number | undefined;

  constructor(tokens: Token[], source?: string) {
    this.tokens = tokens;
    this.sourceLineCount = source === undefined ? undefined : source.split("\n").length;
  }

  public parse(): ParsedCode {
    const linesMap = groupTokensByLine(this.tokens);

    let highestTokenLine = 0;
    for (const lineNumber of linesMap.keys()) {
      if (lineNumber > highestTokenLine) highestTokenLine = lineNumber;
    }
    const totalLines = Math.max(this.sourceLineCount || 0, highestTokenLine);

    const lines: ParsedLine[] = [];
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

  public setTokens(tokens: Token[], source?: string): void {
    this.tokens = tokens;
    this.sourceLineCount = source === undefined ? undefined : source.split("\n").length;
  }
}
