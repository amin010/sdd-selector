/**
 * Parts B4/B5/C/D — metrics and pre-registered verdicts (tools/qc/analyze.mjs).
 *
 * Fully offline and deterministic: reads only the committed
 * tools/qc/data/{vignettes,answers,labels,sensitivity-report}.json plus the
 * engine itself (via tools/qc/lib.mjs, and one direct api.evaluate() call
 * for Part D's threshold sweep — see "RULE OVERRIDE" below). No LLM calls.
 *
 * Implements, in this order (matching docs/QC-EXPERIMENT.md §5 B4's stated
 * priority — inter-judge agreement first, since it is the ceiling on every
 * downstream engine-accuracy claim):
 *   B4.1  Fleiss' kappa across the 3 judges' top-1 picks.
 *   B4.2  Majority judge label; engine aggregate label; Cohen's kappa;
 *         confusion matrix restricted to the reachable bases.
 *   B4.3  Runner-up credit accuracy.
 *   B4.4  Caution precision/recall (fixed keyword heuristic).
 *   B5    Three baselines: constant-openspec, prior-weighted-random,
 *         best single-question stub.
 *   C1    Per-field respondent agreement (test-retest).
 *   C2    End-to-end recommendation stability.
 *   C3    Danger quadrant (A2 influence x C1 agreement).
 *   D     Threshold calibration sweep + Cohen's kappa curve per threshold.
 *   §8    Pre-registered pass/fail verdicts, applied verbatim to whatever
 *         numbers were computed above.
 *
 * Writes tools/qc/data/analysis-report.json and prints a human-readable
 * summary to stdout.
 *
 * Usage:
 *   node tools/qc/analyze.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PINNED_NOW } from "../corpus.mjs";
import {
  loadEngine,
  evaluateAnswers,
  projectOutcome,
  outcomeLabel,
  frameworkCatalog,
  REACHABLE_OUTCOMES,
  clusterBootstrap,
  mcnemar,
  singleJudgeVsMajority,
} from "./lib.mjs";
import { scoreMultiLabel, prevalenceBaseline, perLabelMajority } from "./metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const VIGNETTES_PATH = path.join(DATA_DIR, "vignettes.json");
const ANSWERS_PATH = path.join(DATA_DIR, "answers.json");
const LABELS_PATH = path.join(DATA_DIR, "labels.json");
const SENSITIVITY_PATH = path.join(DATA_DIR, "sensitivity-report.json");
const OUT_PATH = path.join(DATA_DIR, "analysis-report.json");

const REACHABLE_BASES = ["openspec", "speckit", "bmad", "superpowers", "gsd", "speckitty", "tessl"];

function round(n, digits = 4) {
  if (n == null || !Number.isFinite(n)) return n;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
function pct(num, den) {
  return den ? (100 * num) / den : 0;
}

function readJson(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`tools/qc/analyze.mjs: ${p} does not exist — run \`npm run qc:generate && npm run qc:judge\` first (${label}).`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Mode with a deterministic (lexicographically-smallest-among-ties) tie-break. */
function modeOf(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestCount = -1;
  let tie = false;
  for (const [v, c] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
      tie = false;
    } else if (c === bestCount) {
      tie = true;
    }
  }
  return { value: best, count: bestCount, unanimous: bestCount === values.length, tie };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Cohen's kappa (two raters) and Fleiss' kappa (k raters), implemented
// directly against the standard formulas rather than approximated.
// ---------------------------------------------------------------------------

/** pairs: Array<[ratingA, ratingB]>. Returns { kappa, po, pe, categories, matrix }. */
function cohenKappa(pairs) {
  const categories = [...new Set(pairs.flatMap((p) => p))].sort();
  const idx = new Map(categories.map((c, i) => [c, i]));
  const n = categories.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [a, b] of pairs) matrix[idx.get(a)][idx.get(b)]++;
  const total = pairs.length;
  if (total === 0) return { kappa: null, po: null, pe: null, categories, matrix };
  let po = 0;
  for (let i = 0; i < n; i++) po += matrix[i][i];
  po /= total;
  const rowSum = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colSum = categories.map((_, j) => matrix.reduce((s, row) => s + row[j], 0));
  let pe = 0;
  for (let i = 0; i < n; i++) pe += (rowSum[i] / total) * (colSum[i] / total);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { kappa, po, pe, categories, matrix, total };
}

/** subjectRatings: Array<Array<rating>> (one inner array of k ratings per subject). */
function fleissKappa(subjectRatings, categories) {
  const N = subjectRatings.length;
  const k = subjectRatings[0] ? subjectRatings[0].length : 0;
  if (N === 0 || k < 2) return { kappa: null, N, k, categories };
  const catIdx = new Map(categories.map((c, i) => [c, i]));
  const n_ij = subjectRatings.map((ratings) => {
    const row = new Array(categories.length).fill(0);
    for (const r of ratings) {
      if (catIdx.has(r)) row[catIdx.get(r)]++;
    }
    return row;
  });
  const p_j = new Array(categories.length).fill(0);
  for (const row of n_ij) for (let j = 0; j < row.length; j++) p_j[j] += row[j];
  for (let j = 0; j < p_j.length; j++) p_j[j] /= N * k;
  const P_i = n_ij.map((row) => {
    const sumSq = row.reduce((s, v) => s + v * v, 0);
    return (sumSq - k) / (k * (k - 1));
  });
  const P_bar = P_i.reduce((a, b) => a + b, 0) / N;
  const P_e = p_j.reduce((s, p) => s + p * p, 0);
  const kappa = P_e === 1 ? 1 : (P_bar - P_e) / (1 - P_e);
  return { kappa, N, k, categories, P_bar, P_e };
}

