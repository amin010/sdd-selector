/**
 * One-shot authoring helper: write EXT-SELECT axes/practices/parameters and
 * the §7 instrument repairs into packs/finance-tech.json.
 *
 * Idempotent enough to re-run; it replaces the authored selection model and
 * rewrites the four instrument questions in place.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packPath = path.join(root, "packs", "finance-tech.json");

const SEVERITY = [
  { value: "none", label: "None" },
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "blocking", label: "Blocking" },
];

const SEV_MAP = { none: 0, minor: 0.33, major: 0.67, blocking: 1 };

const BOTTLENECKS = [
  { id: "ambiguous_or_shifting", label: "Ambiguous or shifting requirements" },
  { id: "flaky_cicd", label: "Flaky CI/CD pipelines or slow builds" },
  { id: "cross_team_approvals", label: "Cross-team dependencies and waiting on approvals" },
  { id: "test_fear", label: "Lack of test automation / fear of breaking financial calculations" },
  { id: "interruptive_support", label: "High volume of interruptive support tickets/incidents" },
  { id: "compliance_overhead", label: "Complex compliance/audit documentation overhead" },
  { id: "legacy_tech_debt", label: "Technical debt in legacy codebases" },
];

function cap(entries) {
  return Object.fromEntries(entries);
}

function enf(entries) {
  return Object.fromEntries(entries);
}

const axes = [
  {
    id: "brownfield",
    label: "Brownfield / non-roadmap load",
    demand: {
      combine: "max",
      terms: [
        { reads: ["derived.nonRoadmapShare"], fields: ["q5_work_breakdown"], q: 25, p: 55, scale: 1 },
        {
          reads: ["q10_architecture"],
          fields: ["q10_architecture"],
          map: { monolith: 0.85, hybrid: 0.7, batch_data: 0.55, microservices: 0.1, streaming: 0.15 },
          q: 0.2, p: 0.8,
        },
      ],
    },
  },
  {
    id: "midFlightChange",
    label: "Mid-flight change pressure",
    demand: {
      terms: [{
        reads: ["q6_volatility"],
        fields: ["q6_volatility"],
        map: { very_low: 0, moderate: 0.25, high: 0.85, interrupt_driven: 1 },
        q: 0.15, p: 0.8,
      }],
    },
  },
  {
    id: "ambiguityHandling",
    label: "Ambiguity handling",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q7_requirements"], fields: ["q7_requirements"], map: { structured: 0, high_level: 0.55, vague: 1 }, q: 0.2, p: 0.85 },
        { reads: ["q4_domain_familiarity"], fields: ["q4_domain_familiarity"], map: { high: 0, medium: 0.35, low: 1 }, q: 0.2, p: 0.8 },
        { reads: ["q16_bottlenecks.ambiguous_or_shifting"], fields: ["q16_bottlenecks"], map: SEV_MAP, q: 0.2, p: 0.8 },
      ],
    },
  },
  {
    id: "verificationStrength",
    label: "Verification strength",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q9_precision"], fields: ["q9_precision"], map: { standard: 0.15, analytics: 0.4, zero_tolerance: 1 }, q: 0.2, p: 0.85 },
        { reads: ["derived.coverageLevel"], fields: ["q12_quality_gates"], map: { low: 0.9, partial: 0.45, high: 0.1 }, q: 0.15, p: 0.8 },
        { reads: ["q16_bottlenecks.test_fear"], fields: ["q16_bottlenecks"], map: SEV_MAP, q: 0.2, p: 0.8 },
      ],
    },
  },
  {
    id: "deterministicEnforcement",
    label: "Deterministic enforcement",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q8_compliance"], fields: ["q8_compliance"], map: { sox_tier1: 1, internal_governance: 0.45, standard_enterprise: 0.2, low_nonfinancial: 0 }, q: 0.2, p: 0.85 },
        { reads: ["q9_precision"], fields: ["q9_precision"], map: { zero_tolerance: 0.9, analytics: 0.3, standard: 0.1 }, q: 0.2, p: 0.85 },
        { reads: ["derived.ciMaturity"], fields: ["q21_ci_maturity"], map: { none: 1, tests_only: 0.7, tests_plus_static: 0.35, contracts_runtime: 0.1 }, q: 0.15, p: 0.8 },
      ],
    },
  },
  {
    id: "auditTrail",
    label: "Audit trail",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q8_compliance"], fields: ["q8_compliance"], map: { sox_tier1: 1, internal_governance: 0.5, standard_enterprise: 0.2, low_nonfinancial: 0 }, q: 0.2, p: 0.85 },
        { reads: ["q15_governance"], fields: ["q15_governance"], map: { cab: 1, lightweight_review: 0.3, automated: 0.1 }, q: 0.2, p: 0.85 },
      ],
    },
  },
  {
    id: "roleSeparation",
    label: "Role separation",
    demand: {
      combine: "mean",
      terms: [
        { reads: ["derived.hasProductOwner"], fields: ["q2_team"], map: { true: 1, false: 0 }, q: 0, p: 1 },
        { reads: ["derived.hasScrumMaster"], fields: ["q2_team"], map: { true: 1, false: 0 }, q: 0, p: 1 },
        { reads: ["derived.hasQaSdet"], fields: ["q2_team"], map: { true: 1, false: 0 }, q: 0, p: 1 },
      ],
    },
  },
  {
    id: "concurrencyIsolation",
    label: "Concurrency isolation",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q3_distribution"], fields: ["q3_distribution"], map: { more_than_6: 0.1, "3_to_6": 0.45, fewer_than_3: 1 }, q: 0.2, p: 0.85 },
        { reads: ["q14_release_autonomy"], fields: ["q14_release_autonomy"], map: { autonomous: 0.1, coupled: 0.75, heavy: 1, vendor: 0 }, q: 0.2, p: 0.85 },
        { reads: ["q16_bottlenecks.cross_team_approvals"], fields: ["q16_bottlenecks"], map: SEV_MAP, q: 0.2, p: 0.8 },
      ],
    },
  },
  {
    id: "contextHygiene",
    label: "Context hygiene",
    demand: {
      terms: [{
        reads: ["q10_architecture"],
        fields: ["q10_architecture"],
        map: { monolith: 0.85, hybrid: 0.4, batch_data: 0.25, microservices: 0.1, streaming: 0.15 },
        q: 0.2, p: 0.85,
      }],
    },
  },
  {
    id: "traceability",
    label: "Traceability",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q8_compliance"], fields: ["q8_compliance"], map: { sox_tier1: 0.8, internal_governance: 0.4, standard_enterprise: 0.15, low_nonfinancial: 0 }, q: 0.2, p: 0.85 },
        { reads: ["q15_governance"], fields: ["q15_governance"], map: { cab: 0.7, lightweight_review: 0.25, automated: 0.15 }, q: 0.2, p: 0.85 },
      ],
    },
  },
  {
    id: "fastPath",
    label: "Low-ceremony fast path",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q19_change_volume"], fields: ["q19_change_volume"], map: { many_small: 1, balanced: 0.3, few_large: 0.05 }, q: 0.2, p: 0.85 },
        { reads: ["q6_volatility"], fields: ["q6_volatility"], map: { very_low: 0, moderate: 0.2, high: 0.75, interrupt_driven: 1 }, q: 0.2, p: 0.85 },
        { reads: ["q16_bottlenecks.interruptive_support"], fields: ["q16_bottlenecks"], map: SEV_MAP, q: 0.2, p: 0.8 },
      ],
    },
  },
  {
    id: "ceremonyTolerance",
    label: "Need for low ceremony",
    demand: {
      combine: "max",
      terms: [
        { reads: ["q19_change_volume"], fields: ["q19_change_volume"], map: { many_small: 1, balanced: 0.35, few_large: 0.05 }, q: 0.2, p: 0.85 },
        { reads: ["q11_deploy_cadence"], fields: ["q11_deploy_cadence"], map: { continuous: 0.85, sprint: 0.45, monthly: 0.2, quarterly: 0.05 }, q: 0.2, p: 0.85 },
      ],
    },
  },
  {
    id: "tokenBudget",
    label: "Token-budget tightness",
    demand: {
      terms: [{
        reads: ["q18_token_budget"],
        fields: ["q18_token_budget"],
        map: { unmetered: 0, team_plan: 0.25, individual_pro: 0.7, strict: 1 },
        q: 0.15, p: 0.8,
      }],
    },
  },
  {
    id: "specDebt",
    label: "Existing spec / doc debt",
    demand: { terms: [{ reads: [], q: 0, p: 1 }] },
  },
];

const practices = [
  {
    id: "delta-only-specs",
    label: "Delta-only specs",
    capability: cap([["brownfield", 0.95], ["midFlightChange", 0.85], ["ceremonyTolerance", 0.7], ["fastPath", 0.55]]),
    enforcement: enf([["brownfield", "human_gate"], ["midFlightChange", "human_gate"]]),
    cost: { ceremony: 0.2, tokens: 0.2 },
    sources: ["openspec"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["openspec/specs/", "openspec/changes/<name>/{proposal,design,tasks,spec}.md"],
    commands: ["/opsx:explore", "/opsx:propose", "/opsx:apply", "/opsx:archive"],
    rationale: "Write specs only for the change at hand. Strongest brownfield fit in the catalogue.",
    resolves: ["legacy_tech_debt"],
  },
  {
    id: "openspec-change-archive",
    label: "Change archive",
    capability: cap([["auditTrail", 0.45], ["traceability", 0.4]]),
    enforcement: enf([["auditTrail", "advisory"], ["traceability", "advisory"]]),
    cost: { ceremony: 0.15, tokens: 0.1 },
    sources: ["openspec"],
    liftable: true,
    requires: ["delta-only-specs"],
    excludes: [],
    artifacts: ["openspec/changes/"],
    commands: ["/opsx:archive"],
    rationale: "Archived change folders are an audit artifact, but /opsx:verify does not block archive.",
    resolves: [],
  },
  {
    id: "regulatory-constitution",
    label: "Regulatory constitution",
    capability: cap([["auditTrail", 0.7], ["traceability", 0.55], ["deterministicEnforcement", 0.25]]),
    enforcement: enf([["auditTrail", "advisory"], ["traceability", "advisory"], ["deterministicEnforcement", "advisory"]]),
    cost: { ceremony: 0.25, tokens: 0.2 },
    sources: ["speckit"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["constitution.md"],
    commands: ["/speckit.constitution"],
    rationale: "Written invariants in the agent session. Advisory only — pair with CI.",
    resolves: ["compliance_overhead"],
  },
  {
    id: "speckit-phase-pipeline",
    label: "Spec Kit phase pipeline",
    capability: cap([["traceability", 0.6], ["ambiguityHandling", 0.25], ["verificationStrength", 0.3]]),
    enforcement: enf([["traceability", "human_gate"]]),
    cost: { ceremony: 0.7, tokens: 0.55 },
    sources: ["speckit"],
    liftable: false,
    requires: [],
    excludes: [],
    artifacts: ["spec.md", "plan.md", "tasks.md"],
    commands: ["/speckit.specify", "/speckit.plan", "/speckit.tasks", "/speckit.implement"],
    rationale: "Seven-phase pipeline for structured greenfield work. The pipeline is the tool.",
    resolves: [],
  },
  {
    id: "tdd-iron-law",
    label: "TDD iron law",
    capability: cap([["verificationStrength", 0.95], ["deterministicEnforcement", 0.4]]),
    enforcement: enf([["verificationStrength", "agent_gate"], ["deterministicEnforcement", "agent_gate"]]),
    cost: { ceremony: 0.45, tokens: 0.6 },
    sources: ["superpowers"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["tests/"],
    commands: ["test-driven-development"],
    rationale: "Failing tests before production code. Travels without Superpowers as the harness.",
    resolves: ["test_fear"],
  },
  {
    id: "two-stage-review",
    label: "Two-stage review",
    capability: cap([["verificationStrength", 0.55], ["auditTrail", 0.35]]),
    enforcement: enf([["verificationStrength", "human_gate"]]),
    cost: { ceremony: 0.35, tokens: 0.35 },
    sources: ["superpowers", "bmad"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["review notes"],
    commands: ["requesting-code-review"],
    rationale: "Adversarial or two-stage review. BMAD QA persona and Superpowers review skill are the same node.",
    resolves: [],
  },
  {
    id: "lane-worktrees",
    label: "Lane state machine and worktrees",
    capability: cap([["concurrencyIsolation", 0.95], ["auditTrail", 0.85], ["deterministicEnforcement", 0.7]]),
    enforcement: enf([["concurrencyIsolation", "hard_gate"], ["auditTrail", "hard_gate"], ["deterministicEnforcement", "hard_gate"]]),
    cost: { ceremony: 0.65, tokens: 0.4 },
    sources: ["speckitty"],
    liftable: false,
    requires: [],
    excludes: [],
    requiresWhen: { gte: [{ derived: "teamSize" }, 3] },
    artifacts: ["kitty-specs/", ".worktrees/", "append-only status log"],
    commands: ["spec-kitty agent tasks move-task", "spec-kitty sync workspace"],
    rationale: "27-transition lane machine. It is the tool, so it is not liftable.",
    resolves: ["cross_team_approvals"],
  },
  {
    id: "domain-recon",
    label: "Domain reconnaissance",
    capability: cap([["ambiguityHandling", 0.9]]),
    enforcement: enf([["ambiguityHandling", "advisory"]]),
    cost: { ceremony: 0.35, tokens: 0.45 },
    sources: ["bmad", "superpowers"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["research notes", "PRD.md"],
    commands: ["bmad-deep-recon", "brainstorming"],
    rationale: "Discovery before implementation when the domain or the ask is still vague.",
    resolves: ["ambiguous_or_shifting"],
  },
  {
    id: "role-personas",
    label: "Role personas",
    capability: cap([["roleSeparation", 0.95], ["ambiguityHandling", 0.35]]),
    enforcement: enf([["roleSeparation", "human_gate"]]),
    cost: { ceremony: 0.5, tokens: 0.5 },
    sources: ["bmad"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["_bmad/", "PRD.md", "sprint-status.yaml"],
    commands: ["bmad-prd", "bmad-architecture", "bmad-build"],
    rationale: "PO, Scrum Master, and QA personas pay off when those roles exist.",
    resolves: [],
  },
  {
    id: "ephemeral-subagent-waves",
    label: "Ephemeral subagent waves",
    capability: cap([["contextHygiene", 0.95]]),
    enforcement: enf([["contextHygiene", "agent_gate"]]),
    cost: { ceremony: 0.35, tokens: 0.4 },
    sources: ["gsd"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: [".planning/phases/"],
    commands: ["/gsd:execute-phase"],
    rationale: "Fresh-context executor waves for broad file spans.",
    resolves: [],
  },
  {
    id: "gsd-req-ids",
    label: "GSD REQ-id traceability",
    capability: cap([["traceability", 0.8], ["auditTrail", 0.35]]),
    enforcement: enf([["traceability", "agent_gate"]]),
    cost: { ceremony: 0.3, tokens: 0.25 },
    sources: ["gsd"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: [".planning/REQUIREMENTS.md"],
    commands: ["/gsd:plan-phase"],
    rationale: "Requirement ids in .planning/ are GSD Core's traceability offer.",
    resolves: [],
  },
  {
    id: "deterministic-ci",
    label: "Deterministic CI enforcement",
    capability: cap([["deterministicEnforcement", 1], ["verificationStrength", 0.55], ["auditTrail", 0.35]]),
    enforcement: enf([["deterministicEnforcement", "hard_gate"], ["verificationStrength", "hard_gate"]]),
    cost: { ceremony: 0.3, tokens: 0.15 },
    sources: [],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: [".github/workflows/spec-gates.yml"],
    commands: [],
    rationale: "Required status checks. Complements advisory constitutions (overlay-f as arithmetic).",
    resolves: ["flaky_cicd"],
  },
  {
    id: "low-ceremony-fast-path",
    label: "Low-ceremony fast path",
    capability: cap([["fastPath", 0.95], ["ceremonyTolerance", 0.9], ["midFlightChange", 0.45]]),
    enforcement: enf([["fastPath", "advisory"], ["ceremonyTolerance", "advisory"]]),
    cost: { ceremony: 0.1, tokens: 0.15 },
    sources: ["openspec", "bmad"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: ["written scope rule for when not to run the full pipeline"],
    commands: ["bmad-quick-spec", "/opsx:propose"],
    rationale: "A documented two-track policy beside any heavyweight pipeline.",
    resolves: ["interruptive_support"],
  },
  {
    id: "one-question-at-a-time",
    label: "One question at a time",
    capability: cap([["ambiguityHandling", 0.55]]),
    enforcement: enf([["ambiguityHandling", "advisory"]]),
    cost: { ceremony: 0.15, tokens: 0.15 },
    sources: ["tessl"],
    liftable: true,
    requires: [],
    excludes: [],
    artifacts: [],
    commands: ["requirement-gathering"],
    rationale: "Tessl's interview discipline, recommendable while Tessl stays vetoed as a harness.",
    resolves: [],
  },
];

const parameters = {
  tier: "prior",
  note: "Prior mean centered on 0.5.1 hand weights. Replace with a fitted vector after S4.",
  theta: {
    brownfield: 1.2,
    midFlightChange: 0.85,
    ambiguityHandling: 0.95,
    verificationStrength: 1.05,
    deterministicEnforcement: 1.1,
    auditTrail: 0.9,
    roleSeparation: 1.0,
    concurrencyIsolation: 0.75,
    contextHygiene: 0.65,
    traceability: 0.7,
    fastPath: 0.85,
    ceremonyTolerance: 0.75,
    tokenBudget: 0.65,
    specDebt: 0,
  },
  lambda: {
    brownfield: 0.15,
    midFlightChange: 0.12,
    ambiguityHandling: 0.18,
    verificationStrength: 0.15,
    deterministicEnforcement: 0.2,
    auditTrail: 0.15,
    roleSeparation: 0.25,
    concurrencyIsolation: 0.2,
    contextHygiene: 0.12,
    traceability: 0.12,
    fastPath: 0.1,
    ceremonyTolerance: 0.1,
    tokenBudget: 0.08,
    specDebt: 0,
  },
  mu: { ceremony: 0.18, tokens: 0.22, adoption: 0.28 },
  kappa: { hard_gate: 1, agent_gate: 0.67, human_gate: 0.5, advisory: 0.33 },
  gamma: 0.4,
};

const bundles = {
  openspec: { bundle: ["delta-only-specs", "openspec-change-archive", "low-ceremony-fast-path"], cost: { ceremony: 0.15, tokens: 0.15, adoption: 0.15 } },
  speckit: { bundle: ["regulatory-constitution", "speckit-phase-pipeline"], cost: { ceremony: 0.45, tokens: 0.4, adoption: 0.35 } },
  bmad: { bundle: ["domain-recon", "role-personas", "two-stage-review", "low-ceremony-fast-path"], cost: { ceremony: 0.4, tokens: 0.45, adoption: 0.35 } },
  gsd: { bundle: ["ephemeral-subagent-waves", "gsd-req-ids"], cost: { ceremony: 0.3, tokens: 0.3, adoption: 0.3 } },
  superpowers: { bundle: ["tdd-iron-law", "domain-recon", "two-stage-review"], cost: { ceremony: 0.45, tokens: 0.65, adoption: 0.4 } },
  speckitty: { bundle: ["lane-worktrees"], cost: { ceremony: 0.5, tokens: 0.3, adoption: 0.4 } },
  tessl: { bundle: ["one-question-at-a-time"], cost: { ceremony: 0.25, tokens: 0.25, adoption: 0.35 } },
};

const derivedFrom = {
  C1: { condition: "uncovered_demand", axis: "brownfield", harness: "speckit", demandMin: 0.45, coverageMax: 0.55 },
  C2: { condition: "enforcement_gap", axis: "auditTrail", practice: "regulatory-constitution", demandMin: 0.55 },
  C3: { condition: "cost_mismatch", axis: "tokenBudget", demandMin: 0.55, costMin: 0.3 },
  C4: { retired: "dropped", note: "Tessl [@test] is not a recommended practice; one-question-at-a-time replaced it." },
  C5: { condition: "enforcement_gap", axis: "verificationStrength", harness: "openspec", demandMin: 0.7 },
  C6: { condition: "enforcement_strength", axis: "auditTrail", practice: "lane-worktrees", demandMin: 0.55, coverageMin: 0.6 },
  C7: { condition: "cost_mismatch", axis: "ceremonyTolerance", demandMin: 0.55, costMin: 0.35 },
  C8: { retired: "constraint", note: "Became requiresWhen teamSize >= 3 on lane-worktrees." },
  C9: { condition: "attribute_risk", harness: "gsd", evidence: { any: true } },
  C10: { condition: "attribute_risk", harness: "superpowers", evidence: { zeroCommits: true } },
  C11: { condition: "attribute_risk", harness: "bmad", evidence: { nonMitLicense: true } },
  C12: { condition: "cost_mismatch", axis: "midFlightChange", demandMin: 0.7, costMin: 0.3 },
  C13: { retired: "constraint", note: "Vendor zeros concurrencyIsolation demand via demandScopes." },
  C14: { condition: "uncovered_demand", axis: "brownfield", harness: "speckit", demandMin: 0.5, coverageMax: 0.5 },
  C15: { retired: "veto", note: "Watch-status harnesses are excluded before scoring." },
  C20: { retired: "veto", note: "Runtime mismatch is a veto, reported as its own sentence." },
};

function findQuestion(pack, id) {
  return pack.questions.find((q) => q.id === id || (q.fields || []).some((f) => f.id === id));
}

function migrateQ16(value) {
  const rec = {};
  for (const b of BOTTLENECKS) rec[b.id] = "none";
  if (Array.isArray(value)) {
    value.forEach((id, i) => {
      if (!Object.hasOwn(rec, id)) return;
      rec[id] = i === 0 ? "blocking" : i === 1 ? "major" : "minor";
    });
  }
  return rec;
}

function migrateQ3(value) {
  if (value === "colocated") return "more_than_6";
  if (value === "regional") return "3_to_6";
  if (value === "global_timezones") return "fewer_than_3";
  return value;
}

function migrateQ21(value) {
  if (Array.isArray(value)) return value;
  if (value === "none") return [];
  if (value === "tests_only") return ["unit_tests"];
  if (value === "tests_plus_static") return ["unit_tests", "static_analysis"];
  if (value === "contracts_runtime") return ["unit_tests", "static_analysis", "contract_tests", "runtime_checks"];
  return value;
}

function main() {
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  pack.meta.version = "0.6.0";
  pack.meta.updated = "2026-09-19";
  pack.settings.selection = "utility";
  pack.settings.utility = { k: 5, conformalAlpha: 0.2 };
  if (pack.settings.tierZero) {
    pack.settings.tierZero.mode = "hard";
    delete pack.settings.tierZero.runtimeMismatchPenalty;
    delete pack.settings.tierZero.watchPenalty;
  }

  if (!pack.report) pack.report = {};
  pack.report.bottleneckField = "q16_bottlenecks";

  pack.axes = axes;
  pack.practices = practices;
  pack.parameters = parameters;
  pack.demandScopes = [
    {
      when: { eq: [{ answer: "q14_release_autonomy" }, "vendor"] },
      zero: ["concurrencyIsolation"],
    },
  ];

  for (const fw of pack.frameworks) {
    const extra = bundles[fw.id];
    if (!extra) continue;
    fw.bundle = extra.bundle;
    fw.cost = extra.cost;
  }

  const q3 = findQuestion(pack, "q3_distribution");
  q3.legend = "Daily overlapping working hours";
  q3.help = "Hours of shared working day. Behavioural anchor for concurrency isolation; does not pick the harness by itself.";
  const q3f = q3.fields.find((f) => f.id === "q3_distribution");
  q3f.options = [
    { value: "more_than_6", label: "More than 6 hours of overlap" },
    { value: "3_to_6", label: "3–6 hours of overlap" },
    { value: "fewer_than_3", label: "Fewer than 3 hours of overlap" },
  ];

  const q5 = findQuestion(pack, "q5_work_breakdown");
  q5.legend = "Breakdown of incoming work (approximate percentages are normalized to 100%)";
  q5.help = "Non-roadmap share steers brownfield demand. Approximate sums are rescaled rather than rejected.";
  const q5f = q5.fields.find((f) => f.id === "q5_work_breakdown");
  q5f.constraints.sumToMode = "normalize";

  const q16 = findQuestion(pack, "q16_bottlenecks");
  q16.legend = "How severe is each productivity bottleneck?";
  q16.help = "Independent severity ratings. No forced ranking. Feeds demand as a magnitude.";
  q16.fields = [{
    kind: "record",
    id: "q16_bottlenecks",
    hashKey: "q16",
    fields: BOTTLENECKS.map((b) => ({
      kind: "single",
      id: b.id,
      label: b.label,
      options: SEVERITY,
    })),
  }];

  const q20 = findQuestion(pack, "q20_runtimes");
  q20.help = "Hard veto: a framework that documents a non-empty runtime list with no overlap is excluded, not score-penalized. Choose Unsure / any if you do not know.";

  const q21 = findQuestion(pack, "q21_ci_maturity");
  q21.legend = "Which CI artifacts already run on every pull request?";
  q21.help = "Checklist of concrete artifacts. An ordinal maturity is derived, the same pattern as coverageLevel.";
  q21.fields = [{
    kind: "multi",
    id: "q21_ci_maturity",
    hashKey: "q21",
    options: [
      { value: "unit_tests", label: "Unit tests run on every PR" },
      { value: "static_analysis", label: "Static analysis / linters as a required check" },
      { value: "contract_tests", label: "Contract or API schema tests" },
      { value: "runtime_checks", label: "Runtime assertion or invariant checks in CI" },
      { value: "required_status", label: "Required status checks that block merge" },
    ],
  }];

  if (!pack.derived.some((d) => d.key === "ciMaturity")) {
    pack.derived.push({
      key: "ciMaturity",
      expr: {
        bucket: {
          value: { countSelected: { field: "q21_ci_maturity" } },
          cuts: [
            { lte: 0, then: "none" },
            { lte: 1, then: "tests_only" },
            { lte: 3, then: "tests_plus_static" },
          ],
          else: "contracts_runtime",
        },
      },
    });
  }

  for (const overlay of pack.overlays) {
    if (overlay.id === "overlay-c" && overlay.when) {
      overlay.when = {
        any: [
          { in: [{ answer: "q14_release_autonomy" }, ["coupled", "heavy"]] },
          { eq: [{ answer: "q3_distribution" }, "fewer_than_3"] },
        ],
      };
    }
    if (overlay.id === "overlay-f") {
      overlay.when = {
        all: [
          {
            any: [
              { eq: [{ answer: "q8_compliance" }, "sox_tier1"] },
              { eq: [{ answer: "q9_precision" }, "zero_tolerance"] },
            ],
          },
          { in: [{ derived: "ciMaturity" }, ["none", "tests_only"]] },
        ],
      };
    }
    if (overlay.id === "overlay-b") {
      overlay.when = {
        any: [
          { eq: [{ answer: "q9_precision" }, "zero_tolerance"] },
          { in: [{ answer: "q16_bottlenecks.test_fear" }, ["major", "blocking"]] },
          { flag: "force_tdd_overlay" },
        ],
      };
    }
    if (overlay.id === "overlay-d") {
      overlay.when = {
        any: [
          { eq: [{ answer: "q4_domain_familiarity" }, "low"] },
          { eq: [{ answer: "q7_requirements" }, "vague"] },
          { in: [{ answer: "q16_bottlenecks.ambiguous_or_shifting" }, ["major", "blocking"]] },
        ],
      };
    }
  }

  for (const caution of pack.cautions) {
    if (derivedFrom[caution.id]) caution.derivedFrom = derivedFrom[caution.id];
  }

  for (const fx of pack.fixtures || []) {
    const a = fx.answers || {};
    if (Object.hasOwn(a, "q16_bottlenecks")) a.q16_bottlenecks = migrateQ16(a.q16_bottlenecks);
    if (Object.hasOwn(a, "q3_distribution")) a.q3_distribution = migrateQ3(a.q3_distribution);
    if (Object.hasOwn(a, "q21_ci_maturity")) a.q21_ci_maturity = migrateQ21(a.q21_ci_maturity);
  }

  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`updated ${path.relative(root, packPath)} to ${pack.meta.version} (${practices.length} practices, ${axes.length} axes)`);

  const answersPath = path.join(root, "tools", "qc", "data", "answers.json");
  if (fs.existsSync(answersPath)) {
    const answers = JSON.parse(fs.readFileSync(answersPath, "utf8"));
    for (const rec of answers) {
      const a = rec.answers || {};
      if (Object.hasOwn(a, "q16_bottlenecks")) a.q16_bottlenecks = migrateQ16(a.q16_bottlenecks);
      if (Object.hasOwn(a, "q3_distribution")) a.q3_distribution = migrateQ3(a.q3_distribution);
      if (Object.hasOwn(a, "q21_ci_maturity")) a.q21_ci_maturity = migrateQ21(a.q21_ci_maturity);
    }
    fs.writeFileSync(answersPath, `${JSON.stringify(answers, null, 2)}\n`);
    console.log(`migrated ${answers.length} cached respondent answers`);
  }
}

main();
