import { TokenType } from './token';

export interface LanguageDefinition {
  name: string;
  extensions: string[];
  aliases?: string[];
  /**
   * Declares whether rule `context` callbacks depend on the absolute line index.
   *
   * When omitted, a language is considered line-index sensitive as soon as one
   * of its rules declares a `context` callback. Incremental documents only
   * reuse a cached suffix when line indexes are unchanged for sensitive
   * languages. Set this to `false` only after verifying that every context
   * callback ignores its `lineIndex` argument.
   */
  lineIndexSensitive?: boolean;
  getStates(): Record<string, TokenType[]>;
}