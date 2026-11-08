import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";

const SQL_KEYWORDS = [
  "add",
  "all",
  "alter",
  "analyze",
  "and",
  "any",
  "as",
  "asc",
  "attach",
  "autoincrement",
  "auto_increment",
  "begin",
  "between",
  "by",
  "case",
  "check",
  "column",
  "commit",
  "conflict",
  "constraint",
  "create",
  "cross",
  "database",
  "default",
  "delete",
  "delimiter",
  "desc",
  "describe",
  "detach",
  "distinct",
  "do",
  "drop",
  "else",
  "end",
  "exists",
  "explain",
  "fetch",
  "first",
  "foreign",
  "from",
  "full",
  "go",
  "grant",
  "group",
  "having",
  "if",
  "ilike",
  "in",
  "index",
  "inner",
  "insert",
  "into",
  "is",
  "join",
  "key",
  "lateral",
  "left",
  "like",
  "limit",
  "matched",
  "materialized",
  "merge",
  "next",
  "nolock",
  "not",
  "nothing",
  "null",
  "offset",
  "on",
  "only",
  "or",
  "order",
  "outer",
  "over",
  "partition",
  "percent",
  "pragma",
  "primary",
  "recursive",
  "references",
  "returning",
  "revoke",
  "right",
  "rollback",
  "rows",
  "select",
  "set",
  "show",
  "table",
  "then",
  "ties",
  "top",
  "transaction",
  "trigger",
  "true",
  "false",
  "union",
  "unique",
  "update",
  "upsert",
  "use",
  "using",
  "vacuum",
  "values",
  "view",
  "when",
  "where",
  "window",
  "with",
  "without",
];

const SQL_TYPES = [
  "bigint",
  "binary",
  "bit",
  "blob",
  "boolean",
  "char",
  "array",
  "bigserial",
  "bytea",
  "cidr",
  "date",
  "datetime",
  "decimal",
  "double",
  "double precision",
  "enum",
  "float",
  "geography",
  "geometry",
  "inet",
  "int",
  "integer",
  "interval",
  "json",
  "jsonb",
  "macaddr",
  "map",
  "mediumint",
  "money",
  "numeric",
  "real",
  "serial",
  "smallint",
  "smallserial",
  "struct",
  "text",
  "time",
  "timestamp",
  "timestamptz",
  "tinyint",
  "tsquery",
  "tsvector",
  "uuid",
  "variant",
  "varchar",
  "xml",
];

const SQL_FUNCTIONS = [
  "abs",
  "avg",
  "cast",
  "ceil",
  "coalesce",
  "concat",
  "count",
  "array_agg",
  "date_part",
  "date_trunc",
  "dense_rank",
  "extract",
  "floor",
  "greatest",
  "json_agg",
  "jsonb_agg",
  "lag",
  "lead",
  "least",
  "lower",
  "max",
  "min",
  "now",
  "nullif",
  "rank",
  "round",
  "row_number",
  "string_agg",
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

const DOLLAR_STRING_STATE = "inDollarString";
const DOLLAR_STRING_OPEN = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/g;

const dollarStringPush: StatePushResolver = (
  _line,
  _position,
  _tokens,
  _stateStack,
  matched,
) => {
  const tag = matched.slice(1, -1);
  return `${DOLLAR_STRING_STATE}:${encodeURIComponent(tag)}`;
};

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
          pattern: /#[^\n]*/g,
          className: "nsh-comment",
          context: isSqlHashComment,
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
          name: "string",
          pattern: DOLLAR_STRING_OPEN,
          className: "nsh-string",
          push: dollarStringPush,
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
      [DOLLAR_STRING_STATE]: [
        {
          name: "string",
          pattern: /\$[A-Za-z_0-9]*\$/g,
          className: "nsh-string",
          pop: true,
          context: isDollarStringEnd,
        },
        {
          name: "string",
          pattern: /(?:(?!\$[A-Za-z_0-9]*\$).)+/g,
          className: "nsh-string",
        },
        { name: "string", pattern: /\$/g, className: "nsh-string" },
      ],
    };
  }
}

function isSqlHashComment(line: string, position: number): boolean {
  return line[position] === "#" && line.slice(0, position).trim() === "";
}

function isDollarStringEnd(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  const state = stateStack[stateStack.length - 1];
  const tag = decodeURIComponent(state.slice(state.lastIndexOf(":") + 1));
  const match = /^\$([A-Za-z_0-9]*)\$/.exec(line.slice(position));
  return match !== null && match[1] === tag;
}
