import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";
import { createStringToken, STRING_PATTERNS } from "./shared";

export class CSS implements LanguageDefinition {
  name = "css";
  extensions = [".css"];

  private htmlTags = [
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "svg",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr",
    "path",
    "g",
    "circle",
    "rect",
    "line",
    "polyline",
    "polygon",
  ];

  private pseudoClassPattern =
    /:{1,2}(?:hover|active|focus|focus-within|focus-visible|visited|link|target|checked|disabled|enabled|required|optional|valid|invalid|root|empty|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|nth-child|nth-last-child|nth-of-type|nth-last-of-type|not|is|where|has|placeholder-shown|read-only|read-write|fullscreen|before|after|first-letter|first-line|selection|placeholder|marker|backdrop)\b/;

  private commentRule: TokenType = {
    name: "comment",
    pattern: /\/\*[\s\S]*?\*\//g,
    className: "nsh-comment",
  };

  private stringRule: TokenType = createStringToken([
    STRING_PATTERNS.doubleQuote,
    STRING_PATTERNS.singleQuote,
  ]);

  private numberRule: TokenType = {
    name: "number",
    pattern:
      /\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|rad|turn|hz|khz|dpi|dpcm|dppx|fr|ch|ex)?(?![\w-])/g,
    className: "nsh-number",
  };

  private hexColorRule: TokenType = {
    name: "hex-color",
    pattern: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    className: "nsh-number",
  };

  private atRule: TokenType = {
    name: "at-rule",
    pattern: /@[a-zA-Z0-9_-]+/g,
    className: "nsh-keyword",
  };

  private variableRule: TokenType = {
    name: "variable",
    pattern: /--[a-zA-Z0-9_-]+/g,
    className: "nsh-variable",
  };

  private functionRule: TokenType = {
    name: "function",
    pattern: /[a-zA-Z0-9_-]+(?=\()/g,
    className: "nsh-function",
  };

  private pseudoClassRule: TokenType = {
    name: "pseudo-class",
    pattern: new RegExp(this.pseudoClassPattern, "g"),
    className: "nsh-keyword",
  };

  private propertyRule: TokenType = {
    name: "property",
    pattern: /(?!\d)[a-zA-Z0-9_-]+(?=\s*:)/g,
    className: "nsh-keyword",
  };

  private importantRule: TokenType = {
    name: "important",
    pattern: /!important/g,
    className: "nsh-keyword",
  };

  private selectorTagRule: TokenType = {
    name: "selector-tag",
    pattern: new RegExp(`\\b(?:${this.htmlTags.join("|")})\\b`, "g"),
    className: "nsh-function",
  };

  private selectorClassRule: TokenType = {
    name: "selector-class",
    pattern: /\.[a-zA-Z0-9_-]+/g,
    className: "nsh-function",
  };

  private selectorIdRule: TokenType = {
    name: "selector-id",
    pattern: /#[a-zA-Z0-9_-]+/g,
    className: "nsh-function",
  };

  private valueIdentifierRule: TokenType = {
    name: "value-identifier",
    pattern: /[a-zA-Z_-][a-zA-Z0-9_-]*/g,
    className: "nsh-string",
  };

  private operatorRule: TokenType = {
    name: "operator",
    pattern: /[{}():;,>~+*|]/g,
    className: "nsh-operator",
  };

  public tokenTypes: TokenType[] = [
    this.commentRule,
    this.stringRule,
    this.atRule,
    this.variableRule,
    this.functionRule,
    this.hexColorRule,
    this.pseudoClassRule,
    this.propertyRule,
    this.numberRule,
    this.selectorTagRule,
    this.selectorClassRule,
    this.selectorIdRule,
    this.valueIdentifierRule,
    this.operatorRule,
  ];

  public getTokenTypes(): TokenType[] {
    return this.tokenTypes;
  }

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        this.atRule,
        this.variableRule,
        this.functionRule,
        this.pseudoClassRule,
        this.selectorTagRule,
        this.selectorClassRule,
        this.selectorIdRule,
        this.combinatorRule,
        {
          name: "block-start",
          pattern: /{/g,
          className: "nsh-operator",
          push: "inDeclaration",
        },
        this.operatorRule,
      ],
      inDeclaration: [
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        this.importantRule,
        this.hexColorRule,
        this.variableRule,
        this.functionRule,
        this.propertyRule,
        this.numberRule,
        this.stringRule,
        this.valueIdentifierRule,
        // Nested at-rules and keyframes can open declarations while an outer
        // declaration block is active. Keep one lexical state per `{` so the
        // matching `}` cannot return to selector mode too early.
        {
          name: "block-start",
          pattern: /{/g,
          className: "nsh-operator",
          push: "inDeclaration",
        },
        {
          name: "block-end",
          pattern: /}/g,
          className: "nsh-operator",
          pop: true,
        },
        this.operatorRule,
      ],
      inMultiLineComment: [
        {
          name: "comment",
          pattern: /\*\//g,
          className: "nsh-comment",
          pop: true,
        },
        { name: "comment", pattern: /(?:(?!\*\/).)+/g, className: "nsh-comment" },
      ],
    };
  }

  private combinatorRule: TokenType = {
    name: "combinator",
    pattern: /[>~+]/g,
    className: "nsh-operator",
  };

  comments = { multiLine: { start: "/*", end: "*/" } };
  strings = { startEnd: ['"', "'"], escapeChar: "\\" };
}
