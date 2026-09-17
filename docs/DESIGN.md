# SDD Selector — Design Document

| Field | Value |
|---|---|
| Status | Draft — awaiting review |
| Version | 0.3.0 |
| Owner | Amin Rashidi |
| Last updated | 2026-09-16 |
| Source material | *Modern Agentic Spec-Driven Development Frameworks*, Appendix: "Team Diagnostic & SDD Model Selection Decision System"; *Finance Tech Team & Project Diagnostic Questionnaire* (the instrument) |
| Evidence date | 2026-09-16 (see Appendix A for method) |

**Changelog**

- **0.3.0** — Replaced inferred Q1–Q16 enums with the real Finance Tech diagnostic instrument. Answers are the instrument; the engine reads named derived views where a rule needs an aggregate (§7.6). Q13 and the instrument's open-text Q17 are collected. Design-added questions are Q18–Q21. URL schema `v=3`. New cautions C12 (interrupt-driven) and C13 (vendor-dependent).
- **0.2.0** — Added evidence-based framework profiles (§8) and cross-cutting decision dimensions (§9) from primary-source research. Added Tier 3 caution rules (§10.4), four new diagnostic questions (§9.3), overlays F and G, and a documented list of divergences from the source document (§11). Corrected adoption metrics; several in the source document were materially wrong.
- **0.1.0** — Initial design from the source appendix.

---

## 1. Summary

SDD Selector is a single-file, static HTML page that takes a team's answers to a diagnostic questionnaire and deterministically recommends a spec-driven development (SDD) stack: one **base framework** (the daily workflow harness), zero or more **practice overlays** (techniques borrowed from other frameworks for specific constraints), and zero or more **cautions** (known failure modes of the recommended stack against this team's profile). It runs entirely in the browser with no backend, build step, or dependencies.

The decision logic originates in the source document's appendix but has been revised against primary-source research into each framework (§8, §11). The most consequential finding: **the source document overstates what several frameworks enforce**. Spec Kit's `constitution.md` is prompt context, not an independent gate; OpenSpec's `/opsx:verify` does not block archiving; Tessl's `[@test]` anchors are references, not executable assertions. A tool that recommends these to a SOX Tier 1 finance team without saying so would be actively misleading, so surfacing enforcement gaps is a first-class output, not a footnote.

## 2. Context and motivation

Teams choosing an agentic SDD framework face seven-plus credible options that optimize for conflicting priorities — ceremony versus velocity, greenfield versus brownfield, governance versus autonomy, rigor versus token cost. The source document argues no single framework should be mandated, and defines a **Two-Tier Composite Decision Architecture**:

- **Tier 1 — Base Lifecycle Engine**: the primary framework, chosen from dominant workload characteristics.
- **Tier 2 — Modular Practice Overlays**: specific practices layered on when boolean triggers fire.

This design adds a third tier:

- **Tier 3 — Cautions**: the recommended stack's known weaknesses evaluated against this team's answers. A recommendation without its failure modes is half an answer, and for regulated teams the missing half is the dangerous one.

## 3. Goals and non-goals

### Goals

- G1. Implement the base-selection rules and overlays from the source appendix, revised where primary sources contradict it, with every divergence documented (§11).
- G2. Deterministic: identical answers always yield identical output.
- G3. Zero infrastructure: open `index.html` from disk or any static host.
- G4. Shareable: a completed questionnaire is encodable in the URL.
- G5. Rules are data, not code; a non-developer can adjust a threshold or add an overlay.
- G6. Accessible (WCAG 2.1 AA), usable on desktop and mobile.
- G7. Testable without a browser: the engine is a pure function with fixture-based tests.
- G8. **Honest about enforcement.** Every recommended practice is labeled with what it actually enforces — hard gate, advisory prompt, or human checkpoint.
- G9. **Evidence-dated.** Adoption and maintenance claims carry the date they were verified, because they decay fast.

### Non-goals

- Not a general-purpose survey engine. The question set is fixed per release.
- Not an installer. Output references commands but executes nothing.
- No persistence beyond the URL hash. No accounts, no server storage, no analytics.
- No LLM involvement. Boolean rules only.
- Not a framework benchmark. It does not measure output quality; it matches operational profiles to documented capabilities.

## 4. Users and primary scenario

**Primary user**: an engineering lead, staff engineer, or platform team member evaluating SDD adoption for a team of 2–20 engineers, typically in a regulated (finance) context given the questionnaire's origin.

**Scenario**: The lead answers the diagnostic (~12–15 minutes) plus four constraint questions, sees the recommendation update live, reads the cautions, copies the Markdown report into an adoption proposal, and shares the URL so the team can inspect or tweak the inputs.

## 5. Requirements

### 5.1 Functional

| ID | Requirement |
|---|---|
| F1 | The page presents all diagnostic questions with the answer types in §7.1. |
| F2 | The recommendation re-evaluates on every input change without a submit action. |
| F3 | Exactly one base framework is recommended for any valid, complete answer set. |
| F4 | Every overlay whose trigger fires is listed; overlays already provided by the base are shown as "included in base" rather than as additional adoptions. |
| F5 | The report includes, per base and overlay: name, rationale, artifacts, commands, and an **enforcement class** (§9.2). |
| F6 | The report includes a Bottleneck Resolution Matrix mapping each ranked Q16 bottleneck to the practice addressing it, and explicitly names bottlenecks the stack does *not* address. |
| F7 | The report includes a suggested repository directory layout harmonizing the selected tools. |
| F8 | A "Copy as Markdown" action copies the full report to the clipboard. |
| F9 | Answers serialize into the URL fragment; loading a URL with a fragment restores form state. |
| F10 | Incomplete questionnaires show a partial result plus an explicit list of unanswered questions that could change the outcome. |
| F11 | Every rule evaluation is explainable: the report shows which answers triggered the base selection and each overlay. |
| F12 | **Cautions (Tier 3) are rendered with equal visual weight to recommendations**, not collapsed or footnoted. |
| F13 | The report shows a **runner-up base** with the reason it lost, so the user can see how close the call was. |
| F14 | Each framework's adoption and maintenance evidence is displayed with its verification date and a staleness warning if that date is more than 180 days before page load. |
| F15 | Frameworks whose status is `watch` (pre-production or unmaintained) are never recommended as a base and are labeled when mentioned as an overlay source. |

### 5.2 Non-functional

| ID | Requirement |
|---|---|
| N1 | Single `index.html`; no network requests at runtime. |
| N2 | Current and previous major version of Chrome, Firefox, Safari, Edge. |
| N3 | Input change to rendered result < 50 ms on a mid-range laptop. |
| N4 | WCAG 2.1 AA: keyboard operable, labeled controls, visible focus, contrast ≥ 4.5:1, live region for results. |
| N5 | No third-party scripts, fonts, or stylesheets. CSP-compatible. |
| N6 | Total file size < 150 KB uncompressed. |
| N7 | Engine is a pure function `evaluate(answers, rules) → result` with no DOM access. |

## 6. Architecture

### 6.1 Overview

Three layers in one file, separated by responsibility:

```
┌────────────────────────────────────────────────────────┐
│ index.html                                             │
│                                                        │
│  ┌────────────┐   answers    ┌──────────────┐          │
│  │  UI layer  │ ───────────▶ │    Engine    │          │
│  │ (form,     │              │  evaluate()  │          │
│  │  report,   │ ◀─────────── │   pure fn    │          │
│  │  URL sync) │   result     └──────┬───────┘          │
│  └────────────┘                     │ reads            │
│                              ┌──────▼───────┐          │
│                              │  Rules data  │          │
│                              │  FRAMEWORKS  │          │
│                              │  QUESTIONS   │          │
│                              │  BASE_RULES  │          │
│                              │  OVERLAYS    │          │
│                              │  CAUTIONS    │          │
│                              └──────────────┘          │
└────────────────────────────────────────────────────────┘
```

- **Rules data**: plain object literals. The only layer expected to change as the landscape evolves — and §8 shows it evolves monthly.
- **Engine**: pure functions. No DOM, no globals, no side effects. Exported on `window.SDDSelector` for testing.
- **UI layer**: renders the form from `QUESTIONS`, collects answers, calls the engine, renders the report, syncs the URL hash.

### 6.2 Why a single static file

| Alternative considered | Rejected because |
|---|---|
| Python CLI + YAML rules | Requires an install step; poor distribution to non-developers; harder to share a filled-in result. |
| Framework SPA with build | Build toolchain disproportionate for ~20 inputs and a rules table; adds supply-chain surface. |
| Server-rendered app | Hosting, uptime, and data-handling obligations for a tool that needs none. |
| HTML + separate `rules.json` | `fetch` over `file://` is blocked in most browsers, breaking "open from disk". Revisit if multiple rule sets are needed (§15). |

### 6.3 Module boundaries

```html
<script>
  // ── 1. Rules data (declarative) ──────────────────
  const FRAMEWORKS  = { ... };   // metadata + verified evidence + status
  const QUESTIONS   = [ ... ];   // drives form rendering + validation
  const BASE_RULES  = [ ... ];   // ordered; first match wins
  const OVERLAYS    = [ ... ];   // unordered; all matching apply
  const CAUTIONS    = [ ... ];   // unordered; predicate over answers + derived + result
  const FALLBACK_BASE = 'openspec';

  // ── 2. Engine (pure) ─────────────────────────────
  function derive(answers) { ... }                       // §7.6; never stored
  function evaluate(answers, rules) { ... }              // calls derive() internally
  function selectBase(answers, derived, baseRules) { ... } // returns winner + runner-up
  function applyOverlays(answers, derived, overlays, baseId) { ... }
  function applyCautions(answers, derived, cautions, partialResult) { ... }
  function buildBottleneckMatrix(answers, result) { ... }
  function completeness(answers, questions, rules) { ... }

  // ── 3. UI ────────────────────────────────────────
  function renderForm(questions, container) { ... }
  function readAnswers(form) { ... }
  function renderReport(result, container) { ... }
  function toMarkdown(result) { ... }
  function encodeHash(answers) / decodeHash(hash) { ... }

  window.SDDSelector = { evaluate, derive, selectBase, applyOverlays, applyCautions,
                         toMarkdown, FRAMEWORKS, QUESTIONS, BASE_RULES,
                         OVERLAYS, CAUTIONS };
</script>
```

