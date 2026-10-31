const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let typescriptAvailable = true;
try {
  require.resolve("typescript");
} catch {
  typescriptAvailable = false;
}

if (!typescriptAvailable) {
  const builtEntry = path.join(__dirname, "..", "dist", "cjs", "index.js");
  if (fs.existsSync(builtEntry)) {
    console.warn("TypeScript is not installed; using the existing dist build.");
    process.exit(0);
  }
  console.error(
    "TypeScript is required to build NSH from source. Install dev dependencies or use the published package.",
  );
  process.exit(1);
}

const root = path.join(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
