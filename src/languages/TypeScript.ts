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
  REGEX_PATTERN,
} from "./shared";
import {
  enclosingBracket,
  lastSignificantToken,
  previousSignificantIndex,
} from "./context";

const GENERIC_LOOKAHEAD = 256;
const MAX_GENERIC_TOKENS = 128;
const ROOT_TYPE_PREFIXES = new Set([
  "interface",
  "class",
  "extends",
  "implements",
  "as",
  "satisfies",
]);
const DECLARATION_KEYWORDS = new Set(["function", "class", "interface", "type"]);
const PARAMETER_MODIFIERS = new Set([
  "public",
  "private",
  "protected",
  "readonly",
  "override",
]);

export class TypeScript implements LanguageDefinition {
  name = "typescript";
  extensions = [".ts"];
  aliases = ["ts"];
  // All contexts below inspect the current line, tokens, or lexical state only.
  lineIndexSensitive = false;

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

  public getStates(): Record<string, TokenType[]> {
    const rootRules: TokenType[] = [
        {
          name: "function",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*(?=\s*\()/g,
          className: "nsh-function",
          context: isAfterDot,
        },
        createKeywordToken(this.tsKeywords),
        {
          name: "type",
          pattern: new RegExp(`\\b(${this.tsTypes.join("|")})\\b`, "g"),
          className: "nsh-type",
          context: isRootTypeReference,
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
          pattern: /\/\*\*\//g,
          className: "nsh-comment",
        },
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
          pattern: REGEX_PATTERN,
          className: "nsh-string",
        },
        {
          name: "type-separator",
          pattern: /:/g,
          className: "nsh-operator",
          context: isReturnTypeStart,
          push: "inReturnType",
        },
        {
          name: "type-separator",
          pattern: /:/g,
          className: "nsh-operator",
          context: isParameterTypeStart,
          push: "inParameterType",
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
          context: isClassBodyStart,
          push: "inClassBody",
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
        {
          name: "property",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-property",
          context: isAfterDot,
        },
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
          pattern: /\?\?=?|\?\.|=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||\*\*|[+\-*/%=<>&|^~?:;,.]/g,
          className: "nsh-operator",
        },
        { name: "non-null", pattern: /!(?![=])/g, className: "nsh-operator" },
        createVariableToken(),
    ];

    return {
      root: rootRules,
      inClassBody: [
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
          context: isClassBodyStart,
          push: "inClassBody",
        },
        {
          name: "bracket",
          pattern: /\{/g,
          className: "nsh-bracket",
          push: "inClassBlock",
        },
        {
          name: "type-separator",
          pattern: /:/g,
          className: "nsh-operator",
          context: isClassMemberTypeStart,
          push: "inType",
        },
        ...rootRules,
      ],
      inClassBlock: [
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
          context: isClassBodyStart,
          push: "inClassBody",
        },
        {
          name: "bracket",
          pattern: /\{/g,
          className: "nsh-bracket",
          push: "inClassBlock",
        },
        ...rootRules,
      ],
      inType: [
        {
          name: "bracket",
          pattern: /^/g,
          pop: true,
          context: shouldEndTypeAtLineStart,
        },
        {
          name: "type",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-type",
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
          pattern: /(?=\})/g,
          pop: true,
        },
        {
          name: "bracket",
          pattern: /\{/g,
          className: "nsh-bracket",
          push: "inTypeObject",
        },
      ],
      inReturnType: [
        {
          name: "type",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-type",
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
          pattern: /[>\[\]|&,?():]/g,
          className: "nsh-operator",
        },
        {
          name: "bracket",
          pattern: /\{/g,
          className: "nsh-bracket",
          context: isReturnTypeObjectStart,
          push: "inTypeObject",
        },
        {
          name: "bracket",
          pattern: /(?=\{)/g,
          pop: true,
        },
        {
          name: "operator",
          pattern: /[;=]/g,
          className: "nsh-operator",
          pop: true,
        },
      ],
      inParameterType: [
        {
          name: "type",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-type",
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
          pop: true,
        },
      ],
      inTypeNested: [
        {
          name: "type",
          pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g,
          className: "nsh-type",
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
        { name: "property", pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g, className: "nsh-property" },
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
        { name: "property", pattern: /[A-Za-z_$][A-Za-z0-9_$]*/g, className: "nsh-property" },
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
          pattern: /\$\{/g,
          className: "nsh-variable",
          push: "inTemplateExpression",
        },
        { name: "string", pattern: /`/g, className: "nsh-string", pop: true },
        {
          name: "string",
          pattern: /([^`$]|\$(?!\{))+/g,
          className: "nsh-string",
        },
      ],
      inTemplateExpression: [
        { name: "string", pattern: /`/g, className: "nsh-string", push: "inTemplate" },
        { name: "bracket", pattern: /\{/g, className: "nsh-bracket", push: "inTemplateBrace" },
        { name: "template-expression", pattern: /\}/g, className: "nsh-variable", pop: true },
        createStringToken([STRING_PATTERNS.singleQuote, STRING_PATTERNS.doubleQuote]),
        createNumberToken([
          NUMBER_PATTERNS.scientific,
          NUMBER_PATTERNS.decimal,
          NUMBER_PATTERNS.integer,
        ]),
        { name: "bracket", pattern: /[\[\]\(\)]/g, className: "nsh-bracket" },
        { name: "operator", pattern: /[+\-*/%=<>!&|^~?:;,.]/g, className: "nsh-operator" },
        createVariableToken(),
      ],
      inTemplateBrace: [
        { name: "string", pattern: /`/g, className: "nsh-string", push: "inTemplate" },
        { name: "bracket", pattern: /\{/g, className: "nsh-bracket", push: "inTemplateBrace" },
        { name: "bracket", pattern: /\}/g, className: "nsh-bracket", pop: true },
        createStringToken([STRING_PATTERNS.singleQuote, STRING_PATTERNS.doubleQuote]),
        createNumberToken([
          NUMBER_PATTERNS.scientific,
          NUMBER_PATTERNS.decimal,
          NUMBER_PATTERNS.integer,
        ]),
        { name: "bracket", pattern: /[\[\]\(\)]/g, className: "nsh-bracket" },
        { name: "operator", pattern: /[+\-*/%=<>!&|^~?:;,.]/g, className: "nsh-operator" },
        createVariableToken(),
      ],
    };
  }

}

function isTypeAnnotationStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== ":" || !isRootLikeState(stateStack)) return false;