## 7. Data model

### 7.1 Answers

Flat object keyed by question ID. Values are enumerated strings, arrays of enumerated strings, numbers, or one nested object per compound question. The engine never reads free text (D20); the instrument's open-text Q17 is stored for the Markdown report only.

Question numbers Q1–Q17 match the Finance Tech diagnostic instrument. Q18–Q21 are additions of this design (§9.3).

```ts
type Answers = {
  // ── Instrument Q1–Q17 ──
  q1_domain?:             'ledger' | 'reporting_compliance' | 'treasury'
                          | 'data_pipeline' | 'internal_platform' | 'other';
  q2_team?:               TeamMakeup;                   // size + roles
  q3_distribution?:       'colocated' | 'regional' | 'global_timezones';
  q4_tenure?:             'forming' | '3_12_months' | 'over_1_year';
  q4_domain_familiarity?: 'high' | 'medium' | 'low';
  q5_work_breakdown?:     WorkBreakdown;                // five percents, sum = 100
  q6_volatility?:         'very_low' | 'moderate' | 'high' | 'interrupt_driven';
  q7_requirements?:       'structured' | 'high_level' | 'vague';
  q8_compliance?:         'sox_tier1' | 'internal_governance'
                          | 'standard_enterprise' | 'low_nonfinancial';
  q9_precision?:          'zero_tolerance' | 'analytics' | 'standard';
  q10_architecture?:      'microservices' | 'batch_data' | 'streaming'
                          | 'monolith' | 'hybrid';
  q11_deploy_cadence?:    'continuous' | 'sprint' | 'monthly' | 'quarterly';
  q11_cycle_time?:        'under_2h' | '1_3_days' | '1_2_weeks' | 'over_2_weeks';
  q12_quality_gates?:     Array<QualityGateId>;         // check-all-that-apply
  q13_branching?:         'trunk_based' | 'gitflow' | 'adhoc';
  q14_release_autonomy?:  'autonomous' | 'coupled' | 'heavy' | 'vendor';
  q15_governance?:        'automated' | 'lightweight_review' | 'cab';
  q16_bottlenecks?:       Array<BottleneckId>;          // ordered, top 3, unique
  q17_process_mismatch?:  string;                       // report-only; ≤500 chars

  // ── Added in v0.2.0; renumbered in v0.3.0 (§9.3) ──
  q18_token_budget?:      'unmetered' | 'team_plan' | 'individual_pro' | 'strict';
  q19_change_volume?:     'many_small' | 'balanced' | 'few_large';
  q20_runtimes?:          Array<RuntimeId>;
  q21_ci_maturity?:       'none' | 'tests_only' | 'tests_plus_static' | 'contracts_runtime';
};

type TeamMakeup = {
  total: number;                                        // integer ≥ 1
  swe: number;
  data_engineers: number;
  qa_sdet: number;                                      // 0 allowed
  product_owner: 'dedicated' | 'shared' | 'none';
  scrum_master: 'dedicated' | 'shared' | 'none';
};

type WorkBreakdown = {
  roadmap: number;
  ops: number;                                          // unplanned support / triage
  bugs: number;                                         // production fixes / incidents
  regulatory: number;                                   // mandates / audit-driven
  tech_debt: number;
};                                                      // each 0–100; five must sum to 100

type QualityGateId =
  | 'unit_coverage' | 'integration_contract' | 'e2e'
  | 'financial_reconciliation' | 'sast_dast' | 'mostly_manual';

type BottleneckId =
  | 'ambiguous_or_shifting' | 'flaky_cicd' | 'cross_team_approvals'
  | 'test_fear' | 'interruptive_support' | 'compliance_overhead'
  | 'legacy_tech_debt';

type RuntimeId =
  | 'claude_code' | 'cursor' | 'codex' | 'copilot' | 'gemini_cli'
  | 'windsurf' | 'opencode' | 'other';
```

### 7.2 Framework metadata

```ts
type Framework = {
  id: FrameworkId;
  name: string;
  repo: string;
  status: 'recommended' | 'viable' | 'watch';   // 'watch' → never a base (F15)
  evidence: {
    verifiedOn: string;        // ISO date
    stars: number;
    forks: number;
    latestRelease: string;
    commitsLast30d: number | 'unknown';
    language: string;
    license: string;
  };
  runtimes: RuntimeId[];
  ceremony: 1 | 2 | 3 | 4 | 5;           // 1 = minimal, 5 = heavy
  tokenCost: 1 | 2 | 3 | 4 | 5;
  brownfieldFit: 1 | 2 | 3 | 4 | 5;
  midFlightChange: 1 | 2 | 3 | 4 | 5;
  install: string;
  commands: string[];
  artifacts: string[];
  enforcement: Array<{ practice: string; class: EnforcementClass; note: string }>;
};

type EnforcementClass =
  | 'hard_gate'        // mechanically blocks progress
  | 'agent_gate'       // agent instructed to block; probabilistic
  | 'advisory'         // prompt context only
  | 'human_gate';      // requires a human decision to advance
```

### 7.3 Rule shape

Base rules, overlays, and cautions share one schema so the engine treats them uniformly.

```ts
type Rule = {
  id: string;
  label: string;
  when: (a: Answers, d: Derived, r?: PartialResult) => boolean;  // pure; cautions may read the result
  requires: string[];                 // answer field IDs read — drives completeness (F10) + explanation (F11)
  adopt?: {
    framework: FrameworkId;
    practice?: string;
    artifacts: string[];
    commands: string[];
    rationale: string;
  };
  caution?: {
    severity: 'high' | 'medium';
    finding: string;                  // what goes wrong
    mitigation: string;               // what to do about it
    source: string;                   // where the finding comes from
  };
  providedByBase?: FrameworkId[];     // overlays already native to these bases (F4)
  resolves?: BottleneckId[];          // Q16 bottlenecks addressed (F6)
};
```

### 7.4 Result

```ts
type Result = {
  base:     { rule: Rule; explanation: string[]; fallback: boolean };
  runnerUp: { rule: Rule; whyItLost: string } | null;      // F13
  overlays: Array<{ rule: Rule; explanation: string[]; includedInBase: boolean }>;
  cautions: Array<{ rule: Rule; explanation: string[] }>;  // F12
  bottleneckMatrix: Array<{ bottleneck: BottleneckId; rank: number; resolvedBy: string[] | null }>;
  directoryLayout: string[];
  completeness: { answered: string[]; missing: string[]; couldChangeResult: string[] };
  evidenceAge: { verifiedOn: string; stale: boolean };     // F14
};
```

### 7.5 Instrument fidelity

`Answers` is the Finance Tech diagnostic instrument, not an adapter onto a smaller internal model. Compound instrument items are stored as named fields (Q2, Q4, Q5, Q11) rather than collapsed enums. Fields no current rule reads — `q1_domain`, `q4_tenure`, `q11_cycle_time`, `q13_branching`, `q2_team.swe`, `q2_team.data_engineers` — are still collected and copied into the report (D19). They do not appear in `completeness.couldChangeResult`.

Q18–Q21 are the four questions this design adds; they are grouped under a "Constraints" section in the form so the original diagnostic ordering stays recognizable.

### 7.6 Derived views

`derive(answers): Derived` is a pure function. Derived values are never stored, never encoded in the URL, and never shown as if the user typed them. Rules that need an aggregate read `Derived`; the form and the report speak the instrument.

```ts
type Derived = {
  unplannedShare: number;           // q5.ops + q5.bugs
  nonRoadmapShare: number;          // q5.ops + q5.bugs + q5.regulatory + q5.tech_debt
  volatilityIsHigh: boolean;        // q6 ∈ {high, interrupt_driven}
  coverageLevel: 'low' | 'partial' | 'high';
  hasRoles: {
    product_owner: boolean;         // Dedicated or Shared
    scrum_master: boolean;          // Dedicated or Shared
    qa_sdet: boolean;               // q2.qa_sdet ≥ 1
  };
  teamSize: number;                 // q2.total
};

function coverageLevel(gates: QualityGateId[] | undefined): 'low' | 'partial' | 'high' {
  const automated = (gates ?? []).filter(g => g !== 'mostly_manual');
  if (automated.length === 0) return 'low';
  if (automated.length <= 2) return 'partial';
  return 'high';
}
```

`nonRoadmapShare` and `unplannedShare` are defined only when all five Q5 percents are present and sum to 100; otherwise the Q5-dependent predicates do not fire (same completeness rule as before). `hasRoles` and `teamSize` are defined only when `q2_team` is complete. `volatilityIsHigh` is false when Q6 is unanswered.

## 8. Framework profiles

All metrics verified 2026-09-16 via the GitHub REST API; method and raw figures in Appendix A. Capability claims are sourced from each project's own documentation; failure modes are sourced from independent field reports and are cited inline.

### 8.1 Cross-cutting comparison

| Framework | Status | Stars | Commits/30d | Ceremony | Token cost | Brownfield | Mid-flight change |
|---|---|---:|---:|---:|---:|---:|---:|
| OpenSpec | recommended | 68,430 | 66 | 2 | 2 | 5 | 5 |
| GitHub Spec Kit | recommended | 137,140 | 100+ | 4 | 4 | 2 | 2 |
| BMAD Method | recommended | 53,070 | 100+ | 2–5 (tunable) | 3–5 | 3 | 4 |
| GSD Core | viable | 9,501 | 100+ | 3 | 3 | 4 | 4 |
| Superpowers | viable | 287,303 | 0 | 4 | 5 | 3 | 3 |
| Spec Kitty | viable | 1,627 | active | 4 | 3 | 3 | 3 |
| Tessl SDD Tile | **watch** | 53 | 0 | 3 | 3 | 2 | 2 |

