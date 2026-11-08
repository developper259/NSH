import { Token, TokenType } from "../types/token";
import { LanguageDefinition } from "../types/language";
import {
  BracketFrame,
  BracketKind,
  CompiledState,
  TokenContext,
  TokenizerOptions,
} from "../types/tokenizer";
import {
  LanguageValidationError,
  resolveBaseStateName,
  validateStates,
} from "./LanguageValidation";
import { deriveFirstCharacters } from "./FirstCharFilter";

const DEFAULT_MAX_STATE_DEPTH = 64;
const DEFAULT_STATE = ["root"];
const WHITESPACE_SAMPLES = [" ", "  ", "\t", "\t\t", "\r", "\r\n", " \t\n"];
const REGEX_KEYWORDS = new Set([
  "return", "case", "throw", "else", "do", "yield", "await",
  "of", "in", "new", "typeof", "instanceof", "delete", "void",
  "if", "while", "for", "switch", "with",
]);
const CONTROL_KEYWORDS = new Set(["if", "while", "for", "with", "switch", "catch"]);
const BLOCK_KEYWORDS = new Set(["else", "do", "try", "finally"]);
const OBJECT_KEYWORDS = new Set([
  "return", "yield", "await", "case", "throw", "new", "typeof",
  "instanceof", "in", "of", "delete", "void",
]);
const COMMENT_TOKEN_TYPES = new Set(["comment", "jsdoc", "docstring"]);

export class Tokenizer {
  private language: LanguageDefinition;
  private states: Record<string, CompiledState> | null = null;
  private knownStates: Set<string> | null = null;
  private lineIndexSensitive = false;
  private validationWarnings: string[] = [];
  private readonly maxStateDepth: number;
  private readonly onStateDepthExceeded: "throw" | "truncate";
  private readonly validationEnabled: boolean;
  private readonly firstCharacterFilter: boolean;

  constructor(language: LanguageDefinition, options: TokenizerOptions = {}) {
    const maxStateDepth = options.maxStateDepth ?? DEFAULT_MAX_STATE_DEPTH;
    if (!Number.isInteger(maxStateDepth) || maxStateDepth < 1) {
      throw new RangeError("maxStateDepth must be a positive integer");
    }
    this.language = language;
    this.maxStateDepth = maxStateDepth;
    const onStateDepthExceeded = options.onStateDepthExceeded ?? "throw";
    if (onStateDepthExceeded !== "throw" && onStateDepthExceeded !== "truncate") {
      throw new RangeError(
        'onStateDepthExceeded must be "throw" or "truncate"',
      );
    }
    this.onStateDepthExceeded = onStateDepthExceeded;
    this.validationEnabled = options.validate ?? true;
    this.firstCharacterFilter = options.firstCharacterFilter ?? true;
  }

  public getMaxStateDepth(): number {
    return this.maxStateDepth;
  }

  public isLineIndexSensitive(): boolean {
    this.getCompiledStates();
    return this.lineIndexSensitive;
  }

  public getValidationWarnings(): string[] {
    this.getCompiledStates();
    return [...this.validationWarnings];
  }

  public tokenize(code: string): Token[] {
    return this.tokenizeWithState(code).tokens;
  }

  public tokenizeWithState(
    code: string,
    initialStateStack: string[] = DEFAULT_STATE,
  ): { tokens: Token[]; finalStateStack: string[] } {
    const lines = code.split("\n");
    let currentState = this.sanitizeStateStack(initialStateStack);
    const allTokens: Token[] = [];

    for (let i = 0; i < lines.length; i++) {
      const result = this.tokenizeLine(lines[i], currentState, i);
      for (const token of result.tokens) {
        allTokens.push(token);
      }
      currentState = result.finalStateStack;
    }
    return { tokens: allTokens, finalStateStack: currentState };
  }

