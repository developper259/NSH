import { LanguageDefinition } from "../types/language";
import { Token, TokenType } from "../types/token";

const sassAtRule: TokenType = {
  name: "at-rule",
  pattern:
    /@(?:mixin|include|extend|if|else|each|for|while|function|return|use|forward|content|debug|warn|error|at-root|media|supports|import)\b/gi,
  className: "nsh-keyword",
};

const sassVariable: TokenType = {
  name: "variable",
  pattern: /\$[A-Za-z_][A-Za-z0-9_-]*/g,
  className: "nsh-variable",
};

const sassInterpolation: TokenType = {
  name: "interpolation",
  pattern: /#\{[^}\n]*\}/g,
  className: "nsh-variable",
};

const sassProperty: TokenType = {
  name: "property",
  pattern: /[A-Za-z-][A-Za-z0-9_-]*(?=\s*:)/g,
  className: "nsh-keyword",
  context: isNotSelectorPseudo,
};

export class Sass implements LanguageDefinition {
  name = "sass";
  extensions = [".sass"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "comment",
          pattern: /\/\/[^\n]*/g,
          className: "nsh-comment",
        },
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        sassAtRule,
        sassInterpolation,
        sassVariable,
        {
          name: "string",
          pattern: /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g,
          className: "nsh-string",
        },
        {
          name: "hex-color",
          pattern: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
          className: "nsh-number",
        },
        {
          name: "number",
          pattern:
            /-?\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|rad|turn|fr|ch|ex)?(?![\w-])/g,
          className: "nsh-number",
        },
        {
          name: "pseudo-class",
          pattern: /:[a-zA-Z-][a-zA-Z0-9_-]*/g,
          className: "nsh-keyword",
        },
        {
          name: "important",
          pattern: /!(?:important|default|global|optional)\b/gi,
          className: "nsh-keyword",
        },
        sassProperty,
        {
          name: "selector-class",
          pattern: /\.[A-Za-z_][A-Za-z0-9_-]*/g,
          className: "nsh-function",
        },
        {
          name: "selector-id",
          pattern: /#[A-Za-z_][A-Za-z0-9_-]*/g,
          className: "nsh-function",
        },
        {
          name: "selector-placeholder",
          pattern: /%[A-Za-z_][A-Za-z0-9_-]*/g,
          className: "nsh-function",
        },
        {
          name: "selector-attribute",
          pattern: /\[[^\]\n]+\]/g,
          className: "nsh-variable",
        },
        {
          name: "selector-tag",
          pattern: /[A-Za-z][A-Za-z0-9_-]*/g,
          className: "nsh-function",
          context: isSelectorLine,
        },
        {
          name: "function",
          pattern: /[A-Za-z-][A-Za-z0-9_-]*(?=\s*\()/g,
          className: "nsh-function",
        },
        {
          name: "value-identifier",
          pattern: /[A-Za-z_-][A-Za-z0-9_-]*/g,
          className: "nsh-string",
          context: isAfterDeclarationColon,
        },
        { name: "parent", pattern: /&/g, className: "nsh-operator" },
        {
          name: "operator",
          pattern: /[{}():;,>+~*|]/g,
          className: "nsh-operator",
        },
      ],
      inMultiLineComment: [
        {
          name: "comment",
          pattern: /\*\//g,
          className: "nsh-comment",
          pop: true,
        },
        {
          name: "comment",
          pattern: /(?:(?!\*\/).)+/g,
          className: "nsh-comment",
        },
      ],
    };
  }
}

const SASS_PSEUDO =
  /^(?:active|after|any-link|backdrop|before|checked|disabled|empty|enabled|first-child|first-letter|first-line|first-of-type|focus|focus-visible|focus-within|fullscreen|has|hover|in-range|indeterminate|invalid|is|last-child|last-of-type|link|marker|not|nth-child|nth-last-child|nth-last-of-type|nth-of-type|only-child|only-of-type|optional|out-of-range|placeholder|placeholder-shown|read-only|read-write|required|root|selection|target|valid|visited|where)\b/;

function isSelectorLine(
  line: string,
  position: number,
): boolean {
  const prefix = line.slice(0, position);
  if (prefix.trim() !== "") return false;
  const rest = line.slice(position);
  if (rest.startsWith(":")) return true;
  const property = /^[A-Za-z-][A-Za-z0-9_-]*\s*:\s*(.*)$/.exec(rest);
  if (!property) return true;
  const value = property[1].trim();
  return value !== "" && SASS_PSEUDO.test(value);
}

function isAfterDeclarationColon(
  line: string,
  position: number,
): boolean {
  return line.slice(0, position).includes(":");
}

function isNotSelectorPseudo(
  line: string,
  position: number,
  _tokens: Token[],
): boolean {
  return !isSelectorLine(line, position);
}
