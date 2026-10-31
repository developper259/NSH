import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";
import {
  createKeywordToken,
  createFunctionToken,
  createVariableToken,
  createCommentToken,
  createNumberToken,
  NUMBER_PATTERNS,
  COMMENT_PATTERNS,
} from "./shared";

export class CPP implements LanguageDefinition {
  name = "cpp";
  extensions = [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".h++"];
  aliases = ["c++"];

  private cppKeywords = [
    "alignas",
    "alignof",
    "and",
    "and_eq",
    "asm",
    "auto",
    "bitand",
    "bitor",
    "break",
    "case",
    "catch",
    "class",
    "compl",
    "concept",
    "const",
    "consteval",
    "constexpr",
    "constinit",
    "continue",
    "co_await",
    "co_return",
    "co_yield",
    "decltype",
    "default",
    "delete",
    "do",
    "dynamic_cast",
    "else",
    "enum",
    "explicit",
    "export",
    "extern",
    "final",
    "for",
    "friend",
    "goto",
    "if",
    "import",
    "inline",
    "module",
    "mutable",
    "namespace",
    "new",
    "noexcept",
    "not",
    "not_eq",
    "operator",
    "or",
    "or_eq",
    "override",
    "private",
    "protected",
    "public",
    "register",
    "reinterpret_cast",
    "requires",
    "return",
    "sizeof",
    "static",
    "static_assert",
    "static_cast",
    "struct",
    "switch",
    "template",
    "this",
    "thread_local",
    "throw",
    "try",
    "typedef",
    "typeid",
    "typename",
    "union",
    "using",
    "virtual",
    "volatile",
    "while",
    "xor",
    "xor_eq",
    "true",
    "false",
    "nullptr",
    "NULL",
  ];

  private cppTypes = [
    "void",
    "bool",
    "char",
    "char8_t",
    "char16_t",
    "char32_t",
    "wchar_t",
    "short",
    "int",
    "long",
    "float",
    "double",
    "signed",
    "unsigned",
    "size_t",
    "ssize_t",
    "ptrdiff_t",
    "int8_t",
    "int16_t",
    "int32_t",
    "int64_t",
    "uint8_t",
    "uint16_t",
    "uint32_t",
    "uint64_t",
    "string",
    "wstring",
    "vector",
    "array",
    "map",
    "unordered_map",
    "multimap",
    "set",
    "unordered_set",
    "multiset",
    "pair",
    "tuple",
    "list",
    "deque",
    "stack",
    "queue",
    "priority_queue",
    "shared_ptr",
    "unique_ptr",
    "weak_ptr",
    "function",
    "optional",
    "variant",
    "any",
    "ostream",
    "istream",
    "iostream",
    "stringstream",
    "ostringstream",
    "istringstream",
    "ifstream",
    "ofstream",
    "fstream",
    "exception",
    "runtime_error",
    "logic_error",
    "thread",
    "mutex",
  ];

