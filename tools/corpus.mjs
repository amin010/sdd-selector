/**
 * Reproducible answer-set corpus for G-PARITY.
 * Four families: documented fixtures, boundary sweep, seeded random, malformed.
 */
import { loadGolden } from "./load-page.mjs";

/** Pinned clock for evidenceAge.stale (docs/archive/IMPLEMENTATION-PLAN.md §3.1). */
export const PINNED_NOW = Date.parse("2026-09-16T12:00:00Z");

/** Baseline answers used by the in-page selftest helper A(). */
export function selftestBase(over = {}) {
  const base = {
    q7_requirements: "structured",
    q10_architecture: "microservices",
    q11_deploy_cadence: "monthly",
    q14_release_autonomy: "autonomous",
    q6_volatility: "moderate",
    q5_work_breakdown: {
      roadmap: 80, ops: 5, bugs: 5, regulatory: 5, tech_debt: 5,
    },
    q2_team: {
      total: 8, swe: 6, data_engineers: 0, qa_sdet: 0,
      product_owner: "none", scrum_master: "none",
    },
    q12_quality_gates: ["unit_coverage", "integration_contract", "e2e"],
  };
  return { ...base, ...over };
}

/**
 * ~40 documented fixtures covering DESIGN.md §14.1 cases.
 * Each entry: { name, answers }. Expectations are asserted via parity, not here.
 */