Ceremony and cost are 1 (minimal) to 5 (heavy). These are editorial ratings derived from the workflow descriptions and field reports below, not measurements — O5 (§16) proposes validating them.

### 8.2 OpenSpec

`Fission-AI/OpenSpec` · TypeScript · MIT · created 2025-08-05 · v1.13.0 (2026-09-09) · 68,430 stars, 4,705 forks, 66 commits/30d.

**Workflow.** OPSX is now the standard workflow. Two profiles: `core` (`propose`, `explore`, `apply`, `update`, `sync`, `archive`) and `expanded`, which adds `new`, `continue`, `ff`, `verify`, `bulk-archive`, `onboard`. The expanded profile must be configured explicitly via `openspec config profile` followed by `openspec update`. Changes are written as deltas with `ADDED`, `MODIFIED`, `REMOVED` requirement sections; `/opsx:sync` merges deltas into `openspec/specs/` without archiving, `/opsx:archive` merges and archives.

**Brownfield posture — the strongest of any option.** OpenSpec's own guidance is explicit that you do not document the codebase to start: "You write specs only for what you're about to change." Specs accumulate one change at a time, so `openspec/specs/` starts nearly empty and fills in around work actually done. It also actively warns against bulk-converting existing docs, on the grounds that one-time conversions produce large stale specs nobody trusts.

**Mid-flight change.** `/opsx:update` revises a change's planning artifacts and keeps them coherent. This is the capability Spec Kit most conspicuously lacks.

**Enforcement reality.** `/opsx:verify` checks completeness, correctness, and coherence, flagging issues as CRITICAL / WARNING / SUGGESTION — but **it does not block archiving**; it surfaces gaps and leaves the call to the human. Two implications the source document misses: verification is opt-in (expanded profile only), and it is advisory rather than a hard gate. For a zero-tolerance team this means OpenSpec alone does not give you a fail-closed pipeline (see caution C5).

**Best fit.** Brownfield, high-churn, volatile requirements, low ceremony tolerance. **Poor fit.** Teams that need mechanically enforced gates without adding their own CI.

### 8.3 GitHub Spec Kit

`github/spec-kit` · Python · MIT · created 2025-08-21 · v1.0.7 (2026-09-15) · 137,140 stars, 12,280 forks, 100+ commits/30d. The most-starred and among the most actively developed.

**Workflow.** `/speckit.constitution` → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.analyze` → `/speckit.tasks` → `/speckit.implement`, installed via `uvx specify init`.

**Enforcement reality — the most important correction in this document.** The source appendix describes `constitution.md` as binding "immutable security invariants, audit trail requirements, and segregation-of-duties rules directly into the agent session." It does no such thing. As one analysis puts it, the constitution "is a Markdown file the coding agent reads as context and is instructed to follow. It shapes the agent's behavior through prompting, and prompting is probabilistic. A principle sitting in the context window is an input to generation. It is not an independent gate that inspects the output." Nothing outside the agent re-reads the constitution and blocks a violating change. Spec Kit's own README warns that the pipeline can be over-eager and that pipeline self-validation is not a quality gate.

**Brownfield failure modes — documented and severe.** A field report on ERP modernization found that on undocumented legacy modules with no reachable owner, Spec Kit "fabricates Constitution mandates from accidental correlations," and those hallucinations "propagate into ratified Constitutions that are then trusted as policy." It also fabricated a performance budget where no measured baseline existed, and produced schema drift (adding `NOT NULL` and foreign keys) that "would have broken Revision 001 against any database with data fitting the original looser schema." The same report puts per-unit cost at roughly one full session per ~2,000 LOC script, concluding that batch translation across a thousand scripts "is not a realistic budget."

**Mid-flight change — the weakest area.** Community reports consistently flag missing guidance for refining specs after plan and tasks exist, and for incremental work on large legacy codebases. Reviews also note it "can feel like overhead when you're experimenting" and is poorly suited "when the scope is tiny and a spec would be longer than the change."

**Best fit.** Greenfield 0-to-1, architecturally novel subsystems, teams wanting strict human review gates. **Poor fit.** Legacy migration at volume, high requirement volatility, small changes.

### 8.4 BMAD Method

`bmad-code-org/BMAD-METHOD` · Python · non-standard license · created 2025-04-13 · v6.12.0 (2026-09-04) · 53,070 stars, 5,994 forks, 100+ commits/30d. Oldest of the group and heavily maintained.

**Workflow.** Four phases — Analysis (`bmad-deep-recon`, `bmad-forge-idea`, `bmad-brainstorming`), Planning (`bmad-prd`, `bmad-ux`, `bmad-spec`), Solutioning (`bmad-architecture`, `bmad-sprint-planning`), Implementation (`bmad-build`, `bmad-code-review`, `bmad-retrospective`) — plus a parallel Quick Flow track.

**Ceremony is tunable, which the source document gets wrong.** The source treats BMAD as uniformly heavyweight, warning that "solo developers or rapid-prototyping teams experience severe latency." That is no longer accurate. `bmad-quick-dev` (now `bmad-build`) is documented as "the canonical implementation workflow for all development work," accepting anything from free-form intent to a fully planned story, and Quick Flow skips phases 1–3 entirely for bug fixes, small enhancements, tech debt, and urgent changes. Quick Flow's documented duration is "hours to 1 day" against "days to weeks" for the full method. BMAD's ceremony is therefore a dial, not a fixed cost — it spans roughly 2 to 5 on the §8.1 scale. This widens BMAD's applicability considerably and is reflected in overlay G.

**Notable mechanics.** Workflows use a micro-file architecture where each step references external step files to maintain context boundaries. Quick Flow includes an adversarial review step (security, performance, edge cases, quality, testing) explicitly designed to combat the "lost in the middle" problem. Sprint status is synchronized through deterministic Python-backed merge logic to prevent state regression — a genuine hard-gate mechanism rather than a prompt. `bmad-correct-course` handles significant mid-stream changes.

**Licensing caveat.** The GitHub API reports a non-standard license (`NOASSERTION`), unlike the MIT licensing of the others. Enterprise teams should review terms before adoption; this is surfaced as a caution.

**Best fit.** Teams with real role separation; vague inbound requirements needing discovery; enterprises wanting PRDs and ADRs. **Poor fit.** Teams that will not use the personas — the structure's value is the separation of concerns, and skipping it leaves overhead without benefit.

### 8.5 GSD Core

`open-gsd/gsd-core` · JavaScript · MIT · created 2026-05-22 · v1.14.0 (2026-09-14) · 9,501 stars, 685 forks, 100+ commits/30d.

The source document cites only "473 points on Hacker News," which undersells it by an order of magnitude — it has 9,501 stars. It is also the **newest** project here by a wide margin (created May 2026, four months before this evidence date), which is the real caveat: rapid release cadence, but little track record.

**Workflow.** Five-step loop per phase: Discuss → Plan → Execute → Verify → Ship. Discuss is deliberately lightweight ("a conversation, not a specification exercise") producing a per-phase `CONTEXT.md`. Plan runs a sequence of fresh-context subagents — a researcher writing `RESEARCH.md`, a planner producing `PLAN.md` files, and a plan-checker verifying completeness and scope. Execute runs plans in parallel waves, each executor starting with a clean 200k-token context. Verify produces `VERIFICATION.md` and generates targeted fix plans on discrepancy. Ship creates the PR and archives.

**State artifacts.** `.planning/` holds `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `phases/`, `research/`. Requirements carry stable IDs (`REQ-001`) mapped to phases, giving a traceability chain from requirement → phase → plan → implementation → verification. `STATE.md` is continuously updated and is what `/gsd:resume-work` reads to reconstruct context after a break. `HANDOFF.json` plus `.continue-here.md` capture structured pause state.

**Genuine gates.** The plan-checker runs a decision-coverage gate confirming every trackable decision appears in at least one plan, and the verifier re-checks that decisions were honored in shipped code. These are agent-executed rather than mechanical, but they are explicit checks on output rather than pure prompt context — stronger than `constitution.md`, weaker than CI.

**Best fit.** Long sessions where context degradation is the binding constraint; monoliths with broad file spans; teams wanting requirement traceability without BMAD's role overhead. **Poor fit.** Teams needing a long maintenance track record, or unwilling to adopt a four-month-old dependency.

### 8.6 Superpowers

`obra/superpowers` · Shell · MIT · created 2025-10-09 · v6.3.0 (2026-08-12) · 287,303 stars, 25,690 forks.

**Maintenance signal — attend to this.** Despite the largest star count of any project here, the most recent commit on `main` is 2026-08-12 (the v6.3.0 release), giving **zero commits in the 30 days before this evidence date**, while Spec Kit, BMAD, and GSD Core each posted 100+. One release gap is not abandonment, and the project has a history of steady releases, but a team betting its workflow on Superpowers should check current activity rather than trusting the star count. This is why its status is `viable` rather than `recommended`.

