import { Token } from "./token";

export interface ParsedLine {
  lineNumber: number;
  tokens: Token[];
}

export interface ParsedCode {
  lines: ParsedLine[];
  totalLines: number;
}
