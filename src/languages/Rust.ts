import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";
import { createBuiltinList, createKeywordToken } from "./shared";

const RUST_KEYWORDS = [
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "yield",
];

const RUST_TYPES = [
  "bool",
  "char",
  "f32",
  "f64",
  "i8",
  "i16",
  "i32",
  "i64",
  "i128",
  "isize",
  "str",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "usize",
  "String",
  "Vec",
  "Option",
  "Result",
  "Box",
  "Rc",
  "Arc",
  "Cell",
  "RefCell",
  "HashMap",
  "HashSet",
  "BTreeMap",
  "BTreeSet",
  "VecDeque",
  "Cow",
  "PhantomData",
];

const RUST_BUILTINS = [
  "assert",
  "assert_eq",
  "assert_ne",
  "dbg",
  "eprint",
  "eprintln",
  "format",
  "panic",
  "print",
  "println",
  "todo",
  "unimplemented",
  "unreachable",
  "vec",
  "Some",
  "None",
  "Ok",
  "Err",
];

const rawStringPush: StatePushResolver = (
  _line,
  _position,
  _tokens,
  _stateStack,
  matched,
) => {
  const hashes = matched.slice(matched.indexOf("r") + 1).replace(/"$/, "");
  return `inRawString:${hashes.length}`;
};

export class Rust implements LanguageDefinition {
  name = "rust";
  extensions = [".rs"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "attribute",
          pattern: /#!?\[[^\]\n]*\]/g,
          className: "nsh-variable",
        },
        createKeywordToken(RUST_KEYWORDS),
        {
          name: "type",
          pattern: new RegExp(`\\b(${RUST_TYPES.join("|")})\\b`, "g"),
          className: "nsh-type",
        },
        createBuiltinList(RUST_BUILTINS, "builtin"),
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
          pattern: /\b(?:br|r)(#*)"/g,
          className: "nsh-string",
          push: rawStringPush,
        },
        {
          name: "string",
          pattern: /\bb"/g,
          className: "nsh-string",
          push: "inString",
        },
        {
          name: "string",
          pattern: /"/g,
          className: "nsh-string",
          push: "inString",
        },
        {
          name: "string",
          pattern: /b?'(?:\\.|[^'\\])'/g,
          className: "nsh-string",
        },
        {
          name: "lifetime",
          pattern: /'[A-Za-z_][A-Za-z0-9_]*/g,
          className: "nsh-type",
        },
        {
          name: "number",
          pattern:
            /\b(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)(?:[iu](?:8|16|32|64|128|size)|f(?:32|64))?\b/g,
          className: "nsh-number",
        },
        {
          name: "macro",
          pattern: /\b[a-z_][A-Za-z0-9_]*!/g,
          className: "nsh-function",
        },
        {
          name: "function",
          pattern: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/g,
          className: "nsh-function",
        },
        {
          name: "operator",
          pattern:
            /=>|->|::|\.\.=|\.\.|&&|\|\||<<=|>>=|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[+\-*/%=<>!&|^~?:;,.#]/g,
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
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        {
          name: "comment",
          pattern: /(?:(?!\/\*|\*\/).)+/g,
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
          pattern: /"[#]*/g,
          className: "nsh-string",
          pop: true,
          context: isRawStringEnd,
        },
        { name: "string", pattern: /[^"]+/g, className: "nsh-string" },
        { name: "string", pattern: /"/g, className: "nsh-string" },
      ],
    };
  }
}

function isRawStringEnd(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== '"') return false;
  const state = stateStack[stateStack.length - 1];
  const count = Number(state.slice(state.lastIndexOf(":") + 1));
  if (!Number.isFinite(count)) return false;
  const closing = `"${"#".repeat(count)}`;
  return (
    line.startsWith(closing, position) &&
    line[position + closing.length] !== "#"
  );
}
