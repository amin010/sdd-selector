/**
 * Part A — offline, deterministic discrimination / sensitivity analysis.
 *
 * A1. Outcome distribution over the full corpus + the BMAD/Q20 reachability hole.
 * A2. One-at-a-time (OAT) perturbation / per-field influence scores.
 * A3. Discrete mutual information between each field's answer and the base outcome,
 *     plus pairwise MI between fields that feed the same base rule (redundancy).
 * A4. Threshold brittleness around the nonRoadmapShare>=40, roadmap>=60, and
 *     teamSize<5 cliffs.
 *
 * Usage:
 *   node tools/qc/sensitivity.mjs
 *
 * Writes tools/qc/data/sensitivity-report.json and prints a human-readable
 * summary to stdout. Pure Node ESM, no network, no LLM, no external deps.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpus, flattenCorpus, seededRandom, PINNED_NOW } from "../corpus.mjs";
import {
  loadEngine,
  evaluateAnswers,
  projectOutcome,
  outcomeLabel,
  questionSchema,
  REACHABLE_OUTCOMES,
} from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const REPORT_PATH = path.join(DATA_DIR, "sensitivity-report.json");

const FULL_RANDOM_COUNT = 50_000;
const FULL_OAT_SAMPLE_SIZE = 2_000;
const QUICK_RANDOM_COUNT = 1_500;
const QUICK_OAT_SAMPLE_SIZE = 80;

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function pct(num, den) {
  return den ? (100 * num) / den : 0;
}

function round(n, digits = 3) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function safeEvaluate(api, answers) {
  try {
    return { ok: true, projection: projectOutcome(evaluateAnswers(api, answers)) };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// A1 — outcome distribution + BMAD/Q20 reachability hole
// ---------------------------------------------------------------------------

function outcomeDistribution(cases) {
  const counts = Object.fromEntries(REACHABLE_OUTCOMES.map((l) => [l, 0]));
  let errors = 0;
  for (const { answers } of cases) {
    const evaluated = safeEvaluate(this.api, answers);
    if (!evaluated.ok) {
      errors++;
      continue;
    }
    const label = outcomeLabel(evaluated.projection);
    if (label != null && Object.prototype.hasOwnProperty.call(counts, label)) {
      counts[label]++;
    } else {
      // Should not happen — outcomeLabel only ever returns a canonical label
      // or null (null projection), but guard defensively.
      counts.__unexpected = (counts.__unexpected || 0) + 1;
    }
  }
  const total = cases.length;
  const percentages = Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, round(pct(v, total), 2)]),
  );
  return { total, errors, counts, percentages };
}

/**
 * Quantify the "BMAD reachability hole": among cases where q20_runtimes was
 * answered with a non-empty array, base-3's `when` condition is checked
 * directly (bypassing the tier-0 runtime filter) using the same
 * `SDDExpr.evalExpr` + context shape the engine's own `ruleMatches` uses
 * internally (see index.html's ruleMatches/makeCtx, mirrored here since the
 * engine does not export those helpers). Pack 0.4.1 treats an empty framework
 * `runtimes` array as unrestricted, so answering Q20 no longer drops BMAD from
 * the candidate set. Remaining hole cases are first-match-wins (base-1
 * non-roadmap still preempts base-3) rather than a reachability bug. We still
 * measure matched-but-not-bmad rather than assuming the hole is closed.
 */
