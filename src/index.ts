export { Tokenizer } from './core/Tokenizer';
export { IncrementalDocument } from './core/IncrementalDocument';
export { Parser } from './core/Parser';
export { Highlighter } from './core/Highlighter';
export { LanguageRegistry, normalizeExtension } from './core/LanguageRegistry';

export { JavaScript } from './languages/JavaScript';
export { TypeScript } from './languages/TypeScript';
export { Python } from './languages/Python';
export { HTML } from './languages/HTML';
export { CSS } from './languages/CSS';
export { PHP } from './languages/PHP';
export { XML } from './languages/XML';
export { YAML } from './languages/YAML';
export { JSON } from './languages/JSON';
export { Java } from './languages/Java';
export { CPP } from './languages/CPP';
export { C } from './languages/C';
export { CSV } from './languages/CSV';

export type { Token, TokenType, StatePushResolver } from './types/token';
export type { CachedLineState, IncrementalUpdate } from './types/incremental';
export type { ParsedCode, ParsedLine } from './types/parser';
export type { TokenizerOptions } from './types/tokenizer';
export type { LanguageDefinition } from './types/language';
export type { HighlightOptions, HighlightResult, LineHighlightResult } from './types/highlighter';
export type {
  DetectLanguageResponse,
  HighlightRequest,
  HighlightResponse,
  NSHServerAuthenticate,
  NSHServerOptions,
  NSHServerRequestInfo,
  SupportedLanguageResponse,
} from './types/socket';
