# SDD Selector — Design Extension: Practice Selection

| Field | Value |
|---|---|
| Status | Implemented in v0.6.0 — archived |
| Extension ID | EXT-SELECT |
| Version | 0.1.1 |
| Owner | Amin Rashidi |
| Last updated | 2026-09-19 |
| Extends | `DESIGN.md` v0.5.1 |
| Related | `QC-EXPERIMENT.md` (the measurement protocol this revises), `qc-report.md` (the findings that motivate it) |
| Target release | SDD Selector v0.6.0 |
| Supersedes | DESIGN.md §15 future-work item 2 (weighted scoring); DESIGN.md D1, D3', D5, D11, D23, D24 |

**Changelog**

- **0.1.1** — Resolves the remaining blocking decisions. SO5: a harness top-1 regression is not an S4 stop; the floor is judge-majority top-3 inclusion, not base accuracy. T30: `q11_cycle_time` and `q4_tenure` are marked `reportOnly`, not wired. S4 gate and RQ6' updated to match.
- **0.1.0** — Initial extension. Reframes the product around practice selection, replaces per-framework rule weights with a fitted framework-agnostic utility, replaces hard thresholds with preference ramps, derives cautions from coverage gaps, and re-targets the QC apparatus at the outputs that actually carry the behaviour.

---

## 1. Summary

The selector answers three questions — which base framework, which practice overlays, which cautions — and measures only the first. Section 2 shows that the base carries roughly a quarter of the engine's behaviour while consuming all of the evaluation budget, and that the two unmeasured outputs carry the rest.

This extension makes the practice set the primary output and the base a byproduct of it, on the grounds that the practices are where the value is and where the answers actually land. The mechanism is a single change of representation: **a framework becomes a pre-bundled set of practices plus an adoption cost**, and both frameworks and practices are scored by a small, fitted, framework-agnostic utility over a shared axis vocabulary.

Three properties follow that the current engine cannot provide:

1. **Adding or removing a framework changes nothing else.** No rule is authored, no weight is invented, no caution is written. This is a provable property of absolute-anchored value functions, not a convention, and §9 turns it into a CI gate.
2. **The practice catalogue compounds.** Every framework added donates practices that combine with every practice already present. Harvesting techniques stops being a side effect of base selection and becomes the point.
3. **The weights are estimated, not asserted.** Roughly 30 parameters fitted jointly on framework rankings and best-worst practice judgements, replacing roughly 40 hand-set signal weights that live on a scale nothing anchors.

The instrument survives largely intact. Four questions need work (§7) and one of them — `q16_bottlenecks` — is the single largest reliability defect in the system.

---

## 2. Findings this extension exists to fix

Every figure below is from the committed `tools/qc/data/sensitivity-report.json` and `tools/qc/data/analysis-report.json` at pack 0.5.1. Nothing here is a new measurement; it is the existing data read against a different question.

### 2.1 The base is the least informative output, and the only measured one

One-at-a-time influence from `a2`, summed across all 23 answer fields:

| Output | Aggregate influence (pp) |
|---|---:|
| Base framework | 54.1 |
| Overlays | 211.1 |
| Cautions | 151.9 |

Eight fields move overlays substantially and the base not at all:

| Field | Base | Overlay | Caution |
|---|---:|---:|---:|
| `q3_distribution` | 0 | 13.52 | 3.04 |
| `q4_domain_familiarity` | 0 | 13.45 | 0 |
| `q15_governance` | 0 | 17.49 | 0 |
| `q16_bottlenecks` | 0 | 17.08 | 6.35 |
| `q19_change_volume` | 0 | 14.33 | 4.20 |
| `q21_ci_maturity` | 0 | 10.21 | 0 |
| `q6_volatility` | 0.85 | 17.69 | 3.48 |
| `q8_compliance` | 0.32 | 13.23 | 16.17 |

The largest single influence figure in the table belongs to a caution: `q14_release_autonomy` at **41.70** on cautions against **1.25** on the base.

Meanwhile `analysis-report.json` contains no overlay metric of any kind. `b42_engineVsMajority` scores base top-1, `b43_runnerUpCredit` scores the base second choice, and `b44_cautionPrecisionRecall` reports `vignettesWithRiskTags: 0` and `precision: null` because `judge.mjs` asks only for `rankedTop3` over framework ids and the frozen `labels.json` carries no `riskTags`.

**Consequence.** RQ1 — the pre-registered criterion that failed at +14.61 pp against a 15 pp bar — measures the output that carries about a quarter of the behaviour. That is a measurement design error, and it is not evidence about engine quality in either direction.

### 2.2 The mutual-information table points the wrong way

`a3` computes MI against the outcome label, where outcome means base framework. Read as feature selection it inverts the truth:

- `q6_volatility` — MI **0.0435 bits, last of 23** — overlay influence 17.69. DESIGN.md V5 treats this question as the most consequential omission in the source appendix.
- `q21_ci_maturity` — MI 0.0479 (second last) — overlay influence 10.21.
- `q15_governance` — MI 0.0578 — overlay influence 17.49.

Pruning questions by this ranking would delete precisely the questions that drive the practice recommendations.

### 2.3 The danger-quadrant check cannot see its own targets

`c3_dangerQuadrant` reports `fieldsInQuadrant: []`, `isEmpty: true`. Its rule is `base-influence > 5 AND respondent agreement < 0.60`. Recomputed against **total** influence, four fields qualify:

| Field | Total influence | Reliability | Base influence (why it was invisible) |
|---|---:|---:|---:|
| `q16_bottlenecks` | 23.44 | **0.46** | 0 |
| `q3_distribution` | 16.56 | **0.54** | 0 |
| `q21_ci_maturity` | 10.21 | **0.59** | 0 |
| `q20_runtimes` | 8.12 | **0.37** | 0.38 |

`q2_team` sits just outside at 0.61 reliability and 16.41 influence. Every one of the four has base influence at or below 0.38, so the filter excludes all of them by construction.

### 2.4 Weights on an unanchored scale produce a degenerate distribution

`selectBaseWeighted` compares raw signal sums across rules. Because each rule's weights are meaningful only relative to its siblings, the outcome distribution over the 50k corpus collapses:

