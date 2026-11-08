import { LanguageDefinition } from "../types/language";
import { Token, TokenType } from "../types/token";
import { CSS } from "./CSS";
import { lastSignificantToken } from "./context";

const scssVariable: TokenType = {
  name: "scss-variable",
  pattern: /\$[A-Za-z_][A-Za-z0-9_-]*/g,
  className: "nsh-variable",
};

const scssAtRule: TokenType = {
  name: "scss-at-rule",
  pattern:
    /@(?:mixin|include|extend|if|else|each|for|while|function|return|use|forward|content|debug|warn|error|at-root|media|supports|import)\b/gi,
  className: "nsh-keyword",
};

const scssInterpolation: TokenType = {
  name: "scss-interpolation",
  pattern: /#\{[^}\n]*\}/g,
  className: "nsh-variable",
};

const scssLineComment: TokenType = {
  name: "comment",
  pattern: /\/\/[^\n]*/g,
  className: "nsh-comment",
};

const scssParent: TokenType = {
  name: "scss-parent",
  pattern: /&/g,
  className: "nsh-operator",
};

const scssSelectorClass: TokenType = {
  name: "selector-class",
  pattern: /\.[A-Za-z_][A-Za-z0-9_-]*/g,
  className: "nsh-function",
};

const scssSelectorId: TokenType = {
  name: "selector-id",
  pattern: /#[A-Za-z_][A-Za-z0-9_-]*/g,
  className: "nsh-function",
};

const scssSelectorTag: TokenType = {
  name: "selector-tag",
  pattern: /[A-Za-z][A-Za-z0-9_-]*(?=\s*\{)/g,
  className: "nsh-function",
};

const scssPlaceholder: TokenType = {
  name: "selector-placeholder",
  pattern: /%[A-Za-z_][A-Za-z0-9_-]*/g,
  className: "nsh-function",
};

const scssFlag: TokenType = {
  name: "important",
  pattern: /!(?:default|global|optional)\b/gi,
  className: "nsh-keyword",
};

const scssEllipsis: TokenType = {
  name: "spread",
  pattern: /\.\.\./g,
  className: "nsh-operator",
};

const scssPseudo: TokenType = {
  name: "pseudo-class",
  pattern: /:{1,2}[A-Za-z-][A-Za-z0-9_-]*/g,
  className: "nsh-keyword",
  context: isAfterSelectorToken,
};

const scssDeclarationPrefix: TokenType[] = [
  scssLineComment,
  scssInterpolation,
  scssVariable,
  scssAtRule,
  scssPlaceholder,
  scssSelectorClass,
  scssSelectorId,
  scssSelectorTag,
  scssPseudo,
  scssParent,
  scssFlag,
  scssEllipsis,
];

const scssRootPrefix: TokenType[] = [
  scssVariable,
  scssAtRule,
  scssInterpolation,
  scssLineComment,
  scssPlaceholder,
  scssParent,
  scssSelectorClass,
  scssSelectorId,
];

export class SCSS implements LanguageDefinition {
  name = "scss";
  extensions = [".scss"];
  lineIndexSensitive = false;

  private css = new CSS();

  public getStates(): Record<string, TokenType[]> {
    const base = this.css.getStates();
    return {
      ...base,
      root: [...scssRootPrefix, ...base.root],
      inDeclaration: [...scssDeclarationPrefix, ...base.inDeclaration],
    };
  }
}

function isAfterSelectorToken(
  _line: string,
  _position: number,
  tokens: Token[],
): boolean {
  const previous = lastSignificantToken(tokens)?.token;
  return (
    previous?.value === "&" ||
    previous?.type === "selector-class" ||
    previous?.type === "selector-id" ||
    previous?.type === "selector-tag" ||
    previous?.type === "selector-placeholder"
  );
}
