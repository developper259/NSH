import { Token } from "../types/token";

export function groupTokensByLine(tokens: Token[]): Map<number, Token[]> {
  const lines = new Map<number, Token[]>();
  for (const token of tokens) {
    const line = lines.get(token.line);
    if (line) {
      line.push(token);
    } else {
      lines.set(token.line, [token]);
    }
  }
  return lines;
}
