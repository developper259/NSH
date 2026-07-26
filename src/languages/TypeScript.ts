import { LanguageDefinition } from '../types/language';

export class TypeScript implements LanguageDefinition {
  name = 'typescript';
  extensions = ['.ts', '.tsx'];
  tokenTypes = [
    { name: 'keyword', pattern: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|true|false|null|undefined|void|interface|type|enum|implements|public|private|protected|readonly|abstract|static|as|is|keyof|never|unknown)\b/g, className: 'nsh-keyword' },
    { name: 'string', pattern: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, className: 'nsh-string' },
    { name: 'number', pattern: /\b\d+\.?\d*|\.\d+\b/g, className: 'nsh-number' },
    { name: 'comment', pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm, className: 'nsh-comment' },
    { name: 'function', pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*(?=\()/g, className: 'nsh-function' },
    { name: 'operator', pattern: /[+\-*/%=<>!&|^~?:;,.]/g, className: 'nsh-operator' },
    { name: 'variable', pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, className: 'nsh-variable' },
    { name: 'type', pattern: /\b(string|number|boolean|any|void|never|unknown|object|Array|Promise|Map|Set|Date|RegExp)\b/g, className: 'nsh-keyword' }
  ];
  comments = {
    singleLine: '//',
    multiLine: {
      start: '/*',
      end: '*/'
    }
  };
  strings = {
    startEnd: ['"', "'", '`'],
    escapeChar: '\\'
  };

  public getTokenTypes(): any[] {
    return this.tokenTypes;
  }
}