| Outcome | Share |
|---|---:|
| `insufficient_signal` | **59.38%** |
| `openspec` | 26.02% |
| `bmad` | 8.26% |
| `speckitty` | 4.94% |
| `gsd` | 0.68% |
| `speckit` | 0.58% |
| `superpowers` | 0.14% |
| `tessl` | 0.00% |

Two documented consequences follow directly. `q12_quality_gates` (0.18 total influence) and `q18_token_budget` (0.09 base, 0.03 overlay) both feed `base-4`'s split arm, and `base-4` resolves to 0.82% of the corpus — well-motivated questions wired to a consumer that never runs. And the `bmadHole` records 334 of 3,174 `base-3`-matched cases not resolving to BMAD (10.5%) through rule competition.

### 2.5 Hard thresholds are brittle at exactly the population that matters

`a4` near-cliff shares, defined as the fraction of the 50k corpus within ±5 of a decision threshold:

- `nonRoadmapShare >= 40` — 5.63%
- `q5.roadmap >= 60` — 6.62%
- `teamSize < 5` — 8.01%

`partD` finds `teamSize < 5` is the one swept cliff away from its κ peak (0.4787 at 4 versus 0.4459 shipped), and correctly refuses to retune it on n=89.

### 2.6 The parameter count cannot be fitted on the available labels

Roughly 40 hand-set signal weights plus three thresholds against 89 consensus vignettes — and because the three judges on one vignette are not independent, the effective sample is ~89 clusters, not 267 observations. Fleiss κ 0.5015 means the oracle also disagrees with itself, and the single-judge-versus-majority ceiling is not computed anywhere, so there is no known upper bound to optimise toward.

### 2.7 Deletion is unsafe

Ten of sixteen cautions match a framework id through `{"result": "baseFramework"}`. Removing Spec Kit orphans C1 and C2, `overlay-a`, and two `providedByBase` references. There is no schema-level check that would catch it.

---

## 3. Goals and non-goals

### Goals

- **S-G1** Adding or removing a framework requires editing exactly one pack row and no rules, weights, or cautions. Enforced by `G-STABILITY` (§9.3).
- **S-G2** Removing a framework cannot orphan a reference. Enforced by validation, not review.
- **S-G3** Practices are recommendable independently of their source framework, including practices donated by a `watch`-status framework.
- **S-G4** Every number in the system belongs to exactly one provenance tier — authored, fitted, or cross-validated (§6).
- **S-G5** No decision turns on a step threshold. Preference ramps replace cliffs.
- **S-G6** The practice set and the caution set are measured against an oracle, with pre-registered criteria.
- **S-G7** Recommendations carry inclusion probabilities rather than binary fired/not-fired.
- **S-G8** All DESIGN.md non-functional requirements survive: single file, no runtime dependencies, deterministic, sub-50 ms, WCAG 2.1 AA, URL-encodable.

### Non-goals

- **No LLM at runtime.** Unchanged from DESIGN.md. The LLM is an offline oracle for calibration only; the shipped engine is arithmetic.
- **No solver dependency.** The bundle problem is solved by exhaustive enumeration (§5.4), not by an ILP or SAT library.
- **No new instrument.** The Finance Tech diagnostic stays as issued. Four questions are repaired (§7); none is removed.
- **No learned nonlinearity in framework identity.** Tree ensembles and per-framework embeddings are excluded: they cannot cold-start a new framework, which is the whole requirement.
- **Not a ranked list of every framework.** The output is a practice bundle plus a harness, with acceptability shares.

---

## 4. The reduction

**A framework is a pre-bundled set of practices plus an adoption cost.** Nothing else.

This single definition resolves the structural findings in §2.7 and §2.4 together:

| Today | Under EXT-SELECT |
|---|---|
| `base-1` … `base-6`, one hand-weighted rule per framework | No base rules. Frameworks are scored by the same utility as practices. |
| `overlay-a` … `overlay-g`, a second tier with its own predicates | Practices. Same nodes, same scoring, no tier. |
| `providedByBase: ["speckit"]`, hand-maintained | `p ∈ B[f]`, computed |
| `adoptWhen` / `ifUnavailable` branching in `base-4` | Falls out of the cost term |
| 16 cautions, 10 keyed to a framework id | Derived from coverage gaps (§5.6) |
| `runtimeMismatchPenalty: 3`, `watchPenalty: 6` | Feasibility veto (§5.3), not a score adjustment |
| `minScore: 1`, `minMargin: 1` | Conformal set with a coverage guarantee (§5.7) |

"Base selection" becomes the question of whose pre-bundle to stand on, and it is answered by the same objective that chooses everything else.

---

## 5. The formulation

### 5.1 Objects

```ts
type Axis = {
  id: AxisId;                      // ~14 of them, §5.2
  label: string;
  demand: ValueFunction;           // answers -> [0,1], monotone, absolute anchors
};

type ValueFunction = {             // piecewise-linear ramp, replaces step thresholds
  reads: string[];                 // answer field ids or derived keys
  q: number;                       // indifference threshold: below this, no signal
  p: number;                       // preference threshold: above this, saturated
  // demand rises linearly from 0 at q to 1 at p; anchors are absolute, never
  // normalized against the catalogue (this is what makes S-G1 provable)
};

type Practice = {
  id: PracticeId;
  label: string;
  capability: Record<AxisId, number>;          // [0,1] per axis
  enforcement: Record<AxisId, EnforcementClass>;
  cost: { ceremony: number; tokens: number };
  sources: FrameworkId[];                      // provenance, may be several
  liftable: boolean;                           // adoptable without its source?
  requires: PracticeId[];
  excludes: PracticeId[];
  artifacts: string[];
  commands: string[];
  rationale: string;
};

type Framework = {
  id: FrameworkId;
  name: string;
  bundle: PracticeId[];            // B[f] — what you get natively
  feasibility: {
    runtimes: RuntimeId[];
    status: 'recommended' | 'viable' | 'watch';
    license: string;
  };
  cost: { ceremony: number; tokens: number };  // adoption overhead beyond its practices
  evidence: Evidence;                          // unchanged from DESIGN.md §7.2
};
```

