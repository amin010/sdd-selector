import test from "node:test";
import assert from "node:assert/strict";
import {
  subsetAccuracy,
  hammingLoss,
  microF1,
  macroF1,
  ndcgAtK,
  prevalenceBaseline,
  scoreMultiLabel,
} from "../tools/qc/metrics.mjs";

test("subset accuracy is exact-set match", () => {
  assert.equal(subsetAccuracy(["a", "b"], ["b", "a"]), 1);
  assert.equal(subsetAccuracy(["a"], ["a", "b"]), 0);
});

test("hamming and F1 distinguish partial overlap", () => {
  const universe = ["a", "b", "c"];
  assert.equal(hammingLoss(["a", "b"], ["a"], universe), 1 / 3);
  const pairs = [
    { pred: ["a", "b"], gold: ["a"] },
    { pred: ["c"], gold: ["c"] },
  ];
  const micro = microF1(pairs);
  const macro = macroF1(pairs, universe);
  assert.ok(micro.f1 > 0);
  assert.ok(macro.f1 > 0);
});

test("NDCG@k and prevalence baseline", () => {
  assert.ok(ndcgAtK(["a", "b", "c"], ["c"], 3) > 0);
  assert.deepEqual(prevalenceBaseline([["a"], ["a", "b"], ["a"]], 1), ["a"]);
  const scored = scoreMultiLabel([
    { pred: ["a"], gold: ["a"], ranked: ["a", "b"] },
    { pred: ["b"], gold: ["a"], ranked: ["b", "a"] },
  ], ["a", "b"]);
  assert.equal(typeof scored.hammingLoss, "number");
  assert.equal(typeof scored.macro.f1, "number");
});
