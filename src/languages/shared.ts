import { TokenType } from '../types/token';

export const COMMENT_PATTERNS = {
  singleLine: {
    hash: /#.*$/gm,
    doubleSlash: /\/\/.*$/gm,
    doubleDash: /--.*$/gm
  },
  multiLine: {
    slashStar: /\/\*[\s\S]*?\*\//g,
    dashDash: /<!--[\s\S]*?-->/g,
    braceStar: /\{#[\s\S]*?#\}/g
  }
};

export const REGEX_PATTERN =
  /\/(?:[^/\\\n\[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuvy]*/g;

export const STRING_PATTERNS = {
  singleQuote: /'(?:[^'\\]|\\.)*'/g,
  doubleQuote: /"(?:[^"\\]|\\.)*"/g,
  backtick: /`(?:[^`\\]|\\.)*`/g,
  tripleSingle: /'''[\s\S]*?'''/g,
  tripleDouble: /"""[\s\S]*?"""/g
};

export const NUMBER_PATTERNS = {
  bigint: /\b\d(?:_?\d)*n\b/g,
  hex: /\b0x[0-9a-fA-F](?:_?[0-9a-fA-F])*\b/g,
  binary: /\b0b[01](?:_?[01])*\b/g,
  octal: /\b0o[0-7](?:_?[0-7])*\b/g,
  scientific: /\b\d(?:_?\d)*(?:\.\d(?:_?\d)*)?[eE][+-]?\d(?:_?\d)*\b/g,
  decimal: /\b\d(?:_?\d)*\.\d(?:_?\d)*\b|\b\d(?:_?\d)*\.(?!\w)/g,
  integer: /\b\d(?:_?\d)*\b/g
};

export function createKeywordToken(keywords: string[]): TokenType {
  const alternatives = keywords
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|');
  return {
    name: 'keyword',
    pattern: new RegExp(`(?<![\\w$])(?:${alternatives})(?![\\w$])`, 'g'),
    className: 'nsh-keyword'
  };
}

export function createBuiltinList(names: string[], tokenName = "builtin"): TokenType {
  const alternatives = names
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  return {
    name: tokenName,
    pattern: new RegExp(`\\b(?:${alternatives})\\b`, "g"),
    className: "nsh-function",
  };
}

export function createFunctionToken(): TokenType {
  return {
    name: 'function',
    pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*(?=\()/g,
    className: 'nsh-function'
  };
}

export function createVariableToken(): TokenType {
  return {
    name: 'variable',
    pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g,
    className: 'nsh-variable'
  };
}

export function createCommentToken(pattern: RegExp): TokenType {
  return {
    name: 'comment',
    pattern,
    className: 'nsh-comment'
  };
}

export function createStringToken(patterns: RegExp[]): TokenType {
  return {
    name: 'string',
    pattern: combinePatterns(patterns, 'string'),
    className: 'nsh-string'
  };
}

export function createNumberToken(patterns: RegExp[]): TokenType {
  return {
    name: 'number',
    pattern: combinePatterns(patterns, 'number'),
    className: 'nsh-number'
  };
}

function combinePatterns(patterns: RegExp[], label: string): RegExp {
  const sources = patterns.map((pattern, index) => {
    if (hasCapturingGroup(pattern.source)) {
      throw new Error(`${label} pattern ${index} must not contain capturing groups`);
    }
    if (pattern.flags.replace(/[gy]/g, '') !== '') {
      throw new Error(`${label} pattern ${index} must only use the g and y flags`);
    }
    return `(?:${pattern.source})`;
  });
  return new RegExp(sources.join('|'), 'g');
}

function hasCapturingGroup(source: string): boolean {
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character !== '(' || source[index + 1] !== '?') {
      if (character === '(') return true;
      continue;
    }
    const groupType = source[index + 2];
    if (groupType === '<' && source[index + 3] !== '=' && source[index + 3] !== '!') {
      return true;
    }
  }
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