  private cppBuiltins = [
    "std",
    "cout",
    "cin",
    "cerr",
    "clog",
    "endl",
    "move",
    "forward",
    "make_shared",
    "make_unique",
    "make_pair",
    "make_tuple",
    "to_string",
    "stoi",
    "stol",
    "stof",
    "stod",
    "stoul",
    "sort",
    "find",
    "find_if",
    "count",
    "count_if",
    "begin",
    "end",
    "rbegin",
    "rend",
    "swap",
    "max",
    "min",
    "max_element",
    "min_element",
    "accumulate",
    "transform",
    "for_each",
    "copy",
    "unique",
    "reverse",
    "printf",
    "scanf",
    "malloc",
    "free",
    "memcpy",
    "memset",
    "strlen",
    "strcpy",
    "strcmp",
    "assert",
  ];

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "preprocessor",
          pattern:
            /#\s*(?:include|define|undef|ifdef|ifndef|elif|else|endif|pragma|error|warning|line|if)\b.*/g,
          className: "nsh-keyword",
        },
        createKeywordToken(this.cppKeywords),
        {
          name: "type",
          pattern: new RegExp(`\\b(${this.cppTypes.join("|")})\\b`, "g"),
          className: "nsh-keyword",
        },
        {
          name: "builtin",
          pattern: new RegExp(`\\b(${this.cppBuiltins.join("|")})\\b`, "g"),
          className: "nsh-function",
        },
        {
          name: "string",
          pattern: /\b(?:u8|u|U|L)?R"([^()\\\s]{0,16})\(/g,
          className: "nsh-string",
          push: rawStringPush,
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
          /\b\d[\d']*\.\d[\d']*[fFlL]?\b/g,
          /\b\d[\d']*[uUlLfF]*\b/g,
        ]),
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        createCommentToken(COMMENT_PATTERNS.singleLine.doubleSlash),
        {
          name: "scope-resolution",
          pattern: /::/g,
          className: "nsh-operator",
        },
        {
          name: "generic",
          pattern: /<[a-zA-Z0-9_,:\s<>\[\]*&]+>/g,
          className: "nsh-keyword",
          context: isCppGeneric,
        },
        createFunctionToken(),
        {
          name: "pointer",
          pattern: /[*&](?=\s*[a-zA-Z_])/g,
          className: "nsh-operator",
        },
        { name: "arrow-function", pattern: /->/g, className: "nsh-operator" },
        {
          name: "bracket",
          pattern: /[\[\]\{\}\(\)]/g,
          className: "nsh-bracket",
        },
        {
          name: "operator",
          pattern: /[+\-*/%=<>!&|^~?:;,.]/g,
          className: "nsh-operator",
        },
        createVariableToken(),
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
      inDoubleString: [
        { name: "string", pattern: /"/g, className: "nsh-string", pop: true },
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        { name: "string", pattern: /\\$/g, className: "nsh-string" },
        { name: "string", pattern: /[^"\\]+/g, className: "nsh-string" },
      ],
      inSingleString: [
        { name: "string", pattern: /'/g, className: "nsh-string", pop: true },
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        { name: "string", pattern: /\\$/g, className: "nsh-string" },
        { name: "string", pattern: /[^'\\]+/g, className: "nsh-string" },
      ],
      inRawString: [
        {
          name: "string",
          pattern: /\)([^()\\\s]{0,16})"/g,
          className: "nsh-string",
          pop: true,
          context: isRawStringTerminator,
        },
        { name: "string", pattern: /[^)]+/g, className: "nsh-string" },
        { name: "string", pattern: /\)/g, className: "nsh-string" },
      ],
    };
  }

}

const rawStringPush: StatePushResolver = (
  _line,
  _position,
  _tokens,
  _stateStack,
  matched,
) => {
  const delimiter = matched.slice(matched.indexOf('R"') + 2, -1);
  return `inRawString:${encodeURIComponent(delimiter)}`;
};

function isRawStringTerminator(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  const currentState = stateStack[stateStack.length - 1];
  const separator = currentState.lastIndexOf(":");
  if (separator < 0) return false;
  const delimiter = decodeURIComponent(currentState.slice(separator + 1));
  const match = /^\)([^()\\\s]{0,16})"/.exec(line.slice(position));
  return match !== null && match[1] === delimiter;
}

function isCppGeneric(
  line: string,
  position: number,
  tokens: Token[],
  _stateStack: string[],
): boolean {
  const match = /^<[a-zA-Z0-9_,:\s<>\[\]*&]+>/.exec(line.slice(position));
  if (!match) return false;

  const content = match[0].slice(1, -1);
  if (/&&|\|\||==|!=|<=|>=|[=+\-/%!?]/.test(content)) return false;
  if (!/\s/.test(content)) return true;

  let previous: Token | undefined;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (tokens[index].type !== "comment") {
      previous = tokens[index];
      break;
    }
  }
  if (previous?.value === "template" || previous?.type === "type") return true;

  const prefix = line.slice(0, position).trimEnd();
  if (/\b(?:class|struct|typename|using|typedef)\b/.test(prefix)) return true;
  return /[,:<>*&[\]]/.test(content);
}