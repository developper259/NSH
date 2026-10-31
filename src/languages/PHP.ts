import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";
import { HTML } from "./HTML";
import { createEmbeddedStates } from "../utils/EmbedLanguage";
import { createKeywordToken, createNumberToken, NUMBER_PATTERNS } from "./shared";

class PHPCode implements LanguageDefinition {
  name = "php-code";
  extensions: string[] = [];

  private phpKeywords = [
    "abstract",
    "and",
    "array",
    "as",
    "break",
    "callable",
    "case",
    "catch",
    "class",
    "clone",
    "const",
    "continue",
    "declare",
    "default",
    "do",
    "echo",
    "else",
    "elseif",
    "empty",
    "enddeclare",
    "endfor",
    "endforeach",
    "endif",
    "endswitch",
    "endwhile",
    "enum",
    "extends",
    "final",
    "finally",
    "fn",
    "for",
    "foreach",
    "function",
    "global",
    "goto",
    "if",
    "implements",
    "include",
    "include_once",
    "instanceof",
    "insteadof",
    "interface",
    "isset",
    "list",
    "match",
    "namespace",
    "new",
    "or",
    "print",
    "private",
    "protected",
    "public",
    "readonly",
    "require",
    "require_once",
    "return",
    "static",
    "switch",
    "throw",
    "trait",
    "try",
    "unset",
    "use",
    "var",
    "while",
    "xor",
    "yield",
    "true",
    "false",
    "null",
    "self",
    "parent",
    "this",
  ];

  private phpBuiltins = [
    "strlen",
    "strpos",
    "str_replace",
    "str_split",
    "substr",
    "trim",
    "ltrim",
    "rtrim",
    "explode",
    "implode",
    "sprintf",
    "printf",
    "number_format",
    "array_map",
    "array_filter",
    "array_reduce",
    "array_merge",
    "array_keys",
    "array_values",
    "array_push",
    "array_pop",
    "array_shift",
    "array_unshift",
    "in_array",
    "count",
    "sort",
    "usort",
    "ksort",
    "asort",
    "is_array",
    "is_string",
    "is_int",
    "is_numeric",
    "is_bool",
    "is_null",
    "var_dump",
    "print_r",
    "json_encode",
    "json_decode",
    "file_get_contents",
    "file_put_contents",
    "fopen",
    "fclose",
    "fread",
    "fwrite",
    "preg_match",
    "preg_replace",
    "preg_split",
    "date",
    "time",
    "strtotime",
    "mktime",
    "header",
    "session_start",
    "htmlspecialchars",
    "htmlentities",
    "urlencode",
    "urldecode",
    "base64_encode",
    "base64_decode",
    "md5",
    "sha1",
    "rand",
    "mt_rand",
    "min",
    "max",
    "abs",
    "round",
    "floor",
    "ceil",
    "pow",
    "sqrt",
    "intval",
    "floatval",
    "strval",
    "boolval",
    "gettype",
    "settype",
    "define",
    "defined",
    "function_exists",
    "class_exists",
    "method_exists",
    "property_exists",
    "get_class",
    "call_user_func",
    "call_user_func_array",
  ];