  const last = lastSignificantToken(tokens);
  if (!last) return false;

  if (last.token.type === "variable") {
    const previousIndex = previousSignificantIndex(tokens, last.index);
    const previous = previousIndex >= 0 ? tokens[previousIndex] : undefined;
    return (
      previous?.type === "keyword" &&
      (previous.value === "const" || previous.value === "let" || previous.value === "var")
    );
  }

  if (
    last.token.type === "bracket" &&
    (last.token.value === "}" || last.token.value === "]")
  ) {
    const openerIndex = findMatchingOpenerIndex(tokens, last.index);
    if (openerIndex < 0) return false;
    const keywordIndex = previousSignificantIndex(tokens, openerIndex);
    const keyword = keywordIndex >= 0 ? tokens[keywordIndex] : undefined;
    return (
      keyword?.type === "keyword" &&
      (keyword.value === "const" || keyword.value === "let" || keyword.value === "var")
    );
  }

  return false;
}

function isReturnTypeStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== ":" || !isRootLikeState(stateStack)) return false;
  return lastSignificantToken(tokens)?.token.value === ")";
}

function isParameterTypeStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== ":" || !isRootLikeState(stateStack)) return false;

  const last = lastSignificantToken(tokens);
  if (!last) return false;

  const frame = enclosingBracket(tokens);
  if (!frame || frame.kind !== "(") return false;

  if (
    last.token.type === "bracket" &&
    (last.token.value === "}" || last.token.value === "]")
  ) {
    const openerIndex = findMatchingOpenerIndex(tokens, last.index);
    return openerIndex >= 0 && isAfterParameterSeparator(tokens, openerIndex);
  }
  if (isOptionalParameterMarker(tokens, last.index)) return true;
  if (last.token.type !== "variable") return false;

  const previousIndex = previousSignificantIndex(tokens, last.index);
  const previous = previousIndex >= 0 ? tokens[previousIndex] : undefined;
  if (
    previous?.type === "keyword" &&
    PARAMETER_MODIFIERS.has(previous.value)
  ) {
    return isAfterParameterSeparator(tokens, previousIndex);
  }
  return isAfterParameterSeparator(tokens, last.index);
}