function bmadReachabilityHole(cases, api) {
  const base3 = (api.BASE_RULES || []).find((r) => r.id === "base-3");
  if (!base3) {
    throw new Error("base-3 (bmad) rule not found in api.BASE_RULES");
  }
  let q20AnsweredCount = 0;
  let base3WhenMatchedCount = 0;
  let holeCount = 0;

  for (const { answers } of cases) {
    const rt = answers && answers.q20_runtimes;
    if (!Array.isArray(rt) || rt.length === 0) continue;
    q20AnsweredCount++;

    let derived;
    try {
      derived = api.derive(answers);
    } catch {
      continue;
    }
    const ctx = {
      answers: answers || {},
      derived: derived || {},
      result: null,
      flags: {},
      fieldIndex: api.FIELD_INDEX,
    };
    let whenMatches = false;
    try {
      whenMatches = api.SDDExpr.evalExpr(base3.when, ctx) === true;
    } catch {
      whenMatches = false;
    }
    if (!whenMatches) continue;
    base3WhenMatchedCount++;

    const evaluated = safeEvaluate(api, answers);
    const label = evaluated.ok ? outcomeLabel(evaluated.projection) : null;
    if (label !== "bmad") holeCount++;
  }

  return {
    corpusSize: cases.length,
    q20AnsweredCount,
    base3WhenMatchedCount,
    holeCount,
    holeShareOfCorpusPct: round(pct(holeCount, cases.length), 3),
    holeShareOfQ20AnsweredPct: round(pct(holeCount, q20AnsweredCount), 3),
    holeShareOfBase3MatchedPct: round(pct(holeCount, base3WhenMatchedCount), 3),
  };
}

// ---------------------------------------------------------------------------
// A2 — one-at-a-time (OAT) perturbation / influence scores
// ---------------------------------------------------------------------------

/**
 * Perturbation strategy per field kind (documented here since the task asks
 * for judgment calls to be recorded):
 *
 *  - single:  sweep through every OTHER valid option value.
 *  - multi:   toggle membership of each option one at a time (add if absent,
 *             remove if present) — one alternate answer per option.
 *  - ranked:  reverse the ranking, rotate it by one position, and swap in
 *             up to 3 currently-unranked options at the top rank. If the
 *             field is unanswered, populate it with the first N options.
 *  - record:  for single-kind inner fields (e.g. q2_team.product_owner),
 *             sweep through the other valid values, exactly like a
 *             top-level single field. For number-kind inner fields, swap
 *             the value with an adjacent sibling field's value (this keeps
 *             sum-constrained records like q5_work_breakdown still summing
 *             to 100, and gives a real elementary-effects probe for
 *             non-sum-constrained records like q2_team even though the
 *             result may not be a "realistic" team).
 *  - number/text (top-level): skipped. The only top-level text field is
 *    q17_process_mismatch (reportOnly), and there are no top-level number
 *    fields (q5/q2's numbers are nested inside records, handled above) —
 *    this also doubles as a sanity check, since a skipped field trivially
 *    reports a base-influence score of 0.
 */
function alternatesForField(fieldDesc, currentValue) {
  switch (fieldDesc.kind) {
    case "single":
      return (fieldDesc.options || [])
        .filter((v) => v !== currentValue)
        .map((v) => ({ value: v, tag: `=${v}` }));

    case "multi": {
      const opts = fieldDesc.options || [];
      const cur = Array.isArray(currentValue) ? currentValue : [];
      return opts.map((opt) => {
        const has = cur.includes(opt);
        const next = has ? cur.filter((v) => v !== opt) : [...cur, opt];
        return { value: next, tag: `toggle:${opt}` };
      });
    }

    case "ranked": {
      const opts = fieldDesc.options || [];
      const ranksN = fieldDesc.ranks || 3;
      const cur = Array.isArray(currentValue) ? currentValue : [];
      const alternates = [];
      if (cur.length > 1) {
        alternates.push({ value: [...cur].reverse(), tag: "reverse" });
        alternates.push({ value: [...cur.slice(1), cur[0]], tag: "rotate" });
      }
      if (cur.length === 0) {
        alternates.push({ value: opts.slice(0, ranksN), tag: "populate" });
      } else {
        const unused = opts.filter((o) => !cur.includes(o));
        for (const o of unused.slice(0, 3)) {
          const next = [o, ...cur.filter((x) => x !== o)].slice(0, ranksN);
          alternates.push({ value: next, tag: `swap-in:${o}` });
        }
      }
      return alternates;
    }

    case "record":
      return recordAlternates(fieldDesc, currentValue);

    case "text":
    case "number":
    default:
      return [];
  }
}

