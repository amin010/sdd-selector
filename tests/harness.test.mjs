import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGolden, loadCurrent, GOLDEN_V030, CURRENT_PAGE } from "../tools/load-page.mjs";
import {
  PINNED_NOW,
  documentedFixtures,
  boundarySweep,
  malformedSets,
  seededRandom,
  buildCorpus,
  flattenCorpus,
} from "../tools/corpus.mjs";
import { projectRec, runParity } from "../tools/parity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_DIR = path.join(__dirname, "markdown");

test("golden freeze file exists and matches baseline snapshot contract", () => {
  assert.ok(fs.existsSync(GOLDEN_V030));
  const golden = fs.readFileSync(GOLDEN_V030, "utf8");
  const current = fs.readFileSync(CURRENT_PAGE, "utf8");
  // At P0 they are identical; later phases diverge and this assertion is removed
  // from the "must match current" sense — golden must remain frozen.
  assert.ok(golden.includes("SDDSelector"));
  assert.ok(golden.includes("module.exports"));
  assert.equal(golden, current, "P0: golden freeze must equal index.html");
});

test("load-page exports evaluate/toMarkdown without document", () => {
  const api = loadGolden({ now: PINNED_NOW });
  assert.equal(typeof api.evaluate, "function");
  assert.equal(typeof api.toMarkdown, "function");
  assert.ok(api.QUESTIONS.length > 10);
  const r = api.evaluate({}, null, PINNED_NOW);
  assert.ok(r.base || r.noRuntimeMatch);
});

test("pinned now keeps evidenceAge.stale false on 2026-09-16", () => {
  const api = loadGolden({ now: PINNED_NOW });
  const r = api.evaluate({}, null, PINNED_NOW);
  assert.equal(r.evidenceAge.stale, false);
});

test("corpus families have expected sizes", () => {
  const doc = documentedFixtures();
  const bound = boundarySweep();
  const mal = malformedSets();
  const rand = seededRandom(100);
  assert.ok(doc.length >= 40, `documented ${doc.length}`);
  assert.ok(bound.length >= 100, `boundary ${bound.length}`);
  assert.ok(mal.length >= 100, `malformed ${mal.length}`);
  assert.equal(rand.length, 100);
});

test("projectRec omits when closures and nested derived", () => {
  const api = loadGolden({ now: PINNED_NOW });
  const r = api.evaluate(documentedFixtures()[0].answers, null, PINNED_NOW);
  const p = projectRec(r);
  assert.ok(p.baseId);
  assert.ok(Array.isArray(p.overlays));
  assert.ok(Array.isArray(p.cautions));
  assert.equal("derived" in p, false);
  assert.equal("forceOverlayB" in p, false);
});

test("G-PARITY self (golden vs golden) on documented+boundary+malformed", () => {
  const api = loadGolden({ now: PINNED_NOW });
  const cases = [
    ...documentedFixtures(),
    ...boundarySweep(),
    ...malformedSets(),
    ...seededRandom(500, 0xabcdd00d, api),
  ];
  const report = runParity({
    leftApi: api,
    rightApi: api,
    cases,
    label: "self",
    stopAt: 3,
  });
  assert.equal(report.ok, true, JSON.stringify(report.failures, null, 2));
});

test("G-MARKDOWN fixtures match golden files", () => {
  assert.ok(fs.existsSync(path.join(MD_DIR, "INDEX.json")), "run npm run fixtures:markdown first");
  const index = JSON.parse(fs.readFileSync(path.join(MD_DIR, "INDEX.json"), "utf8"));
  const api = loadGolden({ now: PINNED_NOW });
  const byName = Object.fromEntries(documentedFixtures().map((f) => [f.name, f.answers]));
  for (const file of index) {
    const name = file.replace(/\.md$/, "");
    const answers = byName[name];
    assert.ok(answers !== undefined, `missing fixture ${name}`);
    const result = api.evaluate(answers, null, PINNED_NOW);
    const got = api.toMarkdown(result, answers);
    const exp = fs.readFileSync(path.join(MD_DIR, file), "utf8");
    assert.equal(got, exp, `markdown drift: ${file}`);
  }
});

test("in-page selftest still passes under vm", () => {
  const api = loadGolden({ now: PINNED_NOW });
  const out = api.runSelftest();
  assert.equal(out.ok, true, out.fails && out.fails.join("\n"));
});
