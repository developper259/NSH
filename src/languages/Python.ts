import { LanguageDefinition } from '../types/language';

export class Python implements LanguageDefinition {
  name = 'python';
  extensions = ['.py', '.pyw'];
  tokenTypes = [
    { name: 'keyword', pattern: /\b(def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|assert|del|in|is|not|and|or|True|False|None)\b/g, className: 'nsh-keyword' },
    { name: 'string', pattern: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: 'nsh-string' },
    { name: 'number', pattern: /\b\d+\.?\d*|\.\d+\b/g, className: 'nsh-number' },
    { name: 'comment', pattern: /#.*$/gm, className: 'nsh-comment' },
    { name: 'function', pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\s*(?=\()/g, className: 'nsh-function' },
    { name: 'operator', pattern: /[+\-*/%=<>!&|^~?:;,.]/g, className: 'nsh-operator' },
    { name: 'variable', pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, className: 'nsh-variable' },
    { name: 'decorator', pattern: /@\w+/g, className: 'nsh-function' }
  ];
  comments = {
    singleLine: '#'
  };
  strings = {
    startEnd: ['"', "'", '"""', "'''"],
    escapeChar: '\\'
  };

  public getTokenTypes(): any[] {
    return this.tokenTypes;
  }
}
