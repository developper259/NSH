const ASCII_LIMIT = 128;

/**
 * Derives the set of possible first characters of a consuming match.
 *
 * Returns `null` when the first character cannot be proven to be ASCII-only.
 * A `null` result means "always test this rule", which preserves correctness.
 * The parser is deliberately conservative: groups, alternations, optional
 * leading atoms, case-insensitive patterns and Unicode classes are not indexed.
 */
const firstCharacterCache = new WeakMap<RegExp, Uint8Array | null>();

export function deriveFirstCharacters(pattern: RegExp): Uint8Array | null {
  if (firstCharacterCache.has(pattern)) {
    return firstCharacterCache.get(pattern) ?? null;
  }
  const result = deriveFirstCharactersUncached(pattern);
  firstCharacterCache.set(pattern, result);
  return result;
}

function deriveFirstCharactersUncached(pattern: RegExp): Uint8Array | null {
  if (pattern.flags.includes("i") || pattern.flags.includes("v")) {
    return null;
  }

  const source = pattern.source;
  if (hasTopLevelAlternation(source)) return null;

  let index = 0;

  while (index < source.length) {
    if (source[index] === "^") {
      index += 1;
      continue;
    }
    if (
      source.startsWith("\\b", index) ||
      source.startsWith("\\B", index)
    ) {
      index += 2;
      continue;
    }
    const lookaroundEnd = findLookaroundEnd(source, index);
    if (lookaroundEnd === -1) return null;
    if (lookaroundEnd > index) {
      index = lookaroundEnd;
      continue;
    }
    break;
  }

  if (index >= source.length) return null;
  const first = source[index];
  if (first === "(" || first === "|" || first === ")" || first === "$") {
    return null;
  }

  let set: Uint8Array;
  let end: number;

  if (first === "\\") {
    const escape = parseEscape(source, index);
    if (!escape) return null;
    set = escape.set;
    end = escape.end;
  } else if (first === "[") {
    const classEnd = findClassEnd(source, index);
    if (classEnd < 0) return null;
    const classSet = characterClassSet(
      source.slice(index, classEnd + 1),
      pattern.flags,
    );
    if (!classSet) return null;
    set = classSet;
    end = classEnd + 1;
  } else if (
    first === "." ||
    first === "^" ||
    first === "?" ||
    first === "*" ||
    first === "+" ||
    first === "{" ||
    first === "}" ||
    first === "]"
  ) {
    return null;
  } else {
    const code = first.charCodeAt(0);
    if (code >= ASCII_LIMIT) return null;
    set = new Uint8Array(ASCII_LIMIT);
    set[code] = 1;
    end = index + 1;
  }

  const minimum = quantifierMinimum(source, end);
  if (minimum !== 1) return null;
  return set;
}

function parseEscape(
  source: string,
  index: number,
): { set: Uint8Array; end: number } | null {
  const code = source[index + 1];
  if (code === undefined) return null;
  if (code === "d") return { set: characterSet(codePointRanges([[48, 57]])), end: index + 2 };
  if (code === "w") {
    return {
      set: characterSet(codePointRanges([[48, 57], [65, 90], [95, 95], [97, 122]])),
      end: index + 2,
    };
  }
  if (code === "s" || code === "S" || code === "D" || code === "W") {
    return null;
  }
  if (code === "b" || code === "B" || code === "c" || code === "k") {
    return null;
  }
  if (code === "x") {
    const value = Number.parseInt(source.slice(index + 2, index + 4), 16);
    if (!Number.isFinite(value) || value >= ASCII_LIMIT) return null;
    return { set: characterSet([value]), end: index + 4 };
  }
  if (code === "u" || code === "p" || code === "P") return null;
  if (code >= "0" && code <= "9") return null;
  const value = code.charCodeAt(0);
  if (value >= ASCII_LIMIT) return null;
  return { set: characterSet([value]), end: index + 2 };
}

function characterClassSet(
  classSource: string,
  flags: string,
): Uint8Array | null {
  if (classSource[1] === "^") return null;
  for (let index = 1; index < classSource.length - 1; index += 1) {
    const character = classSource[index];
    if (character === "\\") {
      const escaped = classSource[index + 1];
      if (
        escaped === "s" ||
        escaped === "S" ||
        escaped === "D" ||
        escaped === "W" ||
        escaped === "p" ||
        escaped === "P" ||
        escaped === "u" ||
        escaped === "x" ||
        escaped === "c"
      ) {
        return null;
      }
      index += 1;
      continue;
    }
    if (character.charCodeAt(0) >= ASCII_LIMIT) return null;
  }

  let matcher: RegExp;
  try {
    matcher = new RegExp(
      `^(?:${classSource})`,
      flags.replace(/[gy]/g, ""),
    );
  } catch {
    return null;
  }

  const set = new Uint8Array(ASCII_LIMIT);
  let any = false;
  for (let code = 0; code < ASCII_LIMIT; code += 1) {
    if (matcher.test(String.fromCharCode(code))) {
      set[code] = 1;
      any = true;
    }
  }
  return any ? set : null;
}

function hasTopLevelAlternation(source: string): boolean {
  let depth = 0;
  let inClass = false;
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (character === "]") inClass = false;
      continue;
    }
    if (character === "[") {
      inClass = true;
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === "|" && depth === 0) {
      return true;
    }
  }
  return false;
}

function findLookaroundEnd(source: string, index: number): number {
  const prefixes = ["(?=", "(?!", "(?<=", "(?<!"];
  for (const prefix of prefixes) {
    if (source.startsWith(prefix, index)) {
      const end = findGroupEnd(source, index);
      return end < 0 ? -1 : end + 1;
    }
  }
  return index;
}

function findGroupEnd(source: string, start: number): number {
  let depth = 0;
  let inClass = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (character === "]") inClass = false;
      continue;
    }
    if (character === "[") {
      inClass = true;
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function findClassEnd(source: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "]") return index;
  }
  return -1;
}

function quantifierMinimum(source: string, index: number): number {
  if (index >= source.length) return 1;
  const character = source[index];
  if (character === "?") return 0;
  if (character === "*") return 0;
  if (character === "+") return 1;
  if (character === "{") {
    const match = /^\{(\d+)(?:,\d*)?\}/.exec(source.slice(index));
    if (!match) return 0;
    return Number(match[1]);
  }
  return 1;
}

function codePointRanges(ranges: Array<[number, number]>): number[] {
  const result: number[] = [];
  for (const [start, end] of ranges) {
    for (let code = start; code <= end; code += 1) result.push(code);
  }
  return result;
}

function characterSet(codes: number[]): Uint8Array {
  const set = new Uint8Array(ASCII_LIMIT);
  for (const code of codes) {
    if (code < ASCII_LIMIT) set[code] = 1;
  }
  return set;
}
