import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
import { CSS } from "./CSS";

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

const scssDeclarationPrefix: TokenType[] = [
  scssLineComment,
  scssInterpolation,
  scssVariable,
  scssAtRule,
  scssSelectorClass,
  scssSelectorId,
  scssSelectorTag,
  scssParent,
];

const scssRootPrefix: TokenType[] = [
  scssVariable,
  scssAtRule,
  scssInterpolation,
  scssLineComment,
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
