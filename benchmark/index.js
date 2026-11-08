const { performance } = require("node:perf_hooks");
const os = require("node:os");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { IncrementalDocument } = require("../dist/cjs/core/IncrementalDocument");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");
const { TypeScript } = require("../dist/cjs/languages/TypeScript");
const { Python } = require("../dist/cjs/languages/Python");
const { HTML } = require("../dist/cjs/languages/HTML");
const { CSS } = require("../dist/cjs/languages/CSS");
const { JSON: JSONLanguage } = require("../dist/cjs/languages/JSON");
const { Markdown } = require("../dist/cjs/languages/Markdown");
const { CPP } = require("../dist/cjs/languages/CPP");
const { Bash } = require("../dist/cjs/languages/Bash");
const { SQL } = require("../dist/cjs/languages/SQL");
const { Rust } = require("../dist/cjs/languages/Rust");
const { Go } = require("../dist/cjs/languages/Go");
const { SCSS } = require("../dist/cjs/languages/SCSS");
const { Sass } = require("../dist/cjs/languages/Sass");
const packageJson = require("../package.json");

const SAMPLES = readInteger("NSH_BENCH_SAMPLES", 3, 1);
const WARMUP = readInteger("NSH_BENCH_WARMUP", 1, 0);
const MEMORY_AVAILABLE = typeof global.gc === "function";

const LANGUAGES = [
  {
    name: "javascript",
    language: new JavaScript(),
    lines: [
      "const value = 123.45;",
      "function add(a, b) { return a + b; }",
      "const re = /[a-z]+/g;",
      "const text = 'hello';",
    ],
  },
  {
    name: "typescript",
    language: new TypeScript(),
    lines: [
      "interface Item { id: number; name: string; }",
      "type Result<T> = { value: T };",
      "const value: number = 123.45;",
      "function add(a: number, b: number): number { return a + b; }",
    ],
  },
  {
    name: "python",
    language: new Python(),
    lines: [
      "x: int = 1",
      "def f(a: int) -> int:",
      "    return a + 1",
      'text = f"value {x}"',
    ],
  },
  {
    name: "html",
    language: new HTML(),
    lines: ['<div class="item">text content</div>', "<span>value</span>"],
  },
  {
    name: "css",
    language: new CSS(),
    lines: [".item { width: 50%; color: #fff; }"],
  },
  {
    name: "json",
    language: new JSONLanguage(),
    lines: ['{"id": 1, "name": "value", "active": true}'],
  },
  {
    name: "markdown",
    language: new Markdown(),
    lines: [
      "## Section",
      "Some **bold** text and `code`.",
      "- item",
      "| a | b |",
    ],
  },
  {
    name: "bash",
    language: new Bash(),
    lines: [
      "#!/usr/bin/env bash",
      'name="world"',
      'if [[ -n "$name" ]]; then',
      '  echo "hello $name"',
      "fi",
    ],
  },
  {
    name: "sql",
    language: new SQL(),
    lines: [
      "SELECT id, name FROM users;",
      "WHERE active = true;",
      "ORDER BY id DESC;",
    ],
  },
  {
    name: "rust",
    language: new Rust(),
    lines: [
      "fn main() {",
      "  let value = 42;",
      '  println!("{}", value);',
      "}",
    ],
  },
  {
    name: "go",
    language: new Go(),
    lines: ["package main", "func main() {", "  value := 42", "  _ = value", "}"],
  },
  {
    name: "scss",
    language: new SCSS(),
    lines: [
      "$primary: #333;",
      ".card {",
      "  color: $primary;",
      "  &:hover { color: red; }",
      "}",
    ],
  },
  {
    name: "sass",
    language: new Sass(),
    lines: [
      "$primary: #333",
      ".card",
      "  color: $primary",
      "  &:hover",
      "    color: red",
    ],
  },
];

const ALL_SIZES = [1000, 10000, 50000, 100000];
const SMALL_SIZES = [1000, 10000];
const INCREMENTAL_SIZES = [10000, 50000, 100000];
const FULL_SIZE_LANGUAGES = new Set(["javascript", "typescript"]);

printMetadata();

console.log("\n# Initial tokenization");
printHeader("metric", "language", "lines", "chars", "tokens", "median ms", "p95 ms");
for (const entry of LANGUAGES) {
  const sizes = FULL_SIZE_LANGUAGES.has(entry.name) ? ALL_SIZES : SMALL_SIZES;
  for (const size of sizes) {
    const source = buildDocument(entry.lines, size);
    const tokenizer = new Tokenizer(entry.language);
    tokenizer.tokenize("");
    const result = measure(
      () => tokenizer.tokenizeWithState(source),
      (tokens) => tokens.tokens.length,
      size >= 50000 ? 2 : SAMPLES,
    );
    printRow(
      "tokenize-initial",
      entry.name,
      size,
      source.length,
      result.value,
      result.median,
      result.p95,
    );
  }
}

