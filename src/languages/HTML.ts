import { LanguageDefinition } from '../types/language';

export class HTML implements LanguageDefinition {
  name = 'html';
  extensions = ['.html', '.htm'];
  tokenTypes = [
    { name: 'tag', pattern: /<\/?[a-zA-Z][a-zA-Z0-9]*|>/g, className: 'nsh-keyword' },
    { name: 'attribute', pattern: /\s[a-zA-Z-]+(?==)/g, className: 'nsh-variable' },
    { name: 'string', pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'nsh-string' },
    { name: 'comment', pattern: /<!--[\s\S]*?-->/g, className: 'nsh-comment' },
    { name: 'doctype', pattern: /<!DOCTYPE[^>]*>/gi, className: 'nsh-keyword' },
    { name: 'entity', pattern: /&[a-zA-Z]+;/g, className: 'nsh-number' }
  ];
  comments = {
    multiLine: {
      start: '<!--',
      end: '-->'
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
