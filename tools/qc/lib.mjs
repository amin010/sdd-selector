/**
 * QC harness — thin, shared wrapper over the engine loader + parity projection,
 * used by tools/qc/*.mjs (sensitivity, personas, respond, judge, analyze).
 *
 * Nothing here talks to an LLM or the network; it only loads the built
 * index.html in a Node vm (via tools/load-page.mjs) and re-exposes a stable,
 * JSON-serializable projection of api.evaluate() results (via tools/parity.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCurrent, CURRENT_PAGE } from "../load-page.mjs";
import { PINNED_NOW } from "../corpus.mjs";
import { projectRec } from "../parity.mjs";

export { projectRec };

/**
 * Load the current (built) engine. Defaults the pinned clock to PINNED_NOW so
 * every QC script is deterministic across runs, machines, and days.
 * Throws a clear, actionable error if index.html has not been built yet.
 */
export function loadEngine({ now } = {}) {
  if (!fs.existsSync(CURRENT_PAGE)) {
    throw new Error(
      `tools/qc: ${CURRENT_PAGE} does not exist. Run \`node tools/build.mjs\` first, then re-run this script.`,
    );
  }
  return loadCurrent({ now: now == null ? PINNED_NOW : now });
}

/**
 * Thin wrapper around api.evaluate — kept as its own function so QC scripts
 * never call api.evaluate directly and always agree on the pinned clock.
 */
export function evaluateAnswers(api, answers, now) {
  return api.evaluate(answers, null, now == null ? PINNED_NOW : now);
}

/**
 * Project a raw evaluate() result into the stable, JSON-serializable shape
 * used across G-PARITY and QC (see tools/parity.mjs#projectRec). Kept as a
 * distinctly-named export (vs. the re-exported projectRec) for readability
 * at QC call sites: `projectOutcome(result)`.
 */
export function projectOutcome(result) {
  return projectRec(result);
}

/**
 * The 7 canonical outcome labels used across the whole QC experiment:
 * reachable bases, then the fallback-to-openspec state, then the
 * explicit no-runtime-match state. Fixed order matters for histograms/tables.
 */
export const REACHABLE_OUTCOMES = [
  "openspec",
  "speckit",
  "bmad",
  "superpowers",
  "gsd",
  "speckitty",
  "tessl",
  "fallback_openspec",
  "no_runtime_match",
  "insufficient_signal",
];

/**
 * Map a projection (from projectOutcome/projectRec) to one of the 7 canonical
 * outcome labels. Precedence: noRuntimeMatch, then fallback, then plain baseId.
 */
export function outcomeLabel(projection) {
  if (!projection) return null;
  if (projection.noRuntimeMatch) return "no_runtime_match";
  if (projection.fallback) return "fallback_openspec";
  if (projection.insufficientSignal && !projection.baseId) return "insufficient_signal";
  return projection.baseId;
}

/**
 * Describe one field (top-level or nested inside a record) in a shape that is
 * both compact and sufficient to construct a valid answer value: every kind
 * carries its valid option values / value shape, not just a label.
 */
function describeField(f) {
  const out = { id: f.id, kind: f.kind };
  if (f.hashKey != null) out.hashKey = f.hashKey;
  if (Array.isArray(f.options)) out.options = f.options.map((o) => o.value);
  if (f.maxLength != null) out.maxLength = f.maxLength;
  if (f.ranks != null) out.ranks = f.ranks;
  if (f.rankLabels != null) out.rankLabels = f.rankLabels;
  if (f.unique != null) out.unique = !!f.unique;
  if (f.min != null) out.min = f.min;
  if (f.max != null) out.max = f.max;
  if (f.label != null) out.label = f.label;
  if (f.constraints != null) out.constraints = f.constraints;
  if (Array.isArray(f.fields)) out.fields = f.fields.map(describeField);
  return out;
}

/**
 * Compact, LLM-prompt-friendly description of every question in the pack,
 * derived from api.QUESTIONS (legend/help/reportOnly at the question level)
 * cross-referenced with api.FIELD_INDEX (kind/options/constraints per field,
 * including nested sub-fields of record fields like q5_work_breakdown /
 * q2_team). Consumed by later QC workers building respondent/judge prompts.
 */
export function questionSchema(api) {
  return (api.QUESTIONS || []).map((q) => ({
    id: q.id,
    number: q.number != null ? q.number : q.n,
    legend: q.legend,
    help: q.help,
    reportOnly: !!q.reportOnly,
    fields: (q.fields || []).map((f) => {
      const meta = (api.FIELD_INDEX && api.FIELD_INDEX[f.id]) || f;
      return describeField({ ...f, ...meta, id: f.id });
    }),
  }));
}

