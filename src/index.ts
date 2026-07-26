// Core classes
export { Tokenizer } from './core/Tokenizer';
export { Parser } from './core/Parser';
export { Highlighter } from './core/Highlighter';
export { ThemeManager } from './core/ThemeManager';
export { LanguageRegistry } from './core/LanguageRegistry';

// Language definitions
export { JavaScript } from './languages/JavaScript';
export { TypeScript } from './languages/TypeScript';
export { Python } from './languages/Python';
export { HTML } from './languages/HTML';
export { CSS } from './languages/CSS';

// Types
export type { Token, TokenType } from './types/token';
export type { ThemeInfo } from './types/theme';
export type { LanguageDefinition } from './types/language';
export type { HighlightOptions, HighlightResult } from './types/highlighter';
