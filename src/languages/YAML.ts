import { LanguageDefinition } from "../types/language";
import {
  createKeywordToken,
  createStringToken,
  createNumberToken,
  STRING_PATTERNS,
  NUMBER_PATTERNS,
} from "./shared";

export class Yaml implements LanguageDefinition {
  name = "yaml";
  extensions = [".yml", ".yaml"];

  // Mots-clés spécifiques au YAML
  private yamlKeywords = ["true", "false", "null", "yes", "no", "on", "off"];

  tokenTypes = [
    // 1. Commentaires (# ...)
    {
      name: "comment",
      pattern: /#.*/g,
      className: "nsh-comment",
    },

    // 2. Chaînes de caractères explicites ("..." et '...')
    createStringToken([
      STRING_PATTERNS.doubleQuote,
      STRING_PATTERNS.singleQuote,
    ]),

    // 3. Mots-clés YAML (true, false, etc.)
    createKeywordToken(this.yamlKeywords),

    // 4. Nombres (ex: 55, 12)
    createNumberToken([NUMBER_PATTERNS.integer, NUMBER_PATTERNS.decimal]),

    // 5. CLÉS (Variables) 🚀
    // Le lookahead positif (?=\s*:) EXIGE la présence d'un ":" juste après le mot
    {
      name: "yaml-key",
      pattern: /[a-zA-ZÀ-ÿ0-9_-]+(?=\s*:)/g,
      className: "nsh-variable",
    },

    // 6. VALEURS ET LISTES (Strings) 🚀
    // Le lookahead négatif (?!\s*:) INTERDIT la présence d'un ":" après le mot.
    // Tout ce qui est ROBERT, pomme, banane tombera ici.
    {
      name: "yaml-value",
      pattern: /[a-zA-ZÀ-ÿ_-][a-zA-ZÀ-ÿ0-9_-]*(?!\s*:)/g,
      className: "nsh-string",
    },

    // 7. Opérateurs (Le ":" et le "-")
    {
      name: "operator",
      pattern: /[:\-|>]/g,
      className: "nsh-operator",
    },
  ];

  comments = {
    singleLine: "#",
  };

  strings = {
    startEnd: ['"', "'"],
    escapeChar: "\\",
  };

  public getTokenTypes(): any[] {
    return this.tokenTypes;
  }
}
