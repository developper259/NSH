import { LanguageDefinition } from '../types/language';

export class LanguageRegistry {
  private languages: Map<string, LanguageDefinition>;

  constructor() {
    this.languages = new Map();
  }

  public registerLanguage(language: LanguageDefinition): void {
    this.languages.set(language.name.toLowerCase(), language);
  }

  public getLanguage(name: string): LanguageDefinition | undefined {
    return this.languages.get(name.toLowerCase());
  }

  public getLanguageByExtension(extension: string): LanguageDefinition | undefined {
    const normalizedExtension = extension.startsWith('.')
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;

    for (const language of this.languages.values()) {
      if (language.extensions.some((item) => item.toLowerCase() === normalizedExtension)) {
        return language;
      }
    }
    return undefined;
  }

  public listLanguages(): string[] {
    return Array.from(this.languages.keys());
  }
}
