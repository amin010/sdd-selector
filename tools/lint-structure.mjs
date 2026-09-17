/**
 * Structural lint (EXT-CONFIG §16.4): outside the pack/data block, index.html
 * must not contain /\bq\d+_[a-z]/ or framework-id literals.
 *
 * At P0 the allowlist enumerates current offenders; later phases shrink it.
 * An empty allowlist is P5's exit criterion.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "index.html");
const ALLOWLIST_PATH = path.join(ROOT, "tools/lint-structure-allowlist.json");

const FRAMEWORK_IDS = [
  "openspec", "speckit", "bmad", "gsd", "superpowers",
  "agent_os", "spec_kitty", "ccpm",
];

/**
 * Extract "engine / UI code" region: everything after the data tables that
 * still hard-codes field names. For P0 we lint the whole script body and
 * allowlist every match — phases remove entries as hard-coding disappears.
 *
 * Pack block markers (added in P4):
 *   // BEGIN PACK
 *   // END PACK
 * Until those exist, the whole <script> is scanned.
 */
function scriptBody(html) {
  const m = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
  if (!m) throw new Error("no script body");
  return m[1];
}

function regionsToLint(script) {
  // Strip inlined pack JSON (either comment style) so field/framework ids inside
  // the pack do not inflate the allowlist.
  const markers = [
    ["/* BEGIN PACK */", "/* END PACK */"],
    ["// BEGIN PACK", "// END PACK"],
  ];
  for (const [beginMark, endMark] of markers) {
    const begin = script.indexOf(beginMark);
    const end = script.indexOf(endMark);
    if (begin !== -1 && end !== -1 && end > begin) {
      return script.slice(0, begin) + script.slice(end + endMark.length);
    }
  }
  return script;
}

function findOffenders(text) {
  const offenders = [];
  const qRe = /\bq\d+_[a-z0-9_]+\b/g;
  let m;
  while ((m = qRe.exec(text))) {
    offenders.push({ kind: "field", value: m[0], index: m.index });
  }
  for (const id of FRAMEWORK_IDS) {
    const re = new RegExp(`\\b${id}\\b`, "g");
    while ((m = re.exec(text))) {
      offenders.push({ kind: "framework", value: id, index: m.index });
    }
  }
  return offenders;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function main() {
  const html = fs.readFileSync(PAGE, "utf8");
  const script = scriptBody(html);
  const region = regionsToLint(script);
  const found = findOffenders(region);

  let allow = { fields: [], frameworks: [], notes: "" };
  if (fs.existsSync(ALLOWLIST_PATH)) {
    allow = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
  }

  const allowFields = new Set(allow.fields || []);
  const allowFw = new Set(allow.frameworks || []);

  const uniqueFields = [...new Set(found.filter((f) => f.kind === "field").map((f) => f.value))].sort();
  const uniqueFw = [...new Set(found.filter((f) => f.kind === "framework").map((f) => f.value))].sort();

  const unexpected = [];
  for (const f of uniqueFields) {
    if (!allowFields.has(f)) unexpected.push({ kind: "field", value: f });
  }
  for (const f of uniqueFw) {
    if (!allowFw.has(f)) unexpected.push({ kind: "framework", value: f });
  }

  const staleFields = [...allowFields].filter((f) => !uniqueFields.includes(f));
  const staleFw = [...allowFw].filter((f) => !uniqueFw.includes(f));

  if (process.argv.includes("--dump-allowlist")) {
    const dump = {
      notes: "Auto-generated P0 allowlist of current hard-coded identifiers. Shrink per phase.",
      fields: uniqueFields,
      frameworks: uniqueFw,
    };
    fs.writeFileSync(ALLOWLIST_PATH, JSON.stringify(dump, null, 2) + "\n");
    console.log(`wrote ${ALLOWLIST_PATH} (${uniqueFields.length} fields, ${uniqueFw.length} frameworks)`);
    return;
  }

  console.log(
    `structural lint: ${uniqueFields.length} field ids, ${uniqueFw.length} framework ids` +
    ` (allowlist fields=${allowFields.size} fw=${allowFw.size})`,
  );

  if (staleFields.length || staleFw.length) {
    console.warn("stale allowlist entries (safe to remove):", {
      fields: staleFields,
      frameworks: staleFw,
    });
  }

  if (unexpected.length) {
    console.error("unexpected hard-coded identifiers outside allowlist:");
    for (const u of unexpected) {
      const hit = found.find((f) => f.kind === u.kind && f.value === u.value);
      console.error(`  ${u.kind} ${u.value} (approx line ${lineOf(region, hit.index)})`);
    }
    process.exit(1);
  }

  if (allowFields.size === 0 && allowFw.size === 0) {
    console.log("structural lint OK — allowlist empty (CG1)");
  } else {
    console.log("structural lint OK — within allowlist");
  }
}

main();
