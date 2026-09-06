import { LanguageDefinition } from "../types/language";
import { Token, TokenType } from "../types/token";
import {
  createKeywordToken,
  createFunctionToken,
  createVariableToken,
  createCommentToken,
  createStringToken,
  createNumberToken,
  STRING_PATTERNS,
  NUMBER_PATTERNS,
  COMMENT_PATTERNS,
} from "./shared";

export class TypeScript implements LanguageDefinition {
  name = "typescript";
  extensions = [".ts"];

  private tsKeywords = [
    "var",
    "let",
    "const",
    "function",
    "class",
    "extends",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "throw",
    "error",
    "return",
    "yield",
    "async",
    "await",
    "typeof",
    "instanceof",
    "in",
    "of",
    "delete",
    "void",
    "this",
    "super",
    "new",
    "constructor",
    "static",
    "get",
    "set",
    "import",
    "export",
    "from",
    "default",
    "as",
    "true",
    "false",
    "null",
    "undefined",
    "NaN",
    "Infinity",
    "with",
    "debugger",
    "interface",
    "type",
    "enum",
    "namespace",
    "module",
    "declare",
    "implements",
    "public",
    "private",
    "protected",
    "readonly",
    "abstract",
    "override",
    "is",
    "keyof",
    "infer",
    "never",
    "unknown",
    "satisfies",
    "out",
    "assert",
    "require",
  ];

  private tsTypes = [
    "string",
    "number",
    "boolean",
    "bigint",
    "symbol",
    "any",
    "unknown",
    "never",
    "void",
    "null",
    "undefined",
    "object",
    "Object",
    "Function",
    "Array",
    "Promise",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "Date",
    "RegExp",
    "Error",
    "JSON",
    "Intl",
    "Record",
    "Partial",
    "Required",
    "Readonly",
    "Pick",
    "Omit",
    "Exclude",
    "Extract",
    "ReturnType",
    "Parameters",
    "ThisType",
    "Uppercase",
    "Lowercase",
    "Capitalize",
    "Uncapitalize",
    "NonNullable",
    "ConstructorParameters",
    "InstanceType",
    "Infer",
    "Awaited",
  ];

  private tsBuiltins = [
    "console",
    "window",
    "document",
    "navigator",
    "history",
    "location",
    "localStorage",
    "Math",
    "JSON",
    "Object",
    "Array",
    "String",
    "Number",
    "Date",
    "RegExp",
    "Error",
    "Promise",
    "Map",
    "Set",
    "Proxy",
    "Reflect",
    "Symbol",
    "process",
    "Buffer",
    "require",
    "module",
    "exports",
  ];