function main() {
// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

const vignettes = readJson(VIGNETTES_PATH, "run node tools/qc/personas.mjs");
const answers = readJson(ANSWERS_PATH, "run node tools/qc/respond.mjs");
const labels = readJson(LABELS_PATH, "run node tools/qc/judge.mjs");
const sensitivityReport = readJson(SENSITIVITY_PATH, "run node tools/qc/sensitivity.mjs");

const api = loadEngine();
const FRAMEWORK_IDS = frameworkCatalog(api).map((f) => f.id); // 7 catalog ids, catalog order

const failedAnswers = answers.filter((r) => r.failed || !r.answers);
const usableAnswers = answers.filter((r) => !r.failed && r.answers);
const parseFailureLabels = labels.filter((r) => r.parseFailure || !Array.isArray(r.rankedTop3) || r.rankedTop3.length < 3);
const usableLabels = labels.filter((r) => !r.parseFailure && Array.isArray(r.rankedTop3) && r.rankedTop3.length >= 3);

const vignetteById = new Map(vignettes.map((v) => [v.id, v]));
const answersByVignette = new Map();
for (const rec of usableAnswers) {
  if (!answersByVignette.has(rec.vignetteId)) answersByVignette.set(rec.vignetteId, []);
  answersByVignette.get(rec.vignetteId).push(rec);
}
for (const arr of answersByVignette.values()) arr.sort((a, b) => a.respondentIndex - b.respondentIndex);
const labelsByVignette = new Map();
for (const rec of usableLabels) {
  if (!labelsByVignette.has(rec.vignetteId)) labelsByVignette.set(rec.vignetteId, []);
  labelsByVignette.get(rec.vignetteId).push(rec);
}
for (const arr of labelsByVignette.values()) arr.sort((a, b) => a.judgeIndex - b.judgeIndex);

const dataQuality = {
  answersTotal: answers.length,
  answersFailed: failedAnswers.length,
  answersUsable: usableAnswers.length,
  labelsTotal: labels.length,
  labelsParseFailure: parseFailureLabels.length,
  labelsUsable: usableLabels.length,
  note: "Failed respondent fills and judge parse failures are excluded from every metric. Parse failures are not backfilled from presentation order.",
};

const vignetteIds = vignettes.map((v) => v.id);

// ---------------------------------------------------------------------------
// Per-vignette, per-respondent engine evaluation (shipped rules).
// Reused across B4.2/B4.3/B4.4/C1/C2/C3/D's baseline point.
// ---------------------------------------------------------------------------

/**
 * mapLabelForComparison — reconciliation policy between the engine's 7
 * canonical outcome labels and the judges' 7-framework-id label space
 * (docs/QC-EXPERIMENT.md §5 B4.2 / §9 explicitly calls this out as a
 * judgment call the analysis code must record):
 *   - "fallback_openspec" is folded into "openspec". The fallback is
 *     *itself* an openspec recommendation (settings.fallbackBase) — the
 *     distinction is "why openspec" (a rule fired vs. nothing fired), which
 *     a judge choosing frameworks from a menu has no way to express. Folding
 *     it in means the engine is not penalized for surfacing openspec via the
 *     fallback path rather than base-1 when a judge's independent pick
 *     happens to be "openspec" either way.
 *   - "no_runtime_match" is kept as its own, distinct, engine-only bucket.
 *     It is never merged into any framework id because it represents "no
 *     candidate survived tier-0 filtering," not a considered pick — a judge
 *     never emits it, so any vignette landing here is *always* a miss
 *     against the judge majority unless/until the label space is extended.
 *     This is a deliberate, documented asymmetry, not an oversight.
 */
function mapLabelForComparison(label) {
  return label === "fallback_openspec" ? "openspec" : label;
}

const perVignette = new Map(); // vignetteId -> { respondents: [{index, rawLabel, mappedLabel, runnerUpFrameworkId, cautions, answers}], aggregateMappedLabel, aggregateTie, representativeIndex }

for (const vid of vignetteIds) {
  const respondentRecs = answersByVignette.get(vid) || [];
  const respondents = respondentRecs.filter((rec) => rec.answers).map((rec) => {
    const result = evaluateAnswers(api, rec.answers); // shipped rules, PINNED_NOW
    const projection = projectOutcome(result);
    const rawLabel = outcomeLabel(projection);
    // Runner-up is a *base rule id* in projectOutcome (e.g. "base-4"), which
    // is ambiguous for base-4 (adopts either superpowers or gsd depending on
    // coverage/token budget — see docs/DESIGN.md §10.2's adoptWhen split).
    // The *raw* evaluate() result already resolved this ambiguity internally
    // (result.runnerUp.rule.adopt.framework), so we read the raw result
    // directly here rather than reverse-engineering it from the rule id —
    // see "interface mismatches resolved" in this repo's QC write-up.
    const runnerUpFrameworkId =
      result.runnerUp && result.runnerUp.rule && result.runnerUp.rule.adopt
        ? result.runnerUp.rule.adopt.framework
        : null;
    return {
      respondentIndex: rec.respondentIndex,
      answers: rec.answers,
      rawLabel,
      mappedLabel: mapLabelForComparison(rawLabel),
      runnerUpFrameworkId,
      cautions: projection.cautions || [],
      winningRule: result.base && result.base.rule ? result.base.rule : null,
      derived: result.derived || {},
      conformal: result.conformal || [],
    };
  });
  const mappedLabels = respondents.map((r) => r.mappedLabel);
  const agg = mappedLabels.length ? modeOf(mappedLabels) : { value: null, unanimous: false, tie: false };
  const representative = respondents.find((r) => r.mappedLabel === agg.value) || respondents[0];
  perVignette.set(vid, {
    respondents,
    aggregateMappedLabel: agg.value,
    aggregateUnanimous: agg.unanimous,
    aggregateTie: agg.tie,
    representativeIndex: representative ? representative.respondentIndex : null,
  });
}

// ---------------------------------------------------------------------------
// Majority judge label per vignette (mode of the 3 judges' rankedTop3[0]).
// ---------------------------------------------------------------------------

const judgeMajorityByVignette = new Map(); // vignetteId -> { label, unanimous, noConsensus, top1s }
let noConsensusCount = 0;
for (const vid of vignetteIds) {
  const judgeRecs = labelsByVignette.get(vid) || [];
  const top1s = judgeRecs.map((r) => (Array.isArray(r.rankedTop3) ? r.rankedTop3[0] : null)).filter((t) => t != null);
  const agg = modeOf(top1s);
  const noConsensus = top1s.length < 2 || agg.count < 2;
  if (noConsensus) noConsensusCount++;
  judgeMajorityByVignette.set(vid, { label: agg.value, unanimous: agg.unanimous, noConsensus, top1s, usableJudges: top1s.length });
}

// ===========================================================================
// B4.1 — Fleiss' kappa across the 3 judges' top-1 picks, over the 7-framework
// category space.
// ===========================================================================

const fleissSubjects = vignetteIds
  .map((vid) => judgeMajorityByVignette.get(vid).top1s)
  .filter((top1s) => top1s.length >= 2 && top1s.every((t) => t != null));
const fleiss = fleissKappa(fleissSubjects, FRAMEWORK_IDS);

let oracleVerdict;
if (fleiss.kappa == null) oracleVerdict = "INDETERMINATE";
else if (fleiss.kappa >= 0.4) oracleVerdict = "USABLE";
else if (fleiss.kappa < 0.2) oracleVerdict = "UNUSABLE";
else oracleVerdict = "WEAKLY_USABLE_GRAY_ZONE";

const b41 = {
  method: "Fleiss' kappa (standard formula) over usable judges x 7-framework categories; parse failures excluded",
  vignettesConsidered: fleissSubjects.length,
  vignettesTotal: vignetteIds.length,
  parseFailures: parseFailureLabels.length,
  kappa: round(fleiss.kappa),
  P_bar: round(fleiss.P_bar),
  P_e: round(fleiss.P_e),
  verdict: oracleVerdict,
  thresholds: { usable: 0.4, unusable: 0.2, note: "0.20-0.40 is a gray zone: weakly usable, no RQ1 pass/fail verdict asserted." },
};

// ===========================================================================
// B4.2 — majority judge label, engine aggregate label, Cohen's kappa,
// confusion matrix restricted to the 5 reachable bases.
// ===========================================================================

const consensusVignetteIds = vignetteIds.filter((vid) => {
  const jm = judgeMajorityByVignette.get(vid);
  const pv = perVignette.get(vid);
  return jm && !jm.noConsensus && pv && pv.aggregateMappedLabel;
});
const cohenPairs = consensusVignetteIds.map((vid) => [
  perVignette.get(vid).aggregateMappedLabel,
  judgeMajorityByVignette.get(vid).label,
]);
const cohen = cohenKappa(cohenPairs);

const top1Matches = cohenPairs.filter(([e, j]) => e === j).length;
const top1Accuracy = pct(top1Matches, cohenPairs.length) / 100;

// 5x5 confusion matrix restricted to the 5 reachable bases, for display /
// bias inspection only (per QC-EXPERIMENT.md §5 B4.2) — the Cohen's kappa
// number used for the §8 verdict is computed above over the FULL
// reconciled label space (openspec/speckit/bmad/superpowers/gsd/
// no_runtime_match x the 7 framework ids), not this restricted view.
const confusion5x5 = {
  labels: REACHABLE_BASES,
  matrix: REACHABLE_BASES.map((rowLabel) =>
    REACHABLE_BASES.map(
      (colLabel) => cohenPairs.filter(([e, j]) => e === rowLabel && j === colLabel).length,
    ),
  ),
};

// Supplementary: per-respondent-index accuracy (not the aggregate), so the
// aggregate-vs-per-respondent choice documented in this file is auditable.
const perRespondentAccuracy = [0, 1, 2].map((idx) => {
  const pairs = consensusVignetteIds
    .map((vid) => {
      const pv = perVignette.get(vid);
      const r = pv.respondents.find((x) => x.respondentIndex === idx);
      return r ? [r.mappedLabel, judgeMajorityByVignette.get(vid).label] : null;
    })
    .filter(Boolean);
  const matches = pairs.filter(([e, j]) => e === j).length;
  return { respondentIndex: idx, n: pairs.length, accuracy: round(pct(matches, pairs.length) / 100) };
});

const b42 = {
  consensusVignettes: consensusVignetteIds.length,
  noConsensusVignettes: noConsensusCount,
  vignettesTotal: vignetteIds.length,
  labelReconciliation: {
    note:
      "fallback_openspec is folded into openspec for this comparison; no_runtime_match is kept as its own always-a-miss bucket. See mapLabelForComparison() in this file.",
  },
  top1Accuracy: round(top1Accuracy),
  top1Matches,
  n: cohenPairs.length,
  cohenKappa: round(cohen.kappa),
  cohenPo: round(cohen.po),
  cohenPe: round(cohen.pe),
  confusionMatrixCategories: cohen.categories,
  confusionMatrix: cohen.matrix,
  confusion5x5Reachable: confusion5x5,
  perRespondentAccuracy,
  aggregateMethod:
    "mode of the 3 respondents' mapped outcome label per vignette; ties broken lexicographically. representativeIndex = first respondent whose label equals the mode, reused for B4.3/B4.4/stub-fitting.",
};

const judgesByVignette = new Map();
for (const vid of vignetteIds) {
  const recs = (labelsByVignette.get(vid) || []).filter((r) => Array.isArray(r.rankedTop3) && r.rankedTop3[0]);
  judgesByVignette.set(vid, recs.map((r) => r.rankedTop3[0]));
}
const oracleCeiling = singleJudgeVsMajority(judgesByVignette);
const top1Ci = clusterBootstrap(consensusVignetteIds, (ids) => {
  let hit = 0;
  for (const vid of ids) {
    const pv = perVignette.get(vid);
    const jm = judgeMajorityByVignette.get(vid);
    if (pv && jm && pv.aggregateMappedLabel === jm.label) hit++;
  }
  return ids.length ? hit / ids.length : 0;
});
const mcnemarVsConstant = mcnemar(consensusVignetteIds.map((vid) => {
  const pv = perVignette.get(vid);
  const gold = judgeMajorityByVignette.get(vid).label;
  return [pv && pv.aggregateMappedLabel === gold, gold === "openspec"];
}));

// ===========================================================================
// Headroom — answer-elicitation bounds, label-reachability ceiling, and
// winning-rule `when` gate integrity (regression guard for D23).
// ===========================================================================

function gateHolds(rule, answers, derived) {
  if (!rule || rule.when == null) return true;
  try {
    return api.SDDExpr.evalExpr(rule.when, {
      answers: answers || {},
      derived: derived || {},
      result: null,
      flags: {},
      fieldIndex: api.FIELD_INDEX || {},
    }) === true;
  } catch {
    return false;
  }
}

const selectableFromRules = new Set();
for (const rule of api.BASE_RULES || []) {
  if (rule.adopt && rule.adopt.framework) selectableFromRules.add(rule.adopt.framework);
  for (const branch of rule.adoptWhen || []) {
    if (branch.framework) selectableFromRules.add(branch.framework);
    if (branch.ifUnavailable && branch.ifUnavailable.framework) {
      selectableFromRules.add(branch.ifUnavailable.framework);
    }
  }
}
if (api.SETTINGS && api.SETTINGS.fallbackBase) selectableFromRules.add(api.SETTINGS.fallbackBase);

let bestOf3Matches = 0;
let all3AgreeAndRight = 0;
let unreachableGold = 0;
let falseGateWinners = 0;
const falseGateByRule = {};
const unreachableGoldCounts = {};
for (const vid of consensusVignetteIds) {
  const gold = judgeMajorityByVignette.get(vid).label;
  const pv = perVignette.get(vid);
  const labs = pv.respondents.map((r) => r.mappedLabel);
  if (labs.includes(gold)) bestOf3Matches++;
  if (labs.length && labs.every((l) => l === gold)) all3AgreeAndRight++;
  if (!selectableFromRules.has(gold)) {
    unreachableGold++;
    unreachableGoldCounts[gold] = (unreachableGoldCounts[gold] || 0) + 1;
  }
  const rep = pv.respondents.find((r) => r.respondentIndex === pv.representativeIndex);
  if (rep && rep.winningRule && !gateHolds(rep.winningRule, rep.answers, rep.derived)) {
    falseGateWinners++;
    const rid = rep.winningRule.id || "(unknown)";
    falseGateByRule[rid] = (falseGateByRule[rid] || 0) + 1;
  }
}

const headroom = {
  n: consensusVignetteIds.length,
  modeOf3Accuracy: round(top1Accuracy),
  bestOf3Accuracy: round(pct(bestOf3Matches, consensusVignetteIds.length) / 100),
  bestOf3Matches,
  all3AgreeAndRightAccuracy: round(pct(all3AgreeAndRight, consensusVignetteIds.length) / 100),
  all3AgreeAndRight,
  elicitationHeadroomPp: round((pct(bestOf3Matches, consensusVignetteIds.length) / 100 - top1Accuracy) * 100),
  labelReachabilityCeiling: round(pct(consensusVignetteIds.length - unreachableGold, consensusVignetteIds.length) / 100),
  unreachableGoldCount: unreachableGold,
  unreachableGoldCounts,
  selectableFromRules: [...selectableFromRules].sort(),
  falseGateWinners,
  falseGateWinnerShare: round(pct(falseGateWinners, consensusVignetteIds.length) / 100),
  falseGateByRule,
  note: "best-of-3 credits a vignette if any respondent's answers land on the judge-majority label (optimistic elicitation bound). all-3-agree-and-right is the floor. labelReachabilityCeiling is the share of gold labels some baseRules entry or fallback can emit. falseGateWinners must stay 0 after D23.",
};

// ===========================================================================
// B4.3 — runner-up credit: match if engine base OR reported runner-up
// (from the *representative* respondent) equals the judges' majority label.
// ===========================================================================

const runnerUpPairs = consensusVignetteIds.map((vid) => {
  const pv = perVignette.get(vid);
  const rep = pv.respondents.find((r) => r.respondentIndex === pv.representativeIndex);
  const judgeLabel = judgeMajorityByVignette.get(vid).label;
  const baseHit = pv.aggregateMappedLabel === judgeLabel;
  const runnerUpHit = rep && rep.runnerUpFrameworkId != null && rep.runnerUpFrameworkId === judgeLabel;
  return { vid, baseHit, runnerUpHit, hit: baseHit || runnerUpHit };
});
const runnerUpCreditMatches = runnerUpPairs.filter((r) => r.hit).length;
const runnerUpOnlyMatches = runnerUpPairs.filter((r) => !r.baseHit && r.runnerUpHit).length;

const b43 = {
  n: runnerUpPairs.length,
  baseOnlyAccuracy: round(top1Accuracy),
  withRunnerUpCreditAccuracy: round(pct(runnerUpCreditMatches, runnerUpPairs.length) / 100),
  additionalMatchesFromRunnerUp: runnerUpOnlyMatches,
  note: "runner-up framework id is read from the raw evaluate() result (result.runnerUp.rule.adopt.framework) of the representative respondent, not reverse-engineered from projectOutcome's rule-id-shaped runnerUpId.",
};

// ===========================================================================
// B4.4 — caution precision/recall against judge-emitted structured risk tags
// (same ids as engine cautions). Labels without riskTags are skipped; we do
// not fall back to keyword matching of free-text reasoning.
// ===========================================================================

const ENGINE_CAUTION_IDS = (api.CAUTIONS || []).map((c) => c.id);
const RISK_TAG_LABELS = usableLabels.filter((r) => Array.isArray(r.riskTags));

function unionRiskTags(judgeRecs) {
  const tags = new Set();
  for (const rec of judgeRecs) {
    for (const id of rec.riskTags || []) tags.add(id);
  }
  return tags;
}

let cautionTP = 0;
let cautionFP = 0;
let cautionFN = 0;
const perCautionCounts = Object.fromEntries(ENGINE_CAUTION_IDS.map((id) => [id, { tp: 0, fp: 0, fn: 0 }]));
let cautionVignettesScored = 0;

for (const vid of vignetteIds) {
  const judgeRecs = (labelsByVignette.get(vid) || []).filter((r) => Array.isArray(r.riskTags));
  if (!judgeRecs.length) continue;
  cautionVignettesScored++;
  const pv = perVignette.get(vid);
  const rep = pv.respondents.find((r) => r.respondentIndex === pv.representativeIndex);
  const engineFired = new Set(rep ? rep.cautions : []);
  const judgeFlagged = unionRiskTags(judgeRecs);
  for (const cautionId of ENGINE_CAUTION_IDS) {
    const fired = engineFired.has(cautionId);
    const flagged = judgeFlagged.has(cautionId);
    if (fired && flagged) {
      cautionTP++;
      perCautionCounts[cautionId].tp++;
    } else if (fired && !flagged) {
      cautionFP++;
      perCautionCounts[cautionId].fp++;
    } else if (!fired && flagged) {
      cautionFN++;
      perCautionCounts[cautionId].fn++;
    }
  }
}

const b44 = {
  method: "structured risk tags emitted by judges (riskTags on labels.json). Labels without riskTags are excluded — no keyword fallback.",
  representativeRespondentPerVignette: true,
  vignettesWithRiskTags: cautionVignettesScored,
  labelsWithRiskTags: RISK_TAG_LABELS.length,
  precision: cautionVignettesScored ? round(cautionTP / (cautionTP + cautionFP || 1)) : null,
  recall: cautionVignettesScored ? round(cautionTP / (cautionTP + cautionFN || 1)) : null,
  truePositives: cautionTP,
  falsePositives: cautionFP,
  falseNegatives: cautionFN,
  perCaution: perCautionCounts,
};

// ===========================================================================
// B5 — baselines.
// ===========================================================================

// Constant-openspec.
const constantOpenspecMatches = consensusVignetteIds.filter(
  (vid) => judgeMajorityByVignette.get(vid).label === "openspec",
).length;
const constantOpenspecAccuracy = pct(constantOpenspecMatches, consensusVignetteIds.length) / 100;

// Prior-weighted random: analytic expected accuracy = sum of squared label
// proportions in the empirical majority-label distribution (documented
// choice, per QC-EXPERIMENT.md §5 B5 — more reproducible than an actual
// random draw, and equivalent in expectation to iid-sampling a prediction
// from the same distribution as the true label).
const judgeMajorityCounts = {};
for (const vid of consensusVignetteIds) {
  const l = judgeMajorityByVignette.get(vid).label;
  judgeMajorityCounts[l] = (judgeMajorityCounts[l] || 0) + 1;
}
const priorWeightedRandomAccuracy = Object.values(judgeMajorityCounts).reduce(
  (s, c) => s + (c / consensusVignetteIds.length) ** 2,
  0,
);

// Best single-question stub: fit over the *representative* respondent's
// answers per vignette (same representative index used throughout this
// file), predicting a framework id directly from one field/threshold.
function repAnswers(vid) {
  const pv = perVignette.get(vid);
  const rep = pv.respondents.find((r) => r.respondentIndex === pv.representativeIndex);
  return rep ? rep.answers : null;
}

const STUB_CANDIDATES = [
  {
    name: "q10_architecture==microservices -> speckit else openspec",
    predict: (a) => (a && a.q10_architecture === "microservices" ? "speckit" : "openspec"),
  },
  {
    name: "q5_work_breakdown.roadmap>=60 -> speckit else openspec",
    predict: (a) => (a && a.q5_work_breakdown && a.q5_work_breakdown.roadmap >= 60 ? "speckit" : "openspec"),
  },
  {
    name: "q7_requirements in {high_level,vague} -> bmad else openspec",
    predict: (a) => (a && ["high_level", "vague"].includes(a.q7_requirements) ? "bmad" : "openspec"),
  },
  {
    name: "q2_team.total<5 -> superpowers else openspec",
    predict: (a) => (a && a.q2_team && a.q2_team.total < 5 ? "superpowers" : "openspec"),
  },
  {
    name: "q11_deploy_cadence in {continuous,sprint} -> superpowers else openspec",
    predict: (a) => (a && ["continuous", "sprint"].includes(a.q11_deploy_cadence) ? "superpowers" : "openspec"),
  },
];

const stubResults = STUB_CANDIDATES.map((stub) => {
  const pairs = consensusVignetteIds.map((vid) => [stub.predict(repAnswers(vid)), judgeMajorityByVignette.get(vid).label]);
  const matches = pairs.filter(([p, j]) => p === j).length;
  return { name: stub.name, accuracy: round(pct(matches, pairs.length) / 100), matches, n: pairs.length };
});
stubResults.sort((a, b) => b.accuracy - a.accuracy);
const bestStub = stubResults[0];

const b5 = {
  n: consensusVignetteIds.length,
  constantOpenspec: { accuracy: round(constantOpenspecAccuracy) },
  priorWeightedRandom: {
    accuracy: round(priorWeightedRandomAccuracy),
    method: "analytic: sum of squared empirical majority-label proportions (documented substitute for actual random sampling).",
    labelDistribution: judgeMajorityCounts,
  },
  bestSingleQuestionStub: bestStub,
  allStubCandidates: stubResults,
};

// ===========================================================================
// C1 — per-field respondent agreement (test-retest across the 3 respondents).
// Computed at the same top-level field-id granularity as Part A's A2 influence
// scores (sensitivity-report.json), so C3's danger quadrant can cross them
// directly with no unit conversion.
// ===========================================================================

const NUMERIC_TOLERANCE = 10; // documented heuristic: q5 percentages and q2 headcounts

// Field-kind lookup, built once from the shipped pack via api.FIELD_INDEX so
// C1 doesn't need to re-derive it from questionSchema().
const FIELD_KIND = api.FIELD_INDEX || {};

function valuesAgree(fieldId, values) {
  const meta = FIELD_KIND[fieldId] || {};
  switch (meta.kind) {
    case "single":
    case "text":
    case undefined:
      return values.every((v) => v === values[0]);
    case "multi": {
      const sets = values.map((v) => new Set(Array.isArray(v) ? v : []));
      return sets.every((s) => setsEqual(s, sets[0]));
    }
    case "ranked":
      return values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
    case "number": {
      const nums = values.map((v) => (typeof v === "number" ? v : NaN));
      if (nums.some((n) => Number.isNaN(n))) return values.every((v) => v === values[0]);
      return Math.max(...nums) - Math.min(...nums) <= NUMERIC_TOLERANCE;
    }
    case "record": {
      return (meta.fields || []).every((sub) => {
        const subVals = values.map((v) => (v && typeof v === "object" ? v[sub.id] : undefined));
        if (sub.kind === "number") {
          const nums = subVals.map((v) => (typeof v === "number" ? v : NaN));
          if (nums.some((n) => Number.isNaN(n))) return subVals.every((v) => v === subVals[0]);
          return Math.max(...nums) - Math.min(...nums) <= NUMERIC_TOLERANCE;
        }
        return subVals.every((v) => v === subVals[0]);
      });
    }
    default:
      return values.every((v) => v === values[0]);
  }
}

const ALL_ANSWER_FIELD_IDS = Object.keys(FIELD_KIND);
const c1PerField = ALL_ANSWER_FIELD_IDS.map((fieldId) => {
  let agree = 0;
  let n = 0;
  for (const vid of vignetteIds) {
    const recs = answersByVignette.get(vid) || [];
    if (recs.length < 3) continue;
    n++;
    const values = recs.map((r) => r.answers[fieldId]);
    if (valuesAgree(fieldId, values)) agree++;
  }
  return { fieldId, n, agreementScore: round(pct(agree, n) / 100) };
});
const c1ByField = new Map(c1PerField.map((r) => [r.fieldId, r]));

const TOLERANCE_FIELDS = ["q5_work_breakdown", "q2_team"];
const c1 = {
  numericTolerance: NUMERIC_TOLERANCE,
  toleranceFields: TOLERANCE_FIELDS,
  toleranceNote: "exact match for categorical/multi/ranked fields; ±10 tolerance for q5_work_breakdown percentages and q2_team headcounts (documented heuristic). Those ±10 fields are listed in toleranceFields so they are not read against exact-match scores.",
  perField: c1PerField.sort((a, b) => a.agreementScore - b.agreementScore).map((row) => ({
    ...row,
    matchRule: TOLERANCE_FIELDS.includes(row.fieldId) ? "tolerance_pm_10" : "exact",
  })),
  determinability: {
    note: "Agreement overall vs on the subset where vignette prose contains a field cue (§7.3). Keyword heuristics; not an LLM pass.",
  },
};

const FIELD_CUES = {
  q2_team: ["engineer", "headcount", "team of", "developers", "qa"],
  q3_distribution: ["overlap", "timezone", "hours", "colocat", "remote", "distributed"],
  q5_work_breakdown: ["roadmap", "percent", "ops", "bugs", "tech debt", "regulatory"],
  q6_volatility: ["volatil", "interrupt", "priority", "shifting"],
  q7_requirements: ["requirement", "spec", "vague", "structured"],
  q8_compliance: ["sox", "audit", "compliance", "regulator"],
  q9_precision: ["zero-tolerance", "precision", "ledger", "calculation"],
  q10_architecture: ["monolith", "microservice", "streaming", "architecture"],
  q12_quality_gates: ["coverage", "e2e", "unit test", "quality gate"],
  q14_release_autonomy: ["vendor", "release train", "autonomous", "coupled"],
  q16_bottlenecks: ["bottleneck", "flaky", "test fear", "ticket", "approval"],
  q18_token_budget: ["token", "metered", "budget"],
  q19_change_volume: ["small change", "many small", "volume"],
  q20_runtimes: ["cursor", "claude", "copilot", "runtime"],
  q21_ci_maturity: ["ci", "pull request", "status check", "linter"],
};

c1.determinability.perField = ALL_ANSWER_FIELD_IDS.map((fieldId) => {
  const cues = FIELD_CUES[fieldId] || [];
  let agreeAll = 0;
  let nAll = 0;
  let agreeDet = 0;
  let nDet = 0;
  for (const vid of vignetteIds) {
    const recs = answersByVignette.get(vid) || [];
    if (recs.length < 3) continue;
    nAll++;
    const values = recs.map((r) => r.answers[fieldId]);
    const agreed = valuesAgree(fieldId, values);
    if (agreed) agreeAll++;
    const prose = String((vignetteById.get(vid) || {}).prose || "").toLowerCase();
    const determinable = cues.length === 0 || cues.some((c) => prose.includes(c));
    if (determinable) {
      nDet++;
      if (agreed) agreeDet++;
    }
  }
  return {
    fieldId,
    agreementOverall: round(pct(agreeAll, nAll) / 100),
    agreementDeterminable: nDet ? round(pct(agreeDet, nDet) / 100) : null,
    determinableShare: round(pct(nDet, nAll) / 100),
  };
});

// ===========================================================================
// C2 — end-to-end recommendation stability: fraction of vignettes where all
// 3 respondents' raw outcome label (baseId + fallback state) is identical.
// ===========================================================================

let stableCount = 0;
for (const vid of vignetteIds) {
  const pv = perVignette.get(vid);
  const rawLabels = pv.respondents.map((r) => r.rawLabel);
  if (rawLabels.length === 3 && rawLabels[0] === rawLabels[1] && rawLabels[1] === rawLabels[2]) stableCount++;
}
const c2 = {
  n: vignetteIds.length,
  stableCount,
  stability: round(pct(stableCount, vignetteIds.length) / 100),
  note: "stable = all 3 respondents' raw outcome label (baseId, or fallback_openspec, or no_runtime_match) is identical for the same vignette.",
};

// ===========================================================================
// C3 — danger quadrant: A2 base-influence (sensitivity-report.json) x C1
// respondent agreement, restricted to non-report-only fields (§3.4's fixed
// 5-field rule-inert set is excluded from A2's own reportOnly flag at the
// *question* level for q4_tenure/q11_cycle_time — see the RQ2(a) note below
// for why this file uses the field-level definition instead).
// ===========================================================================

const RULE_INERT_FIELD_IDS = ["q1_domain", "q13_branching", "q17_process_mismatch", "q4_tenure", "q11_cycle_time"];
const a2FieldsById = new Map((sensitivityReport.a2 && sensitivityReport.a2.fields || []).map((f) => [f.fieldId, f]));

function totalInfluence(a2Field) {
  return (a2Field.baseInfluenceScore || 0) + (a2Field.overlayInfluenceScore || 0) + (a2Field.cautionInfluenceScore || 0);
}

const dangerQuadrant = [];
for (const [fieldId, a2Field] of a2FieldsById) {
  if (RULE_INERT_FIELD_IDS.includes(fieldId)) continue;
  const c1Field = c1ByField.get(fieldId);
  if (!c1Field) continue;
  const total = totalInfluence(a2Field);
  if (total > 5 && c1Field.agreementScore < 0.6) {
    dangerQuadrant.push({
      fieldId,
      totalInfluenceScore: round(total),
      baseInfluenceScore: a2Field.baseInfluenceScore,
      overlayInfluenceScore: a2Field.overlayInfluenceScore,
      cautionInfluenceScore: a2Field.cautionInfluenceScore,
      agreementScore: c1Field.agreementScore,
    });
  }
}

const c3 = {
  rule: "total-influence (base+overlay+caution) > 5 (percentage points, from A2) AND respondent agreement < 0.60 (from C1)",
  ruleInertFieldsExcluded: RULE_INERT_FIELD_IDS,
  fieldsInQuadrant: dangerQuadrant,
  isEmpty: dangerQuadrant.length === 0,
  assertNonEmpty: true,
};

// ===========================================================================
// RQ2(a) — >=60% of non-reportOnly QUESTIONS have non-zero base influence.
//
// IMPORTANT INTERFACE NOTE (documented per the task's request to record
// judgment calls explicitly): sensitivity-report.json's a2.fields[].
// questionReportOnly is the *parent question's* own `reportOnly` flag
// (api.QUESTIONS[i].reportOnly), which is FALSE for the Q4 and Q11
// questions even though each contains one individually report-only *field*
// (q4_tenure, q11_cycle_time — see packs/finance-tech.json and
// docs/QC-EXPERIMENT.md §3.4, which lists both as part of the fixed
// 5-field rule-inert set). Naively filtering on `questionReportOnly` would
// under-count the rule-inert set (3 instead of 5) and change the resulting
// percentage. This file instead excludes the exact 5 fields §3.4 names
// (RULE_INERT_FIELD_IDS above, cross-checked against a2.sanityCheck in
// sensitivity-report.json, which independently confirms all 5 already have
// a measured base-influence score of exactly zero) from BOTH the numerator
// and denominator, over all 23 flattened answer fields.
// ===========================================================================

const nonInertFields = [...a2FieldsById.values()].filter((f) => !RULE_INERT_FIELD_IDS.includes(f.fieldId));
const nonInertNonZero = nonInertFields.filter((f) => totalInfluence(f) > 0);
const rq2a = {
  totalFields: a2FieldsById.size,
  ruleInertFieldsExcluded: RULE_INERT_FIELD_IDS.length,
  nonReportOnlyFieldsConsidered: nonInertFields.length,
  nonZeroAnyInfluenceCount: nonInertNonZero.length,
  nonZeroBaseInfluenceCount: nonInertFields.filter((f) => f.baseInfluenceScore > 0).length,
  fraction: round(nonInertNonZero.length / nonInertFields.length),
  fieldsWithZeroInfluence: nonInertFields.filter((f) => totalInfluence(f) === 0).map((f) => f.fieldId),
  criterion: "non-zero influence on any output (base, overlay, or caution)",
  passThreshold: 0.6,
  pass: nonInertNonZero.length / nonInertFields.length >= 0.6,
};

// ===========================================================================
// Part D — threshold calibration sweep.
//
// RULE OVERRIDE: api.evaluate(answers, rules, now) accepts an override object
// shaped { FRAMEWORKS, BASE_RULES, OVERLAYS, CAUTIONS } (see index.html's
// evaluate() and tools/parity.mjs's break-demo mode for the same convention)
// — falling back to the shipped globals when `rules` is null/undefined, which
// is what evaluateAnswers()/lib.mjs always passes. Part D is the one place in
// this pipeline that needs a *mutated* rules object, so it calls api.evaluate
// directly instead of going through evaluateAnswers().
// ===========================================================================

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

/** Recursively find {gte:[X,old]} / {lt:[X,old]} nodes where matchFn(X) is true, and replace `old`. */
function replaceThreshold(node, matchFn, newValue, hits) {
  if (Array.isArray(node)) {
    for (const child of node) replaceThreshold(child, matchFn, newValue, hits);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const op of ["gte", "gt", "lte", "lt"]) {
    if (Array.isArray(node[op]) && node[op].length === 2 && matchFn(node[op][0])) {
      node[op][1] = newValue;
      hits.count++;
    }
  }
  for (const value of Object.values(node)) replaceThreshold(value, matchFn, newValue, hits);
}

function buildMutatedRules(matchFn, newValue) {
  const baseRules = deepClone(api.BASE_RULES);
  const hits = { count: 0 };
  replaceThreshold(baseRules, matchFn, newValue, hits);
  if (hits.count === 0) throw new Error(`Part D: threshold mutation matched 0 nodes (newValue=${newValue})`);
  return {
    FRAMEWORKS: api.FRAMEWORKS,
    BASE_RULES: baseRules,
    OVERLAYS: api.OVERLAYS,
    CAUTIONS: api.CAUTIONS,
    SETTINGS: api.SETTINGS,
  };
}

/** Recompute the aggregate mapped label per vignette under a rules override, then Cohen's kappa vs judge majority. */
function kappaUnderRules(rulesOverride) {
  const pairs = [];
  for (const vid of consensusVignetteIds) {
    const recs = answersByVignette.get(vid) || [];
    const mappedLabels = recs.map((rec) => {
      const result = api.evaluate(rec.answers, rulesOverride, PINNED_NOW);
      const projection = projectOutcome(result);
      return mapLabelForComparison(outcomeLabel(projection));
    });
    const agg = modeOf(mappedLabels);
    pairs.push([agg.value, judgeMajorityByVignette.get(vid).label]);
  }
  const { kappa } = cohenKappa(pairs);
  return kappa;
}

function sweepRange(center, deltas) {
  return [...new Set(deltas.map((d) => center + d))].sort((a, b) => a - b);
}

function summarizeSweep(name, matchFn, shippedValue, sweepValues) {
  const points = sweepValues.map((value) => ({
    value,
    kappa: round(value === shippedValue ? kappaUnderRules(null) : kappaUnderRules(buildMutatedRules(matchFn, value))),
  }));
  // shippedValue's kappa with the *unmutated* rules must equal b42.cohenKappa
  // exactly (sanity: buildMutatedRules(matchFn, shippedValue) should be a
  // no-op reproduction of the shipped rule) — computed via the real (null)
  // rules path above to avoid relying on that no-op property.
  let peak = points[0];
  for (const p of points) {
    if (p.kappa != null && (peak.kappa == null || p.kappa > peak.kappa)) peak = p;
  }
  const shippedPoint = points.find((p) => p.value === shippedValue);
  const delta = shippedPoint && peak.kappa != null && shippedPoint.kappa != null ? peak.kappa - shippedPoint.kappa : null;
  let verdict = "INDETERMINATE";
  if (delta != null) {
    if (peak.value === shippedValue) verdict = "AT_PEAK";
    else if (delta <= 0.03) verdict = "NEAR_PEAK";
    else verdict = "AWAY_FROM_PEAK";
  }
  return { name, shippedValue, sweepValues, points, peak, shippedKappa: shippedPoint ? shippedPoint.kappa : null, verdict, deltaFromPeak: round(delta) };
}

function kappaUnderSelection(selection) {
  const settings = { ...api.SETTINGS, selection };
  return kappaUnderRules({
    FRAMEWORKS: api.FRAMEWORKS,
    BASE_RULES: api.BASE_RULES,
    OVERLAYS: api.OVERLAYS,
    CAUTIONS: api.CAUTIONS,
    SETTINGS: settings,
  });
}

const firstMatchKappa = kappaUnderSelection("first-match");
const weightedKappa = kappaUnderSelection("weighted");
const utilityKappa = kappaUnderSelection("utility");

const practiceUniverse = (api.PACK.practices || []).map((p) => p.id);
const practicePairs = [];
for (const vid of vignetteIds) {
  const recs = answersByVignette.get(vid) || [];
  if (!recs.length) continue;
  const result = evaluateAnswers(api, recs[0].answers);
  const pred = (result.overlays || []).map((o) => o.rule && o.rule.id).filter(Boolean);
  const goldFromBw = [];
  for (const lab of (labelsByVignette.get(vid) || [])) {
    for (const row of lab.bestWorst || []) {
      if (row.most) goldFromBw.push(row.most);
    }
  }
  practicePairs.push({ pred, gold: [...new Set(goldFromBw)], ranked: pred });
}
const labeledPracticePairs = practicePairs.filter((p) => p.gold.length);
let conformalHits = 0;
let conformalN = 0;
let harnessInJudgeTop3 = 0;
for (const vid of consensusVignetteIds) {
  const pv = perVignette.get(vid);
  const jm = judgeMajorityByVignette.get(vid);
  const rep = (pv.respondents || []).find((r) => r.respondentIndex === pv.representativeIndex) || pv.respondents[0];
  if (rep && Array.isArray(rep.conformal) && jm && jm.label) {
    conformalN++;
    if (rep.conformal.indexOf(jm.label) !== -1) conformalHits++;
  }
  const majorityJudge = (labelsByVignette.get(vid) || []).find((r) => Array.isArray(r.rankedTop3) && r.rankedTop3[0] === jm.label);
  if (majorityJudge && pv.aggregateMappedLabel && majorityJudge.rankedTop3.indexOf(pv.aggregateMappedLabel) !== -1) {
    harnessInJudgeTop3++;
  }
}
const rq4 = {
  note: "RQ4' — conformal set contains the judge-majority harness (nominal 1-α = 0.80 at conformalAlpha 0.2).",
  n: conformalN,
  hits: conformalHits,
  coverage: conformalN ? round(conformalHits / conformalN) : null,
  nominal: 0.8,
};
const rq6 = {
  note: "RQ6' — shipped harness is in the majority judge's rankedTop3. Compared to runner-up-credit (b43) as the T17-era floor proxy; a frozen pre-cutover T17 number was not checked in.",
  n: consensusVignetteIds.length,
  hits: harnessInJudgeTop3,
  rate: consensusVignetteIds.length ? round(harnessInJudgeTop3 / consensusVignetteIds.length) : null,
};

const gPractice = {
  note: labeledPracticePairs.length
    ? "Scored against judge best-worst 'most' labels (union per vignette)."
    : "Frozen labels.json has no bestWorst yet (T13 re-run pending). Metrics below are engine overlay prevalence only.",
  labeledVignettes: labeledPracticePairs.length,
  engine: labeledPracticePairs.length
    ? scoreMultiLabel(labeledPracticePairs, practiceUniverse)
    : null,
  prevalenceBaseline: prevalenceBaseline(labeledPracticePairs.map((p) => p.gold), 5),
  perPracticeMajority: perLabelMajority(labeledPracticePairs.map((p) => p.gold), practiceUniverse),
  engineOverlayPrevalence: (() => {
    const counts = {};
    for (const p of practicePairs) {
      for (const id of p.pred) counts[id] = (counts[id] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
  })(),
};

const partE = {
  method: "Offline re-score of frozen answers/labels under first-match vs weighted selection. No new panel.",
  shippedSelection: api.SETTINGS && api.SETTINGS.selection,
  firstMatchKappa: round(firstMatchKappa),
  weightedKappa: round(weightedKappa),
  utilityKappa: round(utilityKappa),
  delta: round((weightedKappa == null || firstMatchKappa == null) ? null : weightedKappa - firstMatchKappa),
  note: "Positive delta means weighted scoring agrees more with the frozen judge majority than first-match-wins. utilityKappa is the shipped EXT-SELECT scorer.",
};

const partD = {
  nonRoadmapShareGte40: summarizeSweep(
    "nonRoadmapShare>=40 (base-1, openspec)",
    (x) => x && x.derived === "nonRoadmapShare",
    40,
    sweepRange(40, [-15, -10, -5, 0, 5, 10, 15]),
  ),
  roadmapShareGte60: summarizeSweep(
    "q5_work_breakdown.roadmap>=60 (base-2, speckit)",
    (x) => x && x.answer === "q5_work_breakdown.roadmap",
    60,
    sweepRange(60, [-15, -10, -5, 0, 5, 10, 15]),
  ),
  teamSizeLt5: summarizeSweep(
    "teamSize<5 (base-4, superpowers/gsd)",
    (x) => x && x.derived === "teamSize",
    5,
    sweepRange(5, [-2, -1, 0, 1, 2]),
  ),
};

// ===========================================================================
// §8 — pre-registered pass/fail verdicts, applied verbatim.
// ===========================================================================

const rq1AccuracyGapVsConstant = round((b42.top1Accuracy - b5.constantOpenspec.accuracy) * 100); // percentage points
const rq1Criteria = {
  withdrawn: true,
  note: "RQ1 (base top-1 vs constant-openspec +15pp) is withdrawn by EXT-SELECT §8.5. Replacement criteria RQ1'–RQ6' apply after S1 labels exist.",
};
const rq1Verdict = "UNSTATED (RQ1 withdrawn — EXT-SELECT §8.5; harness top-1 is reported, not gated)";

const rq2Criteria = {
  atLeast60PctQuestionsNonZeroInfluence: rq2a.pass,
  noDangerQuadrantFields: c3.isEmpty,
  stabilityAtLeast070: c2.stability >= 0.7,
};
const rq2AllCriteriaMet = Object.values(rq2Criteria).every(Boolean);
const rq2Verdict = rq2AllCriteriaMet ? "PASS" : "FAIL";

const verdicts = {
  oracleUsable: { verdict: oracleVerdict, fleissKappa: b41.kappa, thresholds: b41.thresholds },
  engineRQ1: {
    verdict: rq1Verdict,
    criteria: rq1Criteria,
    numbers: {
      cohenKappa: b42.cohenKappa,
      top1Accuracy: b42.top1Accuracy,
      constantOpenspecAccuracy: b5.constantOpenspec.accuracy,
      accuracyGapVsConstantPp: rq1AccuracyGapVsConstant,
      bestStubAccuracy: b5.bestSingleQuestionStub.accuracy,
      bestStubName: b5.bestSingleQuestionStub.name,
    },
  },
  questionnaireRQ2: {
    verdict: rq2Verdict,
    criteria: rq2Criteria,
    numbers: {
      nonZeroInfluenceFraction: rq2a.fraction,
      dangerQuadrantFields: c3.fieldsInQuadrant,
      recommendationStability: c2.stability,
    },
  },
};

// ===========================================================================
// Assemble + write
// ===========================================================================

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    pinnedNow: PINNED_NOW,
    counts: { vignettes: vignetteIds.length, answers: answers.length, labels: labels.length },
    dataQuality,
    note: "This report's numbers are ONLY as meaningful as the underlying vignettes/answers/labels — see each file's generatorModel/model fields. Under the mock LLM provider (no ANTHROPIC_API_KEY/OPENAI_API_KEY), this is a pipeline-validation run, not a real Part B/C/D result (docs/QC-EXPERIMENT.md §11).",
  },
  b41_fleissKappa: b41,
  b42_engineVsMajority: {
    ...b42,
    top1AccuracyCI95: top1Ci,
    oracleCeiling: oracleCeiling,
    mcnemarVsConstantOpenspec: mcnemarVsConstant,
  },
  headroom,
  b43_runnerUpCredit: b43,
  b44_cautionPrecisionRecall: b44,
  b5_baselines: b5,
  c1_respondentAgreement: c1,
  c2_recommendationStability: c2,
  c3_dangerQuadrant: c3,
  rq2a_questionInfluenceCoverage: rq2a,
  partD_thresholdCalibration: partD,
  partE_weightedScoring: partE,
  gPractice,
  rq4_conformalCoverage: rq4,
  rq6_harnessInJudgeTop3: rq6,
  verdicts,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------

function printSweep(sweep) {
  console.log(`  ${sweep.name}`);
  console.log(
    `    shipped=${sweep.shippedValue} kappa=${sweep.shippedKappa}  peak=${sweep.peak.value} kappa=${sweep.peak.kappa}  verdict=${sweep.verdict}`,
  );
  console.log(`    curve: ${sweep.points.map((p) => `${p.value}:${p.kappa}`).join("  ")}`);
}

console.log(`\ntools/qc/analyze.mjs — ${vignetteIds.length} vignettes, ${answers.length} answers (${failedAnswers.length} failed), ${labels.length} labels (${parseFailureLabels.length} parse failures)\n`);

console.log("=== B4.1 Inter-judge Fleiss' kappa ===");
console.log(`  kappa=${b41.kappa}  (n=${b41.vignettesConsidered}/${b41.vignettesTotal})  verdict=${b41.verdict}`);

console.log("\n=== B4.2 Engine vs. majority judge label ===");
console.log(`  consensus vignettes: ${b42.consensusVignettes}/${b42.vignettesTotal} (no-consensus: ${b42.noConsensusVignettes})`);
console.log(`  top-1 accuracy: ${b42.top1Accuracy}  Cohen's kappa: ${b42.cohenKappa}`);
console.log(`  per-respondent accuracy: ${JSON.stringify(perRespondentAccuracy)}`);

console.log("\n=== Headroom (elicitation / reachability / gate integrity) ===");
console.log(`  mode-of-3: ${headroom.modeOf3Accuracy}  best-of-3: ${headroom.bestOf3Accuracy}  all-3-right: ${headroom.all3AgreeAndRightAccuracy}  elicitation headroom: ${headroom.elicitationHeadroomPp} pp`);
console.log(`  label-reachability ceiling: ${headroom.labelReachabilityCeiling}  unreachable gold: ${JSON.stringify(headroom.unreachableGoldCounts)}`);
console.log(`  false-gate winners: ${headroom.falseGateWinners}/${headroom.n} (${headroom.falseGateWinnerShare}) ${JSON.stringify(headroom.falseGateByRule)}`);

console.log("\n=== B4.3 Runner-up credit ===");
console.log(`  base-only accuracy: ${b43.baseOnlyAccuracy}  with runner-up credit: ${b43.withRunnerUpCreditAccuracy} (+${b43.additionalMatchesFromRunnerUp})`);

console.log("\n=== B4.4 Caution precision/recall (structured risk tags) ===");
console.log(`  precision=${b44.precision} recall=${b44.recall}  (tp=${b44.truePositives} fp=${b44.falsePositives} fn=${b44.falseNegatives})`);

console.log("\n=== B5 Baselines ===");
console.log(`  constant-openspec: ${b5.constantOpenspec.accuracy}`);
console.log(`  prior-weighted-random (analytic): ${b5.priorWeightedRandom.accuracy}`);
console.log(`  best single-question stub: "${b5.bestSingleQuestionStub.name}" -> ${b5.bestSingleQuestionStub.accuracy}`);

console.log("\n=== C1 Per-field respondent agreement (lowest 8 shown) ===");
for (const f of c1.perField.slice(0, 8)) console.log(`  ${f.fieldId.padEnd(24)} ${f.agreementScore}`);

console.log("\n=== C2 Recommendation stability ===");
console.log(`  ${c2.stableCount}/${c2.n} = ${c2.stability}`);

console.log("\n=== C3 Danger quadrant ===");
console.log(`  fields in quadrant: ${dangerQuadrant.length ? JSON.stringify(dangerQuadrant) : "(none)"}`);

console.log("\n=== RQ2(a) question-influence coverage ===");
console.log(`  ${rq2a.nonZeroBaseInfluenceCount}/${rq2a.nonReportOnlyFieldsConsidered} = ${rq2a.fraction} (pass >= 0.60: ${rq2a.pass})`);

console.log("\n=== Part E — weighted vs first-match (frozen labels) ===");
console.log(`  shipped selection: ${partE.shippedSelection}`);
console.log(`  first-match kappa: ${partE.firstMatchKappa}`);
console.log(`  weighted kappa:    ${partE.weightedKappa}  (delta ${partE.delta})`);

console.log("\n=== Part D — threshold calibration ===");
printSweep(partD.nonRoadmapShareGte40);
printSweep(partD.roadmapShareGte60);
printSweep(partD.teamSizeLt5);

console.log("\n=== §8 Pre-registered verdicts ===");
console.log(`  Oracle usable:        ${verdicts.oracleUsable.verdict}  (Fleiss kappa=${verdicts.oracleUsable.fleissKappa})`);
console.log(`  Engine passes RQ1:    ${verdicts.engineRQ1.verdict}`);
console.log(`    criteria: ${JSON.stringify(verdicts.engineRQ1.criteria)}`);
console.log(`  Questionnaire passes RQ2: ${verdicts.questionnaireRQ2.verdict}`);
console.log(`    criteria: ${JSON.stringify(verdicts.questionnaireRQ2.criteria)}`);

console.log(`\nwrote ${path.relative(process.cwd(), OUT_PATH)}`);

return report;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    main();
    process.exit(0);
  } catch (err) {
    console.error("tools/qc/analyze.mjs FAILED");
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

export { cohenKappa, fleissKappa, modeOf, main };
