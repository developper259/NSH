import { LanguageDefinition } from "./language";

export interface EmbeddedLanguageOptions {
  language: LanguageDefinition;
  exitRule: {
    name: string;
    pattern: RegExp;
    className: string;
  };
  prefix: string;
  /** Return to the exact parent state instead of leaving the host language. */
  exitMode?: "host" | "parent";
  /** Child states where the host exit rule must not be injected. */
  skipExitStates?: string[];
}
