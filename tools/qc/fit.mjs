/**
 * Offline fit + G-FIT (EXT-SELECT S4 / §5.5 / §9.4).
 *
 * Ships a prior-centered parameter check and a Plackett-Luce likelihood
 * against frozen framework rankings. Best-worst practice labels are used
 * when present; they are not required to run G-FIT on the prior.
 *
 * Usage:
 *   node tools/qc/fit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PINNED_NOW } from "../corpus.mjs";
import { coverageOf, demandVector, feasibleFrameworks, samplePosterior, selectUtility } from "../../src/select.mjs";
import { macroF1, prevalenceBaseline } from "./metrics.mjs";
import { evalExpr, evalDerived } from "../../src/expr.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const LABELS_PATH = path.join(DATA_DIR, "labels.json");
const ANSWERS_PATH = path.join(DATA_DIR, "answers.json");
const OUT_PATH = path.join(DATA_DIR, "fit-report.json");

const MU_KEYS = ["ceremony", "tokens", "adoption"];

function clamp0(value) {
  return value < 0 ? 0 : value;
}

function splitOf(vignetteId) {
  let h = 2166136261;
  const s = String(vignetteId);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = (h >>> 0) % 100;
  if (bucket < 60) return "train";
  if (bucket < 80) return "cal";
  return "test";
}

function nativePractices(framework, byId, answers, derived) {
  const ids = framework.bundle || [];
  const set = [];
  for (let i = 0; i < ids.length; i++) {
    const practice = byId[ids[i]];
    if (!practice) continue;
    if (practice.requiresWhen && evalExpr(practice.requiresWhen, {
      answers, derived, result: null, flags: {}, fieldIndex: {},
    }) !== true) continue;
    set.push(practice);
  }
  return set;
}

function costParts(framework, set) {
  let ceremony = (framework.cost && framework.cost.ceremony) || 0;
  let tokens = (framework.cost && framework.cost.tokens) || 0;
  for (let i = 0; i < set.length; i++) {
    ceremony += (set[i].cost && set[i].cost.ceremony) || 0;
    tokens += (set[i].cost && set[i].cost.tokens) || 0;
  }
  return {
    ceremony,
    tokens,
    adoption: (framework.cost && framework.cost.adoption) || 0,
  };
}

/** Native-bundle features. U = -theta·shortfall - lambda·overshoot - mu·cost. */
export function featureRows(pack, answers) {
  const axes = pack.axes || [];
  const practices = pack.practices || [];
  const byId = {};
  for (let i = 0; i < practices.length; i++) byId[practices[i].id] = practices[i];
  const params = pack.parameters || {};
  const derived = evalDerived(pack.derived || [], answers, {});
  const demand = demandVector(axes, answers, derived, pack.demandScopes || [], evalExpr, {
    answers, derived, result: null, flags: {}, fieldIndex: {},
  });
  const feas = feasibleFrameworks(pack.frameworks || [], answers, pack.settings || {});
  const rows = {};
  for (let i = 0; i < feas.feasible.length; i++) {
    const framework = feas.feasible[i];
    const set = nativePractices(framework, byId, answers, derived);
    const shortfall = {};
    const overshoot = {};
    for (let a = 0; a < axes.length; a++) {
      const id = axes[a].id;
      const d = demand[id] || 0;
      const cov = coverageOf(set, id, params.kappa || {}, params.gamma);
      shortfall[id] = d * (1 - cov);
      overshoot[id] = (1 - d) * cov;
    }
    rows[framework.id] = { shortfall, overshoot, cost: costParts(framework, set) };
  }
  return { rows, feasible: feas.feasible.map((f) => f.id) };
}

export function utilityFromFeatures(row, theta, lambda, mu) {
  let u = 0;
  for (const id of Object.keys(row.shortfall)) {
    u -= (theta[id] || 0) * row.shortfall[id];
    u -= (lambda[id] || 0) * row.overshoot[id];
  }
  u -= (mu.ceremony || 0) * row.cost.ceremony;
  u -= (mu.tokens || 0) * row.cost.tokens;
  u -= (mu.adoption || 0) * row.cost.adoption;
  return u;
}

function softmaxMap(scores) {
  const ids = Object.keys(scores);
  let max = -Infinity;
  for (const id of ids) if (scores[id] > max) max = scores[id];
  const exps = {};
  let sum = 0;
  for (const id of ids) {
    exps[id] = Math.exp(scores[id] - max);
    sum += exps[id];
  }
  const p = {};
  for (const id of ids) p[id] = exps[id] / sum;
  return p;
}

