import { Token } from './token';

export interface HighlightOptions {
  theme?: string;
  lineNumbers?: boolean;
  language?: string;
}

export interface HighlightResult {
  html: string;
  tokens: Token[];
}
