import { LanguageDefinition } from "../types/language";
import { TokenType } from "../types/token";

const SQL_KEYWORDS = [
  "add",
  "all",
  "alter",
  "and",
  "any",
  "as",
  "asc",
  "begin",
  "between",
  "by",
  "case",
  "check",
  "column",
  "commit",
  "constraint",
  "create",
  "cross",
  "database",
  "default",
  "delete",
  "desc",
  "distinct",
  "drop",
  "else",
  "end",
  "exists",
  "foreign",
  "from",
  "full",
  "group",
  "having",
  "if",
  "in",
  "index",
  "inner",
  "insert",
  "into",
  "is",
  "join",
  "key",
  "left",
  "like",
  "limit",
  "not",
  "null",
  "offset",
  "on",
  "or",
  "order",
  "outer",
  "primary",
  "references",
  "returning",
  "right",
  "rollback",
  "select",
  "set",
  "table",
  "then",
  "transaction",
  "trigger",
  "true",
  "false",
  "union",
  "unique",
  "update",
  "using",
  "values",
  "view",
  "when",
  "where",
  "with",
];

const SQL_TYPES = [
  "bigint",
  "binary",
  "bit",
  "blob",
  "boolean",
  "char",
  "date",
  "datetime",
  "decimal",
  "double",
  "enum",
  "float",
  "int",
  "integer",
  "interval",
  "json",
  "jsonb",
  "numeric",
  "real",
  "serial",
  "smallint",
  "text",
  "time",
  "timestamp",
  "timestamptz",
  "tinyint",
  "uuid",
  "varchar",
];

const SQL_FUNCTIONS = [
  "abs",
  "avg",
  "cast",
  "ceil",
  "coalesce",
  "concat",
  "count",
  "date_trunc",
  "floor",
  "lower",
  "max",
  "min",
  "now",
  "nullif",
  "round",
  "row_number",
  "sum",
  "trim",
  "upper",
];

function caseInsensitiveWordPattern(words: string[]): RegExp {
  const alternatives = words
    .slice()
    .sort((left, right) => right.length - left.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`\\b(?:${alternatives})\\b`, "gi");
}

export class SQL implements LanguageDefinition {
  name = "sql";
  extensions = [".sql"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "keyword",
          pattern: caseInsensitiveWordPattern(SQL_KEYWORDS),
          className: "nsh-keyword",
        },
        {
          name: "type",
          pattern: caseInsensitiveWordPattern(SQL_TYPES),
          className: "nsh-keyword",
        },
        {
          name: "function",
          pattern: caseInsensitiveWordPattern(SQL_FUNCTIONS),
          className: "nsh-function",
        },
        {
          name: "comment",
          pattern: /--[^\n]*/g,
          className: "nsh-comment",
        },
        {
          name: "comment",
          pattern: /\/\*/g,
          className: "nsh-comment",
          push: "inMultiLineComment",
        },
        {
          name: "string",
          pattern: /'(?:[^']|'')*'/g,
          className: "nsh-string",
        },
        {
          name: "variable",
          pattern: /"(?:[^"]|"")*"/g,
          className: "nsh-variable",
        },
        {
          name: "variable",
          pattern: /`(?:[^`]|``)*`/g,
          className: "nsh-variable",
        },
        {
          name: "variable",
          pattern: /\[[^\]]+\]/g,
          className: "nsh-variable",
        },
        {
          name: "number",
          pattern: /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi,
          className: "nsh-number",
        },
        {
          name: "operator",
          pattern: /::/g,
          className: "nsh-operator",
        },
        {
          name: "parameter",
          pattern: /:\w+|\?\d*|\$\d+/g,
          className: "nsh-variable",
        },
        {
          name: "function",
          pattern: /\b[A-Za-z_][A-Za-z0-9_$]*(?=\s*\()/g,
          className: "nsh-function",
        },
        {
          name: "operator",
          pattern:
            /<>|!=|<=|>=|\|\||&&|[=<>+\-*/%,;.()]/g,
          className: "nsh-operator",
        },
        {
          name: "variable",
          pattern: /\b[A-Za-z_][A-Za-z0-9_$]*\b/g,
          className: "nsh-variable",
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