function isRootTypeReference(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (!isTypeNameStart(line.charCodeAt(position)) || !isRootLikeState(stateStack)) {
    return false;
  }

  const previous = tokens[tokens.length - 1];
  if (previous) {
    if (previous.value === "new" || previous.value === ",") return true;
    if (previous.type === "keyword" && ROOT_TYPE_PREFIXES.has(previous.value)) {
      return true;
    }
    if (previous.value === "<" && previous.type === "type-separator") return true;
  }
  return isFollowedByGenericArguments(line, position);
}

function shouldEndTypeAtLineStart(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (position !== 0 || !isStateKind(stateStack, "inType")) {
    return false;
  }

  const rest = line.trimStart();
  if (/^[}\])]/.test(rest)) return true;
  if (
    /^(?:readonly\s+)?[A-Za-z_$][A-Za-z0-9_$]*\s*(?:[?:]|\()/.test(rest) ||
    /^\[[^\]]+\]\s*[?:]/.test(rest)
  ) {
    return true;
  }
  return /^(?:const|let|var|function|class|interface|type|export|import|return|if|for|while|switch|try|throw|new)\b/.test(
    rest,
  );
}

function isReturnTypeObjectStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== "{" || !isStateKind(stateStack, "inReturnType")) {
    return false;
  }

  const last = lastSignificantToken(tokens);
  if (!last) return true;
  return [":", "|", "&", "<", ","].includes(last.token.value);
}

function isAfterDot(
  _line: string,
  _position: number,
  tokens: Token[],
  _stateStack: string[],
): boolean {
  return tokens[tokens.length - 1]?.value === ".";
}

function isGenericStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== "<" || !isRootLikeState(stateStack)) return false;

  const snippet = line.slice(
    position,
    Math.min(line.length, position + GENERIC_LOOKAHEAD),
  );
  if (/^<\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\s*,[^>]*)?\s*>\s*\(/.test(snippet)) {
    return true;
  }

  const previous = tokens[tokens.length - 1];
  if (previous?.type === "type") return true;
  const beforePrevious = tokens[tokens.length - 2];
  return (
    previous?.type === "variable" &&
    beforePrevious?.type === "keyword" &&
    DECLARATION_KEYWORDS.has(beforePrevious.value)
  );
}

function isTypeAliasEquals(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  return (
    line[position] === "=" &&
    isRootLikeState(stateStack) &&
    isKeywordBeforeNameChain(tokens, "type")
  );
}

function isInterfaceBodyStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  return (
    line[position] === "{" &&
    isRootLikeState(stateStack) &&
    isKeywordBeforeNameChain(tokens, "interface")
  );
}

function isClassBodyStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== "{" || !isRootLikeState(stateStack)) return false;

  for (
    let index = tokens.length - 1, steps = 0;
    index >= 0 && steps < MAX_GENERIC_TOKENS;
    index -= 1, steps += 1
  ) {
    const token = tokens[index];
    if (token.type === "comment" || token.type === "jsdoc") continue;
    if (
      token.value === ";" ||
      token.value === "{" ||
      token.value === "}" ||
      token.value === "="
    ) {
      return false;
    }
    if (token.type === "keyword" && token.value === "class") {
      const next = nextSignificantToken(tokens, index);
      return !(
        next &&
        (next.value === ":" || next.value === "," || next.value === "}")
      );
    }
  }
  return false;
}

function isClassMemberTypeStart(
  line: string,
  position: number,
  tokens: Token[],
  stateStack: string[],
): boolean {
  if (line[position] !== ":" || !isStateKind(stateStack, "inClassBody")) {
    return false;
  }

  const last = lastSignificantToken(tokens);
  if (!last) return false;

  if (enclosingBracket(tokens)?.kind === "(") return false;

  if (last.token.value === "?" && last.token.type === "operator") {
    const variableIndex = previousSignificantIndex(tokens, last.index);
    return tokens[variableIndex]?.type === "variable";
  }
  if (last.token.type === "bracket" && last.token.value === "]") return true;
  if (last.token.type !== "variable") return false;

  const previousIndex = previousSignificantIndex(tokens, last.index);
  const previous = previousIndex >= 0 ? tokens[previousIndex] : undefined;
  return previous?.value !== "?";
}

