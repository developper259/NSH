const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32" && command === "npm",
    });
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : "";
    const stdout = error.stdout ? error.stdout.toString().trim() : "";
    if (stderr) error.message += `\nstderr:\n${stderr}`;
    if (stdout) error.message += `\nstdout:\n${stdout}`;
    throw error;
  }
}

test("npm pack + install in a temp project exposes CJS, ESM, types and themes", { timeout: 120000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nsh-package-"));
  let tarball;
  try {
    const packOutput = run("npm", ["pack", "--json", "--ignore-scripts"], ROOT);
    const packInfo = JSON.parse(packOutput);
    tarball = path.join(ROOT, packInfo[0].filename);
    assert.ok(fs.existsSync(tarball), "tarball was not created");

    run("npm", ["init", "-y"], tmp);
    run("npm", ["install", tarball, "--no-audit", "--no-fund"], tmp);

    const cjsMain = run("node", ["-e", `const nsh = require("nsh"); console.log(typeof nsh.Highlighter, typeof nsh.Tokenizer, typeof nsh.JavaScript, typeof nsh.IncrementalDocument);`], tmp);
    assert.match(cjsMain, /function function function function/);

    const cjsServer = run("node", ["-e", `const server = require("nsh/server"); console.log(typeof server.NSHServer);`], tmp);
    assert.match(cjsServer, /function/);

    const esmMain = run("node", ["--input-type=module", "-e", `const nsh = await import("nsh"); console.log(typeof nsh.Highlighter, typeof nsh.Tokenizer, typeof nsh.JavaScript);`], tmp);
    assert.match(esmMain, /function function function/);

    const esmServer = run("node", ["--input-type=module", "-e", `const srv = await import("nsh/server"); console.log(typeof srv.NSHServer);`], tmp);
    assert.match(esmServer, /function/);

    const nodeModules = path.join(tmp, "node_modules", "nsh");
    assert.ok(fs.existsSync(path.join(nodeModules, "dist", "types", "index.d.ts")), "index.d.ts missing");
    assert.ok(fs.existsSync(path.join(nodeModules, "dist", "types", "server.d.ts")), "server.d.ts missing");

    assert.ok(fs.existsSync(path.join(nodeModules, "dist", "themes", "dark.css")), "dark.css missing");
    assert.ok(fs.existsSync(path.join(nodeModules, "dist", "themes", "light.css")), "light.css missing");
    assert.ok(fs.existsSync(path.join(nodeModules, "src", "index.ts")), "source files missing");

    const declarationMap = JSON.parse(
      fs.readFileSync(path.join(nodeModules, "dist", "cjs", "index.js.map"), "utf8"),
    );
    assert.ok(
      declarationMap.sources.some((source) => source.includes("src/index.ts")),
      "source map does not reference the shipped source",
    );
    const packageJson = JSON.parse(
      run("node", ["-e", "console.log(JSON.stringify(require('nsh/package.json')))"], tmp),
    );
    assert.equal(packageJson.name, "nsh");
    const serverTypes = fs.readFileSync(
      path.join(nodeModules, "dist", "types", "server.d.ts"),
      "utf8",
    );
    assert.match(serverTypes, /NSHServerOptions/);
  } finally {
    if (tarball) fs.rmSync(tarball, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("GitHub-style install works via the prepare lifecycle", { timeout: 120000 }, (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nsh-git-"));
  const gitDir = path.join(tmp, "nsh-repo");
  try {
    copyRepositoryFiles(gitDir);
    run("git", ["init", "-q"], gitDir);
    run("git", ["add", "."], gitDir);
    assert.notEqual(
      run("git", ["status", "--porcelain=v1"], gitDir).trim(),
      "",
      "copied repository has no files to commit",
    );
    try {
      run(
        "git",
        [
          "-c",
          "user.email=nsh-tests@example.invalid",
          "-c",
          "user.name=NSH tests",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "-qm",
          "package test",
        ],
        gitDir,
      );
    } catch (error) {
      const status = run("git", ["status", "--porcelain=v1"], gitDir);
      error.message += `\ngit status:\n${status}`;
      throw error;
    }

    const consumer = path.join(tmp, "consumer");
    fs.mkdirSync(consumer, { recursive: true });
    run("npm", ["init", "-y"], consumer);
    run("npm", ["install", `git+file://${gitDir}#HEAD`, "--no-audit", "--no-fund"], consumer);
    const out = run("node", ["-e", `const nsh = require("nsh"); console.log(typeof nsh.Highlighter);`], consumer);
    assert.match(out, /function/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function copyRepositoryFiles(destination) {
  const entries = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.cjs.json",
    "tsconfig.types.json",
    "scripts",
    "src",
    "README.md",
    "LICENSE",
  ];
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) {
    const source = path.join(ROOT, entry);
    if (!fs.existsSync(source)) continue;
    const target = path.join(destination, entry);
    if (fs.statSync(source).isDirectory()) {
      fs.cpSync(source, target, { recursive: true });
    } else {
      fs.copyFileSync(source, target);
    }
  }
}
