/**
 * Build pipeline (EXT-CONFIG §13): validate pack → inline pack + src/expr.mjs into HTML.
 *
 * Usage:
 *   node tools/build.mjs [--pack packs/finance-tech.json] [--out index.html] [--strip-fixtures]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePack } from "./validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "index.html");
const exprPath = path.join(root, "src", "expr.mjs");
const defaultPack = path.join(root, "packs", "finance-tech.json");

const EXPR_BEGIN = "/* BEGIN EXPR */";
const EXPR_END = "/* END EXPR */";
const SELECT_BEGIN = "/* BEGIN SELECT */";
const SELECT_END = "/* END SELECT */";
const PACK_BEGIN = "/* BEGIN PACK */";
const PACK_END = "/* END PACK */";
const selectPath = path.join(root, "src", "select.mjs");

function parseArgs(argv) {
  let packPath = defaultPack;
  let outPath = templatePath;
  let stripFixtures = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--strip-fixtures") stripFixtures = true;
    else if (arg === "--pack") {
      packPath = path.resolve(argv[++i] || "");
    } else if (arg.startsWith("--pack=")) {
      packPath = path.resolve(arg.slice("--pack=".length));
    } else if (arg === "--out") {
      outPath = path.resolve(argv[++i] || "");
    } else if (arg.startsWith("--out=")) {
      outPath = path.resolve(arg.slice("--out=".length));
    } else if (arg === "--help" || arg === "-h") {
      console.log("usage: node tools/build.mjs [--pack path] [--out path] [--strip-fixtures]");
      process.exit(0);
    }
  }
  return { packPath, outPath, stripFixtures };
}

function replaceMarkerBlock(page, begin, end, body) {
  const beginEsc = begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const endEsc = end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(\\s*${beginEsc}\\s*\\n)[\\s\\S]*?(\\n\\s*${endEsc})`,
  );
  if (!pattern.test(page)) {
    throw new Error(`index.html is missing markers ${begin} … ${end}`);
  }
  const indented = body.split("\n").map((line) => (line.length ? `  ${line}` : line)).join("\n");
  return page.replace(pattern, `$1${indented}$2`);
}

function inlineModule(page, filePath, begin, end, globalName, required) {
  const source = fs.readFileSync(filePath, "utf8");
  const exports = Array.from(
    source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm),
    (match) => match[1],
  );
  for (const name of required) {
    if (!exports.includes(name)) {
      throw new Error(`${filePath} must export ${name}`);
    }
  }
  const script = source
    .replace(/^export\s+/gm, "")
    .replace(/\bconst\b/g, "var")
    .replace(/\blet\b/g, "var")
    .trimEnd();
  const body = `${script}\n\nvar ${globalName} = { ${exports.join(", ")} };`;
  return replaceMarkerBlock(page, begin, end, body);
}

function inlineExpr(page) {
  return inlineModule(page, exprPath, EXPR_BEGIN, EXPR_END, "SDDExpr", ["evalExpr", "evalDerived"]);
}

function inlineSelect(page) {
  return inlineModule(page, selectPath, SELECT_BEGIN, SELECT_END, "SDDSelect", ["selectUtility", "ramp"]);
}

function inlinePack(page, pack, stripFixtures) {
  const payload = stripFixtures ? { ...pack, fixtures: [] } : pack;
  const json = JSON.stringify(payload);
  const body = `var PACK = ${json};`;
  return replaceMarkerBlock(page, PACK_BEGIN, PACK_END, body);
}

function main() {
  const { packPath, outPath, stripFixtures } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(packPath)) {
    console.error(`pack not found: ${packPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(packPath, "utf8");
  let pack;
  try {
    pack = JSON.parse(raw);
  } catch (error) {
    console.error(`E-PACK-002 $ Malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const diagnostics = validatePack(pack);
  const errors = diagnostics.filter((d) => d.severity === "error");
  for (const item of diagnostics) {
    console.log(`${item.severity} ${item.code} ${item.path}: ${item.message}`);
  }
  if (errors.length) {
    console.error(`build refused: ${errors.length} validation error(s)`);
    process.exit(1);
  }

  // Always read the on-disk index.html as the template (finance-tech or prior build).
  let page = fs.readFileSync(templatePath, "utf8");
  if (!page.includes(PACK_BEGIN) || !page.includes(PACK_END)) {
    throw new Error("index.html is missing BEGIN/END PACK markers");
  }
  if (!page.includes(SELECT_BEGIN) || !page.includes(SELECT_END)) {
    throw new Error("index.html is missing BEGIN/END SELECT markers");
  }
  page = inlineExpr(page);
  page = inlineSelect(page);
  page = inlinePack(page, pack, stripFixtures);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, page);

  const bytes = Buffer.byteLength(page, "utf8");
  const fixtureCount = Array.isArray(pack.fixtures) ? pack.fixtures.length : 0;
  console.log(
    `built ${path.relative(root, outPath)} from ${path.relative(root, packPath)}` +
    ` (${bytes} bytes` +
    (stripFixtures ? `, fixtures stripped; source had ${fixtureCount}` : `, ${fixtureCount} fixtures`) +
    ")",
  );
  if (stripFixtures && bytes > 150 * 1024) {
    console.warn(`warning: release build is ${bytes} bytes (>150 KB)`);
  }
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();

export { inlineExpr, inlinePack, PACK_BEGIN, PACK_END, EXPR_BEGIN, EXPR_END };
