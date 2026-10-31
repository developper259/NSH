import { LanguageDefinition } from "../types/language";

export class LanguageRegistry {
  private languages = new Map<string, LanguageDefinition>();
  private aliases = new Map<string, string>();
  private extensions = new Map<string, string>();

  public registerLanguage(language: LanguageDefinition): void {
    const canonical = language.name.toLowerCase();
    const nextLanguages = new Map(this.languages);
    nextLanguages.set(canonical, language);
    const indexes = buildIndexes(nextLanguages);
    this.languages = nextLanguages;
    this.aliases = indexes.aliases;
    this.extensions = indexes.extensions;
  }

  public getLanguage(name: string): LanguageDefinition | undefined {
    const normalized = name.toLowerCase();
    const canonical = this.aliases.get(normalized) ?? normalized;
    return this.languages.get(canonical);
  }

  public getLanguageByExtension(extension: string): LanguageDefinition | undefined {
    const canonical = this.extensions.get(normalizeExtension(extension));
    return canonical ? this.languages.get(canonical) : undefined;
  }

  public listLanguages(): string[] {
    return Array.from(this.languages.values()).map((language) => language.name);
  }
}

export function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function buildIndexes(languages: Map<string, LanguageDefinition>): {
  aliases: Map<string, string>;
  extensions: Map<string, string>;
} {
  const aliases = new Map<string, string>();
  const extensions = new Map<string, string>();

  for (const [canonical, language] of languages) {
    for (const name of [canonical, ...(language.aliases ?? []).map((alias) => alias.toLowerCase())]) {
      const owner = aliases.get(name);
      if (owner && owner !== canonical) {
        throw new Error(`Language name or alias already registered: ${name}`);
      }
      aliases.set(name, canonical);
    }

    for (const extension of language.extensions) {
      const normalized = normalizeExtension(extension);
      const owner = extensions.get(normalized);
      if (owner && owner !== canonical) {
        throw new Error(`Extension already registered: ${normalized}`);
      }
      extensions.set(normalized, canonical);
    }
  }

  return { aliases, extensions };
}
