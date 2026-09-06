import { HighlightOptions } from "./highlighter";
import { Token } from "./token";
import { CachedLineState } from "./incremental";

export interface NSHServerOptions {
  host?: string;
  port?: number;
  maxPayload?: number;
}

export interface HighlightRequest {
  id: string;
  requestType: 'highlight' | 'highlightLine' | 'supportedLanguages' | 'detectLanguage' |
    'openDocument' | 'updateDocument' | 'closeDocument' | 'getDocumentLines';

  code?: string;
  language?: string;
  responseType?: 'html' | 'tokens' | 'both';

  initialState?: string[];
  lineIndex?: number;

  ext?: string;
  path?: string;
  fileName?: string;

  options?: HighlightOptions;
  documentId?: string;
  startLine?: number;
  deletedLines?: number;
  insertedLines?: string[];
  endLine?: number;
}

export interface HighlightResponse {
  id: string;
  success: boolean;
  tokens?: Token[];
  html?: string;
  finalState?: string[];
  error?: string;
  changedStartLine?: number;
  changedEndLine?: number;
  lines?: CachedLineState[];
}

export interface DetectLanguageResponse {
  id: string;
  success: boolean;
  language?: string;
  error?: string;
}

export interface SupportedLanguageResponse {
  id: string;
  success: boolean;
  languages?: string[];
  error?: string;
}
