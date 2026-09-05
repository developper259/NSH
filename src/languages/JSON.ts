import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
import {
  createKeywordToken,
  createStringToken,
  createNumberToken,
  STRING_PATTERNS,
  NUMBER_PATTERNS,
} from "./shared";

export class JSON implements LanguageDefinition {
  name = "json";
  extensions = [
    ".json",
    ".geojson",
    ".eslintrc",
    ".prettierrc",
    ".babelrc",
  ];

  private jsonConstants = ["true", "false", "null"];

  public tokenTypes: TokenType[] = [
    {
      name: "json-key",
      pattern: /"([^"\\]|\\.)*"(?=\s*:)/g,
      className: "nsh-variable",
    },
    createKeywordToken(this.jsonConstants),
    createStringToken([STRING_PATTERNS.doubleQuote]),
    {
      name: "number",
      pattern: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      className: "nsh-number",
    },
    {
      name: "bracket",
      pattern: /[\[\]\{\}]/g,
      className: "nsh-bracket",
    },
    {
      name: "operator",
      pattern: /[:\,]/g,
      className: "nsh-operator",
    },
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    return {
      root: this.tokenTypes,
    };
  }

  strings = { startEnd: ['"'], escapeChar: "\\" };
}