**Workflow.** Mandatory progression: brainstorming → writing-plans → subagent-driven-development → TDD → code review → finishing-a-development-branch. Composable skills include `brainstorming`, `writing-plans`, `executing-plans`, `dispatching-parallel-agents`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`.

**The strongest hard gate in the ecosystem.** The TDD skill establishes an "iron law": production code written before a failing test must be deleted and rewritten. It explicitly enumerates and refuses the rationalizations an agent uses to skip TDD ("just this once", "too simple to test", "I'll test after"). The brainstorming skill includes a gate that prevents implementation until a design has been presented and approved. Subagent-driven development dispatches a fresh subagent per task with two-stage review — spec compliance, then code quality — and critical issues block progress. For a zero-tolerance precision requirement, this is the most credible verification mechanism available among these tools.

**Token cost is by design, not accident.** Structured brainstorms, multi-page specs, adversarial spec review, and subagent dispatch all spend tokens before the first line of code, and the project's own release notes describe visual brainstorming as token-intensive. Independent reports describe users experiencing slowdowns after installing it, with some uninstalling and reverting to a plain plan mode. One assessment is blunt: "On a rationed Pro window, running the full loop on a one-file fix is malpractice." Setup is reported at 10–20 minutes per feature.

**Portability — the broadest.** The README documents installs for Claude Code, Codex CLI, Gemini CLI, Cursor, OpenCode, Factory Droid, GitHub Copilot CLI, Antigravity, Kimi, Roo, Zed, and (as of v6.3.0) Devin CLI and Hermes. It has become a portable methodology rather than a Claude Code plugin.

**Best fit.** Ambiguous multi-file production work where correctness dominates cost; teams with low test coverage needing enforced TDD. **Poor fit.** Metered token budgets; high volumes of small changes.

### 8.7 Spec Kitty

`spec-kitty/spec-kitty` (moved from `Priivacy-ai/spec-kitty`) · Python · MIT · created 2025-10-09 · 1,627 stars, 166 forks, **826 open issues**, actively pushed.

The repository has relocated; the old path returns a redirect. The open-issue count is high relative to project size — roughly one open issue per two stars — which may reflect either an active support culture or a backlog problem. Worth checking before adoption.

**Workflow.** Missions partitioned into Work Packages moving through nine internal lanes (`planned`, `claimed`, `in_progress`, `for_review`, `in_review`, `approved`, `done`, plus `blocked` and `canceled`), displayed as six board columns. Artifacts live in `kitty-specs/`, worktrees under `.worktrees/`.

**A real mechanical gate, and an audit trail worth having.** The lane state machine "enforces exactly 27 legal transitions. Any transition not in this list is rejected unless `--force` is used (which requires actor + reason for audit)." Moving to `for_review` requires implementation evidence. This is a genuine hard gate with a documented override that captures who overrode it and why — which is precisely the segregation-of-duties evidence a SOX Tier 1 team needs, and it is stronger for that purpose than Spec Kit's constitution. The source document does not make this point; it is surfaced as a positive note in caution C6.

**Isolation is partial.** Per the project's own architecture docs, lane worktrees use full checkouts: "Isolation is enforced by lane computation, ownership metadata, workspace context, and merge guards rather than by hiding files from the working directory." Agents are *expected* to stay inside files owned by the active work package. Branches, history, and configuration are shared; files, indexes, and uncommitted changes are separate.

**Operational friction.** Dependent work packages need `spec-kitty sync workspace` after upstream changes, and sync fails on conflicts requiring manual resolution. `--repair` may lose uncommitted changes. Merging append-only status logs can lose events and reset dashboard progress if conflicts are resolved incorrectly.

**Best fit.** Multiple agents or engineers working concurrently; teams needing visible progress and auditable review gates; coupled releases. **Poor fit.** Solo developers (worktree overhead without concurrency benefit); teams unwilling to manage rebase friction between dependent work packages.

### 8.8 Tessl SDD Tile — status `watch`, do not recommend

`tesslio/spec-driven-development-tile` · Shell · MIT · created 2025-12-05 · **53 stars, 8 forks, last pushed 2026-03-30** — roughly five and a half months stale at this evidence date.

The source document presents Tessl as a peer of the others, citing "$125M funding" and Martin Fowler's coverage. The funding is real and the coverage is real, but neither is evidence that *this artifact* is ready. The tile repository has 53 stars and no pushes since March 2026.

**Capability reality.** The tile provides skills (`requirement-gathering`, `spec-writer`, `spec-verification`, `work-review`), rules (`spec-before-code`, `one-question-at-a-time`, `spec-format-compliance`), and validation scripts (`validate-specs.sh`, `check-spec-links.sh`). Specs are `.spec.md` files with YAML frontmatter declaring `targets` globs and inline `[@test]` links.

**The `[@test]` anchors are references, not assertions.** `check-spec-links.sh` verifies that `[@test]` links and `targets` point to existing files. That is a link checker, not a verification that code satisfies linked assertions. The source document's Overlay B claims Tessl anchors make tasks "fail closed if test assertions fail"; the tile does not do this. Fowler's evaluation adds that Tessl is still in beta, that spec-as-source is currently a 1:1 spec-to-file mapping, and that the Tessl team themselves "see their framework as something that is more in the future than their current public product."

**Consequence for this tool.** Tessl is marked `watch`. It is never recommended as a base (F15), and Overlay B recommends Superpowers' TDD loop rather than Tessl anchors (divergence V4, §11). Its `one-question-at-a-time` interview rule is a genuinely good idea and is noted as a technique teams can copy without adopting the tile.

## 9. Decision dimensions

### 9.1 What the source rules cover, and what they miss

Mapping the source appendix's rules against the **real instrument** (§7.1):

| Question | Used by a rule? | Notes |
|---|---|---|
| Q1 functional domain | No | Collected and reported (D19). No evidence-backed split by domain. |
| Q2 team makeup | Base rules 3, 4; C8 | Size is `q2.total`. Role presence is derived (D14). SWE and data-engineer counts are report-only. |
| Q3 distribution | Overlay C | Unchanged. |
| Q4a tenure | No | Collected and reported (D19). |
| Q4b domain familiarity | Overlay D | Unchanged. |
| Q5 work breakdown | Base rules 1, 2; C1 | Five percents. Rules read `derived.nonRoadmapShare` and `q5.roadmap` (D13). |
| **Q6 volatility** | **Base rule 2; Overlay G; C12** | Source appendix never used it. V5 adds it. `interrupt_driven` counts as high (D15). |
| Q7 requirements clarity | Base rules 2, 3; Overlay D | Unchanged. |
| Q8 compliance | Overlay A; C2; Overlay F | `internal_governance` does not fire A or C2 (D16). |
| Q9 precision | Overlay B; Overlay F; C5 | `standard` replaces the invented `reconciled` value. |
| Q10 architecture | Base rules 1, 2; Overlay E | `streaming` is in the form; it is not brownfield and not Spec Kit's microservices path (D22). |
| Q11a deploy cadence | Base rule 4 | Instrument's "once or twice per sprint" is `sprint` (was `weekly`). |
| Q11b cycle time | No | Collected and reported (D19). |
| Q12 quality gates | Rule-4 split (D3′); report note on overlay B | Multi-select. `coverageLevel` is derived (D17). |
| Q13 branching | No | Collected and reported (D19). Previously omitted. |
| Q14 release autonomy | Base rule 4; Overlay C; C13 | `coupled` and `heavy` fire C; `vendor` fires C13, not C (D18). |
| Q15 governance | Overlay A | Unchanged. |
| Q16 bottlenecks | Overlays B, D; matrix (F6) | Seven instrument options. Only `test_fear` and `ambiguous_or_shifting` trigger overlays. Overlay C `resolves` `cross_team_approvals` when C fires. |
| Q17 process mismatch | No | Open text; Markdown report only (D20). |
| Q18 token budget | Rule-4 split; C3 | Design addition. |
| Q19 change volume | Overlay G; C7 | Design addition. |
| Q20 runtimes | Tier 0 | Design addition. |
| Q21 CI maturity | Overlay F | Design addition. |

**Q6 (requirement volatility) was collected by the source appendix and then ignored**, despite being the dimension on which the frameworks differ most sharply. Spec Kit's documented weakness is mid-implementation spec change; OpenSpec has `/opsx:update` precisely for it; BMAD has `bmad-correct-course`; GSD Core supports phase editing after roadmap approval. A team with high or interrupt-driven volatility should be steered away from Spec Kit, and the source rules provide no path for that. Divergence V5 (§11) adds it.


### 9.2 Enforcement classes — a new first-class dimension

The research makes clear that "the framework enforces X" spans four very different things. Conflating them is how a compliance team ends up believing a Markdown file is a control.

| Class | Meaning | Examples |
|---|---|---|
| `hard_gate` | Mechanically blocks progress; cannot be bypassed without a recorded override | Spec Kitty's 27-transition state machine (`--force` requires actor + reason); BMAD's Python-backed sprint-status merge |
| `agent_gate` | The agent is instructed to block and generally does, but the check is model-executed | Superpowers' TDD iron law and two-stage subagent review; GSD Core's plan-checker decision-coverage gate |
| `advisory` | Prompt context that shapes generation but inspects no output | Spec Kit `constitution.md`; OpenSpec `/opsx:verify` findings (does not block archiving); Tessl `[@test]` link checking |
| `human_gate` | Requires a human decision to advance | Spec Kit phase reviews; Spec Kitty Decision Moments; Tessl spec approval |

Every recommended practice in the report carries its class (F5). For `q8 = sox_tier1` or `q9 = zero_tolerance`, a stack composed entirely of `advisory` mechanisms triggers caution C2 and overlay F.

### 9.3 Four added questions (Q18–Q21)

Each is justified by a decision the research shows matters and the Finance Tech instrument cannot express. They were Q17–Q20 in v0.2.0; they moved to Q18–Q21 so the instrument keeps Q1–Q17.

**Q18 — Token / plan budget.** `unmetered | team_plan | individual_pro | strict`
Superpowers is token-hungry by design, with documented user complaints of slowdown and reversion; Spec Kit adds overhead disproportionate to small changes. Recommending either into a metered budget invites abandonment. Drives caution C3 and the rule-4 split.

**Q19 — Change volume profile.** `many_small | balanced | few_large`
The ERP field report's arithmetic — roughly one session per 2,000 LOC unit, a thousand units being unaffordable — is a hard constraint, not a preference. Heavyweight pipelines priced per change fail on `many_small`. Drives overlay G and caution C7.

**Q20 — Agent runtimes in use.** multi-select over `claude_code | cursor | codex | copilot | gemini_cli | windsurf | opencode | other`
Portability varies widely (§8). A team standardized on a runtime a framework does not document is buying an integration project. Filters candidate frameworks before other rules apply.

**Q21 — Existing CI enforcement maturity.** `none | tests_only | tests_plus_static | contracts_runtime`
Since the strongest governance mechanisms in these frameworks are `advisory`, real enforcement has to come from CI. A team at `contracts_runtime` already has the backstop; a team at `none` with SOX requirements has a gap no framework choice closes. Drives overlay F.


## 10. Decision logic

### 10.1 Tier 0 — runtime feasibility filter

Before base selection, any framework not documenting support for at least one runtime in `q20_runtimes` is removed from the candidate set, and frameworks with `status: 'watch'` are removed as base candidates (F15). If `q20` is unanswered, no filtering occurs. If filtering empties the candidate set, the engine reports "no framework documents support for your runtimes" and lists the closest matches rather than falling through to a default.

### 10.2 Tier 1 — base selection

Rules are evaluated **in order; the first whose predicate is true wins**, restricted to the Tier 0 candidate set. The runner-up is the next matching rule, reported per F13. If none fire, `FALLBACK_BASE` (OpenSpec) is selected and flagged `fallback: true`.

| # | Base | Predicate |
|---|---|---|
| 1 | **OpenSpec** | `derived.nonRoadmapShare ≥ 40` **OR** `q10 ∈ {monolith, hybrid, batch_data}` |
| 2 | **GitHub Spec Kit** | `q5.roadmap ≥ 60` **AND** `q10 = microservices` **AND** `q7 = structured` **AND** `NOT derived.volatilityIsHigh` |
| 3 | **BMAD Method** | `derived.hasRoles.{product_owner, scrum_master, qa_sdet}` all true **AND** `q7 ∈ {high_level, vague}` |
| 4 | **Superpowers** or **GSD Core** | `derived.teamSize < 5` **AND** `q11_deploy_cadence ∈ {continuous, sprint}` **AND** `q14 = autonomous`; split per D3′ below |
| — | OpenSpec (fallback) | none of the above |

**Rule 2 uses `NOT derived.volatilityIsHigh`** (divergence V5): Spec Kit's documented weakness is mid-implementation spec change, so a high-volatility or interrupt-driven team should not be routed to it even with otherwise-matching greenfield signals.

**Rule 4 split (D3′, revised).** The source names two frameworks with no criterion. Revised logic:

```
if coverageLevel = low AND q18 ∈ {unmetered, team_plan}  → Superpowers   (enforced TDD; affordable)
elif coverageLevel = low AND q18 ∈ {individual_pro, strict} → GSD Core + overlay B  (TDD practice without full Superpowers cost)
else                                                      → GSD Core     (context hygiene)
```

The token-budget arm is new. Routing a strict-budget team to Superpowers — the most token-intensive option, with documented abandonment under metering — would be a recommendation they cannot execute.

### 10.3 Tier 2 — overlays

Evaluated independently; all that fire are included. Those whose `providedByBase` contains the selected base are marked `includedInBase`.

| Overlay | Borrowed from | Predicate | Provided by base |
|---|---|---|---|
| **A** Regulatory constitution | Spec Kit | `q8 = sox_tier1` **OR** `q15 = cab` | Spec Kit |
| **B** Autonomous TDD verification | **Superpowers** (not Tessl — V4) | `q9 = zero_tolerance` **OR** `test_fear ∈ q16[0..1]` | Superpowers |
| **C** Worktree sandboxing & Decision Moments | Spec Kitty | `q14 ∈ {coupled, heavy}` **OR** `q3 = global_timezones` | — |
| **D** Domain reconnaissance | BMAD / Superpowers | `q4_domain_familiarity = low` **OR** `q7 = vague` **OR** `q16[0] = ambiguous_or_shifting` | BMAD, Superpowers |
| **E** Ephemeral subagent waves | GSD Core | `q10 = monolith` | GSD Core |
| **F** *(new)* Deterministic CI enforcement | none — native CI | `(q8 = sox_tier1 OR q9 = zero_tolerance)` **AND** `q21 ∈ {none, tests_only}` | — |
| **G** *(new)* Low-ceremony fast path | BMAD Quick Flow / OpenSpec `propose` | `q19 = many_small` **OR** `derived.volatilityIsHigh` | OpenSpec |

Overlay C `resolves` `cross_team_approvals` when it fires, so the bottleneck matrix can credit it. It does not fire from Q16 alone: an autonomous, co-located team that ranks cross-team waits #1 sees that bottleneck as unaddressed.

If `financial_reconciliation ∈ q12`, overlay B still fires (TDD is not the same control as ledger reconciliation) and the overlay card notes the existing reconciliation tests as a related control already in place.

**Overlay F — deterministic CI enforcement.** The one overlay borrowed from no framework, because none of them provide it. Given that `constitution.md` is advisory, `/opsx:verify` does not block archiving, and Tessl's anchors are link checks, a team with SOX or zero-tolerance requirements and only tests-or-nothing in CI has an unclosed gap. The adopted practice is conventional: required status checks on protected branches, spec-to-test traceability enforced in CI rather than by prompt, and a failing build as the actual gate. Artifacts are CI config, not framework files.

**Overlay G — low-ceremony fast path.** For `many_small` change volume or high / interrupt-driven volatility, the recommendation is an explicit two-track policy: full pipeline for architecturally novel work, documented fast path for the rest. Concretely BMAD's Quick Flow (`bmad-quick-spec` / `bmad-build`) if the base is BMAD, OpenSpec's default `/opsx:propose` quick path if the base is OpenSpec (hence `providedByBase`), and for Spec Kit a written scope rule for when *not* to run the pipeline — the gap its own reviewers identify.

### 10.4 Tier 3 — cautions

Predicates may read the answers, derived views, and the partial result. Rendered with equal weight to recommendations (F12).

| ID | Trigger | Finding | Mitigation |
|---|---|---|---|
| **C1** | base = Spec Kit **AND** `derived.nonRoadmapShare ≥ 25` | On legacy modules with no reachable owner, Spec Kit has been observed fabricating constitution mandates from accidental correlations, inventing performance budgets with no measured baseline, and tightening schemas (`NOT NULL`, FKs) in ways that break against existing data. | Bound Spec Kit to architecturally novel work. Require a measured baseline before any performance claim enters a spec. Review every schema change against production data shape. |
| **C2** | overlay A active **AND** `q8 = sox_tier1` | `constitution.md` is prompt context, not a control. Nothing outside the agent re-reads it or blocks a violating change. It will not satisfy an auditor asking what prevents a violation. | Pair with overlay F. Treat the constitution as documentation of intent and CI as the enforcement. If segregation of duties must be provable, prefer Spec Kitty's lane state machine, whose `--force` override records actor and reason. |
| **C3** | (base = Superpowers **OR** overlay B active) **AND** `q18 ∈ {individual_pro, strict}` | Superpowers' full loop is token-intensive by design; users under metered plans report slowdowns and reversion to plain planning. Setup runs 10–20 minutes per feature. | Adopt the TDD and code-review skills selectively rather than the full mandatory progression. Reserve brainstorming and adversarial spec review for genuinely ambiguous work. |
| **C4** | overlay B active | The source material recommends Tessl `[@test]` anchors as fail-closed verification. They are not: the tile's `check-spec-links.sh` verifies that links point to existing files. The tile is at 53 stars with no pushes since 2026-03-30, and Tessl is pre-production by its own team's account. | Use Superpowers' TDD iron law as the enforcement mechanism. Borrow Tessl's `one-question-at-a-time` interview discipline as a technique without adopting the tile. |
| **C5** | base = OpenSpec **AND** `q9 = zero_tolerance` | `/opsx:verify` exists only in the expanded workflow profile and must be configured explicitly. Even then it flags CRITICAL / WARNING / SUGGESTION without blocking archiving. | Run `openspec config profile` to enable the expanded profile. Add overlay F so the actual gate is CI, not the verify step's advice. |
| **C6** | overlay C active **AND** `q8 = sox_tier1` | *Positive note.* Spec Kitty's lane machine permits exactly 27 transitions and requires implementation evidence to reach `for_review`; overrides demand actor and reason. This is a stronger audit artifact than any Markdown-based governance here. | Treat Spec Kitty's status log as an audit record. Be aware that append-only log merges can lose events if conflicts are resolved incorrectly — protect it in review. |
| **C7** | `q19 = many_small` **AND** base ∈ {Spec Kit, BMAD-full, Superpowers} | Per-change ceremony dominates at high change volume. Field measurement puts Spec Kit at roughly one full session per ~2,000 LOC unit; a thousand units is not a realistic budget. | Adopt overlay G's two-track policy and hold the heavyweight pipeline for architecturally novel work only. |
| **C8** | overlay C active **AND** `derived.teamSize < 3` | Spec Kitty's worktree model pays off through concurrency. Below three concurrent workers it adds sync and rebase friction without the benefit, and isolation is partial anyway — lane worktrees are full checkouts relying on ownership metadata and merge guards. | Use plain git worktrees or Superpowers' `using-git-worktrees` skill instead of adopting Spec Kitty's full mission model. |
| **C9** | base = GSD Core | Created 2026-05-22 — roughly four months old at this evidence date. Release cadence is high but there is little track record, and the artifact layout under `.planning/` is still evolving. | Pin a version. Budget for migration between minor releases. Re-verify activity before committing a team to it. |
| **C10** | base = Superpowers | No commits on `main` in the 30 days before the evidence date (latest release v6.3.0, 2026-08-12), while comparable projects posted 100+. The 287k star count reflects historical popularity, not current velocity. | Check current repository activity before adopting. The methodology is portable and documented, so a maintenance pause is survivable — but do not assume active upstream support. |
| **C11** | base = BMAD | The GitHub API reports a non-standard license (`NOASSERTION`) where comparable projects are MIT. | Have legal review the license terms before enterprise adoption. |
| **C12** | `q6 = interrupt_driven` **AND** base ∈ {Spec Kit, Superpowers, BMAD} | Interrupt-driven work arrives in real time. Spec Kit, Superpowers' mandatory progression, and BMAD's full method price a session per change that the queue will not wait for. Overlay G's fast path is necessary but not sufficient if the base itself assumes planned work. | Prefer OpenSpec (or BMAD Quick Flow if BMAD is already the base) as the daily path. Do not run the full Spec Kit or Superpowers pipeline on interrupt tickets. |
| **C13** | `q14 = vendor` | Core delivery waits on an external vendor release train. No SDD framework removes that blocker; worktree isolation and constitution files do not shorten a vendor calendar. | Keep the selected stack for work this team owns. Treat vendor-gated work as out of scope for the SDD recommendation rather than overlaying Spec Kitty. |

### 10.5 Design decisions

| ID | Ambiguity | Decision | Rationale |
|---|---|---|---|
| D1 | Multiple base rules can fire (e.g., a small autonomous team on a monolith hits rules 1 and 4). | Ordered evaluation, first match wins, in source order; runner-up reported (F13). | Simplest deterministic scheme. Source ordering places brownfield safety before velocity, the conservative choice for finance. Reporting the runner-up removes most of the cost of being wrong. |
| D2 | No base rule fires for some valid inputs. | Fall back to OpenSpec and flag it. | Lowest-ceremony, highest brownfield-fit option; least harmful default. The flag prevents a fallback reading as a strong recommendation. |
| D3′ | Rule 4 names two frameworks with no split criterion. | `coverageLevel = low` **and** affordable budget → Superpowers; `coverageLevel = low` **and** metered → GSD Core + overlay B; otherwise GSD Core. | Superpowers' value is enforced TDD, which matters most at low coverage — but it is the most token-intensive option, so budget gates it. GSD Core's value is context hygiene, orthogonal to coverage. |
| D4 | Overlay E's second trigger ("complex multi-file features spanning broad historical files") is not a questionnaire answer. | Dropped; only `q10 = monolith` fires E. | Not evaluable from inputs. |
| D5 | Overlays may duplicate the base's native capability. | Report as "included in base" (F4). | Avoids recommending a second tool for a capability already present. |
| D6 | Q5 is five percents in the instrument. | Store five integers summing to 100. Rules read `derived.nonRoadmapShare` (≥40 / ≥25) and `q5.roadmap` (≥60). | Source thresholds are numeric. Folding ops + bugs + regulatory + tech debt into "not roadmap" keeps the brownfield signal when a team is mandate-heavy rather than ticket-heavy. |
| D7 | Q16 could be ranked or unordered. | Ordered top 3 from the instrument's seven options. | Overlays B and D reference rank positions ("top-2", "#1"). |
| D8 | Should frameworks be filtered by runtime support before or after base rules? | Before (Tier 0). | A recommendation the team cannot run is not a recommendation. Filtering first also keeps the runner-up meaningful. |
| D9 | How should `status: 'watch'` frameworks be handled? | Never a base; labeled when named as an overlay source. | Tessl is the motivating case: real ideas, unready artifact. Suppressing it entirely would lose the `one-question-at-a-time` technique; recommending it as a base would be irresponsible. |
| D10 | Should cautions be collapsible? | No — equal visual weight (F12). | The cautions are the highest-value output for regulated teams and the part most likely to prevent a bad adoption. |
| D11 | Should editorial ratings (ceremony, token cost) drive rules? | Displayed, but no rule branches on them in v1. | They are judgments, not measurements. Rules branch only on answers and derived views; ratings inform the human reading the report. O5 tracks validating them. |
| D12 | Instrument is richer than the source appendix's implied enums. | `Answers` is the instrument. Rules that need an aggregate read `Derived` (§7.6). No adapter layer that discards fields. | An adapter would silently drop regulatory share, interrupt-driven work, vendor dependence, and reconciliation tests — the signals this tool exists to honour. |
| D13 | How should five Q5 buckets feed rules written against three? | `nonRoadmapShare = ops + bugs + regulatory + tech_debt`. Rule 1 and C1 use that sum. Rule 2 uses `q5.roadmap` directly. | A mandate-driven team is not a greenfield feature factory; treating regulatory as "not roadmap" keeps OpenSpec's brownfield safety. |
| D14 | When does Q2 count as "has a role" for BMAD (rule 3)? | QA/SDET if headcount ≥ 1; PO and Scrum Master if Dedicated **or** Shared. | Shared still means the persona exists. `None` is the signal that BMAD's role separation has no audience. |
| D15 | Is interrupt-driven volatility the same as high? | `volatilityIsHigh` is true for both `high` and `interrupt_driven`. C12 additionally warns when the base is ceremony-heavy. | Spec Kit's mid-flight weakness applies. Interrupt-driven work is worse than weekly priority shifts, so it also needs an explicit caution rather than only the high-volatility path. |
| D16 | Does Internal Governance fire overlay A and C2? | No. Overlay A and C2 stay `sox_tier1` (or CAB for A). Internal Governance is reported as high-risk internal, not as `low_nonfinancial`. | A is a SOX/auditor-facing constitution. Internal governance without external SOX is not the same control need. |
| D17 | Q12 is check-all-that-apply, not an ordinal. | Store the multi-select. Derive `coverageLevel`: `low` if no automated gate is checked, `partial` if 1–2, `high` if 3+. Rule 4 reads the derived ordinal. Overlay B is not suppressed by existing reconciliation tests. | The ordinal is a view for a rule that needs one. Reconciliation tests and TDD are different controls; noting the former on overlay B is enough. |
| D18 | Do `heavy` and `vendor` fire overlay C? | `coupled` and `heavy` fire C. `vendor` fires C13 only. | Worktrees help synchronized internal releases. They do not shorten a vendor calendar. |
| D19 | Should unused instrument fields be omitted to save fill time? | Collect Q1 domain, Q4 tenure, Q11 cycle time, Q13 branching, and Q2 SWE/data-engineer counts. Show them in the report. No rule reads them. They never appear in `couldChangeResult`. | The page is the diagnostic. Dropping instrument items because the current rule table is silent would make a filled URL a different questionnaire from the one Finance Tech issued. |
| D20 | The instrument's Q17 is free text. | Collect it, cap at 500 characters, copy into the Markdown report, never pass it to `evaluate`. Unanswered Q17 does not affect completeness-for-rules. | The engine stays boolean. The report is an adoption proposal; the mismatch note belongs there. |
| D21 | Should Q1 domain steer SOX or ledger-specific overlays? | Display only. | A domain split without primary-source evidence would be speculation. |
| D22 | Where does event-driven streaming sit in base selection? | Not in rule 1's brownfield set and not in rule 2's `microservices` conjunct. Streaming teams fall through unless another rule matches. | Streaming is modern, not a monolith/legacy signal, and Spec Kit's greenfield path is documented around services, not Kafka topologies. |

## 11. Divergences from the source document

Recorded so a reviewer can check each independently.

| ID | Source claim | Finding | Change made |
|---|---|---|---|
| **V1** | Overlay A: `constitution.md` "binds immutable security invariants, audit trail requirements, and segregation-of-duties rules directly into the agent session." | It is prompt context. Nothing outside the agent re-reads it or blocks a violating change. Spec Kit's own README says pipeline self-validation is not a quality gate. | Enforcement classes (§9.2); caution C2; overlay F. |
| **V2** | Spec Kit at "90k–120k+ stars, 8,000+ forks". | 137,140 stars, 12,280 forks (2026-09-16). | Corrected; evidence dated (F14). |
| **V3** | GSD Core's adoption evidenced by "473 points on Hacker News". | 9,501 stars — but created 2026-05-22, the newest project here. | Corrected; caution C9 for immaturity. |
| **V4** | Overlay B: Tessl `[@test]` anchors make tasks "fail closed if test assertions fail". | `check-spec-links.sh` verifies links point to existing files. Tile at 53 stars, no pushes since 2026-03-30; Tessl pre-production by its own team's description. | Tessl marked `watch`; overlay B sources from Superpowers; caution C4. |
| **V5** | Q6 (requirement volatility) is collected but no rule reads it. | Mid-flight change is where the frameworks differ most; Spec Kit is documented as weakest. | `NOT derived.volatilityIsHigh` added to base rule 2; high or interrupt-driven volatility fires overlay G; C12 for interrupt-driven + ceremony-heavy bases. |
| **V6** | BMAD causes "severe latency" for solo developers "unless operated in Quick Flow mode". | Quick Flow is no longer a special mode — `bmad-build` is documented as the canonical implementation workflow, and phases 1–3 are skippable by default for small work. | BMAD ceremony modeled as a 2–5 range; overlay G routes Quick Flow explicitly. |
| **V7** | OpenSpec `/opsx:verify` presented as a standard verification step. | Expanded-profile only, requires explicit configuration, and does not block archiving. | Caution C5. |
| **V8** | Spec Kitty described only in terms of worktrees and Decision Moments. | Its lane state machine is a genuine hard gate — 27 legal transitions, evidence required for `for_review`, overrides recording actor and reason — and the best audit artifact here. Isolation is partial: full checkouts with ownership metadata, not file hiding. | Positive caution C6; C8 for sub-3-worker teams. |
| **V9** | No treatment of token cost. | Superpowers is token-intensive by design with documented abandonment under metered plans. | Q18 added; rule-4 split revised (D3′); caution C3. |
| **V10** | Spec Kit recommended for brownfield refactors alongside greenfield. | Field reports document fabricated constitution mandates, invented performance budgets, and unsafe schema tightening on unowned legacy code. | Caution C1; brownfield rating of 2 (§8.1). |
| **V11** | Spec Kitty repository at `Priivacy-ai/spec-kitty`. | Moved to `spec-kitty/spec-kitty`; old path redirects. 826 open issues against 1,627 stars. | Metadata corrected; issue ratio surfaced in §8.7. |
| **V12** | Superpowers presented as the flagship, highest-adoption choice. | Largest star count, but zero commits in the 30 days before the evidence date while peers posted 100+. | Status `viable` not `recommended`; caution C10. |
| **V13** | Source appendix treats "compact, <5 engineers" as Q1 and never publishes the instrument's options. | The Finance Tech instrument's Q1 is functional domain; team size and roles are Q2; Q5 has five percents; Q6 has interrupt-driven; Q8 has internal governance; Q12 is check-all-that-apply; Q13 exists; Q14 has heavy and vendor; Q16 has seven bottlenecks. | Answers replaced (§7.1); derived views (§7.6); D12–D22; C12, C13. |

## 12. User interface

*Superseded in part by `DESIGN-EXT-UI.md` (EXT-UI): the form is rendered from generic field kinds rather than per-question renderers (§12.2), and the profile and process-mismatch sections move to the Markdown export only (§12.3). Layout and accessibility below stand.*

### 12.1 Layout

Two-column at ≥ 900 px (form left, sticky report right); single column stacked below. No modals.

### 12.2 Form

- One `<fieldset>` per instrument item (Q4, Q5, Q2, and Q11 are compound: one fieldset with a legend, multiple labeled controls inside). Helper line explaining what the question influences, or "Shown in the report; does not change the recommendation" for D19 fields.
- Single-choice → radios. Multi-choice (Q12, Q20) → checkboxes. Q2 → number inputs for counts plus Dedicated/Shared/None radios for PO and Scrum Master. Q5 → five number inputs with live sum indicator and inline error when ≠ 100. Q16 → three `<select>`s labeled 1st/2nd/3rd with duplicates prevented. Q17 → `<textarea maxlength="500">`.
- Inputs named by answer field ID; `readAnswers()` is a generic `FormData` walk driven by `QUESTIONS`, not hand-written per field.
- Q18–Q21 are grouped under a "Constraints" section so the original diagnostic ordering stays recognizable.
- "Reset" clears the form and the URL hash.

### 12.3 Report

Rendered into an `aria-live="polite"` region. Sections in order:

1. **Completeness banner** (when questions that rules read are missing): unanswered rule-relevant questions, highlighting those that could change the result. Report-only fields (D19, D20) are listed separately as optional, not as `couldChangeResult`.
2. **Team profile**: Q1 domain, Q2 size and role mix, Q4 tenure and familiarity, Q11 cadence and cycle time, Q13 branching — so the Markdown report is a complete diagnostic even for fields no rule reads.
3. **Recommended base**: framework, rationale, install command, triggering answers (F11), enforcement classes (F5), and the evidence line with verification date (F14). Fallback results carry a visible "default recommendation — no strong signal" notice.
4. **Runner-up** (F13): one line naming the framework and why it lost.
5. **Practice overlays**: one card each, with enforcement class; "included in base" variants de-emphasized but still labeled.
6. **Cautions** (F12): equal weight, severity-ordered, each with finding, mitigation, and source.
7. **Bottleneck Resolution Matrix**: rank / bottleneck / resolving practice, explicitly naming unaddressed bottlenecks (`flaky_cicd`, `interruptive_support`, `compliance_overhead`, and `legacy_tech_debt` have no overlay in this revision).
8. **Process mismatch note**: Q17 verbatim when present; omitted when empty.
9. **Suggested directory layout**: `<pre>` tree union of selected tools' artifacts.
10. **Actions**: "Copy as Markdown", "Copy link".

### 12.4 Accessibility

- Native controls only; no custom widgets requiring ARIA role emulation.
- Visible focus ring everywhere; tab order follows question order.
- Colour never the sole carrier of meaning — "included in base" and caution severity use icon plus text.
- Results announced via `aria-live`; explanations are prose, not icon-only.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.

## 13. URL state encoding

Answers encode into the fragment (`#`), never the query string, so they are never sent to a server if the file is hosted.