/**
 * Framework catalog derived from api.FRAMEWORKS (keyed by id in the compiled
 * engine, not an array). Passes through whatever fields exist on each
 * framework object in the pack (id, name, repo, status, evidence, runtimes,
 * ratings + the flattened rating keys, install, commands, artifacts,
 * enforcement) and adds a computed `selectableAsBase` from
 * api.SETTINGS.statuses (the pack has no per-framework selectableAsBase
 * field — it is derived from the framework's status).
 */
/** Deterministic mulberry32 used when the corpus helper is not imported. */
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cluster bootstrap at the vignette level (EXT-SELECT T6).
 * `statisticFn(ids)` receives a resampled list of vignette ids and returns a number.
 */
export function clusterBootstrap(vignetteIds, statisticFn, { n = 400, seed = 0x51ec7, alpha = 0.05 } = {}) {
  const rng = mulberry32(seed);
  const values = [];
  for (let i = 0; i < n; i++) {
    const sample = [];
    for (let j = 0; j < vignetteIds.length; j++) {
      sample.push(vignetteIds[Math.floor(rng() * vignetteIds.length)]);
    }
    const v = statisticFn(sample);
    if (typeof v === "number" && Number.isFinite(v)) values.push(v);
  }
  values.sort((a, b) => a - b);
  const lo = values[Math.floor(alpha / 2 * values.length)] ?? null;
  const hi = values[Math.min(values.length - 1, Math.floor((1 - alpha / 2) * values.length))] ?? null;
  const mean = values.length ? values.reduce((s, x) => s + x, 0) / values.length : null;
  return { mean, lo, hi, n: values.length };
}

/** McNemar's test on paired [engineCorrect, baselineCorrect] booleans (T7). */
export function mcnemar(pairs) {
  let b = 0;
  let c = 0;
  for (const [eng, base] of pairs) {
    if (eng && !base) b++;
    if (!eng && base) c++;
  }
  const denom = b + c;
  const stat = denom ? ((Math.abs(b - c) - 1) ** 2) / denom : 0;
  return { b, c, chi2: stat, nDiscordant: denom };
}

/**
 * Single-judge-versus-majority accuracy — the oracle ceiling (T8).
 * `judgesByVignette` is Map<vignetteId, string[] top-1 labels>.
 */
export function singleJudgeVsMajority(judgesByVignette) {
  let agree = 0;
  let n = 0;
  for (const labels of judgesByVignette.values()) {
    if (!labels || labels.length < 2) continue;
    const counts = new Map();
    for (const lab of labels) counts.set(lab, (counts.get(lab) || 0) + 1);
    let majority = null;
    let best = -1;
    for (const [lab, c] of counts) {
      if (c > best || (c === best && lab < majority)) {
        majority = lab;
        best = c;
      }
    }
    if (best < 2) continue;
    n += labels.length;
    for (const lab of labels) if (lab === majority) agree++;
  }
  return { accuracy: n ? agree / n : null, n, agree };
}

export function frameworkCatalog(api) {
  const statuses = (api.SETTINGS && api.SETTINGS.statuses) || [];
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  return Object.values(api.FRAMEWORKS || {}).map((fw) => {
    const statusMeta = statusById.get(fw.status);
    return {
      ...fw,
      selectableAsBase: statusMeta ? !!statusMeta.selectableAsBase : false,
    };
  });
}

// --- self-check -----------------------------------------------------------
// node tools/qc/lib.mjs
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const api = loadEngine();
    const sampleAnswers = {
      q5_work_breakdown: { roadmap: 80, ops: 5, bugs: 5, regulatory: 5, tech_debt: 5 },
      q7_requirements: "structured",
      q10_architecture: "microservices",
      q11_deploy_cadence: "monthly",
      q14_release_autonomy: "autonomous",
      q6_volatility: "moderate",
      q2_team: {
        total: 8, swe: 6, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q12_quality_gates: ["unit_coverage", "integration_contract", "e2e"],
    };
    const result = evaluateAnswers(api, sampleAnswers, PINNED_NOW);
    const projection = projectOutcome(result);
    const label = outcomeLabel(projection);
    const schema = questionSchema(api);
    const frameworks = frameworkCatalog(api);

    console.log("tools/qc/lib.mjs self-check");
    console.log("projection:", JSON.stringify(projection, null, 2));
    console.log("outcomeLabel:", label);
    console.log(`questionSchema: ${schema.length} questions`);
    console.log(`frameworkCatalog: ${frameworks.length} frameworks`);
    console.log("REACHABLE_OUTCOMES:", REACHABLE_OUTCOMES.join(", "));

    if (schema.length !== 21) {
      throw new Error(`expected 21 questions, got ${schema.length}`);
    }
    if (frameworks.length !== 7) {
      throw new Error(`expected 7 frameworks, got ${frameworks.length}`);
    }
    if (!REACHABLE_OUTCOMES.includes(label)) {
      throw new Error(`outcomeLabel ${label} is not a canonical outcome`);
    }

    console.log("OK");
    process.exit(0);
  } catch (err) {
    console.error("tools/qc/lib.mjs self-check FAILED");
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}
