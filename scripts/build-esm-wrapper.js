const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "..", "dist");
const cjsDir = path.join(distDir, "cjs");
const esmDir = path.join(distDir, "esm");

fs.mkdirSync(esmDir, { recursive: true });
fs.writeFileSync(
  path.join(esmDir, "package.json"),
  JSON.stringify({ type: "module" }, null, 2) + "\n",
);

function collectJsFiles(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectJsFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      result.push(path.relative(base, full));
    }
  }
  return result;
}

for (const relPath of collectJsFiles(cjsDir)) {
  const cjsPath = path.join(cjsDir, relPath);
  const esmPath = path.join(esmDir, relPath);
  fs.mkdirSync(path.dirname(esmPath), { recursive: true });

  const rel = "./" + path.relative(path.dirname(esmPath), cjsPath).replace(/\\/g, "/");
  let mod;
  try {
    mod = require(cjsPath);
  } catch (error) {
    console.warn(`Skipping ${relPath}: ${error.message}`);
    continue;
  }

  const keys = Object.keys(mod).filter((k) => k !== "__esModule" && k !== "default");
  const parts = [];
  if (keys.length > 0) {
    parts.push(`export { ${keys.join(", ")} } from ${JSON.stringify(rel)};`);
  }
  if (mod.default || keys.length === 0) {
    parts.push(`import mod from ${JSON.stringify(rel)};`);
    parts.push("export default mod;");
  }
  fs.writeFileSync(esmPath, parts.join("\n") + "\n");
}
