import { LanguageDefinition } from "../types/language";
import { Token, TokenType } from "../types/token";

const QUOTED_FIELD = /"(?:[^"]|"")*"/g;
const UNQUOTED_FIELD = /[^,\r\n]+/g;
const CSV_NUMBER =
  /[+-]?(?:0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*|\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|\.\d(?:_?\d)*(?:[eE][+-]?\d(?:_?\d)*)?)(?=\s*(?:,|$))/g;

export class CSV implements LanguageDefinition {
  name = "csv";
  extensions = [".csv"];

  private readonly rootRules: TokenType[] = [
    {
      name: "csv-header",
      pattern: QUOTED_FIELD,
      className: "nsh-variable",
      context: isHeaderRow,
    },
    {
      name: "csv-header",
      pattern: UNQUOTED_FIELD,
      className: "nsh-variable",
      context: isHeaderRow,
    },
    { name: "string", pattern: QUOTED_FIELD, className: "nsh-string" },
    { name: "number", pattern: CSV_NUMBER, className: "nsh-number" },
    { name: "string", pattern: UNQUOTED_FIELD, className: "nsh-string" },
    { name: "delimiter", pattern: /,/g, className: "nsh-operator" },
  ];

  public getStates(): Record<string, TokenType[]> {
    return {
      root: this.rootRules,
    };
  }
}

function isHeaderRow(
  _line: string,
  _position: number,
  _tokens: Token[],
  _stateStack: string[],
  lineIndex: number,
): boolean {
  return lineIndex === 0;
}