/** Partial Plackett-Luce: rankedTop3 is a prefix; the rest of `feasible` stays in the denominator. */
export function plackettLuce(ranking, scores) {
  const remaining = Object.keys(scores);
  let ll = 0;
  const gradU = {};
  for (const id of remaining) gradU[id] = 0;
  for (let k = 0; k < ranking.length; k++) {
    const chosen = ranking[k];
    if (!Object.prototype.hasOwnProperty.call(scores, chosen)) break;
    const subset = {};
    for (const id of remaining) subset[id] = scores[id];
    const p = softmaxMap(subset);
    for (const id of remaining) gradU[id] -= p[id];
    gradU[chosen] += 1;
    ll += Math.log(p[chosen]);
    const idx = remaining.indexOf(chosen);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return { ll, gradU };
}

function packVectors(params, axisIds) {
  const theta = {};
  const lambda = {};
  for (const id of axisIds) {
    theta[id] = (params.theta && params.theta[id]) || 0;
    lambda[id] = (params.lambda && params.lambda[id]) || 0;
  }
  const mu = {};
  for (const key of MU_KEYS) mu[key] = (params.mu && params.mu[key]) || 0;
  return { theta, lambda, mu };
}

function practiceRows(pack, answers) {
  const axes = pack.axes || [];
  const params = pack.parameters || {};
  const derived = evalDerived(pack.derived || [], answers, {});
  const demand = demandVector(axes, answers, derived, pack.demandScopes || [], evalExpr, {
    answers, derived, result: null, flags: {}, fieldIndex: {},
  });
  const rows = {};
  for (const practice of pack.practices || []) {
    const shortfall = {};
    const overshoot = {};
    for (let a = 0; a < axes.length; a++) {
      const id = axes[a].id;
      const d = demand[id] || 0;
      const cov = coverageOf([practice], id, params.kappa || {}, params.gamma);
      shortfall[id] = d * (1 - cov);
      overshoot[id] = (1 - d) * cov;
    }
    const cost = practice.cost || {};
    rows[practice.id] = {
      shortfall,
      overshoot,
      cost: { ceremony: cost.ceremony || 0, tokens: cost.tokens || 0, adoption: 0 },
    };
  }
  return rows;
}

/** Most-then-least on one presented set. Least is a softmax over negated utilities. */
function maxDiff(most, least, presented, scores) {
  const subset = {};
  for (const id of presented) if (Object.prototype.hasOwnProperty.call(scores, id)) subset[id] = scores[id];
  const gradU = {};
  if (!Object.prototype.hasOwnProperty.call(subset, most) || !Object.prototype.hasOwnProperty.call(subset, least) || most === least) {
    return { ll: 0, gradU };
  }
  const pMost = softmaxMap(subset);
  let ll = Math.log(pMost[most]);
  for (const id of Object.keys(subset)) gradU[id] = -pMost[id];
  gradU[most] += 1;
  const rest = {};
  for (const id of Object.keys(subset)) if (id !== most) rest[id] = -scores[id];
  if (!Object.prototype.hasOwnProperty.call(rest, least)) return { ll, gradU };
  const pLeast = softmaxMap(rest);
  ll += Math.log(pLeast[least]);
  for (const id of Object.keys(rest)) gradU[id] += id === least ? pLeast[id] - 1 : pLeast[id];
  return { ll, gradU };
}

function addUtilityGrad(gTheta, gLambda, gMu, row, g, axisIds) {
  for (const id of axisIds) {
    gTheta[id] += g * (-(row.shortfall[id] || 0));
    gLambda[id] += g * (-(row.overshoot[id] || 0));
  }
  gMu.ceremony += g * (-(row.cost.ceremony || 0));
  gMu.tokens += g * (-(row.cost.tokens || 0));
  gMu.adoption += g * (-(row.cost.adoption || 0));
}

function objectiveAndGrad(cases, bwCases, theta, lambda, mu, prior, tau) {
  let ll = 0;
  const gTheta = {};
  const gLambda = {};
  const gMu = { ceremony: 0, tokens: 0, adoption: 0 };
  const axisIds = Object.keys(theta);
  for (const id of axisIds) {
    gTheta[id] = 0;
    gLambda[id] = 0;
  }
  for (let c = 0; c < cases.length; c++) {
    const scores = {};
    const rows = cases[c].rows;
    for (const id of Object.keys(rows)) scores[id] = utilityFromFeatures(rows[id], theta, lambda, mu);
    const step = plackettLuce(cases[c].ranking, scores);
    ll += step.ll;
    for (const fid of Object.keys(step.gradU)) addUtilityGrad(gTheta, gLambda, gMu, rows[fid], step.gradU[fid], axisIds);
  }
  for (let c = 0; c < bwCases.length; c++) {
    const rows = bwCases[c].rows;
    const scores = {};
    for (const id of bwCases[c].presented) {
      if (rows[id]) scores[id] = utilityFromFeatures(rows[id], theta, lambda, mu);
    }
    const step = maxDiff(bwCases[c].most, bwCases[c].least, bwCases[c].presented, scores);
    ll += step.ll;
    for (const fid of Object.keys(step.gradU)) {
      if (rows[fid]) addUtilityGrad(gTheta, gLambda, gMu, rows[fid], step.gradU[fid], axisIds);
    }
  }
  const ridge = 1 / (2 * tau * tau);
  const inv = 1 / (tau * tau);
  for (const id of axisIds) {
    ll -= ridge * (theta[id] - prior.theta[id]) ** 2;
    ll -= ridge * (lambda[id] - prior.lambda[id]) ** 2;
    gTheta[id] -= inv * (theta[id] - prior.theta[id]);
    gLambda[id] -= inv * (lambda[id] - prior.lambda[id]);
  }
  for (const key of MU_KEYS) {
    ll -= ridge * (mu[key] - prior.mu[key]) ** 2;
    gMu[key] -= inv * (mu[key] - prior.mu[key]);
  }
  return { ll, gTheta, gLambda, gMu };
}

function projectNonneg(theta, lambda, mu) {
  for (const id of Object.keys(theta)) theta[id] = clamp0(theta[id]);
  for (const id of Object.keys(lambda)) lambda[id] = clamp0(lambda[id]);
  for (const key of MU_KEYS) mu[key] = clamp0(mu[key]);
}

export function fitParameters(cases, priorParams, axisIds, tau, { steps = 400, start = "prior", bwCases = [] } = {}) {
  const prior = packVectors(priorParams, axisIds);
  const theta = {};
  const lambda = {};
  const mu = {};
  for (const id of axisIds) {
    const scale = start === "zero" ? 0 : start === "half" ? 0.5 : 1;
    theta[id] = prior.theta[id] * scale;
    lambda[id] = prior.lambda[id] * scale;
  }
  for (const key of MU_KEYS) {
    const scale = start === "zero" ? 0 : start === "half" ? 0.5 : 1;
    mu[key] = prior.mu[key] * scale;
  }
  projectNonneg(theta, lambda, mu);
  let step = 0.05;
  let last = objectiveAndGrad(cases, bwCases, theta, lambda, mu, prior, tau).ll;
  for (let s = 0; s < steps; s++) {
    const { ll, gTheta, gLambda, gMu } = objectiveAndGrad(cases, bwCases, theta, lambda, mu, prior, tau);
    let accepted = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const nextT = { ...theta };
      const nextL = { ...lambda };
      const nextM = { ...mu };
      for (const id of axisIds) {
        nextT[id] += step * gTheta[id];
        nextL[id] += step * gLambda[id];
      }
      for (const key of MU_KEYS) nextM[key] += step * gMu[key];
      projectNonneg(nextT, nextL, nextM);
      const next = objectiveAndGrad(cases, bwCases, nextT, nextL, nextM, prior, tau).ll;
      if (next >= ll - 1e-9) {
        Object.assign(theta, nextT);
        Object.assign(lambda, nextL);
        Object.assign(mu, nextM);
        last = next;
        step = Math.min(step * 1.05, 1);
        accepted = true;
        break;
      }
      step *= 0.5;
    }
    if (!accepted) break;
  }
  return { theta, lambda, mu, logLik: last };
}