console.log("\n# Incremental updates");
printHeader(
  "metric",
  "language",
  "lines",
  "chars",
  "tokens",
  "median ms",
  "p95 ms",
  "retokenized",
);
for (const entry of LANGUAGES) {
  if (!FULL_SIZE_LANGUAGES.has(entry.name)) continue;
  for (const size of INCREMENTAL_SIZES) {
    const source = buildDocument(entry.lines, size);
    for (const operation of ["edit-middle", "insert-start", "insert-end", "delete-start", "multiline"]) {
      const result = benchmarkIncrementalUpdate(
        entry.language,
        source,
        operation,
        size >= 50000 ? 2 : SAMPLES,
      );
      printRow(
        `incremental-${operation}`,
        entry.name,
        size,
        source.length,
        result.tokens,
        result.median,
        result.p95,
        result.retokenized,
      );
    }
  }
}

console.log("\n# Retrieval");
printHeader("metric", "language", "lines", "chars", "tokens", "median ms", "p95 ms");
{
  const source = buildDocument(LANGUAGES[0].lines, 100000);
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
  const middle = Math.floor(document.getLineCount() / 2);
  const line = measure(() => document.getLine(middle), (value) => value.tokens.length);
  printRow("getLine", "javascript", document.getLineCount(), source.length, line.value, line.median, line.p95);

  const range = measure(
    () => document.getLines(middle, middle + 100),
    (value) => value.length,
  );
  printRow("getLines-100", "javascript", document.getLineCount(), source.length, range.value, range.median, range.p95);

  const tokenRange = measure(
    () => document.getTokensForLines(middle, middle + 100),
    (value) => value.length,
  );
  printRow("getTokensForLines-100", "javascript", document.getLineCount(), source.length, tokenRange.value, tokenRange.median, tokenRange.p95);

  const all = measure(() => document.getTokens(), (value) => value.length, 2);
  printRow("getTokens-all", "javascript", document.getLineCount(), source.length, all.value, all.median, all.p95);
}

console.log("\n# HTML generation");
printHeader("metric", "language", "lines", "chars", "output chars/tokens", "median ms", "p95 ms");
for (const size of [10000, 100000]) {
  const source = buildDocument(LANGUAGES[0].lines, size);
  const highlighter = new Highlighter(new JavaScript());
  highlighter.getHTML("const warmup = 1;");

  const html = measure(
    () => highlighter.getHTML(source),
    (value) => value.length,
    size >= 50000 ? 2 : SAMPLES,
  );
  printRow("getHTML", "javascript", size, source.length, html.value, html.median, html.p95);

  if (size === 10000) {
    const both = measure(
      () => highlighter.highlight(source),
      (value) => value.tokens.length,
      SAMPLES,
    );
    printRow("highlight-tokens+html", "javascript", size, source.length, both.value, both.median, both.p95);
  }
}

{
  const highlighter = new Highlighter(new JavaScript());
  const lineResult = measure(
    () => {
      let finalState = ["root"];
      let tokens = 0;
      for (let index = 0; index < 1000; index += 1) {
        const result = highlighter.highlightLine("const value = 1;", finalState, index);
        finalState = result.finalState;
        tokens += result.tokens.length;
      }
      return tokens;
    },
    (value) => value,
  );
  printRow("highlightLine-1000", "javascript", 1000, 17000, lineResult.value, lineResult.median, lineResult.p95);
}

console.log("\n# Long single lines");
printHeader("metric", "language", "lines", "chars", "tokens", "median ms", "p95 ms");
const longLineCases = [
  ["typescript", new TypeScript(), "ts colons", "const a: T; ".repeat(10000)],
  ["typescript", new TypeScript(), "ts generics", "Array<Map<string, Array<number>>> ".repeat(8000)],
  ["python", new Python(), "python annotations", "a: int, ".repeat(12000)],
  ["cpp", new CPP(), "cpp angles", "a < b, ".repeat(15000)],
  ["javascript", new JavaScript(), "js symbols", "+".repeat(500000)],
  ["json", new JSONLanguage(), "json minified", '{"a":1,"b":[1,2,3]},'.repeat(25000)],
  ["html", new HTML(), "html text", "text ".repeat(100000)],
];
for (const [languageName, language, label, line] of longLineCases) {
  const tokenizer = new Tokenizer(language);
  tokenizer.tokenize("");
  const result = measure(
    () => tokenizer.tokenize(line),
    (tokens) => tokens.length,
    SAMPLES,
  );
  printRow(`long-${label}`, languageName, 1, line.length, result.value, result.median, result.p95);
}

