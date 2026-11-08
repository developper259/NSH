import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
import { TypeScript } from "./TypeScript";
import { createJsxStates } from "./jsxStates";

export class TSX implements LanguageDefinition {
  name = "tsx";
  extensions = [".tsx"];
  lineIndexSensitive = false;

  private base = new TypeScript();

  public getStates(): Record<string, TokenType[]> {
    return createJsxStates(this.base);
  }
}
