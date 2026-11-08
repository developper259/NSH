import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
import { JavaScript } from "./JavaScript";
import { createJsxStates } from "./jsxStates";

export class JSX implements LanguageDefinition {
  name = "jsx";
  extensions = [".jsx"];
  lineIndexSensitive = false;

  private base = new JavaScript();

  public getStates(): Record<string, TokenType[]> {
    return createJsxStates(this.base);
  }
}