export function documentedFixtures() {
  const A = selftestBase;
  return [
    { name: "base-1-openspec", answers: A({
      q5_work_breakdown: { roadmap: 20, ops: 20, bugs: 20, regulatory: 20, tech_debt: 20 },
    }) },
    { name: "base-2-speckit", answers: A({}) },
    { name: "base-3-bmad", answers: A({
      q10_architecture: "streaming",
      q7_requirements: "vague",
      q2_team: {
        total: 8, swe: 4, data_engineers: 1, qa_sdet: 1,
        product_owner: "dedicated", scrum_master: "shared",
      },
    }) },
    { name: "base-3-bmad-with-q20", answers: A({
      q10_architecture: "monolith",
      q7_requirements: "vague",
      q2_team: {
        total: 8, swe: 4, data_engineers: 1, qa_sdet: 1,
        product_owner: "dedicated", scrum_master: "shared",
      },
      q20_runtimes: ["claude_code"],
    }) },
    { name: "base-4-superpowers", answers: A({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "continuous",
      q18_token_budget: "unmetered",
      q12_quality_gates: ["mostly_manual"],
    }) },
    { name: "base-6-speckitty", answers: A({
      q10_architecture: "hybrid",
      q9_precision: "zero_tolerance",
      q8_compliance: "sox_tier1",
      q14_release_autonomy: "coupled",
      q5_work_breakdown: { roadmap: 40, ops: 15, bugs: 15, regulatory: 15, tech_debt: 15 },
    }) },
    { name: "D1-rule1-wins-rule4-runnerup", answers: A({
      q10_architecture: "monolith",
      q5_work_breakdown: { roadmap: 20, ops: 20, bugs: 20, regulatory: 20, tech_debt: 20 },
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "continuous",
      q14_release_autonomy: "autonomous",
    }) },
    { name: "D2-fallback", answers: A({
      q10_architecture: "streaming",
      q5_work_breakdown: { roadmap: 70, ops: 10, bugs: 10, regulatory: 5, tech_debt: 5 },
      q2_team: {
        total: 8, swe: 6, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
    }) },
    { name: "D3-superpowers", answers: A({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "sprint", q14_release_autonomy: "autonomous",
      q12_quality_gates: ["mostly_manual"], q18_token_budget: "unmetered",
    }) },
    { name: "D3-gsd-overlay-b", answers: A({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "sprint", q14_release_autonomy: "autonomous",
      q12_quality_gates: ["mostly_manual"], q18_token_budget: "strict",
    }) },
    { name: "D3-gsd-high-coverage", answers: A({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "sprint", q14_release_autonomy: "autonomous",
      q12_quality_gates: ["unit_coverage", "integration_contract", "e2e"],
      q18_token_budget: "unmetered",
    }) },
    { name: "V5-high-volatility", answers: A({
      q6_volatility: "high",
      q5_work_breakdown: { roadmap: 40, ops: 20, bugs: 20, regulatory: 10, tech_debt: 10 },
    }) },
    { name: "V5-interrupt", answers: A({
      q6_volatility: "interrupt_driven",
      q5_work_breakdown: { roadmap: 40, ops: 20, bugs: 20, regulatory: 10, tech_debt: 10 },
    }) },
    { name: "D13-regulatory", answers: A({
      q10_architecture: "microservices",
      q5_work_breakdown: { roadmap: 40, ops: 5, bugs: 5, regulatory: 50, tech_debt: 0 },
    }) },
    { name: "Q5-bad-sum", answers: A({
      q5_work_breakdown: { roadmap: 80, ops: 5, bugs: 5, regulatory: 5, tech_debt: 0 },
      q10_architecture: "microservices",
    }) },
    { name: "tier0-gemini", answers: A({ q20_runtimes: ["gemini_cli"] }) },
    { name: "tier0-no-match", answers: A({ q20_runtimes: ["other"] }) },
    { name: "ov-a-pos", answers: A({ q8_compliance: "sox_tier1" }) },
    { name: "ov-a-neg-lightweight", answers: A({
      q8_compliance: "standard_enterprise", q15_governance: "lightweight_review",
    }) },
    { name: "ov-a-neg-internal", answers: A({ q8_compliance: "internal_governance" }) },
    { name: "ov-b-pos-zero", answers: A({ q9_precision: "zero_tolerance" }) },
    { name: "ov-b-neg", answers: A({
      q9_precision: "standard", q16_bottlenecks: ["flaky_cicd"],
    }) },
    { name: "ov-b-recon-note", answers: A({
      q9_precision: "zero_tolerance",
      q12_quality_gates: ["financial_reconciliation"],
    }) },
    { name: "ov-c-pos", answers: A({ q14_release_autonomy: "heavy" }) },
    { name: "ov-c-neg-vendor", answers: A({ q14_release_autonomy: "vendor" }) },
    { name: "ov-d-pos", answers: A({
      q16_bottlenecks: ["ambiguous_or_shifting", "flaky_cicd", "test_fear"],
    }) },
    { name: "ov-d-neg", answers: A({
      q16_bottlenecks: ["flaky_cicd", "ambiguous_or_shifting", "test_fear"],
      q7_requirements: "structured", q4_domain_familiarity: "high",
    }) },
    { name: "ov-e-pos", answers: A({
      q10_architecture: "monolith",
      q5_work_breakdown: { roadmap: 20, ops: 20, bugs: 20, regulatory: 20, tech_debt: 20 },
    }) },
    { name: "ov-e-neg", answers: A({ q10_architecture: "microservices" }) },
    { name: "ov-f-pos", answers: A({ q8_compliance: "sox_tier1", q21_ci_maturity: "none" }) },
    { name: "ov-f-neg", answers: A({
      q8_compliance: "sox_tier1", q21_ci_maturity: "contracts_runtime",
    }) },
    { name: "ov-g-many-small", answers: A({ q19_change_volume: "many_small" }) },
    { name: "ov-g-high", answers: A({
      q6_volatility: "high",
      q5_work_breakdown: { roadmap: 40, ops: 20, bugs: 20, regulatory: 10, tech_debt: 10 },
    }) },
    { name: "ov-g-interrupt", answers: A({
      q6_volatility: "interrupt_driven",
      q5_work_breakdown: { roadmap: 40, ops: 20, bugs: 20, regulatory: 10, tech_debt: 10 },
    }) },
    { name: "ov-g-neg", answers: A({
      q6_volatility: "moderate", q19_change_volume: "balanced",
    }) },
    { name: "dedupe-a-included", answers: A({ q8_compliance: "sox_tier1" }) },
    { name: "q16-test-fear-rank2", answers: A({
      q9_precision: "standard",
      q16_bottlenecks: ["flaky_cicd", "test_fear", "legacy_tech_debt"],
    }) },
    { name: "q16-test-fear-rank3", answers: A({
      q9_precision: "standard",
      q16_bottlenecks: ["flaky_cicd", "legacy_tech_debt", "test_fear"],
    }) },
    { name: "C1-pos", answers: A({
      q5_work_breakdown: { roadmap: 70, ops: 10, bugs: 10, regulatory: 5, tech_debt: 5 },
    }) },
    { name: "C1-neg", answers: A({
      q5_work_breakdown: { roadmap: 90, ops: 4, bugs: 3, regulatory: 2, tech_debt: 1 },
    }) },
    { name: "C2-pos", answers: A({ q8_compliance: "sox_tier1" }) },
    { name: "C3-pos", answers: A({ q9_precision: "zero_tolerance", q18_token_budget: "strict" }) },
    { name: "C4-pos", answers: A({ q9_precision: "zero_tolerance" }) },
    { name: "C5-pos", answers: A({
      q5_work_breakdown: { roadmap: 20, ops: 20, bugs: 20, regulatory: 20, tech_debt: 20 },
      q7_requirements: "high_level",
      q9_precision: "zero_tolerance",
    }) },
    { name: "C6-pos", answers: A({ q8_compliance: "sox_tier1", q14_release_autonomy: "coupled" }) },
    { name: "C7-pos", answers: A({ q19_change_volume: "many_small" }) },
    { name: "C8-pos", answers: A({
      q14_release_autonomy: "coupled",
      q2_team: {
        total: 2, swe: 2, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
    }) },
    { name: "C9-pos", answers: A({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "sprint",
      q12_quality_gates: ["unit_coverage", "e2e", "sast_dast"],
      q18_token_budget: "team_plan",
    }) },
    { name: "C10-pos", answers: A({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "sprint",
      q12_quality_gates: ["mostly_manual"], q18_token_budget: "unmetered",
    }) },
    { name: "C11-pos", answers: A({
      q10_architecture: "streaming", q7_requirements: "vague",
      q2_team: {
        total: 8, swe: 4, data_engineers: 1, qa_sdet: 1,
        product_owner: "dedicated", scrum_master: "dedicated",
      },
    }) },
    { name: "C12-pos", answers: A({
      q10_architecture: "streaming", q6_volatility: "interrupt_driven",
      q7_requirements: "vague",
      q2_team: {
        total: 8, swe: 4, data_engineers: 1, qa_sdet: 1,
        product_owner: "dedicated", scrum_master: "dedicated",
      },
    }) },
    { name: "C13-pos", answers: A({ q14_release_autonomy: "vendor" }) },
    { name: "empty-answers", answers: {} },
  ];
}

function q5(roadmap, ops, bugs, regulatory, tech_debt) {
  return { roadmap, ops, bugs, regulatory, tech_debt };
}

/** Boundary sweep around numeric thresholds (~500 sets). */
export function boundarySweep() {
  const out = [];
  const push = (name, answers) => out.push({ name, answers });

  // nonRoadmapShare 39/40/41 and 24/25/26 via ops+bugs+regulatory+tech_debt
  for (const share of [39, 40, 41, 24, 25, 26]) {
    const rest = 100 - share;
    push(`boundary-nonRoadmap-${share}`, selftestBase({
      q5_work_breakdown: q5(rest, share, 0, 0, 0),
      q10_architecture: "microservices",
    }));
  }

  // q5.roadmap 59/60/61 (rule 2 threshold)
  for (const roadmap of [59, 60, 61]) {
    const rem = 100 - roadmap;
    push(`boundary-roadmap-${roadmap}`, selftestBase({
      q5_work_breakdown: q5(roadmap, rem, 0, 0, 0),
      q10_architecture: "microservices",
      q7_requirements: "structured",
      q6_volatility: "moderate",
    }));
  }

  // teamSize 2/3/4/5
  for (const total of [2, 3, 4, 5]) {
    push(`boundary-team-${total}`, selftestBase({
      q10_architecture: "streaming",
      q2_team: {
        total, swe: total, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "continuous",
      q14_release_autonomy: "autonomous",
      q12_quality_gates: ["mostly_manual"],
      q18_token_budget: "unmetered",
    }));
  }

  // coverage counts 0/1/2/3 automated gates
  const gates = ["unit_coverage", "integration_contract", "e2e", "sast_dast"];
  for (let n = 0; n <= 3; n++) {
    push(`boundary-coverage-${n}`, selftestBase({
      q10_architecture: "streaming",
      q2_team: {
        total: 3, swe: 3, data_engineers: 0, qa_sdet: 0,
        product_owner: "none", scrum_master: "none",
      },
      q11_deploy_cadence: "sprint",
      q14_release_autonomy: "autonomous",
      q12_quality_gates: n === 0 ? ["mostly_manual"] : gates.slice(0, n),
      q18_token_budget: "unmetered",
    }));
  }

  // Expand: vary architecture × share × roadmap around boundaries for ~500
  const arches = ["microservices", "monolith", "hybrid", "batch_data", "streaming"];
  const shares = [39, 40, 41];
  const roadmaps = [59, 60, 61];
  const teams = [2, 3, 4, 5];
  const covNs = [0, 1, 2, 3];
  let i = 0;
  for (const arch of arches) {
    for (const share of shares) {
      for (const roadmap of roadmaps) {
        // skip impossible q5 (roadmap + share > 100 when share is non-roadmap)
        // use independent axes: one set for share, one for roadmap already above;
        // here combine arch with each axis lightly
        push(`boundary-arch-share-${arch}-${share}-${i++}`, selftestBase({
          q10_architecture: arch,
          q5_work_breakdown: q5(100 - share, share, 0, 0, 0),
        }));
        push(`boundary-arch-road-${arch}-${roadmap}-${i++}`, selftestBase({
          q10_architecture: arch,
          q5_work_breakdown: q5(roadmap, 100 - roadmap, 0, 0, 0),
          q7_requirements: "structured",
          q6_volatility: "moderate",
        }));
      }
    }
  }
  for (const total of teams) {
    for (const n of covNs) {
      for (const budget of ["unmetered", "strict", "team_plan", "individual_pro"]) {
        push(`boundary-rule4-${total}-${n}-${budget}`, selftestBase({
          q10_architecture: "streaming",
          q2_team: {
            total, swe: total, data_engineers: 0, qa_sdet: 0,
            product_owner: "none", scrum_master: "none",
          },
          q11_deploy_cadence: "sprint",
          q14_release_autonomy: "autonomous",
          q12_quality_gates: n === 0 ? ["mostly_manual"] : gates.slice(0, n),
          q18_token_budget: budget,
        }));
      }
    }
  }
  return out;
}

/** Mulberry32 PRNG — deterministic from seed. */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function maybe(rng, p = 0.15) {
  return rng() < p;
}

/**
 * Enum vocabulary drawn from the golden page FIELD_INDEX / QUESTIONS.
 * Cached after first load.
 */
let _enums = null;
export function fieldEnums(api) {
  if (_enums) return _enums;
  const engine = api || loadGolden({ now: PINNED_NOW });
  const enums = {};
  const radioLike = [
    "q1_domain", "q3_distribution", "q6_volatility", "q7_requirements",
    "q8_compliance", "q9_precision", "q10_architecture", "q13_branching",
    "q14_release_autonomy", "q15_governance", "q18_token_budget",
    "q19_change_volume", "q21_ci_maturity",
    "q4_tenure", "q4_domain_familiarity", "q11_deploy_cadence", "q11_cycle_time",
  ];

  function optionsFor(fieldId) {
    const meta = engine.FIELD_INDEX && engine.FIELD_INDEX[fieldId];
    if (meta && Array.isArray(meta.options)) {
      return meta.options.map((o) => o.value);
    }
    for (const q of engine.QUESTIONS || []) {
      if (q.options && q.id === fieldId) return q.options.map((o) => o.value);
      for (const f of q.fields || []) {
        if (f.id === fieldId && Array.isArray(f.options)) {
          return f.options.map((o) => o.value);
        }
        for (const sub of f.fields || []) {
          if (sub.id === fieldId && Array.isArray(sub.options)) {
            return sub.options.map((o) => o.value);
          }
        }
      }
    }
    return null;
  }

  for (const id of radioLike) {
    const opts = optionsFor(id);
    if (opts) enums[id] = opts;
  }
  enums.q4_tenure = enums.q4_tenure || ["forming", "3_12_months", "over_1_year"];
  enums.q4_domain_familiarity = enums.q4_domain_familiarity || ["high", "medium", "low"];
  enums.q11_deploy_cadence = enums.q11_deploy_cadence || ["continuous", "sprint", "monthly", "quarterly"];
  enums.q11_cycle_time = enums.q11_cycle_time || ["under_2h", "1_3_days", "1_2_weeks", "over_2_weeks"];
  enums.q12_quality_gates = optionsFor("q12_quality_gates") || [];
  enums.q16_bottlenecks = optionsFor("q16_bottlenecks") || [];
  enums.q20_runtimes = optionsFor("q20_runtimes") || [];
  enums.po = ["dedicated", "shared", "none"];
  enums.sm = ["dedicated", "shared", "none"];
  _enums = { enums, radioLike };
  return _enums;
}

function randomAnswers(rng, api) {
  const { enums, radioLike } = fieldEnums(api);
  const a = {};
  if (maybe(rng, 0.2)) return a; // empty / sparse

  for (const id of radioLike) {
    if (maybe(rng, 0.25)) continue; // absent
    a[id] = pick(rng, enums[id]);
  }

  if (!maybe(rng, 0.3)) {
    const gates = enums.q12_quality_gates.filter(() => rng() < 0.35);
    a.q12_quality_gates = gates;
  } else if (rng() < 0.5) {
    a.q12_quality_gates = [];
  }

  if (!maybe(rng, 0.35)) {
    const bots = [...enums.q16_bottlenecks].sort(() => rng() - 0.5).slice(0, 1 + Math.floor(rng() * 3));
    a.q16_bottlenecks = bots;
  }

  if (!maybe(rng, 0.3)) {
    const rts = enums.q20_runtimes.filter(() => rng() < 0.3);
    a.q20_runtimes = rts.length ? rts : [pick(rng, enums.q20_runtimes)];
  }

  if (!maybe(rng, 0.25)) {
    const roadmap = Math.floor(rng() * 101);
    const rem = 100 - roadmap;
    const parts = [0, 0, 0, 0];
    let left = rem;
    for (let i = 0; i < 3; i++) {
      parts[i] = Math.floor(rng() * (left + 1));
      left -= parts[i];
    }
    parts[3] = left;
    if (rng() < 0.15) {
      // invalid sum
      a.q5_work_breakdown = {
        roadmap, ops: parts[0], bugs: parts[1],
        regulatory: parts[2], tech_debt: parts[3] + (rng() < 0.5 ? 3 : -3),
      };
    } else {
      a.q5_work_breakdown = {
        roadmap, ops: parts[0], bugs: parts[1],
        regulatory: parts[2], tech_debt: parts[3],
      };
    }
  }

  if (!maybe(rng, 0.25)) {
    const total = 1 + Math.floor(rng() * 20);
    a.q2_team = {
      total,
      swe: Math.floor(rng() * (total + 1)),
      data_engineers: Math.floor(rng() * 5),
      qa_sdet: Math.floor(rng() * 4),
      product_owner: pick(rng, enums.po),
      scrum_master: pick(rng, enums.sm),
    };
    if (rng() < 0.1) delete a.q2_team.product_owner; // incomplete
  }

  if (rng() < 0.1) {
    a.q17_process_mismatch = "seeded note " + Math.floor(rng() * 1e6);
  }

  return a;
}

export function seededRandom(count = 50_000, seed = 0x5dd5e1ec, api) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ name: `rand-${i}`, answers: randomAnswers(rng, api) });
  }
  return out;
}

