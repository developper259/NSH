import { Token } from "../types/token";
import { LanguageDefinition } from "../types/language";

export class Tokenizer {
  private language: LanguageDefinition;
  private states: Record<string, CompiledTokenRule[]> | null = null;

  private static readonly DEFAULT_STATE: string[] = ["root"];

  constructor(language: LanguageDefinition) {
    this.language = language;
  }

  public tokenize(code: string): Token[] {
    return this.tokenizeWithState(code).tokens;
  }

  public tokenizeWithState(
    code: string,
    initialStateStack: string[] = Tokenizer.DEFAULT_STATE,
  ): { tokens: Token[]; finalStateStack: string[] } {
    const lines = code.split("\n");
    let currentState: string[] =
      initialStateStack && initialStateStack.length > 0
        ? [...initialStateStack]
        : [...Tokenizer.DEFAULT_STATE];
    let allTokens: Token[] = [];

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

    const stateStack =
      initialStateStack && initialStateStack.length > 0
        ? [...initialStateStack]
        : [...Tokenizer.DEFAULT_STATE];
    let position = 0;
    let previousToken: Token | undefined;

    while (position < line.length) {
      const currentState = stateStack[stateStack.length - 1];
      const currentRules = states[currentState] || states["root"] || [];
      let matched = false;

      for (const rule of currentRules) {
        if (rule.original.name === "regex" && !canStartRegex(previousToken)) {
          continue;
        }

        rule.matcher.lastIndex = position;
        const match = rule.matcher.exec(line);

        if (match) {
          if (match[0].length === 0) continue;

          tokens.push({
            type: rule.original.name,
            value: match[0],
            line: lineIndex + 1,
            column: position + 1,
            className: rule.original.className,
          });
          previousToken = tokens[tokens.length - 1];

          position += match[0].length;
          matched = true;

          if (rule.original.pop && stateStack.length > 1) {
            stateStack.pop();
          }
          if (rule.original.popTo) {
            const target = stateStack.lastIndexOf(rule.original.popTo);
            stateStack.splice(target >= 0 ? target + 1 : 1);
          }
          if (rule.original.popPrefix) {
            while (
              stateStack.length > 1 &&
              stateStack[stateStack.length - 1].startsWith(rule.original.popPrefix)
            ) {
              stateStack.pop();
            }
          }
          if (rule.original.push) {
            stateStack.push(rule.original.push);
          }

          break;
        }
      }

      if (!matched) {
        position++;
      }
    }

    return { tokens, finalStateStack: stateStack };
  }

  public setLanguage(language: LanguageDefinition): void {
    this.language = language;
    this.states = null;
  }

  private getCompiledStates(): Record<string, CompiledTokenRule[]> {
    if (this.states) {
      return this.states;
    }

    const rawStates =
      typeof this.language.getStates === "function"
        ? this.language.getStates()
        : { root: this.language.getTokenTypes() };

    this.states = Object.fromEntries(
      Object.entries(rawStates).map(([stateName, rules]) => [
        stateName,
        rules.map((original) => ({
          original,
          matcher: toStickyRegExp(original.pattern),
        })),
      ]),
    );

    return this.states;
  }
}

interface CompiledTokenRule {
  original: import("../types/token").TokenType;
  matcher: RegExp;
}

function toStickyRegExp(pattern: RegExp): RegExp {
  if (pattern.sticky) {
    return new RegExp(pattern.source, pattern.flags);
  }

  return new RegExp(pattern.source, `${pattern.flags.replace("g", "")}y`);
}

function canStartRegex(previousToken: Token | undefined): boolean {
  if (!previousToken) return true;

  switch (previousToken.type) {
    case "keyword": {
      return [
        "return", "case", "throw", "else", "do", "yield", "await",
        "of", "in", "new", "typeof", "instanceof", "delete", "void",
        "if", "while", "for", "switch", "with",
      ].includes(previousToken.value);
    }
    case "bracket": {
      return ["(", "[", "{"].includes(previousToken.value);
    }
    case "operator": {
      return !["++", "--", "."].includes(previousToken.value);
    }
    case "variable":
    case "number":
    case "string":
    case "regex":
    case "boolean":
    case "builtin":
    case "function":
    case "type":
    case "generic":
    case "type-annotation":
    case "non-null":
    case "optional-chaining":
    case "jsx-tag":
      return false;
    default:
      return false;
  }
}
