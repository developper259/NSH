import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";
import {
  createKeywordToken,
  createStringToken,
  createNumberToken,
  STRING_PATTERNS,
  NUMBER_PATTERNS,
} from "./shared";

export class YAML implements LanguageDefinition {
  name = "yaml";
  extensions = [".yml", ".yaml"];

  private yamlKeywords = ["true", "false", "null", "yes", "no", "on", "off"];

  public tokenTypes: TokenType[] = [
    {
      name: "comment",
      pattern: /#.*/g,
      className: "nsh-comment",
    },
    createStringToken([
      STRING_PATTERNS.doubleQuote,
      STRING_PATTERNS.singleQuote,
    ]),
    createKeywordToken(this.yamlKeywords),
    createNumberToken([
      NUMBER_PATTERNS.decimal,
      NUMBER_PATTERNS.scientific,
      NUMBER_PATTERNS.hex,
      NUMBER_PATTERNS.integer,
    ]),
    {
      name: "yaml-anchor",
      pattern: /&[a-zA-Z0-9_-]+/g,
      className: "nsh-function",
    },
    {
      name: "yaml-alias",
      pattern: /\*[a-zA-Z0-9_-]+/g,
      className: "nsh-variable",
    },
    {
      name: "yaml-key",
      pattern: /[a-zA-ZÀ-ÿ0-9_-]+(?=\s*:)/g,
      className: "nsh-variable",
    },
    {
      name: "yaml-value",
      pattern: /[a-zA-ZÀ-ÿ_-][a-zA-ZÀ-ÿ0-9_-]*(?!\s*:)/g,
      className: "nsh-string",
    },
    {
      name: "operator",
      pattern: /[:\-|>]/g,
      className: "nsh-operator",
    },
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "block-scalar-start",
          pattern: /^(\s*)(?:[a-zA-ZÀ-ÿ0-9_-]+\s*:\s*)([|>][+-]?)/gm,
          className: "nsh-operator",
          push: blockScalarPush,
        },
        ...this.tokenTypes,
      ],
      inBlockScalar: [
        {
          name: "block-scalar-end",
          pattern: /^/g,
          pop: true,
          context: isBlockScalarEnd,
        },
        {
          name: "block-scalar",
          pattern: /^[ \t]+.*$/gm,
          className: "nsh-string",
        },
      ],
    };
  }

  comments = { singleLine: "#" };
  strings = { startEnd: ['"', "'"], escapeChar: "\\" };
}

const blockScalarPush: StatePushResolver = (
  line,
  _position,
  _tokens,
  _stateStack,
  _matched,
) => {
  const indentation = /^[ \t]*/.exec(line)?.[0].length ?? 0;
  return `inBlockScalar:${indentation}`;
};

function isBlockScalarEnd(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (position !== 0 || line.trim() === "") return false;
  const currentState = stateStack[stateStack.length - 1];
  const separator = currentState.lastIndexOf(":");
  if (separator < 0) return false;
  const requiredIndentation = Number(currentState.slice(separator + 1));
  if (!Number.isFinite(requiredIndentation)) return false;
  const indentation = /^[ \t]*/.exec(line)?.[0].length ?? 0;
  return indentation <= requiredIndentation;
}