function recordAlternates(fieldDesc, currentValue) {
  const cur = currentValue && typeof currentValue === "object" ? currentValue : {};
  const subFields = fieldDesc.fields || [];
  const alternates = [];

  for (let i = 0; i < subFields.length; i++) {
    const sub = subFields[i];
    if (sub.kind === "single") {
      for (const opt of (sub.options || []).filter((v) => v !== cur[sub.id])) {
        alternates.push({
          value: { ...cur, [sub.id]: opt },
          tag: `${sub.id}=${opt}`,
        });
      }
    } else if (sub.kind === "number") {
      const buddy = subFields[(i + 1) % subFields.length];
      if (buddy && buddy.kind === "number" && buddy.id !== sub.id) {
        const a = cur[sub.id];
        const b = cur[buddy.id];
        if (a !== undefined && b !== undefined && a !== b) {
          alternates.push({
            value: { ...cur, [sub.id]: b, [buddy.id]: a },
            tag: `swap:${sub.id}<->${buddy.id}`,
          });
        }
      }
    }
  }
  return alternates;
}

function sortedOverlayIds(overlays) {
  return (overlays || []).map((o) => o.id).sort();
}

function diffProjections(a, b) {
  const baseChanged = a.baseId !== b.baseId;
  const fallbackFlipped = !!a.fallback !== !!b.fallback;
  const overlayChanged =
    JSON.stringify(sortedOverlayIds(a.overlays)) !== JSON.stringify(sortedOverlayIds(b.overlays));
  const cautionChanged =
    JSON.stringify([...(a.cautions || [])].sort()) !== JSON.stringify([...(b.cautions || [])].sort());
  return { baseChanged, fallbackFlipped, overlayChanged, cautionChanged };
}

function runOatSensitivity(profiles, api, fields) {
  const fieldStats = new Map();
  for (const f of fields) {
    fieldStats.set(f.id, {
      fieldId: f.id,
      questionId: f.questionId,
      questionReportOnly: f.questionReportOnly,
      kind: f.kind,
      totalPairs: 0,
      // baseInfluenced = baseId changed OR the fallback flag flipped — either
      // is a materially different recommendation outcome. Counted as a union
      // (once per pair) rather than as two separate counters, so it never
      // double-counts a pair where both happen together.
      baseInfluenced: 0,
      overlayChanged: 0,
      cautionChanged: 0,
      evalErrors: 0,
    });
  }

  for (const { answers } of profiles) {
    const baseline = safeEvaluate(api, answers);
    if (!baseline.ok) continue; // can't measure deltas from a throwing baseline

    for (const f of fields) {
      const stats = fieldStats.get(f.id);
      const currentValue = answers ? answers[f.id] : undefined;
      const alternates = alternatesForField(f, currentValue);
      for (const alt of alternates) {
        const trialAnswers = { ...answers, [f.id]: alt.value };
        const trial = safeEvaluate(api, trialAnswers);
        stats.totalPairs++;
        if (!trial.ok) {
          stats.evalErrors++;
          continue;
        }
        const diff = diffProjections(baseline.projection, trial.projection);
        if (diff.baseChanged || diff.fallbackFlipped) stats.baseInfluenced++;
        if (diff.overlayChanged) stats.overlayChanged++;
        if (diff.cautionChanged) stats.cautionChanged++;
      }
    }
  }

  return [...fieldStats.values()].map((s) => ({
    ...s,
    baseInfluenceScore: round(pct(s.baseInfluenced, s.totalPairs), 4),
    overlayInfluenceScore: round(pct(s.overlayChanged, s.totalPairs), 4),
    cautionInfluenceScore: round(pct(s.cautionChanged, s.totalPairs), 4),
  }));
}

// ---------------------------------------------------------------------------
// A3 — mutual information
// ---------------------------------------------------------------------------

