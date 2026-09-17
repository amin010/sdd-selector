/**
 * Load a built HTML page in the VM and run its pack fixtures / selftest.
 *
 * Usage:
 *   node tools/selftest-page.mjs [path/to/page.html]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, CURRENT_PAGE } from "./load-page.mjs";
import { PINNED_NOW } from "./corpus.mjs";

function main() {
  const target = path.resolve(process.argv[2] || CURRENT_PAGE);
  const api = loadPage(target, { now: PINNED_NOW });
  if (typeof api.runSelftest !== "function") {
    console.error("page has no runSelftest export");
    process.exit(2);
  }
  const out = api.runSelftest();
  if (!out.ok) {
    console.error(`selftest FAILED on ${target}`);
    for (const fail of out.fails || []) console.error(`  ${fail}`);
    process.exit(1);
  }
  console.log(`selftest OK on ${path.basename(target)} (${out.n} checks)`);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();
