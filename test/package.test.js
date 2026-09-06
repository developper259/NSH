const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

test("npm pack + install in a temp project exposes CJS, ESM, types and themes", { timeout: 120000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nsh-package-"));
  try {
    const packOutput = run("npm", ["pack", "--json"], ROOT);
    const packInfo = JSON.parse(packOutput);
    const tarball = path.join(ROOT, packInfo[0].filename);
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

    fs.rmSync(tarball, { force: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("GitHub-style install works via the prepare lifecycle", { timeout: 120000 }, (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nsh-git-"));
  const gitDir = path.join(tmp, "nsh-repo");
  try {
    fs.cpSync(ROOT, gitDir, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(ROOT, src);
        return !rel.startsWith("node_modules") && !rel.startsWith("dist") && !rel.startsWith(".");
      },
    });
    run("git", ["init", "-q"], gitDir);
    run("git", ["config", "user.email", "nsh-tests@example.invalid"], gitDir);
    run("git", ["config", "user.name", "NSH tests"], gitDir);
    run("git", ["add", "."], gitDir);
    run("git", ["commit", "-qm", "package test"], gitDir);

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