function bucketValue(fieldDesc, value) {
  if (value === undefined || value === null) return "\u2205"; // ∅ absent
  if (fieldDesc.kind === "record") {
    if (typeof value !== "object") return "\u2205";
    const keys = Object.keys(value).sort();
    return keys.map((k) => `${k}=${JSON.stringify(value[k])}`).join("|");
  }
  if (fieldDesc.kind === "multi") {
    if (!Array.isArray(value)) return "\u2205";
    return [...value].sort().join(",");
  }
  if (fieldDesc.kind === "ranked") {
    if (!Array.isArray(value)) return "\u2205";
    return value.join(">"); // order matters for ranked fields
  }
  return String(value);
}

function mutualInformationBits(xs, ys) {
  const n = xs.length;
  if (!n) return 0;
  const countX = new Map();
  const countY = new Map();
  const countXY = new Map();
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    countX.set(x, (countX.get(x) || 0) + 1);
    countY.set(y, (countY.get(y) || 0) + 1);
    const key = `${x}\u0001${y}`;
    countXY.set(key, (countXY.get(key) || 0) + 1);
  }
  let mi = 0;
  for (const [key, cxy] of countXY) {
    const sep = key.indexOf("\u0001");
    const x = key.slice(0, sep);
    const y = key.slice(sep + 1);
    const pxy = cxy / n;
    const px = countX.get(x) / n;
    const py = countY.get(y) / n;
    mi += pxy * Math.log2(pxy / (px * py));
  }
  return mi;
}

function fieldToBaseRuleMI(profiles, api, fields) {
  const evaluated = profiles.map(({ answers }) => {
    const r = safeEvaluate(api, answers);
    return {
      answers,
      base: r.ok ? outcomeLabel(r.projection) ?? "\u2205" : "\u2205",
      practices: r.ok
        ? (r.projection.overlays || []).map((o) => o.id).sort().join("|") || "\u2205"
        : "\u2205",
      cautions: r.ok
        ? (r.projection.cautions || []).slice().sort().join("|") || "\u2205"
        : "\u2205",
    };
  });
  const yBase = evaluated.map((e) => e.base);
  const yPractices = evaluated.map((e) => e.practices);
  const yCautions = evaluated.map((e) => e.cautions);

  return fields
    .map((f) => {
      const xs = evaluated.map((e) => bucketValue(f, e.answers ? e.answers[f.id] : undefined));
      return {
        fieldId: f.id,
        questionId: f.questionId,
        miBits: round(mutualInformationBits(xs, yBase), 4),
        miBitsPractices: round(mutualInformationBits(xs, yPractices), 4),
        miBitsCautions: round(mutualInformationBits(xs, yCautions), 4),
      };
    })
    .sort((a, b) => b.miBitsPractices - a.miBitsPractices || b.miBits - a.miBits);
}

function pairwiseFieldGroups(api) {
  const groups = [];
  const seenPairs = new Set();
  for (const rule of api.BASE_RULES || []) {
    const fieldsInRule = [...new Set(rule.requires || [])];
    for (let i = 0; i < fieldsInRule.length; i++) {
      for (let j = i + 1; j < fieldsInRule.length; j++) {
        const a = fieldsInRule[i];
        const b = fieldsInRule[j];
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        groups.push({ ruleId: rule.id, a, b });
      }
    }
  }
  return groups;
}

function pairwiseRedundancyMI(profiles, api, fieldsById) {
  const groups = pairwiseFieldGroups(api);
  return groups
    .map(({ ruleId, a, b }) => {
      const fa = fieldsById.get(a);
      const fb = fieldsById.get(b);
      if (!fa || !fb) return null;
      const xs = profiles.map(({ answers }) => bucketValue(fa, answers ? answers[a] : undefined));
      const ys = profiles.map(({ answers }) => bucketValue(fb, answers ? answers[b] : undefined));
      const mi = mutualInformationBits(xs, ys);
      return { ruleId, fieldA: a, fieldB: b, miBits: round(mi, 4) };
    })
    .filter(Boolean)
    .sort((a, b) => b.miBits - a.miBits);
}

