# SDD Selector — Quality-Control Experiment Protocol

| Field | Value |
|---|---|
| Status | **Pre-registered** — committed before any results exist |
| Scope | SDD Selector engine (`packs/finance-tech.json` + the pure engine in `index.html`) |
| Companion documents | [docs/DESIGN.md](DESIGN.md) (rules, thresholds, framework profiles), [docs/AUTHORING.md](AUTHORING.md) (pack format) |
| Tooling | `tools/qc/` (harness, sensitivity script, LLM client, persona/respond/judge/analyze pipeline) |
| Generated output (not this file) | `docs/qc-report.md` |

**Pre-registration means what it says:** every threshold, metric, and pass/fail rule in §8 is fixed at the time this document is committed, not adjusted after Part A–D produce numbers. If a result is inconvenient, the finding is "the pre-registered criterion was not met," not a rewrite of the criterion. Anyone revising a threshold after seeing results must do so in a follow-up document, not by editing this one in place.

This document specifies *what* is being measured, *why* it requires the instruments it requires, and the *exact interfaces* the tooling under `tools/qc/` must produce and consume so that offline analysis (Part A), online generation (Part B), reliability analysis (Part C), and threshold calibration (Part D) all plug into each other without renegotiation mid-experiment.

---

## 1. Purpose and research questions

The SDD Selector makes two independent claims, and each claim needs a different kind of evidence:

- **RQ1 — Engine effectiveness (criterion validity).** Given a team's answers, does the engine's recommended base framework agree with what an independent, competent judge would recommend for that same team? This is a claim about the *rules* (`BASE_RULES`, the thresholds, the tier-0 filter) being *correct* relative to some external standard of "the right answer."
- **RQ2 — Questionnaire effectiveness (discriminant validity and reliability).** Do the 21 questions actually do work — do they separate teams into different recommendations in a way that tracks real differences, and would two people describing the same team answer them the same way? This is a claim about the *instrument*, independent of whether the rules built on top of it are the best possible rules.

These require different instruments because they have different failure modes and different available ground truth:

- RQ1 has **no ground truth in the repository**. There is no labeled dataset of "team X should get framework Y," no adoption outcome data, no surveyed practitioners. The only way to test criterion validity is to construct one — hence Part B, a blind LLM judge panel standing in for the oracle that does not exist (§2).
- RQ2 is **almost entirely answerable from the engine's own logic and the corpus already in the repository**, with no oracle required. Whether a question ever changes an outcome, how much it changes it, and whether it is redundant with another question are properties of `evaluate()` and the [tools/corpus.mjs](../tools/corpus.mjs) answer space alone — see Part A. The one piece of RQ2 that does need externally generated data is inter-respondent reliability (do two readings of the same team story produce the same answers?), which Part C gets for free from Part B's respondent step.

RQ1 and RQ2 are reported separately in §8 because a defensible engine sitting on a broken instrument, or a well-discriminating instrument feeding an engine that disagrees with experts, are both real and distinct outcomes worth being able to state independently.

---

## 2. Why an oracle must be constructed

[docs/DESIGN.md](DESIGN.md) is explicit, in its own words, that the numbers driving today's recommendations are editorial rather than measured:

> "Ceremony and cost are 1 (minimal) to 5 (heavy). These are editorial ratings derived from the workflow descriptions and field reports below, not measurements — O5 (§16) proposes validating them." (§8.1)