`liftable` is the honest escape hatch and it encodes a distinction DESIGN.md can currently only state in prose. Superpowers' TDD iron law travels; Spec Kitty's 27-transition lane machine does not, because it *is* the tool. Marking the latter `liftable: false` means it can enter the solution only when Spec Kitty is the harness. It also makes DESIGN.md §8.8's observation actionable — Tessl's `one-question-at-a-time` rule becomes a `liftable: true` practice sourced from a `watch` framework, so it is recommendable while Tessl itself stays vetoed as a harness.

### 5.2 The axis vocabulary

Fourteen axes, authored once. Each is a demand the team has and a capability a practice supplies, on one `[0,1]` scale.

| Axis | Demand driven by | Currently expressed as |
|---|---|---|
| `brownfield` | `nonRoadmapShare`, `q10` | `base-1` gate |
| `midFlightChange` | `q6_volatility` | `base-2` negated conjunct (V5) |
| `ambiguityHandling` | `q7`, `q4_domain_familiarity`, `q16` | `overlay-d` |
| `verificationStrength` | `q9_precision`, `coverageLevel`, `q16.test_fear` | `overlay-b` |
| `deterministicEnforcement` | `q8`, `q9`, `q21_ci_maturity` | `overlay-f` |
| `auditTrail` | `q8_compliance`, `q15_governance` | `overlay-a`, C6 |
| `roleSeparation` | `q2_team` role presence | `base-3` gate |
| `concurrencyIsolation` | concurrent workstreams (new, §7.6) | `overlay-c`, C8 |
| `contextHygiene` | session length (new, §7.6), `q10 = monolith` | `overlay-e` |
| `traceability` | `q8`, `q15` | GSD Core REQ-ids, §8.5 |
| `fastPath` | `q19_change_volume`, `q6_volatility` | `overlay-g` |
| `ceremonyTolerance` | `q19`, `q11_deploy_cadence` | C7, C12 |
| `tokenBudget` | `q18_token_budget` | C3, `base-4` split |
| `specDebt` | existing doc debt (new, §7.6) | unexpressed |

Three axes need a question that does not exist yet; §7.6 covers them and gates them on measured information gain. Until then their demand is zero and no practice is credited for them, which is honest rather than silently mis-weighted.

### 5.3 Feasibility as a veto

Evaluated **before** scoring, producing `Feasible(a) ⊆ F`. A framework is excluded when it documents a non-empty `runtimes` list with no overlap against `q20_runtimes`, or when its status is vetoed by pack settings.

This replaces `runtimeMismatchPenalty: 3` and `watchPenalty: 6`. The current additive penalties can be outvoted by enough positive signals, which means a genuine incompatibility is negotiable. A veto is not, and it is reportable as its own sentence — "Tessl was excluded because it documents no support for your runtimes" — rather than disappearing into an unexplained score. D24's dilemma about empty `runtimes` lists dissolves: an empty list is unrestricted at the veto and carries no scoring consequence either way.

### 5.4 The objective

Choose a harness `f` and added practices `A`. Adopted set `S = B[f] ∪ A`.

```
Enforcement discount, with complementarity:

  kappa_eff(p, i, S) = min(1, kappa(enforcement[p][i]) + gamma * backstop(S))

  backstop(S) = strongest hard_gate coverage in S on the
                deterministicEnforcement axis

Coverage:

  cov(i, S) = max over p in S of  capability[p][i] * kappa_eff(p, i, S)

Utility:

  U(f, A) = - sum_i theta[i]  * d[i]     * (1 - cov(i,S))     unmet demand
            - sum_i lambda[i] * (1-d[i]) * cov(i,S)           unneeded ceremony
            - mu . cost(S, f)

Subject to:

  f in Feasible(a)
  A respects requires / excludes
  p in A  =>  liftable[p] or f in sources[p]
  |A| <= k                                   k = 5, report legibility
```

The `gamma * backstop(S)` term is `overlay-f` expressed as arithmetic. DESIGN.md Appendix C already states the mechanism — "`constitution.md` states intent; the workflow is what blocks a merge" — and this makes a CI gate's value automatically proportional to how advisory the rest of the bundle is, instead of a hand-authored trigger.

Both penalty terms are **bilinear** in demand and coverage, so `U` stays linear in `(theta, lambda, mu)`. That is deliberate: it is what makes the likelihood in §5.5 concave and the contribution decomposition in §5.7 exact rather than attributed.

### 5.5 Fitting

One likelihood, two observation types, fitted offline at build time.

```
Framework rankings — Plackett-Luce over Feasible(a), each f on its native bundle:

  L1 = prod over k of  exp(U(f_k, {})) / sum over remaining g of exp(U(g, {}))

Best-worst practice judgements — conditional logit over marginal utilities:

  dU(p) = U(f, A + p) - U(f, A)
  L2 = prod over most/least choices of  exp(dU(p)) / sum of exp(dU(p'))

Objective:

  max  log L1 + log L2  -  ||theta - theta_prior||^2 / (2 tau^2)
  s.t. theta >= 0, lambda >= 0, mu >= 0
```

Four properties, and together they are the argument for this over anything more elaborate:

- **Concave**, so one optimum, no seed, no reproducibility question, and a fit a reviewer can re-run and check.
- **~30 parameters, none of them a framework identity.** A new framework is scored by parameters fitted before it existed.
- **Two observation types, one parameter vector.** Framework rankings are scarce (~89 clusters); best-worst practice judgements are dense, several per vignette over a catalogue roughly three times the size. The abundant data carries the scarce data, which is why reorienting toward practices improves the base pick rather than trading against it.
- **Prior centered on today's hand weights**, so the fit degrades gracefully toward current behaviour when data is thin, and `tau` is one cross-validated number.

Where `a3`'s pairwise redundancy shows two axes co-varying — `q2_team` against `q12_quality_gates` at 2.92 bits inside `base-4` is the strongest case — the corresponding coefficients are not separately identified. Ridge shrinks them toward the prior instead of letting them oscillate, and they must not be interpreted individually.

### 5.6 Cautions, derived

Four generic conditions replace 16 authored predicates. Prose stays authored per item; triggering becomes structural.