// ---------------------------------------------------------------------------
// A4 — threshold brittleness
// ---------------------------------------------------------------------------

/**
 * Uses the full random corpus (cheap: derive()/direct-answer reads only, no
 * evaluate() calls) rather than the ~2,000 OAT sample, for statistical
 * precision on a corpus-wide percentage. The boundary-sweep family is
 * deliberately excluded because it is hand-engineered to sit exactly at the
 * cliffs, which would bias the "how much of the answer space is near a
 * cliff" measurement upward; this uses only the seeded-random family, which
 * approximates a natural answer space.
 */
function thresholdBrittleness(randomCases, api) {
  let nonRoadmapDefined = 0;
  let nonRoadmapNearCliff = 0;
  let roadmapDefined = 0;
  let roadmapNearCliff = 0;
  let teamSizeDefined = 0;
  let teamSizeNearCliff = 0;

  for (const { answers } of randomCases) {
    let derived = {};
    try {
      derived = api.derive(answers) || {};
    } catch {
      derived = {};
    }

    if (typeof derived.nonRoadmapShare === "number") {
      nonRoadmapDefined++;
      if (Math.abs(derived.nonRoadmapShare - 40) <= 5) nonRoadmapNearCliff++;
    }

    const q5 = answers && answers.q5_work_breakdown;
    if (q5 && typeof q5.roadmap === "number") {
      roadmapDefined++;
      if (Math.abs(q5.roadmap - 60) <= 5) roadmapNearCliff++;
    }

    if (typeof derived.teamSize === "number") {
      teamSizeDefined++;
      if (Math.abs(derived.teamSize - 5) <= 1) teamSizeNearCliff++;
    }
  }

  const corpusSize = randomCases.length;
  return {
    corpusSize,
    nonRoadmapShareGte40: {
      cliff: 40,
      band: "\u00b15 points",
      definedCount: nonRoadmapDefined,
      nearCliffCount: nonRoadmapNearCliff,
      nearCliffPctOfDefined: round(pct(nonRoadmapNearCliff, nonRoadmapDefined), 3),
      nearCliffPctOfCorpus: round(pct(nonRoadmapNearCliff, corpusSize), 3),
    },
    roadmapShareGte60: {
      cliff: 60,
      band: "\u00b15 points",
      definedCount: roadmapDefined,
      nearCliffCount: roadmapNearCliff,
      nearCliffPctOfDefined: round(pct(roadmapNearCliff, roadmapDefined), 3),
      nearCliffPctOfCorpus: round(pct(roadmapNearCliff, corpusSize), 3),
    },
    teamSizeLt5: {
      cliff: 5,
      band: "\u00b11 person",
      definedCount: teamSizeDefined,
      nearCliffCount: teamSizeNearCliff,
      nearCliffPctOfDefined: round(pct(teamSizeNearCliff, teamSizeDefined), 3),
      nearCliffPctOfCorpus: round(pct(teamSizeNearCliff, corpusSize), 3),
    },
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printSummary(report) {
  const { a1, a2, a3, a4 } = report;

  console.log("\n=== A1. Outcome distribution ===");
  console.log(`corpus: ${a1.distribution.total} cases (errors: ${a1.distribution.errors})`);
  for (const label of REACHABLE_OUTCOMES) {
    const n = a1.distribution.counts[label] || 0;
    const p = a1.distribution.percentages[label] || 0;
    console.log(`  ${label.padEnd(18)} ${String(n).padStart(6)}  (${p.toFixed(2)}%)`);
  }
  console.log("\n--- BMAD / Q20 reachability hole ---");
  console.log(`  q20_runtimes answered (non-empty): ${a1.bmadHole.q20AnsweredCount}`);
  console.log(`  base-3.when matched directly:       ${a1.bmadHole.base3WhenMatchedCount}`);
  console.log(`  matched but final label != bmad:    ${a1.bmadHole.holeCount}`);
  console.log(`  hole share of corpus:                ${a1.bmadHole.holeShareOfCorpusPct}%`);
  console.log(`  hole share of q20-answered subset:    ${a1.bmadHole.holeShareOfQ20AnsweredPct}%`);
  console.log(`  hole share of base-3-matched subset:  ${a1.bmadHole.holeShareOfBase3MatchedPct}%`);

  console.log(`\n=== A2. OAT influence scores (n=${a2.sampleSize} profiles) ===`);
  console.log("sorted by base-influence score, most to least influential:");
  const rows = [...a2.fields].sort((x, y) => y.baseInfluenceScore - x.baseInfluenceScore);
  for (const r of rows) {
    console.log(
      `  ${r.fieldId.padEnd(24)} base=${String(r.baseInfluenceScore).padEnd(7)}` +
        ` overlay=${String(r.overlayInfluenceScore).padEnd(7)}` +
        ` caution=${String(r.cautionInfluenceScore).padEnd(7)}` +
        ` (n=${r.totalPairs}${r.questionReportOnly ? ", reportOnly" : ""})`,
    );
  }
  console.log("\nzero base-influence fields:");
  for (const r of a2.zeroBaseInfluenceFields) console.log(`  - ${r}`);
  console.log("\nexpected-zero sanity check (q1_domain, q13_branching, q17_process_mismatch, q4_tenure, q11_cycle_time):");
  console.log(`  all zero as expected: ${a2.sanityCheck.ok}`);
  if (!a2.sanityCheck.ok) {
    console.log(`  UNEXPECTED non-zero: ${JSON.stringify(a2.sanityCheck.unexpectedNonZero)}`);
  }

  console.log(`\n=== A3. Mutual information (bits), n=${a3.sampleSize} ===`);
  console.log("top fields by MI(answer, outcome label):");
  for (const r of a3.topMi.slice(0, 10)) {
    console.log(`  ${r.fieldId.padEnd(24)} ${r.miBits.toFixed(4)} bits`);
  }
  console.log("\npairwise redundancy MI (fields sharing a base rule), top pairs:");
  for (const r of a3.pairwiseRedundancy.slice(0, 10)) {
    console.log(`  ${r.ruleId}  ${r.fieldA} <-> ${r.fieldB}: ${r.miBits.toFixed(4)} bits`);
  }

  console.log(`\n=== A4. Threshold brittleness (n=${a4.corpusSize} random cases) ===`);
  console.log(
    `  nonRoadmapShare>=40: ${a4.nonRoadmapShareGte40.nearCliffPctOfDefined}% of defined cases` +
      ` (${a4.nonRoadmapShareGte40.nearCliffPctOfCorpus}% of corpus) within \u00b15 points`,
  );
  console.log(
    `  q5.roadmap>=60:      ${a4.roadmapShareGte60.nearCliffPctOfDefined}% of defined cases` +
      ` (${a4.roadmapShareGte60.nearCliffPctOfCorpus}% of corpus) within \u00b15 points`,
  );
  console.log(
    `  teamSize<5:          ${a4.teamSizeLt5.nearCliffPctOfDefined}% of defined cases` +
      ` (${a4.teamSizeLt5.nearCliffPctOfCorpus}% of corpus) within \u00b11 person`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const t0 = Date.now();
  const api = loadEngine();
  const quick = process.argv.includes("--quick");
  const RANDOM_COUNT = quick ? QUICK_RANDOM_COUNT : FULL_RANDOM_COUNT;
  const OAT_SAMPLE_SIZE = quick ? QUICK_OAT_SAMPLE_SIZE : FULL_OAT_SAMPLE_SIZE;

  console.log(`tools/qc/sensitivity.mjs — pinned now = ${new Date(PINNED_NOW).toISOString()}${quick ? " (quick)" : ""}`);

  // --- corpus + schema -----------------------------------------------------
  const corpus = buildCorpus({ randomCount: RANDOM_COUNT, api });
  const fullCases = flattenCorpus(corpus);
  const schema = questionSchema(api);
  const fields = schema.flatMap((q) =>
    (q.fields || []).map((f) => ({ ...f, questionId: q.id, questionReportOnly: !!q.reportOnly })),
  );
  const fieldsById = new Map(fields.map((f) => [f.id, f]));

  // --- A1 --------------------------------------------------------------
  const distribution = outcomeDistribution.call({ api }, fullCases);
  const bmadHole = bmadReachabilityHole(fullCases, api);
  const a1 = { distribution, bmadHole };

  // --- A2 (deterministic 2000-profile subset of the seeded random family) --
  const oatProfiles = seededRandom(OAT_SAMPLE_SIZE, undefined, api);
  const a2Fields = runOatSensitivity(oatProfiles, api, fields).map((s) => ({
    fieldId: s.fieldId,
    questionId: s.questionId,
    questionReportOnly: s.questionReportOnly,
    kind: s.kind,
    totalPairs: s.totalPairs,
    baseInfluenceScore: s.baseInfluenceScore,
    overlayInfluenceScore: s.overlayInfluenceScore,
    cautionInfluenceScore: s.cautionInfluenceScore,
    evalErrors: s.evalErrors,
  }));
  const zeroBaseInfluenceFields = a2Fields
    .filter((f) => f.baseInfluenceScore === 0)
    .map((f) => f.fieldId)
    .sort();
  const EXPECTED_ZERO = ["q1_domain", "q13_branching", "q17_process_mismatch", "q4_tenure", "q11_cycle_time"];
  const zeroSet = new Set(zeroBaseInfluenceFields);
  const unexpectedNonZero = EXPECTED_ZERO.filter((id) => !zeroSet.has(id));
  const a2 = {
    sampleSize: oatProfiles.length,
    fields: a2Fields.map((f) => ({
      ...f,
      totalInfluenceScore: round(
        (f.baseInfluenceScore || 0) + (f.overlayInfluenceScore || 0) + (f.cautionInfluenceScore || 0),
        4,
      ),
      sobolFirstOrderProxy: round(((f.baseInfluenceScore || 0) + (f.overlayInfluenceScore || 0) + (f.cautionInfluenceScore || 0)) / 100, 4),
    })),
    zeroBaseInfluenceFields,
    sobolNote: "OAT retained. sobolFirstOrderProxy is total-influence/100 on the same sample — a discrete first-order stand-in until a full Saltelli sweep lands. Total-order indices equal first-order here because the proxy cannot see interactions.",
    sanityCheck: { expectedZero: EXPECTED_ZERO, unexpectedNonZero, ok: unexpectedNonZero.length === 0 },
  };

  // --- A3 (same 2000-profile sample as A2) ---------------------------------
  const topMi = fieldToBaseRuleMI(oatProfiles, api, fields);
  const pairwiseRedundancy = pairwiseRedundancyMI(oatProfiles, api, fieldsById);
  const a3 = {
    sampleSize: oatProfiles.length,
    topMi,
    pairwiseRedundancy,
    note: "miBits is against the harness/base label; miBitsPractices and miBitsCautions are against the practice-set and caution-set fingerprints.",
  };

  // --- A4 (full random family, no OAT sample needed) -----------------------
  const a4 = thresholdBrittleness(corpus.random, api);

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      pinnedNow: PINNED_NOW,
      corpusSizes: {
        documented: corpus.documented.length,
        boundary: corpus.boundary.length,
        random: corpus.random.length,
        malformed: corpus.malformed.length,
        total: fullCases.length,
      },
      oatSampleSize: OAT_SAMPLE_SIZE,
      quick,
      elapsedMs: 0, // filled below
    },
    a1,
    a2,
    a3,
    a4,
  };

  report.meta.elapsedMs = Date.now() - t0;

  printSummary(report);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log(`done in ${report.meta.elapsedMs}ms`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    main();
    process.exit(0);
  } catch (err) {
    console.error("tools/qc/sensitivity.mjs FAILED");
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}
