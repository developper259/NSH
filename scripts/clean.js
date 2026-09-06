const fs = require("node:fs");
const path = require("node:path");
const distPath = path.join(__dirname, "..", "dist");
try {
  fs.rmSync(distPath, { recursive: true, force: true });
} catch (error) {
  console.error("Failed to remove dist/:", error);
  process.exit(1);
}
