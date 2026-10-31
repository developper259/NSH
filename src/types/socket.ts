import { HighlightOptions } from "./highlighter";
import { Token } from "./token";
import { CachedLineState } from "./incremental";
import type { IncrementalDocument } from "../core/IncrementalDocument";

export interface NSHServerRequestInfo {
  headers: Record<string, string | string[] | undefined>;
  url?: string;
}

export type NSHServerAuthenticate = (
  request: NSHServerRequestInfo,
) => boolean | Promise<boolean>;

export interface NSHServerOptions {
  host?: string;
  port?: number;
  maxPayload?: number;
  maxClients?: number;
  maxDocumentsPerClient?: number;
  maxDocumentCharacters?: number;
  maxClientDocumentCharacters?: number;
  maxRequestsPerSecond?: number;
  maxRequestBurst?: number;
  maxLinesPerRequest?: number;
  maxStateDepth?: number;
  heartbeatIntervalMs?: number;
  allowedOrigins?: string[];
  allowMissingOrigin?: boolean;
  allowNullOrigin?: boolean;
  authenticate?: NSHServerAuthenticate;
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
  linesTruncated?: boolean;
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

export interface ServerClientDocument {
  document: IncrementalDocument;
  characters: number;
}

export interface ServerClientState {
  documents: Map<string, ServerClientDocument>;
  documentCharacters: number;
  tokens: number;
  lastRefill: number;
  rejectedRequests: number;
}

export interface ServerUpgradeInfo {
  origin?: string;
  req: NSHServerRequestInfo;
}

export type ServerVerifyClientDone = (
  result: boolean,
  code?: number,
  message?: string,
) => void;

export interface ServerValidationLimits {
  maxStateDepth: number;
  maxLinesPerRequest: number;
  maxDocumentCharacters: number;
}