Format: `#v=3&q1=ledger&q3=global_timezones&q5=50,10,10,20,10&q2=8,5,1,1,dedicated,shared&q12=unit_coverage,mostly_manual&q16=test_fear,flaky_cicd,legacy_tech_debt&q20=claude_code,cursor&…`

- `v=3` schema version, incremented by v0.3.0's instrument alignment. Unknown versions are ignored with a visible notice. A `v=2` fragment is not migrated: the question IDs and enums are not compatible.
- Q5 encodes as five comma-separated integers in instrument order: roadmap, ops, bugs, regulatory, tech_debt.
- Q2 encodes as `total,swe,data_engineers,qa_sdet,product_owner,scrum_master`.
- Q17 is URI-encoded. Values longer than 500 characters are truncated on encode, with a visible notice.
- Only answered questions are encoded. Q17 omitted when empty.
- The decoder validates every value against `QUESTIONS`; unknown values are dropped silently and the question shows as unanswered.
- `history.replaceState` avoids polluting back-button history on every keystroke.
- Derived views are never encoded.

## 14. Testing strategy

### 14.1 Engine tests (headless)

The engine has no DOM dependency and is exported on `window.SDDSelector`. Tests run in Node against the engine section, or in-browser via a `?selftest` parameter that runs fixtures and reports pass/fail to the console and page.