  public tokenizeLine(
    line: string,
    initialStateStack: string[],
    lineIndex: number,
  ): { tokens: Token[]; finalStateStack: string[] } {
    const tokens: Token[] = [];
    const states = this.getCompiledStates();
    const stateStack = this.sanitizeStateStack(initialStateStack);
    const context: TokenContext = {
      regexAllowed: true,
      previous: undefined,
      beforePrevious: undefined,
      brackets: [],
      lastClosedParenControl: false,
      lastClosedParenFunction: false,
      lastClosedParenFunctionExpression: false,
      lastClosedBraceBlock: false,
      functionExpression: false,
    };
    let position = 0;

    while (position < line.length) {
      const currentState = stateStack[stateStack.length - 1];
      const compiledState = getCompiledState(states, currentState);
      let matched = false;

      for (const rule of compiledState.rules) {
        if (rule.firstChars) {
          const code = line.charCodeAt(position);
          if (code >= 128 || rule.firstChars[code] === 0) continue;
        }

        if (
          rule.original.context &&
          !rule.original.context(line, position, tokens, stateStack, lineIndex)
        ) {
          continue;
        }

        if (rule.original.name === "regex" && !context.regexAllowed) {
          continue;
        }

        rule.matcher.lastIndex = position;
        const match = rule.matcher.exec(line);

        if (!match) continue;

        if (match[0].length === 0) {
          if (
            rule.original.push ||
            !(rule.original.pop || rule.original.popTo || rule.original.popPrefix)
          ) {
            continue;
          }
          const stateChanged = this.applyStateTransitions(
            rule.original,
            stateStack,
            line,
            position,
            tokens,
            "",
            true,
          );
          if (stateChanged) {
            matched = true;
            break;
          }
          continue;
        }

        const token: Token = {
          type: rule.original.name,
          value: match[0],
          line: lineIndex + 1,
          column: position + 1,
          className: rule.original.className,
        };
        tokens.push(token);

        this.applyStateTransitions(
          rule.original,
          stateStack,
          line,
          position,
          tokens,
          match[0],
          false,
        );
        updateTokenContext(context, token, this.maxStateDepth);

        position += match[0].length;
        matched = true;
        break;
      }

      if (!matched) {
        if (
          compiledState.canSkipWhitespace &&
          isWhitespace(line[position])
        ) {
          do {
            position += 1;
          } while (position < line.length && isWhitespace(line[position]));
        } else {
          position += 1;
        }
      }
    }

    return { tokens, finalStateStack: stateStack };
  }

  public setLanguage(language: LanguageDefinition): void {
    this.language = language;
    this.states = null;
    this.knownStates = null;
    this.lineIndexSensitive = false;
    this.validationWarnings = [];
  }

  public clearCache(): void {
    this.states = null;
    this.knownStates = null;
    this.lineIndexSensitive = false;
    this.validationWarnings = [];
  }

  private applyStateTransitions(
    rule: TokenType,
    stateStack: string[],
    line: string,
    position: number,
    tokens: Token[],
    matched: string,
    requireReduction: boolean,
  ): boolean {
    const before = stateStack.join("\u0000");

    if (rule.pop && stateStack.length > 1) {
      stateStack.pop();
    }
    if (rule.popTo) {
      const target = stateStack.lastIndexOf(rule.popTo);
      if (target >= 0) {
        stateStack.splice(target + 1);
      }
    }
    if (rule.popPrefix) {
      while (
        stateStack.length > 1 &&
        stateStack[stateStack.length - 1].startsWith(rule.popPrefix)
      ) {
        stateStack.pop();
      }
    }
    if (rule.push && !requireReduction) {
      const pushed =
        typeof rule.push === "function"
          ? rule.push(line, position, tokens, stateStack, matched)
          : rule.push;
      if (pushed) {
        this.assertKnownState(pushed, rule.name);
        if (stateStack.length < this.maxStateDepth) {
          stateStack.push(pushed);
        } else if (this.onStateDepthExceeded === "throw") {
          throw new RangeError(
            `lexical state stack exceeded maxStateDepth (${this.maxStateDepth})`,
          );
        }
      }
    }

    return stateStack.join("\u0000") !== before;
  }

