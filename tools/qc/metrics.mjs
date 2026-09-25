/**
 * Multi-label practice/caution metrics (DESIGN-EXT-SELECTION.md §8.3).
 * Hamming and macro-F1 are the targets; subset accuracy is reported only.
 */

function asSet(values) {
  return new Set((values || []).filter((v) => v != null));
}

export function subsetAccuracy(pred, gold) {
  const a = asSet(pred);
  const b = asSet(gold);
  if (a.size !== b.size) return 0;
  for (const x of a) if (!b.has(x)) return 0;
  return 1;
}

export function hammingLoss(pred, gold, universe) {
  const a = asSet(pred);
  const b = asSet(gold);
  const u = universe && universe.length ? universe : [...new Set([...a, ...b])];
  if (!u.length) return 0;
  let miss = 0;
  for (const id of u) {
    if (a.has(id) !== b.has(id)) miss++;
  }
  return miss / u.length;
}

function prf(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

export function microF1(pairs) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const { pred, gold } of pairs) {
    const a = asSet(pred);
    const b = asSet(gold);
    for (const x of a) if (b.has(x)) tp++; else fp++;
    for (const x of b) if (!a.has(x)) fn++;
  }
  return prf(tp, fp, fn);
}

export function perLabelPRF(pairs, universe) {
  const labels = universe && universe.length
    ? universe
    : [...new Set(pairs.flatMap((p) => [...asSet(p.pred), ...asSet(p.gold)]))].sort();
  const out = {};
  for (const id of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const { pred, gold } of pairs) {
      const a = asSet(pred).has(id);
      const b = asSet(gold).has(id);
      if (a && b) tp++;
      else if (a) fp++;
      else if (b) fn++;
    }
    out[id] = prf(tp, fp, fn);
  }
  return out;
}

export function macroF1(pairs, universe) {
  const per = perLabelPRF(pairs, universe);
  const ids = Object.keys(per);
  if (!ids.length) return { precision: 0, recall: 0, f1: 0, perLabel: per };
  const precision = ids.reduce((s, id) => s + per[id].precision, 0) / ids.length;
  const recall = ids.reduce((s, id) => s + per[id].recall, 0) / ids.length;
  const f1 = ids.reduce((s, id) => s + per[id].f1, 0) / ids.length;
  return { precision, recall, f1, perLabel: per };
}

export function ndcgAtK(ranked, gold, k = 5) {
  const rel = asSet(gold);
  const n = Math.min(k, (ranked || []).length);
  let dcg = 0;
  for (let i = 0; i < n; i++) {
    if (rel.has(ranked[i])) dcg += 1 / Math.log2(i + 2);
  }
  const idealN = Math.min(k, rel.size);
  let idcg = 0;
  for (let i = 0; i < idealN; i++) idcg += 1 / Math.log2(i + 2);
  return idcg ? dcg / idcg : 0;
}

export function prevalenceBaseline(trainGold, k = 5) {
  const counts = new Map();
  for (const gold of trainGold) {
    for (const id of gold || []) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map((e) => e[0]);
}

export function perLabelMajority(trainGold, universe) {
  const labels = universe || [...new Set(trainGold.flatMap((g) => g || []))];
  const emit = [];
  for (const id of labels) {
    const pos = trainGold.filter((g) => (g || []).includes(id)).length;
    if (pos * 2 >= trainGold.length) emit.push(id);
  }
  return emit;
}

export function bestSingleQuestionStub(rows, fieldId, k = 5) {
  const byValue = new Map();
  for (const row of rows) {
    const key = JSON.stringify(row.answers ? row.answers[fieldId] : null);
    if (!byValue.has(key)) byValue.set(key, []);
    byValue.get(key).push(row.gold || []);
  }
  const predict = new Map();
  for (const [key, golds] of byValue) {
    predict.set(key, prevalenceBaseline(golds, k));
  }
  return function stub(answers) {
    const key = JSON.stringify(answers ? answers[fieldId] : null);
    return predict.get(key) || prevalenceBaseline(rows.map((r) => r.gold), k);
  };
}

export function scoreMultiLabel(pairs, universe, k = 5) {
  const micro = microF1(pairs);
  const macro = macroF1(pairs, universe);
  const subset = pairs.length ? pairs.reduce((s, p) => s + subsetAccuracy(p.pred, p.gold), 0) / pairs.length : 0;
  const hamming = pairs.length ? pairs.reduce((s, p) => s + hammingLoss(p.pred, p.gold, universe), 0) / pairs.length : 0;
  const ndcg = pairs.length ? pairs.reduce((s, p) => s + ndcgAtK(p.ranked || p.pred, p.gold, k), 0) / pairs.length : 0;
  return { subsetAccuracy: subset, hammingLoss: hamming, micro, macro, ndcgAtK: ndcg };
}
