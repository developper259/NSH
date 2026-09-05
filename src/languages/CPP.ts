import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
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

export class CPP implements LanguageDefinition {
  name = "cpp";
  extensions = [".cpp", ".cc", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".h++", ".c", ".h"];

  private cppKeywords = [
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor",
    "bool", "break", "case", "catch", "char", "char16_t", "char32_t", "class",
    "compl", "const", "constexpr", "const_cast", "continue", "decltype", "default",
    "delete", "do", "double", "dynamic_cast", "else", "enum", "explicit", "export",
    "extern", "false", "float", "for", "friend", "goto", "if", "inline", "int",
    "long", "mutable", "namespace", "new", "noexcept", "not", "not_eq", "nullptr",
    "operator", "or", "or_eq", "private", "protected", "public", "register",
    "reinterpret_cast", "return", "short", "signed", "sizeof", "static",
    "static_assert", "static_cast", "struct", "switch", "template", "this",
    "thread_local", "throw", "true", "try", "typedef", "typeid", "typename",
    "union", "unsigned", "using", "virtual", "void", "volatile", "wchar_t",
    "while", "xor", "xor_eq"
  ];

  private cppTypes = [
    "void", "bool", "char", "wchar_t", "char8_t", "char16_t", "char32_t",
    "short", "int", "long", "float", "double", "void*", "size_t", "ptrdiff_t",
    "nullptr_t", "auto", "decltype", "std::string", "std::wstring", "std::vector",
    "std::map", "std::unordered_map", "std::set", "std::list", "std::deque",
    "std::array", "std::unique_ptr", "std::shared_ptr", "std::weak_ptr",
    "std::function", "std::thread", "std::mutex", "std::lock_guard"
  ];

  private cppBuiltins = [
    "std", "cout", "cin", "endl", "printf", "scanf", "malloc", "free", "new",
    "delete", "sizeof", "alignof", "offsetof", "static_assert", "static_cast",
    "dynamic_cast", "reinterpret_cast", "const_cast", "typeinfo", "typeindex",
    "exception", "runtime_error", "out_of_range", "length_error", "logic_error",
    "domain_error", "invalid_argument", "length_error", "out_of_range",
    "range_error", "overflow_error", "future", "async", "promise", "shared_future",
    "thread", "mutex", "unique_lock", "lock_guard", "condition_variable",
    "atomic", "memory_order", "atomic_bool", "atomic_char", "atomic_int",
    "atomic_uint", "atomic_float", "atomic_double", "atomic_pointer",
    "std::abs", "std::acos", "std::asin", "std::atan", "std::atan2", "std::ceil",
    "std::cos", "std::cosh", "std::exp", "std::fabs", "std::floor", "std::fmod",
    "std::frexp", "std::hypot", "std::ldexp", "std::log", "std::log10", "std::modf",
    "std::pow", "std::round", "std::sin", "std::sinh", "std::sqrt", "std::tan",
    "std::tanh", "std::erf", "std::erfc", "std::tgamma", "std::lgamma", "std::exp2",
    "std::log2", "std::log1p", "std::expm1", "std::cbrt", "std::hypot"
  ];

  public tokenTypes: TokenType[] = [
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
      name: "preprocessor",
      pattern: /#[a-zA-Z0-9_]+/g,
      className: "nsh-keyword",
    },
    createStringToken([
      STRING_PATTERNS.singleQuote,
      STRING_PATTERNS.doubleQuote,
      /R"([^\"]*)"/g,
      /R'([^']*)'/g,
      /R"""([^\"]*)"""/g,
      /R'''([^']*)'''/g,
    ]),
    createNumberToken([
      NUMBER_PATTERNS.integer,
      NUMBER_PATTERNS.decimal,
      NUMBER_PATTERNS.hex,
      NUMBER_PATTERNS.binary,
      NUMBER_PATTERNS.octal,
      NUMBER_PATTERNS.scientific,
      /\b\d+u\b/g,
      /\b\d+l\b/g,
      /\b\d+ll\b/g,
      /\b0x[0-9a-fA-F]+[uUl]*\b/g,
      /\b0b[01]+[uUl]*\b/g,
      /\b0o[0-7]+[uUl]*\b/g,
    ]),
    createCommentToken(COMMENT_PATTERNS.singleLine.doubleSlash),
    {
      name: "multi-line-comment",
      pattern: COMMENT_PATTERNS.multiLine.slashStar,
      className: "nsh-comment",
    },
    {
      name: "raw-string",
      pattern: /R"(?:[^\"]|\"[^\"])*"/g,
      className: "nsh-string",
    },
    {
      name: "raw-string-long",
      pattern: /R"(?:[^\"]|\"[^\"])*"/g,
      className: "nsh-string",
    },
    {
      name: "operator",
      pattern: /[+\-*/%=<>!&|^~?:;,\.]/g,
      className: "nsh-operator",
    },
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
    {
      name: "increment",
      pattern: /(\+\+|--)/g,
      className: "nsh-operator",
    },
    {
      name: "pointer",
      pattern: /(&|\*)/g,
      className: "nsh-bracket",
    },
    {
      name: "bracket",
      pattern: /[\[\]\{\}\(\)]/g,
      className: "nsh-bracket",
    },
    {
      name: "template",
      pattern: /<[^>]*>/g,
      className: "nsh-keyword",
    },
    createFunctionToken(),
    createVariableToken(),
    {
      name: "macro",
      pattern: /#define\s+[a-zA-Z0-9_]+/g,
      className: "nsh-keyword",
    },
    {
      name: "include",
      pattern: /#include\s+[<"].*[>"]?/g,
      className: "nsh-keyword",
    },
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    return {};
  }
}