  private sanitizeStateStack(initialStateStack: string[]): string[] {
    if (!initialStateStack || initialStateStack.length === 0) {
      return [...DEFAULT_STATE];
    }
    if (
      initialStateStack.length > this.maxStateDepth &&
      this.onStateDepthExceeded === "throw"
    ) {
      throw new RangeError(
        `initial lexical state stack exceeds maxStateDepth (${this.maxStateDepth})`,
      );
    }
    const stateStack =
      initialStateStack.length <= this.maxStateDepth
        ? [...initialStateStack]
        : initialStateStack.slice(0, this.maxStateDepth);
    if (this.validationEnabled) {
      for (const stateName of stateStack) {
        this.assertKnownState(stateName, "initialState");
      }
    }
    return stateStack;
  }

  private assertKnownState(stateName: string, ruleName: string): void {
    if (!this.validationEnabled) return;
    const states = this.getCompiledStates();
    if (!this.knownStates) {
      this.knownStates = new Set(Object.keys(states));
    }
    if (
      !this.knownStates.has(stateName) &&
      !this.knownStates.has(resolveBaseStateName(stateName))
    ) {
      throw new LanguageValidationError(this.language.name, [
        `rule "${ruleName}" references unknown state "${stateName}"`,
      ]);
    }
  }

  private getCompiledStates(): Record<string, CompiledState> {
    if (this.states) {
      return this.states;
    }

    const rawStates = this.language.getStates();
    const validation = validateStates(rawStates);
    this.validationWarnings = validation.warnings;
    if (this.validationEnabled && validation.errors.length > 0) {
      throw new LanguageValidationError(this.language.name, validation.errors);
    }

    let hasContextRules = false;
    const compiledStates: Record<string, CompiledState> = {};
    for (const [stateName, rules] of Object.entries(rawStates)) {
      const compiledRules = rules.map((original, ruleIndex) => {
        if (original.context) hasContextRules = true;
        let matcher: RegExp;
        try {
          matcher = toStickyRegExp(original.pattern);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new LanguageValidationError(this.language.name, [
            `state "${stateName}" rule ${ruleIndex} has an invalid pattern: ${message}`,
          ]);
        }
        return {
          original,
          matcher,
          firstChars: this.firstCharacterFilter
            ? deriveFirstCharacters(original.pattern) ?? undefined
            : undefined,
        };
      });
      compiledStates[stateName] = {
        rules: compiledRules,
        canSkipWhitespace: !compiledRules.some((rule) =>
          WHITESPACE_SAMPLES.some((sample) => {
            rule.matcher.lastIndex = 0;
            const match = rule.matcher.exec(sample);
            return match !== null && match[0].length > 0;
          }),
        ),
      };
    }

    this.states = compiledStates;
    this.knownStates = null;
    this.lineIndexSensitive =
      this.language.lineIndexSensitive ?? hasContextRules;

    return this.states;
  }
}

function getCompiledState(
  states: Record<string, CompiledState>,
  stateName: string,
): CompiledState {
  const exact = states[stateName];
  if (exact) return exact;

  const parameterSeparator = stateName.lastIndexOf(":");
  if (parameterSeparator > 0) {
    const base = states[stateName.slice(0, parameterSeparator)];
    if (base) return base;
  }

  return states.root;
}