function gFit(pack) {
  const params = pack.parameters || {};
  const axisIds = new Set((pack.axes || []).map((a) => a.id));
  const failures = [];
  for (const key of ["theta", "lambda"]) {
    const vec = params[key] || {};
    for (const id of Object.keys(vec)) {
      if (!axisIds.has(id)) failures.push(`parameters.${key}.${id} is not an AxisId`);
      if (vec[id] < 0) failures.push(`parameters.${key}.${id} is negative`);
    }
  }
  for (const key of Object.keys(params.mu || {})) {
    if (params.mu[key] < 0) failures.push(`parameters.mu.${key} is negative`);
  }
  const frameworkIds = new Set((pack.frameworks || []).map((f) => f.id));
  for (const key of ["theta", "lambda"]) {
    for (const id of Object.keys(params[key] || {})) {
      if (frameworkIds.has(id)) failures.push(`fitted index ${id} is a FrameworkId`);
    }
  }
  return { ok: failures.length === 0, failures, tier: params.tier || "prior" };
}

function scoresFor(rows, theta, lambda, mu) {
  const scores = {};
  for (const id of Object.keys(rows)) scores[id] = utilityFromFeatures(rows[id], theta, lambda, mu);
  return scores;
}

function argmax(scores) {
  let best = null;
  let bestU = -Infinity;
  for (const id of Object.keys(scores)) {
    if (scores[id] > bestU) {
      bestU = scores[id];
      best = id;
    }
  }
  return best;
}

