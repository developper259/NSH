import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";

export class XML implements LanguageDefinition {
  name = "xml";
  extensions = [".xml", ".xsd", ".xsl", ".xslt", ".svg", ".rss", ".atom"];

  private nameSource = "[a-zA-Z_][a-zA-Z0-9_.-]*(?::[a-zA-Z_][a-zA-Z0-9_.-]*)?";

  public getStates(): Record<string, TokenType[]> {
    const tagAttributeRules: TokenType[] = [
      {
        name: "string",
        pattern: /"/g,
        className: "nsh-string",
        push: "inDoubleQuote",
      },
      {
        name: "string",
        pattern: /'/g,
        className: "nsh-string",
        push: "inSingleQuote",
      },
      {
        name: "attribute",
        pattern: new RegExp(`${this.nameSource}(?=\\s*=)`, "g"),
        className: "nsh-variable",
      },
      {
        name: "operator",
        pattern: /=/g,
        className: "nsh-operator",
      },
      {
        name: "attribute-value",
        pattern: /(?<==\s*)[^\s"'<>=]+/g,
        className: "nsh-string",
      },
    ];

    return {
      root: [
        {
          name: "xml-decl",
          pattern: /<\?xml\b/gi,
          className: "nsh-keyword",
          push: "inXmlDecl",
        },
        {
          name: "doctype",
          pattern: /<!DOCTYPE\b/gi,
          className: "nsh-keyword",
          push: "inDoctype",
        },
        {
          name: "comment",
          pattern: /<!--/g,
          className: "nsh-comment",
          push: "inComment",
        },
        {
          name: "cdata",
          pattern: /<!\[CDATA\[/g,
          className: "nsh-string",
          push: "inCdata",
        },
        {
          name: "tag-close",
          pattern: new RegExp(`<\\/${this.nameSource}`, "g"),
          className: "nsh-keyword",
          push: "inTag",
        },
        {
          name: "tag-open",
          pattern: new RegExp(`<${this.nameSource}`, "g"),
          className: "nsh-keyword",
          push: "inTag",
        },
        {
          name: "entity",
          pattern: /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
          className: "nsh-number",
        },
        {
          name: "processing-instruction",
          pattern: /<\?/g,
          className: "nsh-comment",
          push: "inProcessing",
        },
      ],

      inTag: [
        {
          name: "tag-selfclose",
          pattern: /\/>/g,
          className: "nsh-keyword",
          pop: true,
        },
        {
          name: "tag-bracket",
          pattern: />/g,
          className: "nsh-keyword",
          pop: true,
        },
        ...tagAttributeRules,
      ],

      inDoubleQuote: [
        {
          name: "string",
          pattern: /"/g,
          className: "nsh-string",
          pop: true,
        },
        {
          name: "string",
          pattern: /(?:(?!").)+/g,
          className: "nsh-string",
        },
      ],
      inSingleQuote: [
        {
          name: "string",
          pattern: /'/g,
          className: "nsh-string",
          pop: true,
        },
        {
          name: "string",
          pattern: /(?:(?!').)+/g,
          className: "nsh-string",
        },
      ],

      inComment: [
        {
          name: "comment",
          pattern: /-->/g,
          className: "nsh-comment",
          pop: true,
        },
        {
          name: "comment",
          pattern: /(?:(?!-->).)+/g,
          className: "nsh-comment",
        },
      ],
      inCdata: [
        {
          name: "cdata",
          pattern: /\]\]>/g,
          className: "nsh-string",
          pop: true,
        },
        { name: "cdata", pattern: /(?:(?!\]\]>).)+/g, className: "nsh-string" },
      ],
      inXmlDecl: [
        {
          name: "xml-decl",
          pattern: /\?>/g,
          className: "nsh-keyword",
          pop: true,
        },
        {
          name: "attribute",
          pattern: new RegExp(this.nameSource, "g"),
          className: "nsh-variable",
        },
        { name: "operator", pattern: /=/g, className: "nsh-operator" },
        {
          name: "string",
          pattern: /"[^"]*"|'[^']*'/g,
          className: "nsh-string",
        },
      ],
      inDoctype: [
        {
          name: "doctype",
          pattern: />/g,
          className: "nsh-keyword",
          pop: true,
        },
        {
          name: "comment",
          pattern: /<!--/g,
          className: "nsh-comment",
          push: "inComment",
        },
        {
          name: "doctype",
          pattern: /[\[\]]/g,
          className: "nsh-keyword",
        },
        {
          name: "string",
          pattern: /"[^"]*"|'[^']*'/g,
          className: "nsh-string",
        },
        {
          name: "doctype",
          pattern: /[^>"'\[]+/g,
          className: "nsh-keyword",
        },
      ],
      inProcessing: [
        {
          name: "processing-instruction",
          pattern: /\?>/g,
          className: "nsh-comment",
          pop: true,
        },
        {
          name: "processing-instruction",
          pattern: /(?:(?!\?>).)+/g,
          className: "nsh-comment",
        },
      ],
    };
  }

}
