import { Token } from "../types/token";

export type BracketKind = "(" | "[" | "{";

export interface BracketFrameInfo {
  kind: BracketKind;
  index: number;
}

interface BracketAnalysis {
  processed: number;
  stack: BracketFrameInfo[];
}

// Context callbacks receive the line's growing token list. The analysis is
// updated incrementally so bracket lookups stay O(1) amortized per token
// instead of rescanning the whole line for every rule.
const analyses = new WeakMap<Token[], BracketAnalysis>();

export function enclosingBracket(tokens: Token[]): BracketFrameInfo | undefined {
  let analysis = analyses.get(tokens);
  if (!analysis) {
    analysis = { processed: 0, stack: [] };
    analyses.set(tokens, analysis);
  }

  for (let index = analysis.processed; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "bracket") continue;
    if (token.value === "(" || token.value === "[" || token.value === "{") {
      analysis.stack.push({ kind: token.value, index });
    } else {
      const opening =
        token.value === ")" ? "(" : token.value === "]" ? "[" : "{";
      for (let frame = analysis.stack.length - 1; frame >= 0; frame -= 1) {
        if (analysis.stack[frame].kind === opening) {
          analysis.stack.length = frame;
          break;
        }
      }
    }
  }
  analysis.processed = tokens.length;
  return analysis.stack[analysis.stack.length - 1];
}

export function lastSignificantToken(
  tokens: Token[],
): { token: Token; index: number } | undefined {
  let index = tokens.length - 1;
  while (index >= 0 && isComment(tokens[index])) index -= 1;
  return index >= 0 ? { token: tokens[index], index } : undefined;
}

export function previousSignificantIndex(
  tokens: Token[],
  fromIndex: number,
): number {
  let index = fromIndex - 1;
  while (index >= 0 && isComment(tokens[index])) index -= 1;
  return index;
}

export function isComment(token: Token): boolean {
  return token.type === "comment" || token.type === "jsdoc";
}