| Condition | Test | Derives |
|---|---|---|
| Enforcement gap | `d[i]` high, `cov(i,S)` credited mostly through `kappa(advisory)` | C2, C5 |
| Uncovered demand | `d[i]` high, `cov(i,S)` low | F6 non-coverage, unaddressed bottlenecks |
| Cost mismatch | `cost(S,f)` high against `tokenBudget` / `ceremonyTolerance` demand | C3, C7, C12 |
| Attribute risk | evidence staleness, project age, non-MIT license, zero recent commits | C9, C10, C11, C15 |

Two of today's cautions become **constraints** rather than warnings, which is a behaviour change and an improvement. C8 (Spec Kitty below three concurrent workers) is a `requires` on the practice, so the recommendation is never made instead of being made and then walked back. C13 (`q14 = vendor`) scopes the demand vector rather than appending a warning.

### 5.7 Output

Sample `theta` from the Laplace posterior — the Hessian is analytic — and resample answers under the per-field reliability model from `c1_respondentAgreement`. Re-solve §5.4 per sample; each solve is cheap.

- **Practice inclusion probabilities.** "Deterministic CI enforcement — selected under 94% of plausible weightings. Worktree isolation — 41%." An adoption order for free, and no threshold to flip across. Given §2.1 this is the section carrying the product.
- **Harness acceptability plus a conformal set.** "OpenSpec 78%, BMAD 19%," and a set with a distribution-free marginal coverage guarantee. Replaces `insufficientSignal` and the 59.38% share it currently claims.
- **Exact contribution decomposition.** `U` is linear in the parameters, so per-axis contributions are exact. Exact Shapley over 14 axes is 16,384 subsets if fair credit across interacting axes is wanted — milliseconds, no sampling.
- **Counterfactuals.** "Below 31% non-roadmap share the harness flips to Spec Kit," from a bounded search the existing `boundarySweep()` already supports.
- **Derived cautions** per §5.6, with severity from the size of the gap rather than an authored constant.

---

## 6. Provenance tiers

For an audit-facing tool this is the organising discipline, not bookkeeping. Any reviewer can ask of any number: which tier does this belong to, and how was it set?

| Tier | Contents | Changes when the catalogue changes? | How it is set |
|---|---|---|---|
| **Authored** | capabilities, enforcement classes, costs, bundles, feasibility, evidence, prose, `requires` / `excludes` / `liftable` | Yes — this is the only tier that does | Per item, from a cited source |
| **Fitted** | `theta`, `lambda`, `mu`, `kappa`, `gamma` | No | Joint MLE with confidence intervals (§5.5) |
| **Cross-validated** | `(q, p)` ramp pairs, `tau`, `k` | No | Nested CV on a held-out split |

`kappa(advisory)` moving into the fitted tier is the most consequential line in this table. DESIGN.md §9.2's enforcement classes are the best idea in the current design, and the claim "advisory is worth roughly a third of a hard gate" becomes an estimate with an interval instead of an editorial assertion.

Today's `+4/+2/+2/+2/-2` belongs to no tier. That is the actual problem with it — not that the numbers are wrong, but that there is no procedure by which they could be shown to be wrong.

---

## 7. Instrument changes

Four questions need work. Three distinct diagnoses, and treating them uniformly would damage two good questions.

### 7.1 `q16_bottlenecks` — forced ranking to independent severity ratings

The highest-value single change available. Influence 23.44, reliability **0.46**.

Root cause is identifiable. It is a forced ranking of three from seven, and the rules read rank *cutoffs*: `overlay-b` fires on `test_fear` at `rankAtMost 2`, `overlay-d` on `ambiguous_or_shifting` at rank 1. DESIGN.md §14.1 states the consequence as a required test — "`test_fear` at rank 2 fires overlay B; at rank 3 does not." Rank 2 versus rank 3 is close to arbitrary for a respondent and a hard switch for the engine.

**Change.** Replace the three ordered `<select>`s with seven independent severity ratings: `none | minor | major | blocking`. Removes forced tradeoffs between unrelated bottlenecks, removes ordering artifacts, and feeds `d[i]` as a magnitude — which is what the demand vector wants. Forced-choice ranking is the correct instrument for the judge-side task in §8.2 and the wrong one for eliciting independent magnitudes here.

**Consequences.** `rankAtMost` and `rank` operators become unused by the shipped pack (retain in `expr.mjs` for other packs). URL encoding for `q16` changes from three ordered values to seven ratings; the content digest self-invalidates, which DESIGN.md §13 already handles. The bottleneck matrix (F6) gains severity, which improves it.

### 7.2 `q3_distribution` and `q21_ci_maturity` — behavioural anchors

Influence 16.56 at reliability 0.54, and 10.21 at 0.59. One shared root cause: **label-valued options where behavioural anchors belong.** Is a team with two engineers one timezone away `regional` or `global_timezones`? Is a team with contract tests but no runtime checks `tests_plus_static` or `contracts_runtime`?

**Change.** `q3` becomes hours of overlapping working day (`more_than_6 | 3_to_6 | fewer_than_3`). `q21` becomes a checklist of concrete CI artifacts from which the ordinal level is derived, the same pattern D17 already uses for `coverageLevel`. Same construct measured, less interpretive variance.

### 7.3 `q20_runtimes` — do not change the question

Reliability 0.37, the worst of any live field, and almost certainly an artifact of the persona pipeline rather than a defect. A real user knows their own toolchain with near-certainty; three synthetic respondents inferring it from prose that never states it will disagree.

**Change.** None to the question. Instead, `c1` must separate **determinability** from **agreement**: check whether the vignette prose contains the information at all, and compute agreement only on the subset where it does. Without that split, `c1` conflates question ambiguity with vignette underspecification for every field, and acting on the conflated number would degrade a good question.

### 7.4 `q12_quality_gates` and `q18_token_budget` — rewire, do not delete

Both look inert (0.18 and 0.12 combined base-plus-overlay influence) and both are well-motivated. They feed `base-4`'s split arm, and `base-4` resolves to 0.82% of the corpus. Reachability defect, not question defect. `q12` also carries the instrument's highest pairwise redundancy (2.92 bits against `q2_team`).

**Change.** Under §5.2, `q12` drives `verificationStrength` and `q18` drives `tokenBudget` and the `mu` cost term. Both become globally influential with no edit to the question text. Re-measure after S4 to confirm.