console.log("\n# Memory (document construction, GC required)");
if (MEMORY_AVAILABLE) {
  printHeader("metric", "language", "lines", "chars", "tokens", "heap delta", "bytes/char");
  for (const size of [10000, 50000, 100000]) {
    const source = buildDocument(LANGUAGES[0].lines, size);
    global.gc();
    const before = process.memoryUsage().heapUsed;
    const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
    global.gc();
    const after = process.memoryUsage().heapUsed;
    const tokenCount = document.getTokens().length;
    const megabytes = (after - before) / (1024 * 1024);
    const characters = source.length;
    console.log(
      `memory-document\tjavascript\t${size}\t${characters}\t${tokenCount}\t${megabytes.toFixed(2)} MB\t${((after - before) / characters).toFixed(2)}`,
    );
  }
} else {
  console.log("unavailable: run `node --expose-gc benchmark/index.js` to measure heap usage");
}

function benchmarkIncrementalUpdate(language, source, operation, samples) {
  const document = new IncrementalDocument(new Tokenizer(language), source);
  const lineCount = document.getLineCount();
  const middle = Math.floor(lineCount / 2);
  const originalMiddle = document.getLine(middle).text;
  const originalFirst = document.getLine(0).text;

  const apply = () => {
    if (operation === "edit-middle") {
      return document.updateLines(middle, 1, ["const changed = 1;"]);
    }
    if (operation === "insert-start") {
      return document.updateLines(0, 0, ["const inserted = 1;"]);
    }
    if (operation === "insert-end") {
      return document.updateLines(lineCount, 0, ["const appended = 1;"]);
    }
    if (operation === "delete-start") {
      return document.updateLines(0, 1, []);
    }
    return document.updateLines(middle, 1, ["/* open"]);
  };

  const revert = () => {
    if (operation === "edit-middle" || operation === "multiline") {
      document.updateLines(middle, 1, [originalMiddle]);
    } else if (operation === "insert-start") {
      document.updateLines(0, 1, []);
    } else if (operation === "insert-end") {
      document.updateLines(lineCount, 1, []);
    } else if (operation === "delete-start") {
      document.updateLines(0, 0, [originalFirst]);
    }
  };

  apply();
  revert();

  const times = [];
  const retokenized = [];
  let tokens = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    forceGc();
    const start = performance.now();
    const update = apply();
    times.push(performance.now() - start);
    retokenized.push(update.retokenizedLines);
    revert();
  }
  tokens = document.getTokens().length;

  const sorted = times.slice().sort((left, right) => left - right);
  const retokenizedSorted = retokenized.slice().sort((left, right) => left - right);
  return {
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    retokenized: retokenizedSorted[Math.floor(retokenizedSorted.length / 2)],
    tokens,
  };
}

function measure(operation, valueOf, samples = SAMPLES) {
  forceGc();
  for (let index = 0; index < WARMUP; index += 1) {
    valueOf(operation());
  }
  const times = [];
  let value = 0;
  for (let index = 0; index < samples; index += 1) {
    forceGc();
    const start = performance.now();
    const result = operation();
    times.push(performance.now() - start);
    value = valueOf(result);
  }
  const sorted = times.slice().sort((left, right) => left - right);
  return {
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    value,
  };
}

function forceGc() {
  if (typeof global.gc === "function") global.gc();
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * fraction) - 1,
  );
  return sorted[Math.max(0, index)];
}

function buildDocument(lines, size) {
  const output = [];
  for (let index = 0; index < size; index += 1) {
    output.push(lines[index % lines.length]);
  }
  return output.join("\n");
}

function printMetadata() {
  console.log("# NSH benchmark");
  console.log(
    JSON.stringify({
      nsh: packageJson.version,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      samples: SAMPLES,
      warmup: WARMUP,
      memoryMeasurement: MEMORY_AVAILABLE ? "heapUsed delta after GC" : "unavailable",
      date: new Date().toISOString(),
    }),
  );
}

function printHeader(...columns) {
  console.log(columns.join("\t"));
}

function printRow(...columns) {
  console.log(
    columns
      .map((column) =>
        typeof column === "number"
          ? Number.isInteger(column)
            ? String(column)
            : column.toFixed(2)
          : String(column),
      )
      .join("\t"),
  );
}

function readInteger(name, fallback, minimum) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}
