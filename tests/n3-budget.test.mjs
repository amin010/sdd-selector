import test from "node:test";
import assert from "node:assert/strict";
import { loadCurrent } from "../tools/load-page.mjs";
import { PINNED_NOW, documentedFixtures } from "../tools/corpus.mjs";

test("N3: mid-range evaluate stays under 50ms", () => {
  const api = loadCurrent({ now: PINNED_NOW });
  const answers = documentedFixtures()[0].answers;
  api.evaluate(answers, null, PINNED_NOW); // warmup
  const t0 = Date.now();
  for (let i = 0; i < 8; i++) api.evaluate(answers, null, PINNED_NOW);
  const mean = (Date.now() - t0) / 8;
  assert.ok(mean < 50, `mean evaluate ${mean.toFixed(1)}ms exceeds N3 50ms`);
});