### 7.5 Honesty fixes

`q11_cycle_time` and `q4_tenure` sit at 0/0/0 influence but are not marked `reportOnly`, unlike `q1_domain`, `q13_branching`, and `q17_process_mismatch`. **Decision: mark both `reportOnly`.** Wiring them would invent an evidence-free split, which D19, D21, and SO6 already refuse. F10's `couldChangeResult` then treats them like the other report-only fields. Revisit only if later field evidence appears.

`q5_work_breakdown` needs two fixes. Its 0.91 reliability is scored with a **±10 tolerance** per the `toleranceNote` while categorical fields require exact match, so it is not comparable to the rest of the table and must carry the asterisk. Worse, ±10 is **wider than the ±5 brittleness band** `a4` measures around the `nonRoadmapShare >= 40` cliff, so the reliability metric is tolerant of exactly the variation the threshold is sensitive to. The `(q,p)` ramps absorb the cliff; the metric must stop hiding it. Separately, five percentages constrained to sum to 100 are **compositional data** on a simplex — the components are not independent, a log-ratio transform is the correct treatment, and the form should normalise approximate answers rather than hard-blocking on an exact sum.

### 7.6 Questions worth adding, gated on measured gain

Three axes in §5.2 have no question:

- **Concurrent workstreams**, distinct from headcount. C8 is about concurrent *workers*; `teamSize < 5` is a weak proxy and `partD` already flags that threshold as away from peak.
- **Session length / context-degradation pressure.** DESIGN.md §8.5 names this as GSD Core's entire value proposition and nothing asks about it.
- **Existing spec and doc debt.** OpenSpec's guidance is specifically about not bulk-converting stale documentation, which makes its presence a real signal.

Add with discipline. `q19`–`q21` were all design additions and two landed nearly inert on base and overlay. Each addition ships only if its measured expected information gain against the practice set clears a pre-registered floor.

**Not on this list: trimming the instrument for length.** With adaptive elicitation the effective question count falls out of the information-gain rule, so reliability per question matters far more than the total. Fix the questions before shortening the list.

---

## 8. Measurement changes

`QC-EXPERIMENT.md` is revised, not replaced. The protocol is sound; its targets are wrong.

### 8.1 Re-target the existing metrics

| Metric | Today | Change |
|---|---|---|
| `a2` influence | reported per output, only base consumed downstream | consume total influence in `c3` |
| `a3` mutual information | against base outcome label | against practice set and caution set as well |
| `c3_dangerQuadrant` | `base influence > 5` | `total influence > 5` — turns a false all-clear into the §2.3 worklist |
| `a2` sensitivity | one-at-a-time | Sobol first-order and total indices; OAT cannot see interactions, which is likely why `bmadHole` reads as unexplained rule competition |
| `c1` agreement | conflates ambiguity with underspecification | split determinability from agreement (§7.3) |
| `rq2a` coverage | non-zero **base** influence | non-zero influence on any output |

### 8.2 Extend the oracle

`judge.mjs` must emit practice-level and caution-level labels, or §5.5 has nothing to fit and §8.3 nothing to score.

- **`riskTags`** — already in the prompt and the schema, absent from the frozen `labels.json`. Re-running populates `b44`, which currently reports `precision: null`.
- **Best-worst practice sets** — show the judge four candidate practices for this team, ask which is most and which is least valuable. One such question implies five of the six pairwise comparisons among the four, which is far denser than a binary "does this overlay apply" sweep and yields scaled utilities rather than booleans.

Both re-run over the **frozen 100 vignettes**, so no persona regeneration is needed and judge labels are unaffected by the §7 instrument changes (judges read prose only). Respondent answers *do* need regeneration after §7 — 300 calls, not 600.

### 8.3 New metrics

Practice selection is **multi-label**, not multiclass. Metrics: subset accuracy, Hamming loss, micro-F1, **macro-F1**, per-practice precision and recall, and NDCG@k for the ranked presentation. Macro-F1 is mandatory alongside micro, because micro lets frequent practices hide total failure on rare ones — the multi-label form of the skew that already gives Superpowers 0.14%.

**The loss function determines the optimal predictor, and the optima differ.** Hamming loss is minimised by independent per-label thresholding; subset accuracy by the mode of the joint distribution; F-measure by neither. Since the report renders a list of cards and a reader does not care whether the sixth was also exactly right, **Hamming and macro-F1 are the targets and subset accuracy is reported but not optimised.** This choice is pre-registered because retrofitting it invalidates comparisons.

**Baselines**, mirroring `b5`'s design: prevalence (always emit the `k` most frequently-correct practices), per-practice majority, and best-single-question-per-practice stub. The prevalence baseline is genuinely hard to beat under skewed marginals, which makes it an honest bar rather than a formality.

### 8.4 Inference, not point estimates

- **Cluster bootstrap** at the vignette level for CIs on every accuracy and κ figure. The three judges per vignette are not independent.
- **McNemar's test** against the relevant baseline. RQ1's +14.61 pp against a 15 pp bar is a 0.39 pp shortfall that is almost certainly inside the interval; as it stands there is no way to tell failure from bad luck.
- **Single-judge-versus-majority accuracy** as the human-level ceiling. With Fleiss κ 0.5015 and 11/100 vignettes lacking consensus, agreement with the majority is bounded well below 1.0, and this number is not computed anywhere. It is the most important missing figure in the current report, because without it there is no way to know whether remaining error is model error or oracle noise.
- **Nested cross-validation** for `(q,p)`, `tau`, and `k`, with a genuinely untouched holdout. `partD`'s refusal to fit thresholds on n=89 is correct; a 30-parameter model with CV is the principled response.

### 8.5 Replace RQ1

If a near-constant harness is acceptable — and §2.1 argues it is — then "beat `constantOpenspec` by 15 pp on base top-1" measures something the design no longer wants to be true, and 47.19% becomes roughly the target rather than the floor.

**New pre-registered criteria**, to be fixed before S1 generates any label:

- **RQ1'** — practice-set macro-F1 exceeds the prevalence baseline by a margin whose 95% cluster-bootstrap CI excludes zero. This is the S4 cutover criterion.
- **RQ2'** — every non-`reportOnly` field has non-zero influence on at least one output, and the §2.3 danger quadrant is empty under the *total*-influence rule.
- **RQ3'** — caution precision and recall against judge `riskTags` both clear a floor, replacing `b44`'s current `null`.
- **RQ4'** — harness conformal sets achieve their nominal coverage on holdout.
- **RQ5'** — `G-STABILITY` (§9.3) passes for every framework in the catalogue.
- **RQ6'** — the fitted harness lands in the judge majority's top-3 at a rate no worse than the current engine's runner-up-credit accuracy, re-measured at T17. This is a sanity floor, not a base-accuracy target. A top-1 regression against today's engine is acceptable and is not an S4 stop (SO5).

Fix these before S1, because the pre-registration is what protects the result from post-hoc fitting.

---

## 9. Gates

### 9.1 G-PARITY (existing, retained then retired)

Current engine versus the frozen golden page over the 50k corpus, comparing `projectRec()`. Holds unchanged through S0–S2. **Deliberately broken at S3** by the instrument changes, then re-baselined: the golden is re-frozen to the pre-S3 build, and every mismatch must be attributable to `q16`, `q3`, or `q21` — verified with the existing `minimizeDiff()` rather than by inspection. Retired at S5 when the old scorer is removed, replaced by G-FIT and G-PRACTICE.

### 9.2 G-PRACTICE (new, from S1)