Minimum fixture coverage:

- One fixture per base rule firing that rule and no earlier one.
- Rules 1 and 4 both matching → rule 1 wins, rule 4 reported as runner-up (D1).
- No rule matching → fallback with `fallback: true` (D2).
- Rule 4 split, all three arms (D3′): low `coverageLevel` + unmetered → Superpowers; low `coverageLevel` + strict → GSD Core with overlay B; high `coverageLevel` → GSD Core.
- Base rule 2 with `q6 = high` or `q6 = interrupt_driven` → does *not* select Spec Kit (V5, D15).
- Q5: `regulatory = 50` and other non-roadmap buckets small, sum 100 → `nonRoadmapShare ≥ 40` → rule 1 (D13).
- Q5 incomplete or sum ≠ 100 → rules 1 and 2 do not fire from Q5.
- `derive()`: `interrupt_driven` ⇒ `volatilityIsHigh`; QA/SDET = 0 and PO/SM = none ⇒ all `hasRoles` false; Dedicated or Shared PO ⇒ `hasRoles.product_owner`.
- `coverageLevel`: only `mostly_manual` (or empty) → `low`; two automated gates → `partial`; three → `high` (D17).
- Tier 0: `q20 = [gemini_cli]` filters candidates; empty candidate set produces the explicit no-match result, not a fallback (D8).
- `status: 'watch'` framework never appears as a base (F15).
- One fixture per overlay, positive and negative, including F and G.
- Overlay A does **not** fire on `q8 = internal_governance` (D16).
- Overlay C fires on `q14 = heavy`; does **not** fire on `q14 = vendor` (D18).
- Overlay D: `ambiguous_or_shifting` at rank 1 fires; at rank 2 does not.
- Overlay G fires on `interrupt_driven` as well as `high`.
- Overlay B still fires when `financial_reconciliation ∈ q12` and `q9 = zero_tolerance`; the note about existing reconciliation tests is present.
- Overlay dedupe: base Spec Kit + `q8 = sox_tier1` → overlay A `includedInBase` (D5).
- One fixture per caution C1–C13, positive and negative.
- C6 renders as a positive note, not a warning.
- C12 fires only when `q6 = interrupt_driven` and the base is Spec Kit, Superpowers, or BMAD.
- C13 fires on `q14 = vendor` and overlay C does not.
- Q16 rank sensitivity: `test_fear` at rank 2 fires overlay B; at rank 3 does not.
- Completeness: missing `q10` lists `q10` in `couldChangeResult`. Missing `q1_domain`, `q4_tenure`, `q11_cycle_time`, `q13_branching`, or `q17_process_mismatch` does **not** (D19, D20).
- Determinism: evaluating the same answers twice yields deep-equal results. `derive()` is a pure function of answers.
- Evidence staleness: a `verifiedOn` older than 180 days sets `evidenceAge.stale`.
- URL decode of `v=2` does not populate the form (incompatible schema).

