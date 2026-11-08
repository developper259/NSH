import { Token, TokenType } from "./token";

export interface TokenizerOptions {
  maxStateDepth?: number;
  /**
   * Behavior when a push would exceed `maxStateDepth`.
   * Defaults to `"throw"` so deeply nested input never silently loses state.
   * Use `"truncate"` for the legacy capped behavior.
   */
  onStateDepthExceeded?: "throw" | "truncate";
  /** Validates the language definition before compiling it. Defaults to true. */
  validate?: boolean;
  /**
   * Skips rules whose first character cannot match the current position.
   * Defaults to true; disable only when debugging a custom rule.
   */
  firstCharacterFilter?: boolean;
}

export interface CompiledTokenRule {
  original: TokenType;
  matcher: RegExp;
  firstChars?: Uint8Array;
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