Practice-set and caution-set metrics against the extended oracle, on a held-out split, with cluster-bootstrap CIs. Fails if macro-F1 does not clear the prevalence baseline with a CI excluding zero (RQ1'). Harness top-1 is **reported, not gated**. The only harness assertion is RQ6': judge-majority top-3 inclusion no worse than the T17 runner-up-credit rate. A top-1 regression is not a fail.

### 9.3 G-STABILITY (new, from S2) — the pluggability theorem as a test

The direct executable form of S-G1, and the cheapest high-value gate in this document.

```
for each framework f in catalogue:
    remove f from the pack
    re-evaluate the full corpus
    assert: for every pair (g, h) of remaining frameworks,
            the sign of U(g) - U(h) is unchanged
    assert: no dangling reference anywhere in the pack
    assert: every practice with sources == [f] is also removed,
            and no other practice lost a source it needed
```

Under absolute-anchored value functions this must pass by construction; if it fails, a catalogue-relative normalisation has crept in somewhere. Note that inclusion *probabilities* legitimately shift when the candidate set changes — they must, since they sum to one — so the assertion is on ordering, not on probability values. Add the symmetric test for insertion using a synthetic eighth framework.

### 9.4 G-FIT (new, from S4)

Asserts on the fitted model, not on outputs: sign constraints hold (`theta, lambda, mu >= 0`), value functions are monotone, the optimum is reproducible from a cold start, holdout numbers are within the CI reported at fit time, and no parameter is a framework identity. The last assertion is structural and cheap: the fitted vector's index space must contain no `FrameworkId`.

### 9.5 Existing gates retained unchanged

`npm run validate` (schema and referential), `lint:structure` (hard-coded ids outside the allowlist — extended to cover `AxisId` and `PracticeId`), `?selftest`, and G-MARKDOWN snapshots.

---

## 10. Phasing

One dimension of change per phase, following the discipline of `archive/IMPLEMENTATION-PLAN.md` §1.1. Two properties hold at every boundary: **the page works**, and **the recommendation changes only where a phase says it does**.

| Phase | Changes | Holds constant | LLM spend |
|---|---|---|---|
| **S0** | measurement targets only | engine, pack, instrument | none |
| **S1** | the oracle's label surface | engine, pack, instrument | judges × 100 |
| **S2** | representation added in shadow | decisions, instrument | none |
| **S3** | the instrument | engine decisions beyond `q16`/`q3`/`q21` | respondents × 100 |
| **S4** | offline fit only, in `tools/` | the shipped page | none |
| **S5** | the scorer — cutover | instrument, report layout | none |
| **S6** | the report | the scorer | none |
| **S7** | elicitation order, new questions | everything else | validation only |

**Stopping points.** After **S1** you have a correctly targeted measurement apparatus and a labelled oracle for all three outputs; that alone converts §2's findings from inference into monitoring, and is worth shipping even if nothing follows. After **S4** you know whether the model beats the practice and caution baselines *before* touching `index.html`. If RQ1' or RQ6' fails, stop and diagnose rather than proceeding. A harness top-1 regression alone is not a stop (SO5).

---

## 11. Task list

IDs are stable. `[ ]` open, `[x]` done. Gate rows are checkpoints, not work.

### S0 — Re-target the measurement (no engine change, no LLM spend)

- [ ] **T1** `c3_dangerQuadrant`: switch the influence input from base to total (base + overlay + caution). Expect the four fields in §2.3 to appear; assert the count is non-zero so the check cannot silently re-empty.
- [ ] **T2** `a3`: compute mutual information against the practice set and the caution set alongside the base outcome. Report all three.
- [ ] **T3** `c1`: add a determinability pass — does the vignette prose contain what the field asks? Report agreement overall and on the determinable subset (§7.3).
- [ ] **T4** `c1`: label the ±10-tolerance fields explicitly in the output so `q5`'s 0.91 is not read against exact-match scores (§7.5).
- [ ] **T5** `rq2a`: change the coverage criterion from non-zero base influence to non-zero influence on any output.
- [ ] **T6** Add cluster bootstrap (resampling at the vignette level) as a shared utility in `tools/qc/lib.mjs`; wrap every reported accuracy and κ in a 95% CI.
- [ ] **T7** Add McNemar's test against the relevant baseline for every headline comparison.
- [ ] **T8** Compute single-judge-versus-majority accuracy as the oracle ceiling; report it next to engine accuracy everywhere the latter appears (§8.4).
- [ ] **T9** Replace `a2`'s OAT with Sobol first-order and total indices on the utility gap; retain OAT output for one release for comparison.
- [ ] **T10** Rewrite `QC-EXPERIMENT.md` §8 with RQ1'–RQ6' (§8.5). **Must land before S1.**
- [ ] **T11** Regenerate `qc-report.md` from the re-targeted analysis. Expect RQ1's verdict to become unstated rather than FAIL, since the criterion is withdrawn.
- [ ] **GATE** G-PARITY green and unchanged — S0 touches no engine code.

### S1 — Extend the oracle (reuses frozen vignettes)

- [ ] **T12** `judge.mjs`: re-run over the frozen 100 vignettes to populate `riskTags`, which the prompt and schema already support. Verify `b44` stops reporting `null`.
- [ ] **T13** `judge.mjs`: add a best-worst practice block — four candidate practices per question, most and least valuable, several sets per vignette. Shuffle presentation order per `(vignette, judgeIndex, setIndex)` as the framework order already is.
- [ ] **T14** Extend the `labels.json` data contract in `QC-EXPERIMENT.md` §9 for both new fields. Treat malformed best-worst responses as parse failures; do not backfill from presentation order.
- [ ] **T15** Implement the §8.3 multi-label metric suite: subset accuracy, Hamming, micro-F1, macro-F1, per-practice P/R, NDCG@k.
- [ ] **T16** Implement the three §8.3 baselines: prevalence, per-practice majority, best-single-question-per-practice.
- [ ] **T17** Score the *current* engine's overlays and cautions against the new labels. This is the number every later phase is measured against, and it is the first time it will exist.
- [ ] **GATE** G-PRACTICE established with a baseline reading for the current engine.

### S2 — Representation in shadow (no decision change)

- [ ] **T18** Author the 14 axes of §5.2 with `(q, p)` ramp pairs. Initial anchors from today's thresholds so shadow output starts close to current behaviour.
- [ ] **T19** Decompose the 7 overlays into practice nodes: `capability`, `enforcement`, `cost`, `sources`, `liftable`, `requires`, `excludes`.
- [ ] **T20** Harvest additional practices from each framework's documented workflow — the point of §1 goal 2. Include Tessl's `one-question-at-a-time` as `liftable: true` from a `watch` source (§5.1).
- [ ] **T21** Run capability-vector clustering over the practice catalogue to find near-duplicates (BMAD adversarial review versus Superpowers two-stage review). Resolve each to one node with multiple `sources`, or document why they are distinct.
- [ ] **T22** Declare `bundle: B[f]` per framework. Cross-check against today's `providedByBase` — any disagreement is a finding in one or the other.
- [ ] **T23** Extend pack schema and `tools/validate.mjs`: axis and practice referential integrity, capability keys ⊆ axis ids, `requires`/`excludes` acyclicity, every `sources` entry resolvable, `liftable: false` implies non-empty `sources`.
- [ ] **T24** Compute demand and coverage vectors in shadow alongside the live engine. Log both; decide with neither.
- [ ] **T25** Implement `G-STABILITY` (§9.3) against the shadow utility, including the synthetic-insertion case.
- [ ] **GATE** G-PARITY green (shadow is inert), G-STABILITY green, `validate` green.

### S3 — Instrument repair (deliberate parity break)

- [ ] **T26** `q16_bottlenecks`: forced ranking to seven independent severity ratings (§7.1). Update form rendering, URL encoding, and the bottleneck matrix to carry severity.
- [ ] **T27** `q3_distribution`: behavioural anchors on working-day overlap (§7.2).
- [ ] **T28** `q21_ci_maturity`: artifact checklist with a derived ordinal, following the `coverageLevel` pattern (§7.2).
- [ ] **T29** `q5_work_breakdown`: normalise approximate sums instead of hard-blocking on exactly 100; add the log-ratio treatment for rule consumption (§7.5).
- [ ] **T30** Mark `q11_cycle_time` and `q4_tenure` `reportOnly`. Do not wire them to an axis (§7.5, SO6).
- [ ] **T31** Re-run `respond.mjs` over the frozen vignettes for the new instrument — 300 calls. Judge labels are unaffected.
- [ ] **T32** Re-baseline the golden page. Every G-PARITY mismatch must be attributable to T26–T29 via `minimizeDiff()`; any unattributable diff is a bug.
- [ ] **T33** Re-measure `c1` reliability for the changed fields. `q16` should move materially off 0.46; if it does not, T26's design is wrong and should be revisited before S4.
- [ ] **GATE** G-PARITY re-established at the new baseline with an attributable diff set; `q16` reliability improved.

### S4 — Fit offline and decide (tools only, no page change)

- [ ] **T34** Build the feature map: `shortfall` and `overshoot` per axis, `kappa_eff` with the `gamma * backstop` complementarity term (§5.4).
- [ ] **T35** Implement the joint likelihood — Plackett-Luce over frameworks plus conditional logit over best-worst practice choices, shared `theta` (§5.5).
- [ ] **T36** Fit by sign-constrained convex optimisation (projected gradient or L-BFGS-B). Assert concavity empirically: multiple cold starts reach the same optimum.
- [ ] **T37** Set the prior mean from today's hand weights; cross-validate `tau`, the `(q,p)` pairs, and `k` by nested CV on a held-out split.
- [ ] **T38** Report holdout practice macro-F1 and Hamming against the three baselines; caution P/R against T17; harness top-1 and κ (reported, not gated); and harness-in-judge-top-3 versus the T17 runner-up-credit rate (RQ6'). All with cluster-bootstrap CIs and the oracle ceiling alongside.
- [ ] **T39** Identifiability check: flag coefficient pairs on redundant axes (`a3` pairwise), confirm ridge is shrinking rather than oscillating, and document which coefficients must not be read individually.
- [ ] **T40** Implement `G-FIT` (§9.4), including the structural assertion that no fitted index is a `FrameworkId`.
- [ ] **GATE — STOPPING POINT** RQ1' holds (practice macro-F1 beats the prevalence baseline with a CI excluding zero) and RQ6' holds (harness is in the judge majority's top-3 at a rate no worse than T17 runner-up credit). Harness top-1 may regress. **If RQ1' or RQ6' fails, stop and diagnose. Do not proceed to S5.**

### S5 — Engine cutover

- [ ] **T41** Implement the feasibility veto, replacing `runtimeMismatchPenalty` and `watchPenalty` (§5.3). Report exclusions as their own sentence.
- [ ] **T42** Implement `U(f, A)` and exact bundle enumeration with the §5.4 constraints. Assert the sub-50 ms budget (N3) on a mid-range profile.
- [ ] **T43** Implement derived cautions (§5.6). Map each existing C1–C15 to a generic condition; anything unmappable is either a missing condition or a caution that should not exist — resolve each explicitly.
- [ ] **T44** Convert C8 and C13 from cautions to constraints (§5.6).
- [ ] **T45** Delete `BASE_RULES`, `selectBaseWeighted`, `scoreSignals`, `confidenceOf`, `adoptWhen`/`ifUnavailable`, and `providedByBase`. Retire `settings.selection`, `confidence`, and the tier-zero penalties from the pack schema.
- [ ] **T46** Retire G-PARITY (§9.1). G-FIT, G-PRACTICE, and G-STABILITY are the regression net from here.
- [ ] **T47** Re-measure `a2` influence and confirm §7.4's prediction: `q12` and `q18` become materially influential without a question edit. If they do not, the axis wiring in T18 is wrong.
- [ ] **GATE** G-FIT, G-PRACTICE, G-STABILITY, `validate`, `lint:structure`, `?selftest` all green; N3 budget met.

### S6 — The report

- [ ] **T48** Laplace posterior over `theta` (analytic Hessian) plus the per-field reliability resampling model from `c1` (§5.7).
- [ ] **T49** Render per-practice inclusion probabilities in place of binary overlay cards, ordered by probability.
- [ ] **T50** Render harness acceptability shares plus a conformal set; remove the `insufficientSignal` presentation.
- [ ] **T51** Calibrate conformal coverage on holdout; assert nominal coverage is achieved (RQ4').
- [ ] **T52** Exact per-axis contribution decomposition, with exact Shapley over the 14 axes as the fair-credit view.
- [ ] **T53** Counterfactual explanations via bounded search, reusing `boundarySweep()` machinery.
- [ ] **T54** Update `toMarkdown` and the G-MARKDOWN golden snapshots.
- [ ] **T55** Accessibility pass on the new probability presentations — probability must not be carried by colour alone (DESIGN.md §12.4).
- [ ] **GATE** G-MARKDOWN re-baselined, Lighthouse accessibility ≥ 95, RQ4' met.

### S7 — Elicitation and additions (optional)

- [ ] **T56** Expected information gain per unanswered question, computed against the **full** output — base, practices, and cautions jointly. Targeting the base alone would rank six live questions worthless (§2.1).
- [ ] **T57** Adaptive question ordering with a value-of-information stopping rule; keep a "show all questions" escape.
- [ ] **T58** Trial the three §7.6 questions. Ship only those clearing the pre-registered information-gain floor.
- [ ] **T59** Re-derive `couldChangeResult` (F10) from information gain instead of the `requires` scan.

### Documentation

- [ ] **T60** Fold the shipped outcome into `DESIGN.md` as v0.6.0: rewrite §10 (decision logic), §7 (data model), §9.2 (enforcement now fitted); record superseded decisions D1, D3', D5, D11, D23, D24 with their replacements.
- [ ] **T61** Rewrite `AUTHORING.md` around the new loop — add a framework, harvest its practices, run `G-STABILITY`.
- [ ] **T62** Add a divergence-style table recording which V-numbered findings from DESIGN.md §11 this extension resolves structurally rather than by rule.
- [ ] **T63** Archive this file to `docs/archive/` once v0.6.0 ships, per the EXT-CONFIG precedent.

---

## 12. Open questions

| ID | Question | Blocking? |
|---|---|---|
| SO1 | Fourteen axes is a judgement. Should the vocabulary be derived by archetypal analysis on the 50k corpus first, or authored and then validated? | No — author from §5.2, validate at S4 |
| SO2 | Is `k = 5` the right bundle cap, or should it be demand-dependent? | No — cross-validate at S4 |
| SO3 | Should `gamma` (complementarity) be one global parameter or per-axis? | No — start global, test per-axis at S4 |
| SO4 | The oracle is a single model family per role. Does the shared-family bias in `qc-report.md`'s threats section get worse when judges also rate practices? | No — but widen the panel before any headline claim |
| SO5 | If S4's gate passes on practices but base accuracy regresses, is that acceptable given §2.1? | **Resolved — yes, with a sanity floor.** Harness top-1 is reported, not gated. S4 stops only if RQ1' fails or the harness falls out of the judge majority's top-3 more often than today's runner-up-credit rate (RQ6'). A near-constant OpenSpec harness is an acceptable byproduct; a harness the judges never ranked is not. |
| SO6 | Should `reportOnly` fields feed axes at all, given D19/D21's refusal to invent evidence-free splits? | **Resolved — no.** Keep them report-only. T30 marks `q11_cycle_time` and `q4_tenure` the same way. |

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Practice catalogue authoring is larger than estimated — T20 is the long pole | **High** | Medium | S2 is inert; the catalogue can grow across releases. Start with the 7 existing overlays decomposed, harvest incrementally. |
| The fit does not beat the current engine on practices | Medium | **High** | S4 is a stopping point *before* any page change. Prior centered on today's weights means the practice floor is roughly current overlay behaviour. Harness top-1 may regress (SO5). |
| Oracle noise ceiling is lower than current accuracy, making improvement unmeasurable | Medium | High | T8 computes the ceiling first. If the gap is small, widen the panel or accept that accuracy is not the lever and pursue calibration instead. |
| Instrument change invalidates cached respondent answers | **Certain** | Low | Bounded and known: 300 respondent calls at S3; judge labels unaffected. |
| Inclusion probabilities read as false precision by a regulated audience | Medium | Medium | Report CIs, not point probabilities; the conformal set carries the guarantee and the prose must say what it does and does not mean. |
| Axis vocabulary encodes the same editorial judgements as today's weights, just relocated | Medium | Medium | The §6 tier discipline makes relocation visible: capabilities are authored and cited, weights are fitted. SO1 tests the vocabulary itself. |
| Exhaustive enumeration outgrows the N3 budget as the catalogue grows | Low | Medium | T42 asserts the budget in CI. Submodular greedy and the QUBO formulation are the documented fallbacks past ~30 practices. |