  public tokenTypes: TokenType[] = [
    createKeywordToken(this.phpKeywords),
    {
      name: "builtin",
      pattern: new RegExp(`\\b(${this.phpBuiltins.join("|")})\\b`, "g"),
      className: "nsh-function",
    },
    {
      name: "string",
      pattern:
        /<<<\s*(?:"[A-Za-z_][A-Za-z0-9_]*"|'[A-Za-z_][A-Za-z0-9_]*'|[A-Za-z_][A-Za-z0-9_]*)/g,
      className: "nsh-string",
      push: heredocPush,
    },
    {
      name: "string",
      pattern: /"/g,
      className: "nsh-string",
      push: "inDoubleString",
    },
    {
      name: "string",
      pattern: /'/g,
      className: "nsh-string",
      push: "inSingleString",
    },
    createNumberToken([
      NUMBER_PATTERNS.hex,
      NUMBER_PATTERNS.binary,
      NUMBER_PATTERNS.octal,
      NUMBER_PATTERNS.scientific,
      NUMBER_PATTERNS.decimal,
      NUMBER_PATTERNS.integer,
    ]),
    {
      name: "php-attribute",
      pattern: /#\[[^\]]*\]/g,
      className: "nsh-function",
    },
    {
      name: "comment",
      pattern: /(?:\/\/|#(?!\[))(?:(?!\?>).)*/g,
      className: "nsh-comment",
    },
    {
      name: "variable",
      pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*/g,
      className: "nsh-variable",
    },
    {
      name: "function",
      pattern: /[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g,
      className: "nsh-function",
    },
    { name: "object-operator", pattern: /->|\?->/g, className: "nsh-operator" },
    { name: "scope-resolution", pattern: /::/g, className: "nsh-operator" },
    { name: "namespace-separator", pattern: /\\/g, className: "nsh-operator" },
    { name: "arrow-function", pattern: /=>/g, className: "nsh-operator" },
    { name: "bracket", pattern: /[\[\]\{\}\(\)]/g, className: "nsh-bracket" },
    {
      name: "operator",
      pattern: /[+\-*/%=<>!&|^~?:;,.@]/g,
      className: "nsh-operator",
    },
    {
      name: "class-name",
      pattern: /[a-zA-Z_][a-zA-Z0-9_]*/g,
      className: "nsh-variable",
    },
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        ...this.tokenTypes,
      ],
      inMultiLineComment: [
        { name: "comment", pattern: /\*\//g, className: "nsh-comment", pop: true },
        { name: "comment", pattern: /(?:(?!\*\/).)+/g, className: "nsh-comment" },
      ],
      inDoubleString: [
        { name: "string", pattern: /"/g, className: "nsh-string", pop: true },
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        {
          name: "variable",
          pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*/g,
          className: "nsh-variable",
        },
        { name: "string", pattern: /[^"\\$]+/g, className: "nsh-string" },
      ],
      inSingleString: [
        { name: "string", pattern: /'/g, className: "nsh-string", pop: true },
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        { name: "string", pattern: /[^'\\]+/g, className: "nsh-string" },
      ],
      inHeredoc: [
        {
          name: "string",
          pattern: /^[A-Za-z_][A-Za-z0-9_]*(?=;?\s*$)/g,
          className: "nsh-string",
          pop: true,
          context: isHeredocTerminator,
        },
        {
          name: "variable",
          pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*/g,
          className: "nsh-variable",
        },
        { name: "string", pattern: /[^$\n]+/g, className: "nsh-string" },
      ],
      inNowdoc: [
        {
          name: "string",
          pattern: /^[A-Za-z_][A-Za-z0-9_]*(?=;?\s*$)/g,
          className: "nsh-string",
          pop: true,
          context: isHeredocTerminator,
        },
        { name: "string", pattern: /[^\n]+/g, className: "nsh-string" },
      ],
    };
  }

  comments = { singleLine: "//", multiLine: { start: "/*", end: "*/" } };
  strings = { startEnd: ['"', "'"], escapeChar: "\\" };
}

const heredocPush: StatePushResolver = (
  _line,
  _position,
  _tokens,
  _stateStack,
  matched,
) => {
  const singleQuoted = matched.includes("'");
  const delimiter = matched
    .replace(/^<<<\s*/, "")
    .replace(/^["']|["']$/g, "");
  return `${singleQuoted ? "inNowdoc" : "inHeredoc"}:${delimiter}`;
};

function isHeredocTerminator(
  line: string,
  _position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  const currentState = stateStack[stateStack.length - 1];
  const separator = currentState.lastIndexOf(":");
  if (separator < 0) return false;
  const delimiter = currentState.slice(separator + 1);
  return line.trim().replace(/;$/, "") === delimiter;
}

export class PHP implements LanguageDefinition {
  name = "php";
  extensions = [".php", ".phtml", ".php3", ".php4", ".php5"];

  private html = new HTML();
  private phpCode = new PHPCode();

  public tokenTypes: TokenType[] = [
    {
      name: "php-open",
      pattern: /<\?(?:php\b|=|(?!xml\b))/gi,
      className: "nsh-keyword",
    },
    { name: "php-close", pattern: /\?>/g, className: "nsh-keyword" },
    ...this.phpCode.tokenTypes,
    ...this.html.getTokenTypes(),
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    const phpStates = createEmbeddedStates({
      language: this.phpCode,
      exitRule: {
        name: "php-close",
        pattern: /\?>/g,
        className: "nsh-keyword",
      },
      prefix: "php_",
      exitMode: "parent",
      skipExitStates: [
        "inMultiLineComment",
        "inDoubleString",
        "inSingleString",
        "inHeredoc",
        "inNowdoc",
      ],
    });

    const phpOpenRule: TokenType = {
      name: "php-open",
      pattern: /<\?(?:php\b|=|(?!xml\b))/gi,
      className: "nsh-keyword",
      push: "php_root",
    };

    const htmlStates = this.html.getStates();
    const mergedHtmlStates: Record<string, TokenType[]> = {};
    for (const [stateName, rules] of Object.entries(htmlStates)) {
      mergedHtmlStates[stateName] = [phpOpenRule, ...rules];
    }

    return {
      ...mergedHtmlStates,
      ...phpStates,
    };
  }

  comments = { singleLine: "//", multiLine: { start: "/*", end: "*/" } };
  strings = { startEnd: ['"', "'"], escapeChar: "\\" };
}
