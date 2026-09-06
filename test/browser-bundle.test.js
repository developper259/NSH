const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");

test("browser bundler can consume the public core entry point without Node server modules", async () => {
  const result = await esbuild.build({
    stdin: {
      contents: 'import { Tokenizer, Highlighter, JavaScript, IncrementalDocument } from "nsh"; new IncrementalDocument(new Tokenizer(new JavaScript())); new Highlighter(new JavaScript());',
      resolveDir: process.cwd(),
      sourcefile: "consumer.ts",
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    target: "es2020",
  });
  const output = result.outputFiles[0].text;
  assert.ok(output.length > 0);
  assert.doesNotMatch(output, /node:fs|node:path|from\s*["']ws["']/);
});
