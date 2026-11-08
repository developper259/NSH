import { Token } from "../types/token";
import {
  HighlightOptions,
  HighlightResult,
  LineHighlightResult,
} from "../types/highlighter";
import { Tokenizer } from "./Tokenizer";
import { LanguageDefinition } from "../types/language";
import { defaultRegistry } from "../languages/Languages";
import { groupTokensByLine } from "../utils/TokenGrouping";

const CLASS_MAP: Readonly<Record<string, string>> = {
  keyword: "nsh-keyword", string: "nsh-string", number: "nsh-number",
  comment: "nsh-comment", function: "nsh-function", variable: "nsh-variable",
  operator: "nsh-operator", bracket: "nsh-bracket", builtin: "nsh-function",
  "template-expression": "nsh-variable", regex: "nsh-string",
  "arrow-function": "nsh-operator", spread: "nsh-operator", type: "nsh-keyword",
  jsdoc: "nsh-comment", "type-annotation": "nsh-keyword", generic: "nsh-keyword",
  "non-null": "nsh-operator", "optional-chaining": "nsh-operator",
  "jsx-tag": "nsh-keyword", decorator: "nsh-function",
  "fstring-expression": "nsh-variable", docstring: "nsh-comment",
  "type-hint": "nsh-keyword", comparison: "nsh-operator", assignment: "nsh-operator",
  identity: "nsh-operator", membership: "nsh-operator", boolean: "nsh-operator",
  walrus: "nsh-operator", "special-variable": "nsh-variable", tag: "nsh-keyword",
  doctype: "nsh-keyword", "tag-open": "nsh-keyword", "tag-close": "nsh-keyword",
  "tag-selfclose": "nsh-keyword", "tag-bracket": "nsh-keyword",
  attribute: "nsh-variable", "attribute-value": "nsh-string", cdata: "nsh-string",
  "processing-instruction": "nsh-comment", entity: "nsh-number",
  "script-start": "nsh-keyword", "script-end": "nsh-keyword",
  "style-start": "nsh-keyword", "style-end": "nsh-keyword", selector: "nsh-function",
  "selector-tag": "nsh-function", "selector-id": "nsh-function",
  "selector-class": "nsh-function", "selector-attribute": "nsh-variable",
  "pseudo-class": "nsh-keyword", "pseudo-element": "nsh-keyword",
  property: "nsh-keyword", value: "nsh-string", "value-identifier": "nsh-string",
  color: "nsh-number", "hex-color": "nsh-number", "var-function": "nsh-variable",
  "at-rule": "nsh-keyword", important: "nsh-keyword", combinator: "nsh-operator",
  "yaml-key": "nsh-variable", "yaml-value": "nsh-string", "yaml-anchor": "nsh-function",
  "yaml-alias": "nsh-variable", "block-scalar": "nsh-string", "block-scalar-start": "nsh-operator",
  "json-key": "nsh-variable",
  "php-open": "nsh-keyword", "php-close": "nsh-keyword", "php-attribute": "nsh-function",
  "object-operator": "nsh-operator", "scope-resolution": "nsh-operator",
  "namespace-separator": "nsh-operator", "class-name": "nsh-variable",
  "xml-decl": "nsh-keyword",
  heading: "nsh-keyword", separator: "nsh-operator", blockquote: "nsh-comment",
  "list-marker": "nsh-operator", "table-separator": "nsh-operator",
  "table-delimiter": "nsh-operator", "inline-code": "nsh-string",
  "code-block": "nsh-string", "code-fence": "nsh-string",
  "code-fence-end": "nsh-string", bold: "nsh-keyword", italic: "nsh-type",
  link: "nsh-function", image: "nsh-function", escape: "nsh-operator",
};

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export class Highlighter {
  private tokenizer: Tokenizer;
  private themeName: string;
  private options: HighlightOptions;

  constructor(language: LanguageDefinition, options?: HighlightOptions, tokenizer?: Tokenizer) {
    this.tokenizer = tokenizer || new Tokenizer(language);
    this.themeName = normalizeThemeName(options?.theme);
    this.options = options || {};
  }

  public static getSupportedLanguages(): string[] {
    return defaultRegistry.listLanguages();
  }

  public static registerLanguage(language: LanguageDefinition): void {
    defaultRegistry.registerLanguage(language);
  }

  public static detectLanguage(extension: string): string | undefined {
    return defaultRegistry.getLanguageByExtension(extension)?.name;
  }

  public highlight(code: string): HighlightResult {
    const { tokens: rawTokens, finalStateStack } =
      this.tokenizer.tokenizeWithState(code);
    const html = this.generateHTML(code, rawTokens);

    const tokens = this.options.includeClasses
      ? this.replaceByClasses(rawTokens)
      : rawTokens;

    return {
      html,
      tokens,
      finalState: finalStateStack,
    };
  }

  public highlightLine(
    line: string,
    initialStateStack: string[] = ["root"],
    lineIndex: number = 0,
  ): LineHighlightResult {
    const { tokens: rawTokens, finalStateStack } = this.tokenizer.tokenizeLine(
      line,
      initialStateStack,
      lineIndex,
    );

    const html = this.generateLineHTML(line, rawTokens, lineIndex + 1);

    const tokens = this.options.includeClasses
      ? this.replaceByClasses(rawTokens)
      : rawTokens;

    return {
      html,
      tokens,
      finalState: finalStateStack,
    };
  }

  public getTokenLine(
    line: string,
    initialStateStack: string[] = ["root"],
    lineIndex: number = 0,
  ): { tokens: Token[]; finalState: string[] } {
    const { tokens, finalStateStack } = this.tokenizer.tokenizeLine(
      line,
      initialStateStack,
      lineIndex,
    );

    return { tokens, finalState: finalStateStack };
  }

  public getHTMLLine(
    line: string,
    initialStateStack: string[] = ["root"],
    lineIndex: number = 0,
  ): { html: string; finalState: string[] } {
    const { tokens, finalStateStack } = this.tokenizer.tokenizeLine(
      line,
      initialStateStack,
      lineIndex,
    );
    return {
      html: this.generateLineHTML(line, tokens, lineIndex + 1),
      finalState: finalStateStack,
    };
  }

  public replaceByClasses(tokens: Token[]): Token[] {
    return tokens.map((token) => ({
      ...token,
      className: token.className || this.getCssClass(token.type),
    }));
  }

  public getToken(code: string): Token[] {
    return this.tokenizer.tokenize(code);
  }

  public getHTML(code: string): string {
    const tokens = this.tokenizer.tokenize(code);
    return this.generateHTML(code, tokens);
  }

  public setTheme(themeName: string): void {
    this.themeName = normalizeThemeName(themeName);
  }

  public getThemeName(): string {
    return this.themeName;
  }

  public setLanguage(language: LanguageDefinition): void {
    this.tokenizer.setLanguage(language);
  }

  private generateHTML(code: string, tokens: Token[]): string {
    const lines = code.split("\n");
    const linesMap = groupTokensByLine(tokens);
    const chunks = [`<div class="nsh-highlighter nsh-theme-${this.themeName}">`];

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      chunks.push(
        this.generateLineHTML(lines[i], linesMap.get(lineNumber) || [], lineNumber),
      );
    }

    chunks.push("</div>");
    return chunks.join("");
  }

  private generateLineHTML(
    line: string,
    lineTokens: Token[],
    lineNumber: number,
  ): string {
    const chunks = ['<div class="nsh-line">'];

    if (this.options.lineNumbers) {
      chunks.push(`<span class="nsh-line-number">${lineNumber}</span>`);
    }

    let position = 0;
    for (const token of lineTokens) {
      if (token.column > position + 1) {
        chunks.push(this.escapeHtml(line.substring(position, token.column - 1)));
        position = token.column - 1;
      }

      const className = normalizeClassNames(token.className) || this.getCssClass(token.type);
      const value = this.escapeHtml(token.value);
      chunks.push(className ? `<span class="${className}">${value}</span>` : value);
      position = token.column - 1 + token.value.length;
    }

    if (position < line.length) {
      chunks.push(this.escapeHtml(line.substring(position)));
    }

    chunks.push("</div>");
    return chunks.join("");
  }

  private getCssClass(tokenType: string): string {
    return CLASS_MAP[tokenType] || "";
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }
}

function normalizeThemeName(themeName: unknown): string {
  return typeof themeName === "string" && /^[A-Za-z0-9_-]+$/.test(themeName) ? themeName : "dark";
}

function normalizeClassNames(className: string | undefined): string {
  if (!className) return "";
  const classes = className.trim().split(/\s+/);
  return classes.every((name) => /^[A-Za-z0-9_-]+$/.test(name)) ? classes.join(" ") : "";
}
