const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { defaultRegistry } = require("../dist/cjs/languages/Languages");

const ROOT = path.join(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "corpus-baseline.json");
const SAMPLES = readPositiveInteger("NSH_CORPUS_SAMPLES", 5);
const UPDATE = process.argv.includes("--update");

const EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".jsx",
  ".tsx",
  ".css",
  ".md",
  ".py",
  ".rs",
  ".go",
  ".sql",
  ".sh",
  ".scss",
  ".sass",
  ".html",
  ".json",
]);

const files = [
  ...collectFiles("src"),
  ...collectFiles("test"),
  ...collectFiles("scripts"),
  ...collectFiles("benchmark/corpus"),
  "README.md",
].sort();

const baseline = readBaseline();
const current = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  samples: SAMPLES,
  total: { files: 0, chars: 0, lines: 0, tokens: 0, medianMs: 0 },
  files: {},
};

console.log(
  JSON.stringify({
    benchmark: "nsh-real-corpus",
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    samples: SAMPLES,
    baseline: baseline ? baseline.generatedAt : "none",
  }),
);
console.log(
  "file\tlanguage\tlines\tchars\ttokens\ttoken ratio\tmedian ms\ttime ratio",
);

for (const relativePath of files) {
  const extension = path.extname(relativePath).toLowerCase();
  if (!EXTENSIONS.has(extension)) continue;
  const language = defaultRegistry.getLanguageByExtension(extension);
  if (!language) continue;

  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const tokenizer = new Tokenizer(language);
  tokenizer.tokenize("");
  tokenizer.tokenize(source);

  const times = [];
  let tokenCount = 0;
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    if (typeof global.gc === "function") global.gc();
    const start = performance.now();
    const tokens = tokenizer.tokenize(source);
    times.push(performance.now() - start);
    tokenCount = tokens.length;
  }

  const sorted = times.sort((left, right) => left - right);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  const lines = source.split("\n").length;
  const reference = baseline?.files[relativePath];
  const tokenRatio = reference?.tokens ? tokenCount / reference.tokens : NaN;
  const timeRatio = reference?.medianMs ? median / reference.medianMs : NaN;

  current.files[relativePath] = {
    language: language.name,
    lines,
    chars: source.length,
    tokens: tokenCount,
    medianMs: round(median),
  };
  current.total.files += 1;
  current.total.lines += lines;
  current.total.chars += source.length;
  current.total.tokens += tokenCount;
  current.total.medianMs += median;

  console.log(
    [
      relativePath,
      language.name,
      lines,
      source.length,
      tokenCount,
      Number.isFinite(tokenRatio) ? tokenRatio.toFixed(3) : "-",
      median.toFixed(2),
      Number.isFinite(timeRatio) ? timeRatio.toFixed(2) : "-",
    ].join("\t"),
  );
}

current.total.medianMs = round(current.total.medianMs);
console.log(
  [
    "TOTAL",
    "",
    current.total.lines,
    current.total.chars,
    current.total.tokens,
    baseline
      ? (current.total.tokens / baseline.total.tokens).toFixed(3)
      : "-",
    current.total.medianMs.toFixed(2),
    baseline
      ? (current.total.medianMs / baseline.total.medianMs).toFixed(2)
      : "-",
  ].join("\t"),
);
console.log(
  `corpus: ${current.total.files} files, ${current.total.lines} lines, ${current.total.chars} chars, ${current.total.tokens} tokens, cumulative median ${current.total.medianMs.toFixed(2)} ms`,
);

if (UPDATE) {
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`baseline updated: ${path.relative(ROOT, BASELINE_PATH)}`);
}

function collectFiles(directory) {
  const absoluteDirectory = path.join(ROOT, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(relativePath));
    } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      result.push(relativePath);
    }
  }
  return result;
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}
