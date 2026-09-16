import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "src", "expr.mjs");
const pagePath = path.join(root, "index.html");
const begin = "/* BEGIN EXPR */";
const end = "/* END EXPR */";

const source = fs.readFileSync(sourcePath, "utf8");
const exports = Array.from(
  source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm),
  (match) => match[1],
);
if (!exports.includes("evalExpr") || !exports.includes("evalDerived")) {
  throw new Error("src/expr.mjs must export evalExpr and evalDerived");
}

const script = source
  .replace(/^export\s+/gm, "")
  .replace(/\bconst\b/g, "var")
  .replace(/\blet\b/g, "var")
  .trimEnd();
const body = `${script}\n\nvar SDDExpr = { ${exports.join(", ")} };`;
const indented = body.split("\n").map((line) => `  ${line}`).join("\n");

const page = fs.readFileSync(pagePath, "utf8");
const pattern = new RegExp(
  `(\\s*${begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n)[\\s\\S]*?(\\n\\s*${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
);
if (!pattern.test(page)) {
  throw new Error("index.html is missing BEGIN/END EXPR markers");
}
const next = page.replace(pattern, `$1${indented}$2`);
fs.writeFileSync(pagePath, next);
console.log(`inlined ${sourcePath} into ${pagePath}`);
