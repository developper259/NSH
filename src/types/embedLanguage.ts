import { LanguageDefinition } from "./language";
import { TokenType } from "./token";

export interface EmbeddedLanguageOptions {
  language: LanguageDefinition;
  exitRule: Pick<TokenType, "name" | "pattern" | "className" | "context">;
  prefix: string;
  /** Return to the exact parent state instead of leaving the host language. */
  exitMode?: "host" | "parent";
  /** Child states where the host exit rule must not be injected. */
  skipExitStates?: string[];
}
