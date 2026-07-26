import { LanguageDefinition } from '../types/language';

export class CSS implements LanguageDefinition {
  name = 'css';
  extensions = ['.css', '.scss', '.sass'];
  tokenTypes = [
    { name: 'selector', pattern: /[.#]?[a-zA-Z_-][a-zA-Z0-9_-]*(?=\s*\{)/g, className: 'nsh-function' },
    { name: 'property', pattern: /[a-zA-Z-]+(?=\s*:)/g, className: 'nsh-keyword' },
    { name: 'value', pattern: /:[^;]+/g, className: 'nsh-string' },
    { name: 'string', pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'nsh-string' },
    { name: 'number', pattern: /\b\d+\.?\d*(px|em|rem|%|vh|vw|deg|s|ms)?\b/g, className: 'nsh-number' },
    { name: 'comment', pattern: /\/\*[\s\S]*?\*\//g, className: 'nsh-comment' },
    { name: 'operator', pattern: /[{}:;,]/g, className: 'nsh-operator' },
    { name: 'variable', pattern: /--[a-zA-Z-]+/g, className: 'nsh-variable' }
  ];
  comments = {
    multiLine: {
      start: '/*',
      end: '*/'
    }
  };
  strings = {
    startEnd: ['"', "'"],
    escapeChar: '\\'
  };

  public getTokenTypes(): any[] {
    return this.tokenTypes;
  }
}