  public tokenTypes: TokenType[] = [
    createKeywordToken(this.tsKeywords),
    {
      name: "type",
      pattern: new RegExp(`\\b(${this.tsTypes.join("|")})\\b`, "g"),
      className: "nsh-keyword",
    },
    {
      name: "builtin",
      pattern: new RegExp(`\\b(${this.tsBuiltins.join("|")})\\b`, "g"),
      className: "nsh-function",
    },
    createStringToken([
      STRING_PATTERNS.singleQuote,
      STRING_PATTERNS.doubleQuote,
      STRING_PATTERNS.backtick,
    ]),
    {
      name: "template-expression",
      pattern: /\$\{[^}]*\}/g,
      className: "nsh-variable",
    },
    createNumberToken([
      NUMBER_PATTERNS.bigint,
      NUMBER_PATTERNS.scientific,
      NUMBER_PATTERNS.decimal,
      NUMBER_PATTERNS.hex,
      NUMBER_PATTERNS.binary,
      NUMBER_PATTERNS.octal,
      NUMBER_PATTERNS.integer,
    ]),
    createCommentToken(COMMENT_PATTERNS.multiLine.slashStar),
    createCommentToken(COMMENT_PATTERNS.singleLine.doubleSlash),
    { name: "jsdoc", pattern: /\/\*\*[\s\S]*?\*\//g, className: "nsh-comment" },
    {
      name: "regex",
      pattern: /\/[^/\n\\]*(?:\\.[^/\n\\]*)*\/[dgimsuvy]*/g,
      className: "nsh-string",
    },
    {
      name: "type-separator",
      pattern: /:/g,
      className: "nsh-operator",
    },
    {
      name: "type-separator",
      pattern: /[<>]/g,
      className: "nsh-operator",
    },
    createFunctionToken(),
    { name: "arrow-function", pattern: /=>/g, className: "nsh-operator" },
    { name: "bracket", pattern: /[\[\]\{\}\(\)]/g, className: "nsh-bracket" },
    { name: "spread", pattern: /\.\.\./g, className: "nsh-operator" },
    { name: "non-null", pattern: /!/g, className: "nsh-operator" },
    {
      name: "optional-chaining",
      pattern: /\?\?=?|\?\./g,
      className: "nsh-operator",
    },
    {
      name: "operator",
      pattern: /[+\-*/%=<>!&|^~?:;,.]/g,
      className: "nsh-operator",
    },
    createVariableToken(),
    {
      name: "jsx-tag",
      pattern: /<\/?[a-zA-Z][a-zA-Z0-9]*/g,
      className: "nsh-keyword",
    },
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        createKeywordToken(this.tsKeywords),
        {
          name: "type",
          pattern: new RegExp(`\\b(${this.tsTypes.join("|")})\\b`, "g"),
          className: "nsh-keyword",
        },
        {
          name: "builtin",
          pattern: new RegExp(`\\b(${this.tsBuiltins.join("|")})\\b`, "g"),
          className: "nsh-function",
        },
        {
          name: "string",
          pattern: /`/g,
          className: "nsh-string",
          push: "inTemplate",
        },
        createStringToken([
          STRING_PATTERNS.singleQuote,
          STRING_PATTERNS.doubleQuote,
        ]),
        createNumberToken([
          NUMBER_PATTERNS.bigint,
          NUMBER_PATTERNS.scientific,
          NUMBER_PATTERNS.decimal,
          NUMBER_PATTERNS.hex,
          NUMBER_PATTERNS.binary,
          NUMBER_PATTERNS.octal,
          NUMBER_PATTERNS.integer,
        ]),
        {
          name: "jsdoc",
          pattern: /\/\*\*/g,
          className: "nsh-comment",
          push: "inJSDoc",
        },
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        createCommentToken(COMMENT_PATTERNS.singleLine.doubleSlash),
        {
          name: "regex",
          pattern: /\/[^/\n\\]*(?:\\.[^/\n\\]*)*\/[dgimsuvy]*/g,
          className: "nsh-string",
        },
        {
          name: "type-separator",
          pattern: /:/g,
          className: "nsh-operator",
          context: isTypeAnnotationStart,
          push: "inType",
        },
        {
          name: "bracket",
          pattern: /\{/g,
          className: "nsh-bracket",
          context: isInterfaceBodyStart,
          push: "inInterfaceBody",
        },
        {
          name: "type-separator",
          pattern: /</g,
          className: "nsh-operator",
          context: isGenericStart,
          push: "inTypeNested",
        },
        {
          name: "operator",
          pattern: /=/g,
          className: "nsh-operator",
          context: isTypeAliasEquals,
          push: "inType",
        },
        createFunctionToken(),
        { name: "arrow-function", pattern: /=>/g, className: "nsh-operator" },
        {
          name: "bracket",
          pattern: /[\[\]\{\}\(\)]/g,
          className: "nsh-bracket",
        },
        { name: "spread", pattern: /\.\.\./g, className: "nsh-operator" },
        {
          name: "optional-chaining",
          pattern: /\?\?=?|\?\./g,
          className: "nsh-operator",
        },
        {
          name: "operator",
          pattern: /\?\?=?|\?\.|=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||\*\*|[+\-*/%=<>!&|^~?:;,.]/g,
          className: "nsh-operator",
        },
        { name: "non-null", pattern: /!(?![=])/g, className: "nsh-operator" },
        createVariableToken(),
        {
          name: "jsx-tag",
          pattern: /<\/?[a-zA-Z][a-zA-Z0-9]*/g,
          className: "nsh-keyword",
        },
      ],
      inType: [
        {
          name: "type",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-keyword",
        },
        { name: "number", pattern: /\d+/g, className: "nsh-number" },
        {
          name: "type-separator",
          pattern: /</g,
          className: "nsh-operator",
          push: "inTypeNested",
        },
        {
          name: "type-separator",
          pattern: /[>\[\]|&,?()]/g,
          className: "nsh-operator",
        },
        {
          name: "operator",
          pattern: /=>/g,
          className: "nsh-operator",
          pop: true,
        },
        {
          name: "operator",
          pattern: /[;=]/g,
          className: "nsh-operator",
          pop: true,
        },
        {
          name: "bracket",
          pattern: /[{}]/g,
          className: "nsh-bracket",
          push: "inTypeObject",
        },
      ],
      inTypeNested: [
        {
          name: "type",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-keyword",
        },
        { name: "number", pattern: /\d+/g, className: "nsh-number" },
        {
          name: "type-separator",
          pattern: /</g,
          className: "nsh-operator",
          push: "inTypeNested",
        },
        {
          name: "type-separator",
          pattern: />/g,
          className: "nsh-operator",
          pop: true,
        },
        {
          name: "type-separator",
          pattern: /[\[\]|&,?()]/g,
          className: "nsh-operator",
        },
        {
          name: "operator",
          pattern: /=/g,
          className: "nsh-operator",
        },
      ],
      inTypeObject: [
        {
          name: "type-separator",
          pattern: /:/g,
          className: "nsh-operator",
          push: "inType",
        },
        {
          name: "bracket",
          pattern: /}/g,
          className: "nsh-bracket",
          pop: true,
        },
        { name: "type", pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g, className: "nsh-keyword" },
        { name: "operator", pattern: /[;,?]/g, className: "nsh-operator" },
      ],
      inInterfaceBody: [
        {
          name: "type-separator",
          pattern: /:/g,
          className: "nsh-operator",
          push: "inType",
        },
        {
          name: "bracket",
          pattern: /}/g,
          className: "nsh-bracket",
          pop: true,
        },
        { name: "variable", pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g, className: "nsh-variable" },
        { name: "type-separator", pattern: /[;,?]/g, className: "nsh-operator" },
      ],
      inMultiLineComment: [
        {
          name: "comment",
          pattern: /\*\//g,
          className: "nsh-comment",
          pop: true,
        },
        {
          name: "comment",
          pattern: /(?:(?!\*\/).)+/g,
          className: "nsh-comment",
        },
      ],
      inJSDoc: [
        {
          name: "jsdoc",
          pattern: /\*\//g,
          className: "nsh-comment",
          pop: true,
        },
        { name: "jsdoc", pattern: /(?:(?!\*\/).)+/g, className: "nsh-comment" },
      ],
      inTemplate: [
        {
          name: "template-expression",
          pattern: /\$\{[^}]*\}/g,
          className: "nsh-variable",
        },
        { name: "string", pattern: /`/g, className: "nsh-string", pop: true },
        {
          name: "string",
          pattern: /([^`$]|\$(?!\{))+/g,
          className: "nsh-string",
        },
      ],
    };
  }

  comments = { singleLine: "//", multiLine: { start: "/*", end: "*/" } };
  strings = { startEnd: ['"', "'", "`"], escapeChar: "\\" };
}

function isTypeAnnotationStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (stateStack[stateStack.length - 1] !== "root") return false;

  const prefix = line.slice(0, position).trimEnd();
  if (/(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*$/.test(prefix)) return true;
  if (/(?:function\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]*>)?\s*\([^)]*|\)\s*)$/.test(prefix)) return true;
  return Boolean(tokens.length && tokens[tokens.length - 1].value === ")");
}

function isGenericStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (stateStack[stateStack.length - 1] !== "root") return false;

  const prefix = line.slice(0, position).trimEnd();
  return (
    /\b(?:function|class|interface|type)\s+[A-Za-z_$][A-Za-z0-9_$]*$/.test(prefix) ||
    tokens[tokens.length - 1]?.type === "type"
  );
}

function isTypeAliasEquals(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (stateStack[stateStack.length - 1] !== "root") return false;
  return /\btype\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]*>)?\s*$/.test(
    line.slice(0, position),
  );
}

function isInterfaceBodyStart(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (stateStack[stateStack.length - 1] !== "root") return false;
  return /\binterface\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*<[^>]*>)?\s*$/.test(
    line.slice(0, position),
  );
}