### 14.2 UI checks (manual for v1)

- Form renders every question from `QUESTIONS`; adding a question to the data array adds it to the form with no other change.
- Q5 sum validation blocks evaluation of rules 1 and 2 until the sum is 100.
- Q2 Dedicated/Shared/None radios and headcount inputs round-trip through the URL.
- Q12 checkboxes include `financial_reconciliation` and `mostly_manual`.
- Q16 selects cannot choose the same bottleneck twice; the seven instrument options are the only choices.
- Q17 textarea is in the Markdown report and does not change the recommended base.
- URL round-trip: fill → copy link → open in new tab → identical state and report.
- Keyboard-only completion of the full questionnaire.
- VoiceOver announces report changes.
- Lighthouse accessibility ≥ 95.

### 14.3 Rule-fidelity review

Before v1 ships, a reviewer independently re-derives each predicate in §10 from the source appendix and confirms the tables match, treating §11 as the authoritative list of intentional divergences. Any unlisted difference is either a bug or a new divergence entry.

### 14.4 Evidence refresh

Appendix A's figures are a snapshot. The refresh procedure is scripted and documented there; at minimum, re-run before any release and whenever `evidenceAge.stale` fires. Star counts matter far less than `commitsLast30d` and `latestRelease` — the Superpowers case (V12) shows a large star count coexisting with a maintenance pause.

## 15. Extensibility and future work

Ordered by likelihood:

1. **Multiple rule sets** (finance vs. general engineering). Extract data to `rules/<name>.json` with a selector; keep an inlined default so `file://` still works. *Designed in `DESIGN-EXT-CONFIG.md` (EXT-CONFIG), which supersedes this item: packs are authored offline as JSON and inlined at build time, so §6.2's objection to fetching an external rules file still holds and is honoured.*
2. **Weighted scoring** as an alternative to first-match-wins, producing a ranked list with confidence. Engine-only change; §8.1's ceremony / cost / fit ratings become inputs rather than display-only (see D11).
3. **Rules for currently silent instrument fields** (Q1 domain, Q4 tenure, Q11 cycle time, Q13 branching) if field evidence appears. Do not invent them ahead of evidence (D19, D21).
4. **Automated evidence refresh**: a small script writing a fresh `FRAMEWORKS.evidence` block from the GitHub API, run on a schedule, so §8 metrics do not rot.
5. **JSON export** of the `Result` object for wikis and ticketing templates.
6. **Localization**: user-visible strings already live in data objects; add a `strings` table and a language toggle.

## 16. Open questions

