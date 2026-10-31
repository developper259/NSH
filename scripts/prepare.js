const { spawnSync } = require("node:child_process");
const path = require("node:path");

let typescriptAvailable = true;
try {
  require.resolve("typescript");
} catch {
  typescriptAvailable = false;
}

if (!typescriptAvailable) {
  console.warn("TypeScript is not installed; skipping the NSH build.");
  process.exit(0);
}

const root = path.join(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
