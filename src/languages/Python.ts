import { LanguageDefinition } from "../types/language";
import { Token, TokenType } from "../types/token";
import {
  createKeywordToken,
  createFunctionToken,
  createVariableToken,
  createCommentToken,
  createNumberToken,
  NUMBER_PATTERNS,
  COMMENT_PATTERNS,
} from "./shared";

export class Python implements LanguageDefinition {
  name = "python";
  extensions = [".py", ".pyw"];
  aliases = ["py"];

  private pyKeywords = [
    "def",
    "class",
    "lambda",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "break",
    "continue",
    "pass",
    "try",
    "except",
    "finally",
    "raise",
    "assert",
    "import",
    "from",
    "as",
    "global",
    "nonlocal",
    "del",
    "return",
    "yield",
    "with",
    "async",
    "await",
    "True",
    "False",
    "None",
    "and",
    "or",
    "not",
    "in",
    "is",
  ];

  private pyBuiltins = [
    "abs",
    "all",
    "any",
    "bool",
    "bytes",
    "callable",
    "chr",
    "classmethod",
    "compile",
    "complex",
    "delattr",
    "dict",
    "dir",
    "divmod",
    "enumerate",
    "eval",
    "exec",
    "filter",
    "float",
    "format",
    "frozenset",
    "getattr",
    "globals",
    "hasattr",
    "hash",
    "help",
    "hex",
    "id",
    "input",
    "int",
    "isinstance",
    "issubclass",
    "iter",
    "len",
    "list",
    "locals",
    "map",
    "max",
    "memoryview",
    "min",
    "next",
    "object",
    "oct",
    "open",
    "ord",
    "pow",
    "print",
    "property",
    "range",
    "repr",
    "reversed",
    "round",
    "set",
    "setattr",
    "slice",
    "sorted",
    "staticmethod",
    "str",
    "sum",
    "super",
    "tuple",
    "type",
    "vars",
    "zip",
    "Exception",
    "BaseException",
    "os",
    "sys",
    "re",
    "json",
    "math",
    "random",
    "datetime",
    "time",
  ];

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        createKeywordToken(this.pyKeywords),
        {
          name: "builtin",
          pattern: new RegExp(`\\b(${this.pyBuiltins.join("|")})\\b`, "g"),
          className: "nsh-function",
        },
        {
          name: "decorator",
          pattern: /@\w+(\.\w+)*/g,
          className: "nsh-function",
        },
        {
          name: "string",
          pattern: /(?:[fF][rR]?|[rR][fF])"""/g,
          className: "nsh-string",
          push: "inTripleDouble",
        },
        {
          name: "string",
          pattern: /(?:[fF][rR]?|[rR][fF])'''/g,
          className: "nsh-string",
          push: "inTripleSingle",
        },
        {
          name: "string",
          pattern: /(?:[rRbBuU]{1,2})"""/g,
          className: "nsh-string",
          push: "inTripleDouble",
        },
        {
          name: "string",
          pattern: /(?:[rRbBuU]{1,2})'''/g,
          className: "nsh-string",
          push: "inTripleSingle",
        },
        {
          name: "string",
          pattern: /"""/g,
          className: "nsh-string",
          push: "inTripleDouble",
        },
        {
          name: "string",
          pattern: /'''/g,
          className: "nsh-string",
          push: "inTripleSingle",
        },
        {
          name: "string",
          pattern: /(?:[fF][rR]?|[rR][fF])"/g,
          className: "nsh-string",
          push: "inFStringDouble",
        },
        {
          name: "string",
          pattern: /(?:[fF][rR]?|[rR][fF])'/g,
          className: "nsh-string",
          push: "inFStringSingle",
        },
        {
          name: "string",
          pattern:
            /(?:[rRbBuU]{1,2})"(?:[^"\\]|\\.)*"|(?:[rRbBuU]{1,2})'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
          className: "nsh-string",
        },
        createNumberToken([
          /\b\d+(?:\.\d+)?\+\d+(?:\.\d+)?[jJ]\b/g,
          /\b\d+(?:\.\d+)?[jJ]\b/g,
          NUMBER_PATTERNS.hex,
          NUMBER_PATTERNS.binary,
          NUMBER_PATTERNS.octal,
          NUMBER_PATTERNS.scientific,
          NUMBER_PATTERNS.decimal,
          NUMBER_PATTERNS.integer,
        ]),
        createCommentToken(COMMENT_PATTERNS.singleLine.hash),
        {
          name: "type-hint",
          pattern:
            /:\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\s*(?:\[[^\]]*\])?\s*(?:\|\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(?:\[[^\]]*\])?)*|list\[[^\]]*\]|dict\[[^\]]*\]|Callable\[[^\]]*\]|Optional\[[^\]]*\]|Tuple\[[^\]]*\]|Set\[[^\]]*\]|Any|None)(?=\s*(?:,|\)|=|:))/g,
          className: "nsh-keyword",
          context: isTypeHintContext,
        },
        createFunctionToken(),
        {
          name: "comparison",
          pattern: /(==|!=|<=|>=|<|>)/g,
          className: "nsh-operator",
        },
        {
          name: "assignment",
          pattern: /(=|\+=|\-=|\*=|\/=|%=|\*\*=|\/\/=|&=|\|=|\^=|>>=|<<=)/g,
          className: "nsh-operator",
        },
        { name: "walrus", pattern: /:=/g, className: "nsh-operator" },
        createVariableToken(),
        {
          name: "bracket",
          pattern: /[\[\]\{\}\(\)]/g,
          className: "nsh-bracket",
        },
        {
          name: "operator",
          pattern: /[+\-*/%=!&|^~?:;,.]/g,
          className: "nsh-operator",
        },
      ],
      inTripleDouble: [
        {
          name: "string",
          pattern: /"""/g,
          className: "nsh-string",
          pop: true,
        },
        {
          name: "string",
          pattern: /(?:(?!""").)+/g,
          className: "nsh-string",
        },
      ],
      inTripleSingle: [
        {
          name: "string",
          pattern: /'''/g,
          className: "nsh-string",
          pop: true,
        },
        {
          name: "string",
          pattern: /(?:(?!''').)+/g,
          className: "nsh-string",
        },
      ],
      inFStringDouble: [
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        { name: "string", pattern: /"/g, className: "nsh-string", pop: true },
        { name: "fstring-expression", pattern: /\{[^{}]*\}/g, className: "nsh-variable" },
        {
          name: "string",
          pattern: /\{\{|\}\}|[^"{\\]+/g,
          className: "nsh-string",
        },
      ],
      inFStringSingle: [
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        { name: "string", pattern: /'/g, className: "nsh-string", pop: true },
        { name: "fstring-expression", pattern: /\{[^{}]*\}/g, className: "nsh-variable" },
        {
          name: "string",
          pattern: /\{\{|\}\}|[^'{\\]+/g,
          className: "nsh-string",
        },
      ],
    };
  }

}

function isTypeHintContext(
  _line: string,
  _position: number,
  tokens: Token[],
): boolean {
  let variableIndex = tokens.length - 1;
  while (variableIndex >= 0 && tokens[variableIndex].type === "comment") {
    variableIndex -= 1;
  }
  if (variableIndex < 0 || tokens[variableIndex].type !== "variable") {
    return false;
  }

  for (let index = variableIndex - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (token.type === "comment") continue;
    if (token.value === "{") return false;
    if (token.value === "(" || token.value === "[") return true;
  }
  return true;
}
