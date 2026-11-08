import { LanguageDefinition } from "../types/language";
import { StatePushResolver, TokenType } from "../types/token";

const CODE_FENCE_STATE = "inCodeFence";
const FENCE_PATTERN = /^\s*(`{3,}|~{3,})(.*)$/g;
const FENCE_MARKER = /^\s*(`{3,}|~{3,})/;

const fencePush: StatePushResolver = (
  _line,
  _position,
  _tokens,
  _stateStack,
  matched,
) => {
  const marker = FENCE_MARKER.exec(matched)?.[1] ?? "```";
  return `${CODE_FENCE_STATE}:${encodeURIComponent(marker)}`;
};

export class Markdown implements LanguageDefinition {
  name = "markdown";
  extensions = [".md", ".markdown"];
  aliases = ["md"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "code-fence",
          pattern: FENCE_PATTERN,
          className: "nsh-string",
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
          pattern: /^\s{0,3}>\s?/g,
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
          pattern: /^\s*(`{3,}|~{3,})\s*$/g,
          className: "nsh-string",
          pop: true,
          context: isFenceEnd,
        },
        {
          name: "code-block",
          pattern: /.+/g,
          className: "nsh-string",
        },
      ],
    };
  }
}

function isFenceEnd(
  line: string,
  position: number,
  _tokens: unknown[],
  stateStack: string[],
): boolean {
  if (position !== 0) return false;

  const state = stateStack[stateStack.length - 1];
  const encodedMarker = state.slice(CODE_FENCE_STATE.length + 1);
  const opening = decodeURIComponent(encodedMarker);
  const match = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
  if (!match) return false;

  return match[1][0] === opening[0] && match[1].length >= opening.length;
}
