/**
 * G-PARITY — identical recommendation projection vs frozen v0.4.0 finance-tech page.
 *
 * Usage:
 *   node tools/parity.mjs              # current vs golden
 *   node tools/parity.mjs --self       # golden vs golden (harness smoke)
 *   node tools/parity.mjs --break-demo # prove gate fails on threshold edit
 *   node tools/parity.mjs --quick      # smaller random corpus
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCurrent,
  loadGolden,
  loadPage,
  GOLDEN_V040,
} from "./load-page.mjs";
import {
  PINNED_NOW,
  buildCorpus,
  flattenCorpus,
} from "./corpus.mjs";

export function projectRec(result) {
  if (!result) {
    return {
      baseId: null,
      fallback: false,
      runnerUpId: null,
      overlays: [],
      cautions: [],
      bottleneckMatrix: [],
      directoryLayout: [],
      completeness: { answered: [], missing: [], couldChangeResult: [] },
      evidenceAge: { verifiedOn: "", stale: false },
      noRuntimeMatch: false,
      insufficientSignal: false,
      confidence: null,
      margin: 0,
    };
  }
  const baseId = result.base && result.base.rule && result.base.rule.adopt
    ? result.base.rule.adopt.framework
    : null;
  const overlays = (result.overlays || [])
    .map((o) => ({
      id: o.rule.id,
      includedInBase: !!o.includedInBase,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const cautions = (result.cautions || [])
    .map((c) => c.rule.id)
    .sort();
  const bottleneckMatrix = (result.bottleneckMatrix || []).map((row) => ({
    bottleneck: row.bottleneck,
    rank: row.rank,
    resolvedBy: row.resolvedBy ? [...row.resolvedBy].sort() : null,
  }));
  const completeness = result.completeness || {
    answered: [], missing: [], couldChangeResult: [],
  };
  const out = {
    baseId,
    fallback: !!(result.base && result.base.fallback),
    runnerUpId: result.runnerUp && result.runnerUp.rule
      ? result.runnerUp.rule.id
      : null,
    overlays,
    cautions,
    bottleneckMatrix,
    directoryLayout: [...(result.directoryLayout || [])],
    completeness: {
      answered: [...(completeness.answered || [])].sort(),
      missing: [...(completeness.missing || [])].sort(),
      couldChangeResult: [...(completeness.couldChangeResult || [])].sort(),
    },
    evidenceAge: {
      verifiedOn: result.evidenceAge ? result.evidenceAge.verifiedOn : "",
      stale: !!(result.evidenceAge && result.evidenceAge.stale),
    },
    noRuntimeMatch: !!result.noRuntimeMatch,
    insufficientSignal: !!result.insufficientSignal,
    confidence: result.confidence || null,
    margin: result.margin != null ? result.margin : 0,
  };
  if (result.closest) out.closest = [...result.closest];
  return out;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function safeEval(api, answers) {
  try {
    return { ok: true, result: api.evaluate(answers, null, PINNED_NOW) };
  } catch (err) {
    // Compare by name+message only — stacks differ across vm loads.
    const name = err && err.name ? err.name : "Error";
    const msg = err && err.message != null ? String(err.message) : String(err);
    return { ok: false, error: `${name}: ${msg}` };
  }
}

export function minimizeDiff(leftApi, rightApi, answers) {
  let current = { ...answers };
  let keys = Object.keys(current);
  let changed = true;
  while (changed && keys.length > 1) {
    changed = false;
    for (const k of keys) {
      const trial = { ...current };
      delete trial[k];
      const L = projectRec(safeEval(leftApi, trial).result);
      const R = projectRec(safeEval(rightApi, trial).result);
      if (!deepEqual(L, R)) {
        current = trial;
        keys = Object.keys(current);
        changed = true;
        break;
      }
    }
  }
  // Also try dropping nested record fields one at a time
  for (const k of Object.keys(current)) {
    const v = current[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of Object.keys(v)) {
        const trial = {
          ...current,
          [k]: { ...v },
        };
        delete trial[k][sub];
        const L = projectRec(safeEval(leftApi, trial).result);
        const R = projectRec(safeEval(rightApi, trial).result);
        if (!deepEqual(L, R)) current = trial;
      }
    }
  }
  return current;
}

export function runParity({
  leftApi,
  rightApi,
  cases,
  label = "parity",
  stopAt = 5,
} = {}) {
  const failures = [];
  let compared = 0;
  for (const { name, answers } of cases) {
    compared++;
    const L = safeEval(leftApi, answers);
    const R = safeEval(rightApi, answers);
    if (!L.ok || !R.ok) {
      // Malformed answers: both throw is fine; current throw while golden
      // succeeds is a regression. Golden throw + current ok is hardening.
      if (!L.ok && R.ok) {
        failures.push({
          name,
          kind: "throw",
          left: L.error,
          right: "ok",
          answers,
        });
        if (failures.length >= stopAt) break;
      }
      continue;
    }
    const pl = projectRec(L.result);
    const pr = projectRec(R.result);
    if (!deepEqual(pl, pr)) {
      const mini = minimizeDiff(leftApi, rightApi, answers);
      failures.push({
        name,
        kind: "rec",
        left: pl,
        right: pr,
        answers: mini,
        fullAnswers: answers,
      });
      if (failures.length >= stopAt) break;
    }
  }
  return { label, compared, failures, ok: failures.length === 0 };
}

function printFailures(report) {
  console.error(`\n${report.label}: ${report.failures.length} failure(s) after ${report.compared} cases`);
  for (const f of report.failures) {
    console.error(`\n--- ${f.name} (${f.kind}) ---`);
    console.error("minimized answers:", JSON.stringify(f.answers, null, 2));
    if (f.kind === "rec") {
      console.error("left :", JSON.stringify(f.left, null, 2));
      console.error("right:", JSON.stringify(f.right, null, 2));
    } else {
      console.error("left throw :", f.left);
      console.error("right throw:", f.right);
    }
  }
}

function breakDemo() {
  // Scratch copy with one pack expression threshold flipped:
  // nonRoadmapShare >= 40 → >= 41 (JSON-inlined pack, not a JS closure).
  const html = fs.readFileSync(GOLDEN_V040, "utf8");
  const needle = '{"gte":[{"derived":"nonRoadmapShare"},40]}';
  const replacement = '{"gte":[{"derived":"nonRoadmapShare"},41]}';
  if (!html.includes(needle)) {
    console.error("break-demo: expression threshold not found in golden pack");
    process.exit(2);
  }
  const broken = html.split(needle).join(replacement);
  const tmp = path.join(os.tmpdir(), `sdd-break-${process.pid}.html`);
  fs.writeFileSync(tmp, broken);
  try {
    const golden = loadGolden({ now: PINNED_NOW });
    const left = loadPage(tmp, { now: PINNED_NOW });
    const cases = [
      {
        name: "share-40",
        answers: {
          q7_requirements: "structured",
          q10_architecture: "streaming",
          q11_deploy_cadence: "monthly",
          q14_release_autonomy: "autonomous",
          q6_volatility: "moderate",
          q5_work_breakdown: {
            roadmap: 60, ops: 20, bugs: 20, regulatory: 0, tech_debt: 0,
          },
          q2_team: {
            total: 8, swe: 6, data_engineers: 0, qa_sdet: 0,
            product_owner: "none", scrum_master: "none",
          },
          q12_quality_gates: ["unit_coverage", "integration_contract", "e2e"],
        },
      },
    ];
    const report = runParity({
      leftApi: left,
      rightApi: golden,
      cases,
      label: "break-demo",
      stopAt: 1,
    });
    if (report.ok) {
      console.error("break-demo: expected a failure, got green");
      process.exit(1);
    }
    printFailures(report);
    console.log("break-demo: gate failed and minimized as expected");
    return 0;
  } finally {
    fs.unlinkSync(tmp);
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--break-demo")) {
    process.exit(breakDemo());
  }

  const self = args.has("--self");
  const quick = args.has("--quick");
  const randomCount = quick ? 2_000 : 50_000;

  const golden = loadGolden({ now: PINNED_NOW });
  const current = self ? golden : loadCurrent({ now: PINNED_NOW });

  // Warm enum cache from golden
  const corpus = buildCorpus({ randomCount, api: golden });
  const cases = flattenCorpus(corpus);

  console.log(
    `G-PARITY ${self ? "golden↔golden" : "current↔golden"}: ${cases.length} cases` +
    ` (doc=${corpus.documented.length} boundary=${corpus.boundary.length}` +
    ` random=${corpus.random.length} mal=${corpus.malformed.length})`,
  );

  const t0 = Date.now();
  const report = runParity({
    leftApi: current,
    rightApi: golden,
    cases,
    label: self ? "self-parity" : "parity",
    stopAt: 10,
  });
  const ms = Date.now() - t0;
  console.log(`compared ${report.compared} in ${ms}ms`);

  if (!report.ok) {
    printFailures(report);
    process.exit(1);
  }
  console.log("G-PARITY OK");
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();
