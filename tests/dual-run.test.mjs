/**
 * Pack ↔ page consistency for the finance-tech expressions.
 * (P1 dual-run against v0.3.0 closures was retired in P6 with the golden freeze.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evalDerived } from "../src/expr.mjs";
import { loadCurrent } from "../tools/load-page.mjs";
import {
  PINNED_NOW,
  boundarySweep,
  documentedFixtures,
  malformedSets,
  seededRandom,
} from "../tools/corpus.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pack = JSON.parse(
  fs.readFileSync(path.join(root, "packs/finance-tech.json"), "utf8"),
);
const current = loadCurrent({ now: PINNED_NOW });
const cases = [
  ...documentedFixtures(),
  ...boundarySweep(),
  ...seededRandom(2_000, 0x5dd5e1ec, current),
  ...malformedSets(),
];

function hostJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function ruleWhens(rules) {
  return rules.map((rule) => ({ id: rule.id, when: rule.when }));
}

test("inlined page expressions match the finance-tech pack", () => {
  assert.deepEqual(hostJson(current.DERIVED_DEFS), pack.derived);
  assert.deepEqual(
    hostJson(ruleWhens(Array.from(current.BASE_RULES))),
    ruleWhens(pack.baseRules),
  );
  assert.deepEqual(
    hostJson(ruleWhens(Array.from(current.OVERLAYS))),
    ruleWhens(pack.overlays),
  );
  assert.deepEqual(
    hostJson(ruleWhens(Array.from(current.CAUTIONS))),
    ruleWhens(pack.cautions),
  );
});

test("current derive is total over the corpus", () => {
  for (const { name, answers } of cases) {
    assert.doesNotThrow(
      () => current.derive(answers),
      `${name}: current derive must not throw`,
    );
  }
});

test("source evalDerived table matches the inlined page", () => {
  for (const { name, answers } of cases.slice(0, 500)) {
    assert.deepEqual(
      evalDerived(pack.derived, answers, hostJson(current.FIELD_INDEX)),
      hostJson(current.derive(answers)),
      name,
    );
  }
});