This is not confined to the display-only ratings. The base-selection thresholds under test in this experiment were chosen the same way. D3′ ([§10.5](DESIGN.md#105-design-decisions)) *invents* the split between Superpowers and GSD Core for base rule 4 — the source document names both frameworks with no criterion at all, and the coverage/budget split used today is this project's own construction, not a transcription of external evidence. D19 and D21 go further, stating a general policy of restraint: five instrument fields are deliberately wired into no rule because there is no evidence to justify a split (*"Do not invent [rules for silent fields] ahead of evidence"* — [Extensibility and future work, item 3](DESIGN.md#15-extensibility-and-future-work), citing D19 and D21).

Put plainly: **no labeled dataset, no surveyed teams, and no adoption-outcome data exist anywhere in this repository or its source material today.** Every threshold and every rule predicate is a defensible editorial judgment, documented as such, but a judgment nonetheless. The Part B dataset (`tools/qc/data/{vignettes,answers,labels}.json`) produced by this experiment is the **first attempt at an actual labeled dataset** for this tool. This experiment does not assume that dataset is definitive — §8's pass/fail criteria include an explicit floor below which the oracle itself is declared unusable — but it is the first empirical instrument brought to bear on questions [docs/DESIGN.md](DESIGN.md) has so far only been able to answer by citation of field reports about the underlying frameworks, not about this tool's own recommendations.

Two open questions in [docs/DESIGN.md §16](DESIGN.md#16-open-questions) are direct motivation for this protocol:

- **O5** — should the editorial ceremony/token-cost/brownfield-fit ratings be validated against a measured trial? This experiment does not validate those specific ratings, but it establishes the methodology (a constructed oracle) that any future attempt at O5 would need.
- **O8** — should `q1_domain`, `q4_tenure`, `q11_cycle_time`, or `q13_branching` later drive a rule? Part A's influence scores and Part C's danger quadrant (§6) give a first empirical answer to whether carrying these fields silently is costing anything, without inventing a rule ahead of evidence.
- **O4** — is first-match-wins acceptable, or do stakeholders expect a ranked list? Part B's judges return a ranked top-3 (§5, B3) and Part B4's runner-up-credit metric speaks directly to whether the engine's own runner-up mechanism (D1) captures most of the value a ranked list would.

---

## 3. System facts that shape the design

These are established properties of the current pack and engine (`packs/finance-tech.json`, [docs/DESIGN.md](DESIGN.md) §10), taken as given for this protocol — not re-derived here, and not to be re-litigated by the QC tooling. They are the reason certain measurements in Part A and Part D exist at all.

### 3.1 Framework reachability

Only 5 of the 7 catalog frameworks are reachable as a **base** recommendation. The other two are excluded for different, structural reasons:

| Framework | id | Status | Reachable as base? | Why / why not |
|---|---|---|---|---|
| OpenSpec | `openspec` | recommended | Yes — base-1, and `settings.fallbackBase` | |
| GitHub Spec Kit | `speckit` | recommended | Yes — base-2 | |
| BMAD Method | `bmad` | recommended | Yes — base-3, *but see §3.2* | Latent reachability hole |
| GSD Core | `gsd` | viable | Yes — one arm of base-4's `adoptWhen` split | |
| Superpowers | `superpowers` | viable | Yes — the other arm of base-4's `adoptWhen` split | |
| Spec Kitty | `speckitty` | viable | **No** | Overlay-only; never named in `baseRules` |
| Tessl SDD Tile | `tessl` | watch | **No** | Excluded from the tier-0 base candidate set by `settings.tierZero.excludeStatusesFromBase: ["watch"]` |

This gives **7 canonical outcome labels** for the experiment's classification tasks: the 5 reachable bases plus two non-base outcomes, `fallback_openspec` (no `baseRules` predicate matched; `settings.fallbackBase` applied) and `no_runtime_match` (tier-0 runtime filtering emptied the candidate set before base selection ran). These 7 labels are the fixed label space for `vignettes.json.targetOutcome`, `answers.json` → engine output, and `labels.json.rankedTop3` throughout Parts B–D. `tessl` and `speckitty` remain valid entries in a judge's `rankedTop3` (§5, B3) even though the engine can never emit them as its own recommendation — a judge choosing either is itself a data point (§9).

### 3.2 The BMAD/Q20 reachability hole

`bmad` has an **empty `runtimes` array** in the pack. Tier-0 filtering removes any framework that does not document support for at least one runtime named in `q20_runtimes` — and since `bmad` documents none, **any time `q20_runtimes` is answered at all, `bmad` is removed from the candidate set before base selection runs**, regardless of whether base-3's `when` predicate (dedicated-role team, unclear requirements) matches. Base-3 can be logically satisfied and still never resolve. This is not assumed to be a bug in this protocol — it is a measurable fact about the pack — but its *frequency and blast radius* (what fraction of otherwise-BMAD-shaped teams lose the recommendation solely because they answered a runtime question) is exactly the kind of number Part A is built to produce (§4, A1).

### 3.3 Base selection mechanics

Base selection is **strictly first-match-wins** over four ordered `baseRules`, restricted to whatever candidate set survives tier-0 filtering:

| # | Base(s) | Predicate (abbreviated) |
|---|---|---|
| base-1 | `openspec` | `derived.nonRoadmapShare ≥ 40` **OR** `q10 ∈ {monolith, hybrid, batch_data}` |
| base-2 | `speckit` | `q5.roadmap ≥ 60` **AND** `q10 = microservices` **AND** `q7 = structured` **AND NOT** `derived.volatilityIsHigh` |
| base-3 | `bmad` | all three of `derived.hasRoles.{product_owner, scrum_master, qa_sdet}` **AND** `q7 ∈ {high_level, vague}` |
| base-4 | `superpowers` or `gsd` (via `adoptWhen`, D3′) | `derived.teamSize < 5` **AND** `q11_deploy_cadence ∈ {continuous, sprint}` **AND** `q14 = autonomous` |
| — | `openspec` (`settings.fallbackBase`) | none of the above matched |

Full predicate detail, including the base-4 `adoptWhen` split, is [docs/DESIGN.md §10.2](DESIGN.md#102-tier-1--base-selection).

### 3.4 Rule-inert questions

Five of the 21 instrument fields feed **no rule and no derived view**: `q1_domain`, `q13_branching`, `q17_process_mismatch`, `q4_tenure`, `q11_cycle_time`. These are exactly the fields marked `"reportOnly": true` in `packs/finance-tech.json`. This is documented in [docs/DESIGN.md](DESIGN.md) as a deliberate, evidence-gated decision (D19: collect and display, don't drop, so the on-screen instrument stays faithful to the source diagnostic; D21: no domain-specific split without primary-source evidence) — not an oversight. This protocol's Part A and Part C therefore do not test "should these five questions be inert" as a yes/no question with an assumed answer; they measure **the cost of carrying them** — respondent time and cognitive load spent on fields that structurally cannot move the recommendation — as an input to whether O8 should ever be revisited.

The derived view `unplannedShare` (`q5.ops + q5.bugs`) is computed by `derive()` but never read by any rule or caution — it is orphaned in the same sense, and is included in Part A's influence/MI sweep for completeness even though, being a derived view rather than an answer field, no respondent-facing "cost of carrying it" applies.

### 3.5 Thresholds under test

Three numeric cliffs are the subject of Part A's brittleness analysis (§4, A4) and Part D's calibration sweep (§7):

| Threshold | Rule | Shipped value | Source |
|---|---|---|---|
| `nonRoadmapShare >= 40` | base-1 (`openspec`) | 40 | [docs/DESIGN.md §10.2](DESIGN.md#102-tier-1--base-selection) |
| `q5_work_breakdown.roadmap >= 60` | base-2 (`speckit`) | 60 | [docs/DESIGN.md §10.2](DESIGN.md#102-tier-1--base-selection) |
| `teamSize < 5` | base-4 (`superpowers`/`gsd`) | 5 | [docs/DESIGN.md §10.2](DESIGN.md#102-tier-1--base-selection) |

---

## 4. Part A — Offline discrimination analysis

Fully deterministic, no LLM, no oracle. Implemented in `tools/qc/sensitivity.mjs`. Every sub-result below lands in `tools/qc/data/sensitivity-report.json` (§9 gives the section-by-section shape).

- **A1. Outcome distribution.** Run `evaluate()` over the full 50,000-case seeded corpus produced by [tools/corpus.mjs](../tools/corpus.mjs) (`buildCorpus()` / `flattenCorpus()`) and histogram `baseId`, the fallback rate, and the `no_runtime_match` rate. A distribution collapsing heavily onto `openspec` or fallback is direct evidence of weak discrimination regardless of what the questions individually do. This is also where the §3.2 BMAD/Q20 hole gets its first number: the share of the corpus where base-3's predicate is logically satisfied (dedicated roles, `q7 ∈ {high_level, vague}`) but the *resolved* base is not `bmad` because tier-0 already dropped it.
- **A2. One-at-a-time (OAT) per-question influence.** For a sample of profiles from the corpus, and for each answer field in turn, hold every other field fixed and sweep the target field through all its remaining valid options. Record the fraction of (profile, option) pairs across which `baseId` changes, the overlay set changes, and the caution set changes. This produces one **influence score per question per outcome dimension** (base / overlay / caution) — a discrete, per-question analogue of a Morris elementary-effects screen. A question whose base-influence score is exactly zero cannot affect the recommendation under any input; that is not a hypothesis, it is a property directly readable off the rule predicates, and A2 is how the corpus confirms it empirically rather than by rule-reading alone.
- **A3. Mutual information.** Compute MI between each field's answer distribution and the resolved base outcome across the corpus, and pairwise MI between fields that feed the same rule (e.g. the `q5_work_breakdown` sub-fields against each other, `q2_team` sub-fields against each other). This distinguishes **inert** questions (zero MI with the outcome, confirmed by A2's zero influence) from **redundant** questions (non-zero MI with the outcome but highly correlated with another question already carrying that signal) — a distinct failure mode A2 alone cannot see, since two fields can each individually move the outcome while never adding information beyond one another.
- **A4. Threshold brittleness.** For each threshold in §3.5, measure the share of the corpus sitting within a small band (report at ±1, ±2, ±5 points) of the cliff. A large mass concentrated near a cliff means the recommendation is sensitive to a self-reported estimate's last few percentage points — a real robustness problem independent of whether the threshold's *location* is correct (that question is Part D's, not Part A's).

---

## 5. Part B — Blind LLM judge panel

The only part of this experiment that requires an oracle, hence the only part that requires LLM calls. Implemented across `tools/qc/personas.mjs` (B1), `tools/qc/respond.mjs` (B2), and `tools/qc/judge.mjs` (B3).

- **B1. Vignette generation.** Generate roughly 100 prose team vignettes (2–4 paragraphs each), stratified so that all 7 canonical outcome labels (§3.1) are represented, and diversity-prompted across domain, size, architecture, compliance tier, and deploy cadence so vignettes read as plausible finance-tech teams rather than uniform-random answer vectors (which are frequently internally incoherent — e.g. a 2-person team with a dedicated PO, SM, and QA — and therefore not meaningful to hand to a judge).
- **B2. Respondents.** Three independent LLM respondents read each vignette's prose and fill the full 21-question instrument **from the story alone**, with no visibility into the engine, the rules, or each other's answers. Answers must be derived from the narrative, never the reverse (never generate a vignette to match a target answer set): if the questionnaire's own framing leaked backward into how the "ground truth" answers were produced, agreement between the engine and the judges would be inflated by construction rather than by the rules being right. Running 3 respondents per vignette is deliberate — it is also the entire input to Part C's reliability analysis (§6), so B2 is not repeated work between the two parts.
- **B3. Judges.** Three blind judges, on different model families where feasible, receive **only** the vignette prose plus the framework best-fit/poor-fit profiles extracted from [docs/DESIGN.md §8](DESIGN.md#8-framework-profiles) (capability summary, best fit, poor fit, status, enforcement class per framework) — explicitly **not** the `BASE_RULES` predicates, **not** the numeric thresholds, and **not** the 21-question instrument. Each judge returns a ranked top-3 of framework IDs plus free-text reasoning. The order frameworks are presented in is randomized independently per call to eliminate position bias. `tessl` stays on the menu on purpose: the engine can never recommend it (§3.1), so a judge choosing it anyway is itself informative about whether the engine's `watch`-status exclusion is too aggressive relative to independent judgment, not a bug in the experiment.
- **B4. Metrics, in priority order** (each metric downstream depends on the one above it being informative):
  1. **Inter-judge Fleiss' kappa**, computed first, before any engine metric. This is the ceiling on any claim of engine accuracy and a validity check on the oracle itself — see the pre-registered floor in §8.
  2. **Engine-vs-majority-label top-1 accuracy**, **Cohen's kappa** (not raw accuracy, since the outcome-label distribution is skewed per A1), and a roughly 5×5 confusion matrix restricted to the reachable bases, to expose systematic bias (e.g. base-1/`openspec` over-firing).
  3. **Accuracy-with-runner-up-credit**: score a match if the engine's base *or* its reported runner-up equals the judges' majority top-1 label. This measures how much of D1's "runner-up removes most of the cost of being wrong" claim holds up against independent judgment.
  4. **Caution precision/recall** against risks the judges raised unprompted in their free-text reasoning, matched (by a documented, fixed keyword/topic mapping recorded alongside the analysis code) against the engine's fired `CAUTIONS`.
- **B5. Baselines.** Accuracy numbers are uninterpretable without comparators, so three are required, all computed by `tools/qc/analyze.mjs` from the same `labels.json`:
  - **Constant-`openspec`**: always predict `openspec` (the fallback and likely modal outcome per A1).
  - **Prior-weighted random**: sample a label from the empirical label distribution in `labels.json` itself.
  - **Best single-question stub**: the single answer field whose value alone, run through the simplest possible one-question decision rule, best predicts the majority judge label (a likely candidate is `q10_architecture` or `q5_work_breakdown.roadmap`, but the stub is *fit*, not assumed — see §8's pass condition).

---

## 6. Part C — Instrument reliability

Uses the 3-respondents-per-vignette answers already produced by B2 — no additional LLM calls.

- **C1. Test-retest agreement across respondents.** For each non-`reportOnly` question, compute pairwise agreement across the 3 respondents per vignette (exact match for categorical fields; a documented tolerance band for numeric fields such as `q5_work_breakdown`'s percentages and `q2_team`'s headcounts). A question where three independent readers of the same story give different answers is ambiguously worded or under-specified by the vignette; if that question also drives a base rule, the *recommendation* is unstable by construction, not just the answer.
- **C2. End-to-end recommendation stability.** Run each vignette's 3 respondent answer sets through the engine and measure how often all 3 produce the same `baseId` for the same underlying team. This is the metric that actually matters to a user — an unreliable *question* only matters insofar as it produces an unreliable *recommendation*.
- **C3. The danger quadrant.** Cross Part A's per-question base-influence scores (§4, A2) against this section's respondent-agreement scores (C1). **High influence + low reliability is the failure mode that matters most**: a question that moves the recommendation a lot but that reasonable people answer inconsistently is actively harmful, worse than a question that is merely inert. `q5_work_breakdown` (five percentages required to sum to 100, gating base-1 and base-2) and `q2_team` (exact headcounts and role designations, gating base-3 and base-4) are named here as prior suspects worth watching specifically *because* they are both high-influence by rule construction (§3.3) and structurally the hardest fields for an outside observer to estimate precisely from a prose narrative — but the danger-quadrant membership itself is measured, not assumed; either field landing outside the quadrant is a valid and reportable outcome.

---

## 7. Part D — Threshold calibration

Uses the Part B judge labels as the target. For each threshold in §3.5 (`nonRoadmapShare >= 40`, `q5.roadmap >= 60`, `teamSize < 5`), re-run the corpus (or the vignette set, where judge labels apply) with the threshold swept across a range around its shipped value, and recompute engine-vs-majority-label agreement (Cohen's kappa, per B4) at each swept value. Report the full agreement-vs-threshold curve and flag, for each threshold independently, whether the shipped value sits at, near, or away from the empirical peak. A peak away from the shipped value is a concrete, actionable finding about a number [docs/DESIGN.md](DESIGN.md) already concedes is editorial rather than measured (§2) — it is not, by itself, grounds to change the threshold outside of this pre-registered experiment's own review process.

---

## 8. Pre-registered pass/fail criteria

Fixed now. Not to be adjusted after seeing results — see the note at the top of this document.

| Claim | Criterion |
|---|---|
| **Oracle is usable** | Inter-judge Fleiss' kappa (§5, B4.1) ≥ 0.40. |
| **Oracle is unusable** | Inter-judge Fleiss' kappa < 0.20 → abandon RQ1 correctness claims; report "no stable ground truth" as a legitimate finding in its own right, not as an experiment failure. |
| **Engine passes RQ1** | ALL of: (a) Cohen's kappa vs. majority judge label ≥ 0.40; (b) top-1 accuracy exceeds the constant-`openspec` baseline by ≥ 15 percentage points; (c) top-1 accuracy exceeds the best single-question stub baseline. |
| **Questionnaire passes RQ2** | ALL of: (a) ≥ 60% of non-`reportOnly` questions have non-zero base influence (§4, A2); (b) no question lands in the danger quadrant — base-influence > 5% AND respondent agreement < 0.60 (§6, C3); (c) recommendation stability across respondents (§6, C2) ≥ 0.70. |

Kappa between 0.20 and 0.40 is a gray zone: the oracle is treated as *weakly* usable, RQ1 claims may be reported but must be explicitly qualified with the kappa value, and no pass/fail verdict on RQ1 is asserted.

### 8.1 EXT-SELECT retarget (v0.6.0)

`docs/archive/DESIGN-EXT-SELECTION.md` §8.5 withdraws the original RQ1 base-accuracy gate. The table above is retained as the historical pre-registration. Replacement criteria, fixed before any new S1 labels:

| Claim | Criterion |
|---|---|
| **RQ1'** | Practice-set macro-F1 exceeds the prevalence baseline by a margin whose 95% cluster-bootstrap CI excludes zero. S4 cutover gate. |
| **RQ2'** | Every non-`reportOnly` field has non-zero influence on at least one output, and the danger quadrant is empty under *total* influence (base + overlay + caution). |
| **RQ3'** | Caution precision and recall against judge `riskTags` both clear a floor (replaces `b44` reporting `null`). |
| **RQ4'** | Harness conformal sets achieve their nominal coverage on holdout. |
| **RQ5'** | `G-STABILITY` passes for every framework in the catalogue. |
| **RQ6'** | The fitted harness lands in the judge majority's top-3 at a rate no worse than the pre-cutover runner-up-credit accuracy (T17). Sanity floor, not a top-1 target. |

Harness top-1 versus `constant-openspec` is **reported, not gated**. Analyze writes `verdicts.engineRQ1.verdict = UNSTATED` for the withdrawn RQ1. G-PARITY (current↔golden) is retired at S5; use current↔current / golden↔golden, plus G-FIT / G-PRACTICE / G-STABILITY.

---

## 9. Data contracts

Fixed interfaces. Every downstream stage reads exactly this shape from the upstream stage; changing a field name or type here is a breaking change to the pipeline and must be reflected in every consumer, not patched around locally.

### `tools/qc/data/vignettes.json` (produced by B1, consumed by B2 and B3)

```typescript
Array<{
  id: string,                  // e.g. "v001"
  targetOutcome:
    | "openspec" | "speckit" | "bmad" | "superpowers" | "gsd"
    | "fallback_openspec" | "no_runtime_match",
  prose: string,                // 2-4 paragraph narrative
  tags: { domain, size, architecture, compliance, cadence, ... },
  generatorModel: string,
}>
```

`targetOutcome` is the stratification label used to balance generation across the 7 canonical outcomes (§3.1) — it is **not** shown to respondents or judges, and it is **not** assumed correct; it is a generation-time target, and whether vignettes actually land on their intended outcome when run through the real engine is itself reportable (a large mismatch rate would indicate the vignette generator's own model of the rules is wrong, independent of B4's engine-vs-judge comparison).

### `tools/qc/data/answers.json` (produced by B2, consumed by the engine harness, Part C, and Part D)

```typescript
Array<{
  vignetteId: string,
  respondentIndex: 0 | 1 | 2,
  model: string,
  answers: Record<fieldId, value>,   // shape per packs/finance-tech.json field kinds
}>
```

`answers` must be a value the engine's `evaluate()` accepts as-is (same field IDs and value shapes as [packs/finance-tech.json](../packs/finance-tech.json) defines — see [docs/DESIGN.md §7.1](DESIGN.md#71-answers) for the `Answers` type). No adapter layer between `respond.mjs` output and the harness.

### `tools/qc/data/labels.json` (produced by B3, consumed by Part B4 and Part D)

```typescript
Array<{
  vignetteId: string,
  judgeIndex: 0 | 1 | 2,
  model: string,
  rankedTop3: [frameworkId, frameworkId, frameworkId],
  reasoning: string,
  riskTags?: string[],          // C-ids from the fixed taxonomy; empty if omitted
  bestWorst?: Array<{           // T13; several four-practice sets per vignette
    setIndex: number,
    presented: string[],        // PracticeIds shown, already shuffled
    most: string,
    least: string,
  }>,
  parseFailure?: boolean,       // rankedTop3 malformed — do not backfill
  bestWorstParseFailure?: boolean, // a best-worst set malformed — independent of rankedTop3
}>
```

`frameworkId` values are drawn from the full 7-framework catalog (all IDs in `packs/finance-tech.json`'s `frameworks`), not restricted to the 5 reachable bases — `tessl` and `speckitty` are valid entries (§5, B3).

`most` / `least` must be members of that row's `presented` list and distinct. Malformed best-worst rows are dropped (`bestWorstParseFailure`); they are **not** repaired from presentation order. The frozen `labels.json` predates T13 and has no `bestWorst` — G-PRACTICE waits on a judge re-run.

### `tools/qc/data/sensitivity-report.json` (produced by Part A, consumed by Part C's danger quadrant and Part D)

No fixed schema is prescribed here beyond: one top-level section per sub-analysis (A1 outcome distribution, A2 per-question influence scores keyed by field ID and outcome dimension, A3 MI matrix, A4 threshold brittleness), each independently keyed so Part C can read A2's influence scores by field ID without depending on the rest of the file's shape.

---

## 10. Known threats to validity

- **Judges and engine may share a source.** Both the judges' framework knowledge and the rules in [docs/DESIGN.md §8](DESIGN.md#8-framework-profiles) ultimately derive from the same underlying framework documentation, which can inflate agreement beyond what independent judgment would produce. Mitigation: judges see only the section 8 best-fit/poor-fit prose (§5, B3) — never the rules, thresholds, or question set — so agreement reflects the judge's own read of the team-to-framework fit, not a re-derivation of the engine's logic.
- **Self-preference bias.** If the same model plays generator, respondent, and judge, its own stylistic and reasoning biases could inflate apparent agreement between stages that are supposed to be independent. Mitigation: use distinct model families per role (generation, response, each judge) wherever feasible, and log which model played which role in every record (`generatorModel`, `model` fields in §9) so any residual overlap is auditable after the fact rather than hidden.
- **Vignette realism is itself unvalidated.** Nothing in this pipeline guarantees the generated vignettes read as realistic finance-tech teams rather than as plausible-sounding fiction optimized to hit a stratification target. Recommendation: a human spot-check of roughly 10 vignettes for narrative coherence and realism before committing token spend to the full B2/B3 run.

---

## 11. Environment note

This repository/sandbox had **no `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` configured** at the time the `tools/qc/` tooling was built. `tools/qc/llm.mjs` therefore ships with a deterministic mock provider, used to validate that the pipeline (generation → respondents → judges → analysis) is wired correctly end-to-end without spending tokens or requiring credentials.

This is expected and by design, not a shortcut being hidden: Part A (fully offline) produces genuine results regardless of API key availability. Parts B, C, and D require a real key exported into the environment and the generation scripts (§12) re-run against a live model before their output is anything more than a pipeline smoke test. Any `docs/qc-report.md` generated against the mock provider must say so explicitly and must not be read as a real Part B/C/D result.

---

## 12. How to reproduce

The following npm scripts are the intended entry points for this pipeline. They are wired into `package.json` by another workstream; this document specifies their expected behavior so that wiring can happen independently of this protocol.

| Script | Phase | Requires network/API key? | Deterministic? |
|---|---|---|---|
| `npm run qc:sensitivity` | Part A — offline discrimination analysis | No | Yes |
| `npm run qc:generate` | Part B1 + B2 — vignette generation and respondent fills | Yes (or mock provider, §11) | No (live), Yes (mock) |
| `npm run qc:judge` | Part B3 — blind judge panel | Yes (or mock provider, §11) | No (live), Yes (mock) |
| `npm run qc:analyze` | Parts B4, C, D — all metrics, reads only committed JSON under `tools/qc/data/` | No | Yes |

Only `qc:sensitivity` and `qc:analyze` are safe to add to `npm test` as deterministic offline gates, consistent with this repository's existing `test` script (see [package.json](../package.json)), since they need no network access and no LLM calls. `qc:generate` and `qc:judge` spend tokens and must stay manual, re-run only when the committed `tools/qc/data/*.json` dataset is deliberately refreshed.
