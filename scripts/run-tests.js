const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const files = fs
  .readdirSync(path.join(root, "test"))
  .filter((file) => file.endsWith(".test.js"))
  .sort()
  .map((file) => path.join("test", file));

if (files.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

// Test files run sequentially: packaging tests spawn npm and may rebuild dist,
// so running them concurrently with tests that spawn Workers is racy.
const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...files],
  {
    cwd: root,
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
