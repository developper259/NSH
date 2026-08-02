import { LanguageDefinition } from "../types/language";
import {
  createCommentToken,
  createStringToken,
  STRING_PATTERNS,
  COMMENT_PATTERNS,
} from "./shared";

export class CSS implements LanguageDefinition {
  name = "css";
  extensions = [".css", ".scss", ".sass"];

  // Liste explicite des balises HTML/SVG (pour les sélecteurs)
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

  // Liste stricte des pseudo-classes et pseudo-éléments pour éviter de capturer :hidden, :solid, etc.
  private pseudoClassPattern =
    /:{1,2}(?:hover|active|focus|focus-within|focus-visible|visited|link|target|checked|disabled|enabled|required|optional|valid|invalid|root|empty|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|nth-child|nth-last-child|nth-of-type|nth-last-of-type|not|is|where|has|placeholder-shown|read-only|read-write|fullscreen|before|after|first-letter|first-line|selection|placeholder|marker|backdrop)\b/;

  tokenTypes = [
    // 1. Commentaires (/* ... */)
    createCommentToken(COMMENT_PATTERNS.multiLine.slashStar),

    // 2. Chaînes de caractères ("..." et '...')
    createStringToken([
      STRING_PATTERNS.doubleQuote,
      STRING_PATTERNS.singleQuote,
    ]),

    // 3. At-rules (@media, @keyframes, @import...)
    {
      name: "at-rule",
      pattern: /@[a-zA-Z0-9_-]+/g,
      className: "nsh-keyword",
    },

    // 4. Variables CSS (--bg-primary, --bottombar-height)
    {
      name: "variable",
      pattern: /--[a-zA-Z0-9_-]+/g,
      className: "nsh-variable",
    },

    // 5. Fonctions CSS (var(), calc(), rgb(), url()...)
    {
      name: "function",
      pattern: /[a-zA-Z0-9_-]+(?=\()/g,
      className: "nsh-function",
    },

    // 6. Couleurs Hex (#fff, #000000, #af00db)
    {
      name: "hex-color",
      pattern: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
      className: "nsh-number",
    },

    // 7. Pseudo-classes & Pseudo-éléments explicites (:hover, ::before...)
    {
      name: "pseudo-class",
      pattern: new RegExp(this.pseudoClassPattern, "g"),
      className: "nsh-keyword",
    },

    // 8. Propriétés CSS (border:, background-color:, height:...)
    // Fonctionne avec ou sans espace après les deux-points (ex: border:hidden)
    {
      name: "property",
      pattern: /(?!\d)[a-zA-Z0-9_-]+(?=\s*:)/g,
      className: "nsh-keyword",
    },

    // 9. Nombres et Unités (100%, 0, 13px, 1px, 21px...)
    {
      name: "number",
      pattern:
        /\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|rad|turn|hz|khz|dpi|dpcm|dppx|fr|ch|ex)?\b/g,
      className: "nsh-number",
    },

    // 10. Sélecteurs de balises HTML/SVG (section, div, span...)
    {
      name: "selector-tag",
      pattern: new RegExp(`\\b(?:${this.htmlTags.join("|")})\\b`, "g"),
      className: "nsh-function",
    },

    // 11. Sélecteurs de classe (.bottomBar, .bottomBar-scroller)
    {
      name: "selector-class",
      pattern: /\.[a-zA-Z0-9_-]+/g,
      className: "nsh-function",
    },

    // 12. Sélecteurs d'ID (#main-header)
    {
      name: "selector-id",
      pattern: /#[a-zA-Z0-9_-]+/g,
      className: "nsh-function",
    },

    // 13. Attrape-tout pour les VALEURS CSS (solid, hidden, space-between, absolute, center...) 🚀
    // Tout identifiant restant qui n'est pas une propriété ou une classe devient une valeur !
    {
      name: "value-identifier",
      pattern: /[a-zA-Z_-][a-zA-Z0-9_-]*/g,
      className: "nsh-string",
    },

    // 14. Opérateurs et Ponctuation ({ }, : , ; , ( , ) , > , + , ~ , ,)
    {
      name: "operator",
      pattern: /[{}():;,>~+*|]/g,
      className: "nsh-operator",
    },
  ];

  comments = {
    multiLine: {
      start: "/*",
      end: "*/",
    },
  };

  strings = {
    startEnd: ['"', "'"],
    escapeChar: "\\",
  };

  public getTokenTypes(): any[] {
    return this.tokenTypes;
  }
}
