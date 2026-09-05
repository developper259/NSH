import * as fs from 'node:fs';
import * as path from 'node:path';

export class ThemeManager {
  private themes: Map<string, string>;

  constructor() {
    this.themes = new Map();
    this.loadBuiltinThemes();
  }

  public registerTheme(name: string, cssPath: string): void {
    this.themes.set(name, cssPath);
  }

  public getTheme(name: string): string | undefined {
    return this.themes.get(name);
  }

  public getThemeCSS(name: string): string {
    const cssPath = this.themes.get(name);
    if (!cssPath) return '';
    try {
      return fs.readFileSync(cssPath, 'utf8');
    } catch {
      return '';
    }
  }

  public listThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  public removeTheme(name: string): boolean {
    return this.themes.delete(name);
  }

  private loadBuiltinThemes(): void {
    this.registerTheme('light', path.join(__dirname, '..', 'themes', 'light.css'));
    this.registerTheme('dark', path.join(__dirname, '..', 'themes', 'dark.css'));
  }
}
