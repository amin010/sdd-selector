/**
 * Recompute fixture.expect from the built engine after a selection-model change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCurrent } from "./load-page.mjs";
import { PINNED_NOW } from "./corpus.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packPath = path.join(root, "packs", "finance-tech.json");

const api = loadCurrent({ now: PINNED_NOW });
const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));

for (const fx of pack.fixtures || []) {
  const result = api.evaluate(fx.answers || {}, null, PINNED_NOW);
  const base = result.noRuntimeMatch ? null : (result.base && result.base.rule && result.base.rule.adopt
    ? result.base.rule.adopt.framework
    : null);
  const overlays = (result.overlays || []).map((o) => o.rule.id).sort();
  const overlaysIncludedInBase = (result.overlays || [])
    .filter((o) => o.includedInBase)
    .map((o) => o.rule.id)
    .sort();
  const cautions = (result.cautions || []).map((c) => c.rule.id).sort();
  const runnerUp = result.runnerUp && result.runnerUp.rule ? result.runnerUp.rule.id : undefined;
  fx.expect = {
    ...(fx.expect || {}),
    base,
    overlays,
    overlaysIncludedInBase,
    cautions,
    noRuntimeMatch: !!result.noRuntimeMatch,
  };
  if (runnerUp) fx.expect.runnerUp = runnerUp;
  else delete fx.expect.runnerUp;
}

fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`refreshed expect on ${pack.fixtures.length} fixtures`);
