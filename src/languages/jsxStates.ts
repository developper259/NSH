import { LanguageDefinition } from "../types/language";
import { Token, TokenType } from "../types/token";
import { lastSignificantToken } from "./context";

const JSX_TAG_STATE = "jsxTag";
const JSX_CHILDREN_STATE = "jsxChildren";
const JSX_EXPRESSION_STATE = "jsxExpression";
const JSX_DOUBLE_QUOTE_STATE = "jsxDoubleQuote";
const JSX_SINGLE_QUOTE_STATE = "jsxSingleQuote";

const TAG_NAME = "[A-Za-z_$][A-Za-z0-9_$.:-]*";
const OPEN_TAG = new RegExp(`<${TAG_NAME}`, "g");
const CLOSE_TAG = new RegExp(`</${TAG_NAME}\\s*>`, "g");
const FRAGMENT_OPEN = /<>/g;
const FRAGMENT_CLOSE = /<\/>/g;

const JSX_EXPRESSION_KEYWORDS = new Set([
  "return",
  "yield",
  "await",
  "case",
  "default",
  "else",
  "do",
  "throw",
  "new",
  "typeof",
  "in",
  "of",
]);

const tagStartRules: TokenType[] = [
  {
    name: "jsx-tag",
    pattern: OPEN_TAG,
    className: "nsh-keyword",
    context: isJsxExpressionPosition,
    push: JSX_TAG_STATE,
  },
  {
    name: "jsx-tag",
    pattern: FRAGMENT_OPEN,
    className: "nsh-keyword",
    context: isJsxExpressionPosition,
    push: JSX_CHILDREN_STATE,
  },
];

const tagRules: TokenType[] = [
  {
    name: "tag-selfclose",
    pattern: /\/>/g,
    className: "nsh-keyword",
    pop: true,
  },
  {
    name: "tag-bracket",
    pattern: />/g,
    className: "nsh-keyword",
    pop: true,
    push: JSX_CHILDREN_STATE,
  },
  {
    name: "bracket",
    pattern: /\{/g,
    className: "nsh-bracket",
    push: JSX_EXPRESSION_STATE,
  },
  {
    name: "string",
    pattern: /"/g,
    className: "nsh-string",
    push: JSX_DOUBLE_QUOTE_STATE,
  },
  {
    name: "string",
    pattern: /'/g,
    className: "nsh-string",
    push: JSX_SINGLE_QUOTE_STATE,
  },
  {
    name: "attribute",
    pattern: /[A-Za-z_$][A-Za-z0-9_$.:-]*(?=\s*=)/g,
    className: "nsh-variable",
  },
  {
    name: "operator",
    pattern: /=/g,
    className: "nsh-operator",
  },
  {
    name: "attribute-value",
    pattern: /[^\s"'<>{}/]+/g,
    className: "nsh-string",
    context: isAfterAttributeEquals,
  },
  {
    name: "attribute",
    pattern: /[A-Za-z_$][A-Za-z0-9_$.:-]*/g,
    className: "nsh-variable",
  },
];

const childrenRules: TokenType[] = [
  {
    name: "jsx-tag",
    pattern: CLOSE_TAG,
    className: "nsh-keyword",
    pop: true,
  },
  {
    name: "jsx-tag",
    pattern: FRAGMENT_CLOSE,
    className: "nsh-keyword",
    pop: true,
  },
  {
    name: "jsx-tag",
    pattern: OPEN_TAG,
    className: "nsh-keyword",
    push: JSX_TAG_STATE,
  },
  {
    name: "jsx-tag",
    pattern: FRAGMENT_OPEN,
    className: "nsh-keyword",
    push: JSX_CHILDREN_STATE,
  },
  {
    name: "bracket",
    pattern: /\{/g,
    className: "nsh-bracket",
    push: JSX_EXPRESSION_STATE,
  },
  {
    name: "entity",
    pattern: /&[a-zA-Z0-9#]+;/g,
    className: "nsh-number",
  },
  { name: "text", pattern: /[^<{]+/g },
];

const doubleQuoteRules: TokenType[] = [
  { name: "string", pattern: /"/g, className: "nsh-string", pop: true },
  { name: "string", pattern: /[^"]+/g, className: "nsh-string" },
];

const singleQuoteRules: TokenType[] = [
  { name: "string", pattern: /'/g, className: "nsh-string", pop: true },
  { name: "string", pattern: /[^']+/g, className: "nsh-string" },
];

export function createJsxStates(
  base: LanguageDefinition,
): Record<string, TokenType[]> {
  const baseStates = base.getStates();
  const baseRoot = baseStates.root;
  if (!Array.isArray(baseRoot)) {
    throw new Error(`${base.name} must expose a root state`);
  }

  const expressionRules: TokenType[] = [
    {
      name: "bracket",
      pattern: /\}/g,
      className: "nsh-bracket",
      pop: true,
    },
    {
      name: "bracket",
      pattern: /\{/g,
      className: "nsh-bracket",
      push: JSX_EXPRESSION_STATE,
    },
    ...tagStartRules,
    ...baseRoot,
  ];

  const states: Record<string, TokenType[]> = {
    ...baseStates,
    root: [...tagStartRules, ...baseRoot],
    [JSX_TAG_STATE]: tagRules,
    [JSX_CHILDREN_STATE]: childrenRules,
    [JSX_EXPRESSION_STATE]: expressionRules,
    [JSX_DOUBLE_QUOTE_STATE]: doubleQuoteRules,
    [JSX_SINGLE_QUOTE_STATE]: singleQuoteRules,
  };

  for (const stateName of ["inTemplateExpression", "inTemplateBrace"]) {
    const baseRules = baseStates[stateName];
    if (baseRules) {
      states[stateName] = [...tagStartRules, ...baseRules];
    }
  }

  return states;
}

function isJsxExpressionPosition(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== "<") return false;
  if (stateStack[stateStack.length - 1] === JSX_CHILDREN_STATE) {
    return true;
  }
  if (looksLikeTypeParameterList(line, position)) {
    return false;
  }

  const previous = lastSignificantToken(tokens)?.token;
  if (!previous) return true;

  if (previous.type === "operator" || previous.type === "arrow-function") {
    return previous.value !== "++" && previous.value !== "--" && previous.value !== ".";
  }
  if (previous.type === "keyword") {
    return JSX_EXPRESSION_KEYWORDS.has(previous.value);
  }
  if (previous.type === "bracket") {
    return (
      previous.value === "(" ||
      previous.value === "[" ||
      previous.value === "{"
    );
  }
  if (previous.type === "template-expression") {
    return previous.value === "${";
  }
  return false;
}

function isAfterAttributeEquals(
  _line: string,
  _position: number,
  tokens: Token[],
): boolean {
  return lastSignificantToken(tokens)?.token.value === "=";
}

function looksLikeTypeParameterList(line: string, position: number): boolean {
  const snippet = line.slice(position, Math.min(line.length, position + 96));
  return /^<(?:const\s+|in\s+|out\s+)?[A-Za-z_$][A-Za-z0-9_$]*\s*(?:,|extends\b|=)/.test(
    snippet,
  );
}
