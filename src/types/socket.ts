import { HighlightOptions } from "./highlighter";
import { Token } from "./token";

export interface HighlightRequest {
  id: string;
  code: string;
  language: string;
  responseType?: 'html' | 'tokens' | 'both';
  options?: HighlightOptions;
}

export interface HighlightResponse {
  id: string;
  success: boolean;
  tokens?: Token[];
  html?: string;
  error?: string;
}
