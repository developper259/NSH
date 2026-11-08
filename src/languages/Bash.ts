import { LanguageDefinition } from "../types/language";
import { StatePushResolver, Token, TokenType } from "../types/token";
import {
  createBuiltinList,
  createKeywordToken,
  createVariableToken,
} from "./shared";

const BASH_KEYWORDS = [
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "case",
  "esac",
  "for",
  "select",
  "while",
  "until",
  "do",
  "done",
  "function",
  "in",
  "time",
  "coproc",
];

const BASH_BUILTINS = [
  "alias",
  "autoload",
  "bg",
  "bind",
  "bindkey",
  "break",
  "builtin",
  "caller",
  "cd",
  "chdir",
  "compctl",
  "command",
  "compgen",
  "complete",
  "continue",
  "declare",
  "dirs",
  "disown",
  "echo",
  "emulate",
  "enable",
  "eval",
  "exec",
  "exit",
  "export",
  "false",
  "fc",
  "fg",
  "getopts",
  "hash",
  "help",
  "history",
  "jobs",
  "kill",
  "let",
  "local",
  "logout",
  "mapfile",
  "popd",
  "printf",
  "pushd",
  "print",
  "pwd",
  "read",
  "readarray",
  "readonly",
  "return",
  "set",
  "setopt",
  "shift",
  "shopt",
  "source",
  "suspend",
  "test",
  "times",
  "trap",
  "true",
  "type",
  "typeset",
  "ulimit",
  "umask",
  "unalias",
  "unset",
  "unsetopt",
  "wait",
  "whence",
  "where",
  "which",
  "zle",
  "zmodload",
  "zparseopts",
  "zregexparse",
  "zstat",
  "zstyle",
];

const VARIABLE_PATTERN =
  /\$(?:\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9@#?$!*-])/g;
const HEREDOC_PATTERN =
  /<<-?\s*(?:"([A-Za-z_][A-Za-z0-9_]*)"|'([A-Za-z_][A-Za-z0-9_]*)'|([A-Za-z_][A-Za-z0-9_]*))/g;

const heredocPush: StatePushResolver = (
  _line,
  _position,
  _tokens,
  _stateStack,
  matched,
) => {
  const delimiter = matched
    .replace(/^<<-?\s*/, "")
    .replace(/^["']|["']$/g, "");
  return `inHeredoc:${encodeURIComponent(delimiter)}`;
};

export class Bash implements LanguageDefinition {
  name = "bash";
  extensions = [".sh", ".bash", ".zsh"];
  aliases = ["sh", "shell", "zsh"];
  lineIndexSensitive = false;

  public getStates(): Record<string, TokenType[]> {
    return {
      root: [
        {
          name: "comment",
          pattern: /^#![^\n]*/g,
          className: "nsh-comment",
        },
        {
          name: "comment",
          pattern: /#[^\n]*/g,
          className: "nsh-comment",
          context: isShellCommentStart,
        },
        createKeywordToken(BASH_KEYWORDS),
        createBuiltinList(BASH_BUILTINS, "builtin"),
        {
          name: "string",
          pattern: HEREDOC_PATTERN,
          className: "nsh-string",
          push: heredocPush,
        },
        {
          name: "variable",
          pattern: /\$\(\((?:[^()]|\([^()]*\))*\)\)/g,
          className: "nsh-variable",
        },
        {
          name: "variable",
          pattern: /\$\((?:[^()]|\([^()]*\))*\)/g,
          className: "nsh-variable",
        },
        {
          name: "variable",
          pattern: VARIABLE_PATTERN,
          className: "nsh-variable",
        },
        {
          name: "string",
          pattern: /\$'(?:[^'\\]|\\.)*'/g,
          className: "nsh-string",
        },
        {
          name: "string",
          pattern: /\$"/g,
          className: "nsh-string",
          push: "inDoubleString",
        },
        {
          name: "string",
          pattern: /"/g,
          className: "nsh-string",
          push: "inDoubleString",
        },
        {
          name: "string",
          pattern: /'/g,
          className: "nsh-string",
          push: "inSingleString",
        },
        {
          name: "number",
          pattern: /\b\d+(?:\.\d+)?\b/g,
          className: "nsh-number",
        },
        {
          name: "function",
          pattern: /[A-Za-z_][A-Za-z0-9_-]*(?=\s*\(\s*\))/g,
          className: "nsh-function",
        },
        {
          name: "operator",
          pattern:
            /\[\[|\]\]|<\(|>\(|&&|\|\||;;|>>|<<|[|&;<>(){}[\]=!+\-*/%]/g,
          className: "nsh-operator",
        },
        createVariableToken(),
      ],
      inDoubleString: [
        {
          name: "string",
          pattern: /"/g,
          className: "nsh-string",
          pop: true,
        },
        { name: "string", pattern: /\\[\s\S]/g, className: "nsh-string" },
        {
          name: "variable",
          pattern: VARIABLE_PATTERN,
          className: "nsh-variable",
        },
        { name: "string", pattern: /[^"\\$]+/g, className: "nsh-string" },
      ],
      inSingleString: [
        {
          name: "string",
          pattern: /'/g,
          className: "nsh-string",
          pop: true,
        },
        { name: "string", pattern: /[^']+/g, className: "nsh-string" },
      ],
      inHeredoc: [
        {
          name: "string",
          pattern: /^[A-Za-z_][A-Za-z0-9_]*$/g,
          className: "nsh-string",
          pop: true,
          context: isHeredocTerminator,
        },
        { name: "string", pattern: /[^\n]+/g, className: "nsh-string" },
      ],
    };
  }
}

function isShellCommentStart(
  line: string,
  position: number,
): boolean {
  if (line[position] !== "#") return false;
  return position === 0 || /\s/.test(line[position - 1]);
}

function isHeredocTerminator(
  line: string,
  position: number,
  _tokens: Token[],
  stateStack: string[],
): boolean {
  if (position !== 0) return false;
  const state = stateStack[stateStack.length - 1];
  const encoded = state.slice(state.lastIndexOf(":") + 1);
  return line.trim() === decodeURIComponent(encoded);
}