function nextSignificantToken(tokens: Token[], fromIndex: number): Token | undefined {
  for (let index = fromIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "comment" && token.type !== "jsdoc") return token;
  }
  return undefined;
}

function isRootLikeState(stateStack: string[]): boolean {
  const state = baseStateName(stateStack[stateStack.length - 1]);
  return (
    state === "root" ||
    state === "jsxExpression" ||
    state === "inClassBody" ||
    state === "inClassBlock" ||
    state.endsWith("_root") ||
    state.endsWith("_jsxExpression") ||
    state.endsWith("_inClassBody") ||
    state.endsWith("_inClassBlock")
  );
}

function isStateKind(stateStack: string[], kind: string): boolean {
  const state = baseStateName(stateStack[stateStack.length - 1]);
  return state === kind || state.endsWith(`_${kind}`);
}

function baseStateName(state: string): string {
  const separator = state.lastIndexOf(":");
  return separator > 0 ? state.slice(0, separator) : state;
}

function isOptionalParameterMarker(tokens: Token[], markerIndex: number): boolean {
  if (tokens[markerIndex]?.value !== "?") return false;

  const variableIndex = previousSignificantIndex(tokens, markerIndex);
  const variable = tokens[variableIndex];
  if (variable?.type !== "variable") return false;

  const previousIndex = previousSignificantIndex(tokens, variableIndex);
  const previous = previousIndex >= 0 ? tokens[previousIndex] : undefined;
  if (previous?.type === "keyword" && PARAMETER_MODIFIERS.has(previous.value)) {
    return isAfterParameterSeparator(tokens, previousIndex);
  }
  return isAfterParameterSeparator(tokens, variableIndex);
}

function isAfterParameterSeparator(tokens: Token[], index: number): boolean {
  const previousIndex = previousSignificantIndex(tokens, index);
  const previous = previousIndex >= 0 ? tokens[previousIndex] : undefined;
  return (
    (previous?.type === "bracket" &&
      (previous.value === "(" || previous.value === "[")) ||
    previous?.value === "," ||
    previous?.value === "..." ||
    previous?.type === "spread"
  );
}

function findMatchingOpenerIndex(tokens: Token[], closeIndex: number): number {
  const close = tokens[closeIndex];
  if (!close) return -1;
  const open = close.value === "}" ? "{" : "[";
  let depth = 0;
  for (let index = closeIndex; index >= 0; index -= 1) {
    const token = tokens[index];
    if (token.type !== "bracket") continue;
    if (token.value === close.value) {
      depth += 1;
    } else if (token.value === open) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function skipTypeArgumentsBackward(tokens: Token[], closeIndex: number): number {
  let depth = 1;
  for (
    let index = closeIndex - 1, steps = 0;
    index >= 0 && steps < MAX_GENERIC_TOKENS;
    index -= 1, steps += 1
  ) {
    const token = tokens[index];
    if (token.type !== "type-separator") continue;
    if (token.value === ">") {
      depth += 1;
    } else if (token.value === "<") {
      depth -= 1;
      if (depth === 0) {
        return previousSignificantIndex(tokens, index);
      }
    }
  }
  return -1;
}

function isKeywordBeforeNameChain(tokens: Token[], keyword: string): boolean {
  let index = tokens.length - 1;
  if (tokens[index]?.value === ">" && tokens[index].type === "type-separator") {
    index = skipTypeArgumentsBackward(tokens, index);
    if (index < 0) return false;
  }

  const name = tokens[index];
  if (!name || (name.type !== "variable" && name.type !== "type")) {
    return false;
  }

  const previousIndex = previousSignificantIndex(tokens, index);
  const previous = previousIndex >= 0 ? tokens[previousIndex] : undefined;
  return previous?.type === "keyword" && previous.value === keyword;
}

function isFollowedByGenericArguments(line: string, position: number): boolean {
  let index = position;
  while (index < line.length && isIdentifierCharacter(line.charCodeAt(index))) {
    index += 1;
  }
  while (index < line.length && (line[index] === " " || line[index] === "\t")) {
    index += 1;
  }
  return line[index] === "<";
}

function isIdentifierCharacter(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 95 ||
    code === 36
  );
}

function isTypeNameStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 ||
    code === 36
  );
}