| ID | Question | Owner | Blocking? |
|---|---|---|---|
| O3 | Should the fallback be OpenSpec or an explicit "insufficient signal"? | Reviewer | No — D2 chooses OpenSpec; revisit after user feedback. |
| O4 | Is first-match-wins acceptable, or do stakeholders expect a ranked list? | Reviewer | No — D1 plus runner-up reporting (F13); ranked list is future work 2. |
| O5 | The ceremony / token-cost / brownfield-fit ratings in §8.1 are editorial. Should they be validated against a measured trial before being displayed? | Amin | No — displayed as judgments, no rule branches on them (D11). |
| O6 | Overlay F recommends CI practices rather than a framework. Does that belong in this tool, or in a separate engineering-standards document? | Reviewer | No — included, because the enforcement gap it closes is created by the frameworks this tool recommends. |
| O7 | Should the tool track a framework's *trajectory* (improving/declining) rather than a point-in-time snapshot? | Amin | No — future work 4 is the prerequisite. |
| O8 | Should Q1 domain, Q4 tenure, Q11 cycle time, or Q13 branching later drive a rule? | Amin | No — collected and reported (D19). Inventing a split without evidence is out of scope. |

## 17. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Framework metadata and metrics rot. | **High** — four of seven projects shipped releases within two weeks of the evidence date | Medium | `verifiedOn` per framework, staleness warning (F14), scripted refresh (future work 4), §14.4 procedure. |
| The Finance Tech instrument is revised after v1. | Medium | Medium | Answer types isolated in `QUESTIONS`; URL schema versioned (`v=3`). |
| Users treat a fallback as a strong recommendation. | Medium | Medium | Explicit fallback banner (F3, §12.3). |
| Users read `advisory` mechanisms as controls — the source document's own error. | Medium | **High** for regulated teams | Enforcement classes are mandatory in the report (F5, §9.2); cautions C2 and C5 name it directly; overlay F closes the gap. |
| Cautions are ignored or perceived as boilerplate. | Medium | Medium | Equal visual weight (F12), severity ordering, each caution carries a concrete mitigation rather than a generic warning. |
| Rule fidelity drifts from the source during implementation. | Low | High | §14.3 independent review; §10 tables plus §11 divergences are the contract. |
| A recommended framework is abandoned after adoption. | Low–Medium | High | `commitsLast30d` and `latestRelease` in the evidence block; `status` field demotes at-risk projects (Superpowers → `viable`, Tessl → `watch`); cautions C9 and C10. |

## 18. Implementation plan

Each step independently reviewable.

1. Scaffold `index.html` with CSP meta, layout, and the three script sections.
2. Author `FRAMEWORKS` from §8 and Appendix A–B, including `status`, `evidence`, `enforcement`, and ratings.
3. Author `QUESTIONS` (Q1–Q21) from §7.1, including compound Q2/Q4/Q5/Q11 and report-only Q17.
4. Author `derive()`, `BASE_RULES`, `OVERLAYS`, `CAUTIONS` from §7.6 and §10.
5. Implement engine functions including `derive`, Tier 0 filtering, runner-up tracking, and cautions; export on `window.SDDSelector`.
6. Write engine fixtures (§14.1) and the `?selftest` runner; get them green.
7. Implement `renderForm` / `readAnswers` driven by `QUESTIONS`.
8. Implement `renderReport` with enforcement classes, cautions, Q17 in Markdown, and evidence dating; then `toMarkdown`.
9. Implement URL hash encode/decode at schema `v=3`.
10. Accessibility pass against §12.4 and Lighthouse.
11. Rule-fidelity review (§14.3) against §10 and §11.
12. Tag v0.1.0 of the implementation.

---

## Appendix A — Verified evidence

**Method.** Metrics retrieved 2026-09-16 from the GitHub REST API: `GET /repos/{owner}/{repo}` for stars, forks, open issues, language, license, and timestamps; `GET /repos/{owner}/{repo}/releases/latest` for release tag and date; `GET /repos/{owner}/{repo}/commits?since=2026-08-16` for 30-day commit counts (capped at 100 per page, so "100" means ≥ 100). Capability claims come from each project's own documentation; failure modes from independent field reports and comparative evaluations, cited in §8.

| Framework | Repo | Stars | Forks | Open issues | Lang | License | Created | Latest release | Commits/30d |
|---|---|---:|---:|---:|---|---|---|---|---:|
| Superpowers | `obra/superpowers` | 287,303 | 25,690 | 367 | Shell | MIT | 2025-10-09 | v6.3.0 (2026-08-12) | 0 |
| GitHub Spec Kit | `github/spec-kit` | 137,140 | 12,280 | 321 | Python | MIT | 2025-08-21 | v1.0.7 (2026-09-15) | ≥100 |
| OpenSpec | `Fission-AI/OpenSpec` | 68,430 | 4,705 | 288 | TypeScript | MIT | 2025-08-05 | v1.13.0 (2026-09-09) | 66 |
| BMAD Method | `bmad-code-org/BMAD-METHOD` | 53,070 | 5,994 | 40 | Python | NOASSERTION | 2025-04-13 | v6.12.0 (2026-09-04) | ≥100 |
| GSD Core | `open-gsd/gsd-core` | 9,501 | 685 | 124 | JavaScript | MIT | 2026-05-22 | v1.14.0 (2026-09-14) | ≥100 |
| Spec Kitty | `spec-kitty/spec-kitty` | 1,627 | 166 | 826 | Python | MIT | 2025-10-09 | — | active |
| Tessl SDD Tile | `tesslio/spec-driven-development-tile` | 53 | 8 | 0 | Shell | MIT | 2025-12-05 | — | 0 (last push 2026-03-30) |

**Documented runtime support** (from each README; absence means undocumented, not incompatible):

| Framework | Runtimes |
|---|---|
| Superpowers | Claude Code, Codex CLI, Gemini CLI, Cursor, OpenCode, Copilot CLI, Antigravity, Kimi, Factory Droid, Roo, Zed, Devin CLI, Hermes |
| GSD Core | Claude Code, OpenCode, Codex, Antigravity, Kimi CLI, Kilo, Copilot, Cursor, Windsurf |
| Spec Kitty | Claude Code, Codex, Cursor, Gemini, Copilot, Windsurf, OpenCode |
| OpenSpec | Claude Code, Cursor, Codex, Copilot, Windsurf, Amp, Zed (21+ claimed) |
| GitHub Spec Kit | Copilot, Claude Code, Gemini CLI, Amp, others (25+ claimed) |
| Tessl | Tessl CLI, MCP server |

**Refresh procedure.** Re-run the API calls above, update this table and each `FRAMEWORKS[].evidence` block, bump `verifiedOn`, and re-check `status` assignments. Prioritize `commitsLast30d` and `latestRelease` over star counts.

## Appendix B — Framework command and artifact reference

| ID | Install / init | Key commands | Key artifacts |
|---|---|---|---|
| `openspec` | `openspec init` (+ `openspec config profile` for expanded) | `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:update`, `/opsx:sync`, `/opsx:archive`; expanded adds `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:verify`, `/opsx:bulk-archive`, `/opsx:onboard` | `openspec/specs/`, `openspec/changes/<name>/{proposal,design,tasks,spec}.md` |
| `speckit` | `uvx specify init` | `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.checklist`, `/speckit.plan`, `/speckit.analyze`, `/speckit.tasks`, `/speckit.implement` | `constitution.md`, `spec.md`, `plan.md`, `tasks.md` |
| `bmad` | `/plugin marketplace add bmad-code-org/bmad-plugins` | `bmad-deep-recon`, `bmad-forge-idea`, `bmad-brainstorming`, `bmad-prd`, `bmad-ux`, `bmad-spec`, `bmad-architecture`, `bmad-sprint-planning`, `bmad-build`, `bmad-code-review`, `bmad-retrospective`, `bmad-correct-course`; Quick Flow: `bmad-quick-spec`, `bmad-quick-dev` | `_bmad/`, `PRD.md`, `ARCHITECTURE-SPINE.md`, `tech-spec.md`, `sprint-status.yaml`, `AGENTS.md` context block, ADRs |
| `gsd` | `npx @opengsd/gsd-core` | `/gsd:new-project`, `/gsd:discuss-phase`, `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`, `/gsd:ship`, `/gsd:resume-work`, `/gsd:phase`, `/gsd:progress` | `.planning/{PROJECT,REQUIREMENTS,ROADMAP,STATE}.md`, `.planning/phases/XX-name/{CONTEXT,RESEARCH,PLAN,VERIFICATION}.md`, `HANDOFF.json` |
| `superpowers` | `/plugin install superpowers@claude-plugins-official` | `/skill:brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `systematic-debugging` | design docs, implementation plans, git worktrees |
| `speckitty` | `pip install spec-kitty-cli` | `spec-kitty specify/plan/tasks`, `spec-kitty agent action implement`, `spec-kitty agent action review`, `spec-kitty agent tasks move-task`, `spec-kitty sync workspace`, `spec-kitty dashboard` | `kitty-specs/`, `.worktrees/`, `.kittify/config.yaml`, ADRs, append-only status log |
| `tessl` *(watch)* | `npx @tessl/cli install tessl-labs/spec-driven-development` | skills `requirement-gathering`, `spec-writer`, `spec-verification`, `work-review`; scripts `validate-specs.sh`, `check-spec-links.sh` | `*.spec.md` with `targets:` frontmatter and `[@test]` links |

## Appendix C — Directory layout composition

The suggested layout is the union of artifacts from the base and all non-`includedInBase` overlays. Example for base OpenSpec with overlays A, B, and F active:

```
repo/
├── constitution.md                  # Overlay A (Spec Kit) — advisory, see C2
├── openspec/                        # Base
│   ├── specs/                       # living contracts, grown per change
│   └── changes/<change-name>/
│       ├── proposal.md
│       ├── design.md
│       ├── tasks.md
│       └── spec.md                  # ADDED / MODIFIED / REMOVED deltas
├── .claude/
│   ├── commands/                    # /opsx:* configured by openspec init
│   └── skills/                      # Superpowers TDD skill (Overlay B)
├── tests/                           # Overlay B: failing tests precede implementation
└── .github/workflows/
    └── spec-gates.yml               # Overlay F: the actual enforcement gate
```

The placement of `spec-gates.yml` is the point of overlay F. `constitution.md` states intent; the workflow is what blocks a merge.