function updateTokenContext(
  context: TokenContext,
  token: Token,
  maxStateDepth: number,
): void {
  if (COMMENT_TOKEN_TYPES.has(token.type) || token.type === "text") {
    return;
  }

  if (token.type === "bracket") {
    if (token.value === "(") {
      context.brackets.push({
        kind: "paren",
        control:
          context.previous?.type === "keyword" &&
          CONTROL_KEYWORDS.has(context.previous.value),
        functionParameters: isFunctionParameterStart(context),
        functionExpression: context.functionExpression,
      });
      context.regexAllowed = true;
    } else if (token.value === ")") {
      const frame = popBracket(context.brackets, "paren");
      context.lastClosedParenControl = frame?.control === true;
      context.lastClosedParenFunction = frame?.functionParameters === true;
      context.lastClosedParenFunctionExpression = frame?.functionExpression === true;
      context.regexAllowed = context.lastClosedParenControl;
    } else if (token.value === "[") {
      context.brackets.push({ kind: "square" });
      context.regexAllowed = true;
    } else if (token.value === "]") {
      popBracket(context.brackets, "square");
      context.regexAllowed = false;
    } else if (token.value === "{") {
      const brace = classifyBrace(context);
      context.brackets.push({ kind: "brace", block: brace.block, expression: brace.expression });
      context.regexAllowed = true;
    } else if (token.value === "}") {
      const frame = popBracket(context.brackets, "brace");
      context.lastClosedBraceBlock = frame?.block === true;
      context.regexAllowed = frame?.block === true && frame?.expression !== true;
    } else {
      context.regexAllowed = false;
    }
  } else if (token.type === "template-expression") {
    context.regexAllowed = token.value === "${";
  } else if (token.type === "keyword") {
    if (token.value === "function") {
      context.functionExpression = isFunctionExpressionContext(context);
    }
    context.regexAllowed = REGEX_KEYWORDS.has(token.value);
  } else if (token.type === "operator") {
    context.regexAllowed = !["++", "--", "."].includes(token.value);
  } else {
    context.regexAllowed = false;
  }

  context.beforePrevious = context.previous;
  context.previous = token;

  const maxBracketDepth = Math.max(1, maxStateDepth);
  if (context.brackets.length > maxBracketDepth) {
    context.brackets.splice(0, context.brackets.length - maxBracketDepth);
  }
}

function isFunctionParameterStart(context: TokenContext): boolean {
  if (context.previous?.type === "keyword" && context.previous.value === "function") {
    return true;
  }
  return (
    context.previous?.type === "variable" &&
    context.beforePrevious?.type === "keyword" &&
    context.beforePrevious.value === "function"
  );
}

function classifyBrace(context: TokenContext): { block: boolean; expression: boolean } {
  const previous = context.previous;
  if (previous?.type === "keyword") {
    if (BLOCK_KEYWORDS.has(previous.value)) return { block: true, expression: false };
    if (OBJECT_KEYWORDS.has(previous.value)) return { block: false, expression: true };
  }
  if (previous?.type === "operator") {
    if (previous.value === "=>") return { block: true, expression: true };
    return { block: false, expression: true };
  }
  if (previous?.type === "bracket") {
    if (previous.value === ")") {
      return {
        block: true,
        expression:
          context.lastClosedParenFunction && context.lastClosedParenFunctionExpression,
      };
    }
    if (previous.value === "}") {
      return { block: context.lastClosedBraceBlock, expression: true };
    }
    return { block: false, expression: true };
  }
  return { block: context.regexAllowed, expression: false };
}

function isFunctionExpressionContext(context: TokenContext): boolean {
  if (!context.previous) return false;
  if (context.previous.type === "operator") {
    return ![";", "}"].includes(context.previous.value);
  }
  if (context.previous.type === "keyword") {
    return ["return", "throw", "yield", "await", "new"].includes(context.previous.value);
  }
  return context.previous.type === "bracket";
}

function popBracket(
  brackets: BracketFrame[],
  kind: BracketKind,
): BracketFrame | undefined {
  for (let index = brackets.length - 1; index >= 0; index -= 1) {
    if (brackets[index].kind === kind) {
      return brackets.splice(index, 1)[0];
    }
  }
  return undefined;
}

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\r";
}

function toStickyRegExp(pattern: RegExp): RegExp {
  if (pattern.sticky) {
    return new RegExp(pattern.source, pattern.flags);
  }

  return new RegExp(pattern.source, `${pattern.flags.replace("g", "")}y`);
}
