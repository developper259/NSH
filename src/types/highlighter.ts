import { Token } from './token';

export interface HighlightOptions {
  theme?: string;
  lineNumbers?: boolean;
  /** @deprecated The language is selected by the Highlighter constructor. */
  language?: string;
  /** Adds a mapped CSS class when a token rule did not provide className. */
  includeClasses?: boolean;
}

export interface HighlightResult {
  html: string;
  tokens: Token[];
  finalState: string[];
}

export interface LineHighlightResult {
  html: string;
  tokens: Token[];
  finalState: string[];
}