export function malformedSets() {
  const out = [];
  const A = selftestBase;
  out.push({ name: "mal-wrong-type-q6", answers: A({ q6_volatility: 42 }) });
  out.push({ name: "mal-unknown-enum", answers: A({ q10_architecture: "quantum" }) });
  out.push({ name: "mal-neg-team", answers: A({
    q2_team: {
      total: -3, swe: -1, data_engineers: 0, qa_sdet: -2,
      product_owner: "none", scrum_master: "none",
    },
  }) });
  out.push({ name: "mal-oversized-q17", answers: A({
    q17_process_mismatch: "x".repeat(10_000),
  }) });
  out.push({ name: "mal-q5-strings", answers: A({
    q5_work_breakdown: { roadmap: "80", ops: "5", bugs: "5", regulatory: "5", tech_debt: "5" },
  }) });
  out.push({ name: "mal-q12-not-array", answers: A({ q12_quality_gates: "unit_coverage" }) });
  out.push({ name: "mal-q16-dupes", answers: A({
    q16_bottlenecks: ["test_fear", "test_fear", "test_fear"],
  }) });
  out.push({ name: "mal-q20-null", answers: A({ q20_runtimes: null }) });
  out.push({ name: "mal-nested-junk", answers: { q2_team: "nope", q5_work_breakdown: [] } });
  out.push({ name: "mal-proto", answers: Object.assign(Object.create({ polluted: true }), A({})) });

  // Expand to ~200 variants
  const junkEnums = ["q6_volatility", "q7_requirements", "q8_compliance", "q9_precision",
    "q10_architecture", "q14_release_autonomy", "q18_token_budget", "q21_ci_maturity"];
  junkEnums.forEach((id, i) => {
    out.push({ name: `mal-enum-${id}`, answers: A({ [id]: `__bad_${i}` }) });
    out.push({ name: `mal-null-${id}`, answers: A({ [id]: null }) });
    out.push({ name: `mal-obj-${id}`, answers: A({ [id]: { x: 1 } }) });
    out.push({ name: `mal-arr-${id}`, answers: A({ [id]: ["a"] }) });
  });
  for (let n = -5; n <= 10; n++) {
    out.push({ name: `mal-team-total-${n}`, answers: A({
      q2_team: {
        total: n, swe: 1, data_engineers: 0, qa_sdet: 0,
        product_owner: "dedicated", scrum_master: "none",
      },
    }) });
  }
  for (let i = 0; i < 50; i++) {
    out.push({ name: `mal-mix-${i}`, answers: {
      q10_architecture: i % 2 ? "streaming" : 99,
      q5_work_breakdown: i % 3 === 0 ? null : q5(i * 3, i, i, i, i),
      q12_quality_gates: i % 4 === 0 ? { 0: "e2e" } : ["unit_coverage"],
      q16_bottlenecks: i % 5 === 0 ? "test_fear" : ["test_fear"],
    } });
  }
  return out;
}

/**
 * Full corpus for parity. Random family size is configurable for quick local runs.
 */
export function buildCorpus({ randomCount = 50_000, api } = {}) {
  return {
    documented: documentedFixtures(),
    boundary: boundarySweep(),
    random: seededRandom(randomCount, 0x5dd5e1ec, api),
    malformed: malformedSets(),
  };
}

export function flattenCorpus(corpus) {
  return [
    ...corpus.documented,
    ...corpus.boundary,
    ...corpus.random,
    ...corpus.malformed,
  ];
}
