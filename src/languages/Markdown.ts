import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";
import { createEmbeddedStates } from "../utils/EmbedLanguage";
import { JavaScript } from "./JavaScript";
import { TypeScript } from "./TypeScript";
import { JSX } from "./JSX";
import { TSX } from "./TSX";
import { Python } from "./Python";
import { HTML } from "./HTML";
import { CSS } from "./CSS";
import { JSON as JSONLanguage } from "./JSON";
import { YAML } from "./YAML";
import { Bash } from "./Bash";
import { SQL } from "./SQL";
import { Rust } from "./Rust";
import { Go } from "./Go";
import { SCSS } from "./SCSS";
import { Sass } from "./Sass";

const CODE_FENCE_STATE = "inCodeFence";
const FENCE_PATTERN = /(`{3,}|~{3,})(.*)$/g;
const FENCE_MARKER = /^(`{3,}|~{3,})/;
const FENCE_PREFIX =
  /^(?:(?: {0,3}>[ \t]?)|(?: {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+)|\s)*$/;
const BLOCKQUOTE_PREFIX = /^(?: {0,3}>[ \t]?)+/g;

const QUOTED_BLOCKQUOTE_PREFIX: TokenType = {
  name: "blockquote",
  pattern: BLOCKQUOTE_PREFIX,
  className: "nsh-comment",
  context: isQuotedFencePrefix,
};

interface EmbeddedLanguage {
  language: LanguageDefinition;
  prefix: string;
  aliases: string[];
}

const EMBEDDED_LANGUAGES: EmbeddedLanguage[] = [
  { language: new JavaScript(), prefix: "md_js_", aliases: ["javascript", "js", "mjs"] },
  { language: new TypeScript(), prefix: "md_ts_", aliases: ["typescript", "ts"] },
  { language: new JSX(), prefix: "md_jsx_", aliases: ["jsx"] },
  { language: new TSX(), prefix: "md_tsx_", aliases: ["tsx"] },
  { language: new Python(), prefix: "md_py_", aliases: ["python", "py"] },
  { language: new HTML(), prefix: "md_html_", aliases: ["html", "htm"] },
  { language: new CSS(), prefix: "md_css_", aliases: ["css"] },
  { language: new JSONLanguage(), prefix: "md_json_", aliases: ["json"] },
  { language: new YAML(), prefix: "md_yaml_", aliases: ["yaml", "yml"] },
  { language: new Bash(), prefix: "md_sh_", aliases: ["bash", "sh", "shell", "zsh"] },
  { language: new SQL(), prefix: "md_sql_", aliases: ["sql"] },
  { language: new Rust(), prefix: "md_rs_", aliases: ["rust", "rs"] },
  { language: new Go(), prefix: "md_go_", aliases: ["go", "golang"] },
  { language: new SCSS(), prefix: "md_scss_", aliases: ["scss"] },
  { language: new Sass(), prefix: "md_sass_", aliases: ["sass"] },
];

const EMBEDDED_PREFIX_BY_NAME = new Map<string, string>();
for (const entry of EMBEDDED_LANGUAGES) {
  for (const name of entry.aliases) {
    EMBEDDED_PREFIX_BY_NAME.set(name, entry.prefix);
  }
}

const fencePush: StatePushResolver = (
  line,
  position,
  _tokens,
  _stateStack,
  matched,
) => {
  const markerMatch = FENCE_MARKER.exec(matched);
  const marker = markerMatch?.[1] ?? "```";
  const info = markerMatch
    ? matched.slice(markerMatch[0].length).trim().toLowerCase()
    : "";
  const languageName = info.split(/\s+/)[0];
  const prefix = EMBEDDED_PREFIX_BY_NAME.get(languageName);
  const quoted = line.slice(0, position).includes(">") ? "|q" : "";
  const state = prefix ? `${prefix}root` : CODE_FENCE_STATE;
  return `${state}:${encodeURIComponent(marker)}${quoted}`;
};

let markdownStates: Record<string, TokenType[]> | null = null;

export class Markdown implements LanguageDefinition {
  name = "markdown";
  extensions = [".md", ".markdown"];
  aliases = ["md"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    if (markdownStates) return markdownStates;

    const embeddedStates: Record<string, TokenType[]> = {};
    for (const entry of EMBEDDED_LANGUAGES) {
      const states = createEmbeddedStates({
        language: entry.language,
        exitRule: {
          name: "code-fence-end",
          pattern: createFenceClosePattern(),
          className: "nsh-string",
          context: makeFenceEndContext(entry.prefix),
        },
        prefix: entry.prefix,
        exitMode: "parent",
      });
      for (const rules of Object.values(states)) {
        rules.splice(1, 0, QUOTED_BLOCKQUOTE_PREFIX);
      }
      Object.assign(embeddedStates, states);
    }

    markdownStates = {
      root: [
        {
          name: "code-fence",
          pattern: FENCE_PATTERN,
          className: "nsh-string",
          context: isFenceStart,
          push: fencePush,
        },
        {
          name: "heading",
          pattern: /^#{1,6}\s+.*$/g,
          className: "nsh-keyword",
        },
        {
          name: "separator",
          pattern: /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/g,
          className: "nsh-operator",
        },
        {
          name: "table-separator",
          pattern: /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/g,
          className: "nsh-operator",
        },
        {
          name: "blockquote",
          pattern: /^\s{0,3}(?:>\s?)+/g,
          className: "nsh-comment",
        },
        {
          name: "list-marker",
          pattern: /^\s*(?:[-*+]|\d{1,9}[.)])\s+/g,
          className: "nsh-operator",
        },
        {
          name: "image",
          pattern: /!\[[^\]\n]*\]\([^)\n]*\)/g,
          className: "nsh-function",
        },
        {
          name: "link",
          pattern: /\[[^\]\n]*\]\([^)\n]*\)/g,
          className: "nsh-function",
        },
        {
          name: "inline-code",
          pattern: /`[^`\n]+`/g,
          className: "nsh-string",
        },
        {
          name: "bold",
          pattern: /\*\*(?=\S)[^\n]*?(?<=\S)\*\*/g,
          className: "nsh-keyword",
        },
        {
          name: "bold",
          pattern: /(?<![\w_])__(?=\S)[^\n]*?(?<=\S)__(?![\w_])/g,
          className: "nsh-keyword",
        },
        {
          name: "italic",
          pattern: /\*(?=\S)[^*\n]*?(?<=\S)\*/g,
          className: "nsh-type",
        },
        {
          name: "italic",
          pattern: /(?<![\w_])_(?=\S)[^_\n]*?(?<=\S)_(?![\w_])/g,
          className: "nsh-type",
        },
        {
          name: "tag",
          pattern: /<\/?[A-Za-z][^>\n]*>/g,
          className: "nsh-keyword",
        },
        {
          name: "table-delimiter",
          pattern: /\|/g,
          className: "nsh-operator",
        },
        {
          name: "escape",
          pattern: /\\[\\`*_{}\[\]()#+.!>-]/g,
          className: "nsh-operator",
        },
      ],
      [CODE_FENCE_STATE]: [
        {
          name: "code-fence-end",
          pattern: createFenceClosePattern(),
          className: "nsh-string",
          pop: true,
          context: isFenceEnd,
        },
        QUOTED_BLOCKQUOTE_PREFIX,
        {
          name: "code-block",
          pattern: /.+/g,
          className: "nsh-string",
        },
      ],
      ...embeddedStates,
    };
    return markdownStates;
  }
}

