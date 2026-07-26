import { Token } from '../types/token';
import { HighlightOptions, HighlightResult } from '../types/highlighter';
import { Tokenizer } from './Tokenizer';
import { LanguageDefinition } from '../types/language';

export class Highlighter {
  private tokenizer: Tokenizer;
  private themeName: string;
  private options: HighlightOptions;

  constructor(language: LanguageDefinition, options?: HighlightOptions) {
    this.tokenizer = new Tokenizer(language);
    this.themeName = options?.theme || 'default';
    this.options = options || {};
  }

  public highlight(code: string): HighlightResult {
    const tokens = this.tokenizer.tokenize(code);
    const html = this.generateHTML(code, tokens);

    return {
      html,
      tokens
    };
  }

  public setTheme(themeName: string): void {
    this.themeName = themeName;
  }

  public getThemeName(): string {
    return this.themeName;
  }

  public setLanguage(language: LanguageDefinition): void {
    this.tokenizer.setLanguage(language);
  }

  private generateHTML(code: string, tokens: Token[]): string {
    const lines = code.split('\n');
    const linesMap = new Map<number, Token[]>();

    for (const token of tokens) {
      if (!linesMap.has(token.line)) {
        linesMap.set(token.line, []);
      }
      linesMap.get(token.line)!.push(token);
    }

    let html = '<div class="nsh-highlighter">';

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i];
      const lineTokens = linesMap.get(lineNumber) || [];

      html += '<div class="nsh-line">';

      if (this.options.lineNumbers) {
        html += `<span class="nsh-line-number">${lineNumber}</span>`;
      }

      let position = 0;
      let sortedTokens = [...lineTokens].sort((a, b) => a.column - b.column);

      for (const token of sortedTokens) {
        if (token.column > position + 1) {
          const plainText = line.substring(position, token.column - 1);
          html += this.escapeHtml(plainText);
          position = token.column - 1;
        }

        const className = this.getCssClass(token.type);
        html += `<span class="${className}">${this.escapeHtml(token.value)}</span>`;
        position = token.column - 1 + token.value.length;
      }

      if (position < line.length) {
        const plainText = line.substring(position);
        html += this.escapeHtml(plainText);
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  private getCssClass(tokenType: string): string {
    const classMap: { [key: string]: string } = {
      keyword: 'nsh-keyword',
      string: 'nsh-string',
      number: 'nsh-number',
      comment: 'nsh-comment',
      function: 'nsh-function',
      variable: 'nsh-variable',
      operator: 'nsh-operator',
      tag: 'nsh-keyword',
      attribute: 'nsh-variable',
      selector: 'nsh-function',
      property: 'nsh-keyword',
      value: 'nsh-string',
      decorator: 'nsh-function',
      type: 'nsh-keyword',
      doctype: 'nsh-keyword',
      entity: 'nsh-number'
    };

    return classMap[tokenType] || 'nsh-variable';
  }

  private escapeHtml(text: string): string {
    const htmlEscapes: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  }
}
