import { Token, TokenType } from "./token";

export interface TokenizerOptions {
  maxStateDepth?: number;
}

export interface CompiledTokenRule {
  original: TokenType;
  matcher: RegExp;
}

export interface CompiledState {
  rules: CompiledTokenRule[];
  canSkipWhitespace: boolean;
}

export type BracketKind = "paren" | "square" | "brace";

export interface BracketFrame {
  kind: BracketKind;
  control?: boolean;
  functionParameters?: boolean;
  functionExpression?: boolean;
  block?: boolean;
  expression?: boolean;
}

export interface TokenContext {
  regexAllowed: boolean;
  previous: Token | undefined;
  beforePrevious: Token | undefined;
  brackets: BracketFrame[];
  lastClosedParenControl: boolean;
  lastClosedParenFunction: boolean;
  lastClosedParenFunctionExpression: boolean;
  lastClosedBraceBlock: boolean;
  functionExpression: boolean;
}