function createFenceClosePattern(): RegExp {
  return /^(?: {0,3}>[ \t]?)*\s*(`{3,}|~{3,})\s*$/g;
}

function makeFenceEndContext(prefix: string) {
  return (
    line: string,
    position: number,
    _tokens: Token[],
    stateStack: string[],
  ): boolean => {
    if (position !== 0) return false;
    const markerState = findEmbeddedRootState(stateStack, prefix);
    if (!markerState) return false;
    const opening = parseFenceState(markerState);
    return isClosingFence(line, opening.marker, opening.quoted);
  };
}

function findEmbeddedRootState(
  stateStack: string[],
  prefix: string,
): string | undefined {
  const exact = `${prefix}root`;
  const parameterized = `${prefix}root:`;
  for (let index = stateStack.length - 1; index >= 0; index -= 1) {
    const state = stateStack[index];
    if (state === exact || state.startsWith(parameterized)) return state;
  }
  return undefined;
}

function isFenceStart(
  line: string,
  position: number,
): boolean {
  if (line[position] !== "`" && line[position] !== "~") return false;
  return FENCE_PREFIX.test(line.slice(0, position));
}

function isQuotedFencePrefix(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (position !== 0 || line[position] !== ">") return false;
  return stateStack.some((state) => state.includes("|q"));
}

function isFenceEnd(
  line: string,
  position: number,
  _tokens: unknown[],
  stateStack: string[],
): boolean {
  if (position !== 0) return false;

  const state = stateStack[stateStack.length - 1];
  const opening = parseFenceState(state);
  return isClosingFence(line, opening.marker, opening.quoted);
}

function parseFenceState(state: string): { marker: string; quoted: boolean } {
  const raw = state.slice(state.lastIndexOf(":") + 1);
  const [encodedMarker, flag] = raw.split("|");
  return {
    marker: decodeURIComponent(encodedMarker ?? ""),
    quoted: flag === "q",
  };
}

function isClosingFence(
  line: string,
  opening: string,
  quoted: boolean,
): boolean {
  const prefix = quoted ? /^(?: {0,3}>[ \t]?)*\s*/ : /^\s*/;
  const prefixMatch = prefix.exec(line);
  if (!prefixMatch) return false;
  const match = /^(`{3,}|~{3,})\s*$/.exec(
    line.slice(prefixMatch[0].length),
  );
  if (!match) return false;
  return match[1][0] === opening[0] && match[1].length >= opening.length;
}