function majorityTop1(recs) {
  const counts = {};
  for (const rec of recs) {
    const top = rec.rankedTop3 && rec.rankedTop3[0];
    if (!top) continue;
    counts[top] = (counts[top] || 0) + 1;
  }
  let best = null;
  let n = 0;
  let tie = false;
  for (const id of Object.keys(counts)) {
    if (counts[id] > n) {
      best = id;
      n = counts[id];
      tie = false;
    } else if (counts[id] === n) tie = true;
  }
  if (!best || tie || n < 2) return null;
  return best;
}

function rate(hits, total) {
  return total ? hits / total : null;
}

function evaluateSplit(vignettes, predict, majorityOf) {
  let top1 = 0;
  let top3 = 0;
  let n = 0;
  for (const id of vignettes) {
    const majority = majorityOf.get(id);
    if (!majority) continue;
    const pred = predict(id);
    if (!pred) continue;
    n++;
    if (pred === majority.label) top1++;
    const judge = majority.recs.find((r) => r.rankedTop3 && r.rankedTop3[0] === majority.label);
    if (judge && judge.rankedTop3.indexOf(pred) !== -1) top3++;
  }
  return { n, top1: rate(top1, n), top3: rate(top3, n), top1Hits: top1, top3Hits: top3 };
}

function main() {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, "../../packs/finance-tech.json"), "utf8"));
  const gfit = gFit(pack);
  const labels = fs.existsSync(LABELS_PATH) ? JSON.parse(fs.readFileSync(LABELS_PATH, "utf8")) : [];
  const answers = fs.existsSync(ANSWERS_PATH) ? JSON.parse(fs.readFileSync(ANSWERS_PATH, "utf8")) : [];
  const answersByV = new Map();
  for (const rec of answers) {
    if (rec.respondentIndex === 0 && rec.answers) answersByV.set(rec.vignetteId, rec.answers);
  }

  const axisIds = (pack.axes || []).map((a) => a.id);
  const prior = packVectors(pack.parameters || {}, axisIds);
  const byVignette = new Map();
  let bestWorst = 0;
  for (const lab of labels) {
    if (lab.bestWorst && Array.isArray(lab.bestWorst)) bestWorst += lab.bestWorst.length;
    if (!Array.isArray(lab.rankedTop3) || lab.parseFailure) continue;
    if (!byVignette.has(lab.vignetteId)) byVignette.set(lab.vignetteId, []);
    byVignette.get(lab.vignetteId).push(lab);
  }

  const cases = [];
  const features = new Map();
  const majorityOf = new Map();
  for (const [vignetteId, recs] of byVignette) {
    const ans = answersByV.get(vignetteId);
    if (!ans) continue;
    const feat = featureRows(pack, ans);
    features.set(vignetteId, feat);
    const label = majorityTop1(recs);
    if (label) majorityOf.set(vignetteId, { label, recs });
    for (const rec of recs) {
      const ranking = rec.rankedTop3.filter((id) => feat.rows[id]);
      if (ranking.length < 3) continue;
      cases.push({ vignetteId, split: splitOf(vignetteId), ranking, rows: feat.rows });
    }
  }

  const bwCases = [];
  const practiceByV = new Map();
  for (const lab of labels) {
    if (!Array.isArray(lab.bestWorst) || lab.bestWorstParseFailure) continue;
    const ans = answersByV.get(lab.vignetteId);
    if (!ans) continue;
    if (!practiceByV.has(lab.vignetteId)) practiceByV.set(lab.vignetteId, practiceRows(pack, ans));
    const rows = practiceByV.get(lab.vignetteId);
    for (const row of lab.bestWorst) {
      const presented = row.presented || [];
      if (!row.most || !row.least || row.most === row.least) continue;
      if (!presented.includes(row.most) || !presented.includes(row.least)) continue;
      bwCases.push({
        vignetteId: lab.vignetteId,
        split: splitOf(lab.vignetteId),
        presented,
        most: row.most,
        least: row.least,
        rows,
      });
    }
  }

  const train = cases.filter((c) => c.split === "train");
  const trainBw = bwCases.filter((c) => c.split === "train");
  const taus = [0.25, 0.5, 1, 2];
  let chosen = null;
  for (const tau of taus) {
    const fit = fitParameters(train, pack.parameters, axisIds, tau, { start: "prior", bwCases: trainBw });
    const cold = fitParameters(train, pack.parameters, axisIds, tau, { start: "half", bwCases: trainBw });
    const same = Math.abs(fit.logLik - cold.logLik) < 0.05;
    if (!chosen || fit.logLik > chosen.fit.logLik) chosen = { tau, fit, coldLogLik: cold.logLik, sameOptimum: same };
  }

  function predict(params, vignetteId) {
    const feat = features.get(vignetteId);
    if (!feat) return null;
    return argmax(scoresFor(feat.rows, params.theta, params.lambda, params.mu));
  }
  const ids = [...features.keys()];
  const testIds = ids.filter((id) => splitOf(id) === "test");
  const priorEval = evaluateSplit(testIds, (id) => predict(prior, id), majorityOf);
  const fitEval = evaluateSplit(testIds, (id) => predict(chosen.fit, id), majorityOf);

  const universe = (pack.practices || []).map((p) => p.id);
  function goldMost(vignetteId) {
    const recs = byVignette.get(vignetteId) || [];
    const ids = [];
    for (const rec of recs) {
      for (const row of rec.bestWorst || []) if (row.most) ids.push(row.most);
    }
    return [...new Set(ids)];
  }
  function predictedSet(params, vignetteId) {
    const ans = answersByV.get(vignetteId);
    if (!ans) return [];
    const trial = {
      ...pack,
      parameters: { ...pack.parameters, theta: params.theta, lambda: params.lambda, mu: params.mu },
    };
    const derived = evalDerived(pack.derived || [], ans, {});
    const picked = selectUtility({ pack: trial, answers: ans, derived, evalExpr });
    return (picked.set || []).map((p) => p.id);
  }
  const trainIds = ids.filter((id) => splitOf(id) === "train");
  const trainGold = trainIds.map(goldMost).filter((g) => g.length);
  const prevalence = prevalenceBaseline(trainGold, 5);
  const holdoutPairs = testIds.map((id) => ({ pred: predictedSet(chosen.fit, id), gold: goldMost(id) })).filter((p) => p.gold.length);
  const priorPairs = testIds.map((id) => ({ pred: predictedSet(prior, id), gold: goldMost(id) })).filter((p) => p.gold.length);
  const fittedMacro = macroF1(holdoutPairs, universe).f1;
  const priorMacro = macroF1(priorPairs, universe).f1;
  const prevalenceMacro = macroF1(holdoutPairs.map((p) => ({ pred: prevalence, gold: p.gold })), universe).f1;
  const rngSeed = 0x51ec7;
  let rngState = rngSeed;
  function rng() {
    rngState = (rngState + 0x6D2B79F5) >>> 0;
    let x = rngState;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  const deltas = [];
  const B = 400;
  for (let b = 0; b < B; b++) {
    const sample = [];
    for (let i = 0; i < holdoutPairs.length; i++) sample.push(holdoutPairs[Math.floor(rng() * holdoutPairs.length)]);
    const eng = macroF1(sample, universe).f1;
    const base = macroF1(sample.map((p) => ({ pred: prevalence, gold: p.gold })), universe).f1;
    deltas.push(eng - base);
  }
  deltas.sort((a, b) => a - b);
  const deltaLo = deltas.length ? deltas[Math.floor(0.025 * deltas.length)] : null;
  const deltaHi = deltas.length ? deltas[Math.floor(0.975 * deltas.length)] : null;
  const rq1 = deltaLo != null && deltaLo > 0;
  const rq6Floor = 0.7528;
  const rq6 = fitEval.top3 != null && fitEval.top3 + 1e-9 >= rq6Floor;
  const ship = bestWorst > 0 && rq1 && rq6;
  const practice = {
    holdoutN: holdoutPairs.length,
    priorMacroF1: priorMacro,
    fittedMacroF1: fittedMacro,
    prevalenceMacroF1: prevalenceMacro,
    deltaCi95: [deltaLo, deltaHi],
    rq1,
    rq6,
    rq6Floor,
  };

  const alpha = (pack.settings && pack.settings.utility && pack.settings.utility.conformalAlpha) || 0.2;
  const calScores = [];
  const testScores = [];
  for (const id of ids) {
    const majority = majorityOf.get(id);
    const feat = features.get(id);
    if (!majority || !feat || !feat.rows[majority.label]) continue;
    const share = softmaxMap(scoresFor(feat.rows, prior.theta, prior.lambda, prior.mu));
    const score = 1 - (share[majority.label] || 0);
    const bucket = splitOf(id);
    if (bucket === "cal") calScores.push(score);
    else if (bucket === "test") testScores.push(score);
  }
  calScores.sort((a, b) => a - b);
  const qIndex = Math.min(calScores.length, Math.ceil((calScores.length + 1) * (1 - alpha))) - 1;
  const qhat = calScores.length ? calScores[Math.max(0, qIndex)] : null;
  const covered = (scores) => scores.filter((s) => qhat != null && s <= qhat + 1e-12).length;
  const conformal = {
    alpha,
    nCal: calScores.length,
    qhat,
    calCoverage: rate(covered(calScores), calScores.length),
    testCoverage: rate(covered(testScores), testScores.length),
  };

  let posterior = null;
  const firstAns = answers.find((rec) => rec.answers);
  if (firstAns) {
    const derived = evalDerived(pack.derived || [], firstAns.answers, {});
    posterior = samplePosterior({ pack, answers: firstAns.answers, derived, evalExpr }, { n: 8, sigma: 0.2 });
  }

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      pinnedNow: PINNED_NOW,
      trainCases: train.length,
      bestWorstSets: bwCases.length,
    },
    gFit,
    fit: {
      tau: chosen.tau,
      trainLogLik: chosen.fit.logLik,
      coldStartLogLik: chosen.coldLogLik,
      sameOptimum: chosen.sameOptimum,
      shipped: ship,
      holdout: { prior: priorEval, fitted: fitEval },
      practice,
      conformal,
      theta: chosen.fit.theta,
      lambda: chosen.fit.lambda,
      mu: chosen.fit.mu,
    },
    posterior,
    note: "Joint L1+L2 fit. Weights ship only when holdout practice macro-F1 beats prevalence with a CI above zero and harness top-3 is at least 75.28%.",
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`G-FIT ${gfit.ok ? "OK" : "FAIL"}  tau=${chosen.tau}  train ll=${chosen.fit.logLik.toFixed(2)}  cold=${chosen.coldLogLik.toFixed(2)}  same=${chosen.sameOptimum}`);
  console.log(`holdout top3 prior=${priorEval.top3 == null ? "n/a" : (priorEval.top3 * 100).toFixed(1)}%  fitted=${fitEval.top3 == null ? "n/a" : (fitEval.top3 * 100).toFixed(1)}%  rq6=${rq6}`);
  console.log(`practice macro-F1 prior=${priorMacro.toFixed(3)} fitted=${fittedMacro.toFixed(3)} prevalence=${prevalenceMacro.toFixed(3)} deltaCI=[${deltaLo == null ? "n/a" : deltaLo.toFixed(3)}, ${deltaHi == null ? "n/a" : deltaHi.toFixed(3)}] rq1=${rq1} ship=${ship}`);
  console.log(`conformal qhat=${qhat == null ? "n/a" : qhat.toFixed(4)}  cal=${conformal.calCoverage == null ? "n/a" : (conformal.calCoverage * 100).toFixed(1)}%  test=${conformal.testCoverage == null ? "n/a" : (conformal.testCoverage * 100).toFixed(1)}%`);
  if (!gfit.ok) {
    for (const f of gfit.failures) console.error(" ", f);
    process.exit(1);
  }
  if (ship && process.argv.includes("--write")) {
    pack.parameters.tier = "fitted";
    pack.parameters.note = `Joint L1+L2 fit, tau=${chosen.tau}.`;
    pack.parameters.theta = chosen.fit.theta;
    pack.parameters.lambda = chosen.fit.lambda;
    pack.parameters.mu = chosen.fit.mu;
    fs.writeFileSync(path.join(__dirname, "../../packs/finance-tech.json"), JSON.stringify(pack, null, 2) + "\n");
    console.log("wrote fitted parameters to packs/finance-tech.json");
  }
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();
