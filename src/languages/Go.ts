import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
import { createBuiltinList, createKeywordToken } from "./shared";

const GO_KEYWORDS = [
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
  "true",
  "false",
  "nil",
];

const GO_TYPES = [
  "any",
  "bool",
  "byte",
  "comparable",
  "complex64",
  "complex128",
  "error",
  "float32",
  "float64",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "rune",
  "string",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr",
];

const GO_BUILTINS = [
  "append",
  "cap",
  "clear",
  "close",
  "complex",
  "copy",
  "delete",
  "imag",
  "len",
  "make",
  "max",
  "min",
  "new",
  "panic",
  "print",
  "println",
  "real",
  "recover",
  "fmt",
  "os",
  "io",
  "strings",
  "strconv",
  "errors",
  "time",
  "context",
  "sync",
  "http",
  "json",
];

export class Go implements LanguageDefinition {
  name = "go";
  extensions = [".go"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        createKeywordToken(GO_KEYWORDS),
        {
          name: "type",
          pattern: new RegExp(`\\b(${GO_TYPES.join("|")})\\b`, "g"),
          className: "nsh-type",
        },
        createBuiltinList(GO_BUILTINS, "builtin"),
        {
          name: "comment",
          pattern: /\/\/[^\n]*/g,
          className: "nsh-comment",
        },
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        {
          name: "string",
          pattern: /`/g,
          className: "nsh-string",
          push: "inRawString",
        },
        {
          name: "string",
          pattern: /"/g,
          className: "nsh-string",
          push: "inString",
        },
        {
          name: "string",
          pattern: /'(?:\\.|[^'\\])'/g,
          className: "nsh-string",
        },
        {
          name: "number",
          pattern:
            /\b(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?i?)\b/g,
          className: "nsh-number",
        },
        {
          name: "function",
          pattern: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/g,
          className: "nsh-function",
        },
        {
          name: "operator",
          pattern:
            /:=|<-|\+\+|--|&&|\|\||<<=|>>=|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[+\-*/%=<>!&|^~:;,.&]/g,
          className: "nsh-operator",
        },
        {
          name: "bracket",
          pattern: /[\[\]{}()]/g,
          className: "nsh-bracket",
        },
        {
          name: "variable",
          pattern: /\b[A-Za-z_][A-Za-z0-9_]*\b/g,
          className: "nsh-variable",
        },
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
      inString: [
        {
          name: "string",
          pattern: /"/g,
          className: "nsh-string",
          pop: true,
        },
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        { name: "string", pattern: /[^"\\]+/g, className: "nsh-string" },
      ],
      inRawString: [
        {
          name: "string",
          pattern: /`/g,
          className: "nsh-string",
          pop: true,
        },
        { name: "string", pattern: /[^`]+/g, className: "nsh-string" },
      ],
    };
  }
}
