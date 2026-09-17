# SDD Selector — QC Experiment Results

| Field | Value |
|---|---|
| Protocol | [docs/QC-EXPERIMENT.md](QC-EXPERIMENT.md) (pre-registered — read that document for definitions, thresholds, and the exact §8 pass/fail criteria applied below) |
| Dataset | **terra/sol**, 2026-09-17. Vignettes and respondent fills: `gpt-5.6-terra`. Judges: `gpt-5.6-sol`. 100 vignettes, 300/300 answers/labels under `tools/qc/data/`. |
| Scoring | **Same oracle, new engine.** Judges and respondents were generated against the **old** pack (empty BMAD `runtimes`, base-1 architecture arm). This file reports `qc:sensitivity` + `qc:analyze` re-run after pack **0.4.1** (empty `runtimes` = unrestricted; base-1 is `nonRoadmapShare ≥ 40` only). No `qc:generate` / `qc:judge`. |
| Generated from | `tools/qc/data/analysis-report.json` + `tools/qc/data/sensitivity-report.json` (re-score) |
| Vignettes / answers / labels | 100 / 300 / 300 |

## 0. Read this first: this is a re-score, not a new panel

The terra/sol panel is a completed real run (vignette generation, three respondents, three judges). Re-running `npm run qc:analyze` against the committed `tools/qc/data/{vignettes,answers,labels}.json` is deterministic and spends no LLM tokens. What changed since those labels were written is the **engine/pack**, not the questionnaire instrument and not the judge panel.

**Do not read this as evidence that Q18–Q21 or the eight overlay-only questions were redesigned.** They were not. Pack 0.4.1 is two targeted fixes: Tier 0 empty-`runtimes` semantics, and dropping base-1's architecture-only arm. Overlay/caution questions are out of scope.

Scoring is against [QC-EXPERIMENT.md §8](QC-EXPERIMENT.md#8-pre-registered-pass-fail-criteria)'s pre-registered pass/fail criteria.

### 0.1 Before / after (old pack vs 0.4.1, same labels + same corpus)

Part A is the 50,331-case seeded corpus (`tools/corpus.mjs`; one extra documented fixture vs the previous 50,330 dump). Part B “before” is the old engine re-evaluated on this same terra/sol `answers.json` / `labels.json` (not the earlier `gpt-4.1-mini` panel).

| Metric | Old pack | Pack 0.4.1 |
|---|---:|---:|
| Engine top-1 accuracy (89 consensus vignettes) | 35.96% (32/89) | **37.08% (33/89)** |
| Cohen's κ vs judge majority | 0.0267 | **0.0341** |
| Engine OpenSpec share on that panel (fallback folded in) | 71.91% | 71.91% |
| Engine `bmad` count on that panel | 0 | 2 |
| Corpus OpenSpec (rule-1 + fallback) | 91.00% | **86.78%** |
| Corpus rule-1 `openspec` / `fallback_openspec` | 48.10% / 42.90% | 28.25% / 58.53% |
| Corpus `bmad` | 0.88% | **5.83%** |
| BMAD hole (base-3 matched ∧ Q20 answered, final ≠ `bmad`) | 100% of 3,196 | **33.3% of 3,197** (2.12% of corpus) |

The pack fix closed the Q20 reachability bug and let BMAD occupy ~6% of the random corpus. It did **not** move RQ1: accuracy gained one vignette, kappa is still ~0.03, and OpenSpec (including fallback) still dominates the panel. Dropping the architecture arm mostly reclassified rule-1 OpenSpec hits as `fallback_openspec` rather than routing them to other bases.

---

## 1. Headline finding

**The engine still loses to trivial baselines on this panel.** Scored against 89 vignettes with a usable independent-judge consensus:

| Predictor | Top-1 accuracy |
|---|---:|
| Always guess `openspec` (constant baseline) | **47.19%** |
| Single-question stub: `q5.roadmap ≥ 60 → speckit, else → openspec` | **53.93%** |
| **The engine's actual recommendation (0.4.1)** | **37.08%** |

The engine is **beaten by both comparators §8 requires it to beat**: 10.11 percentage points *worse* than always answering "openspec", and it loses to a rule that looks at one numeric field. Cohen's kappa between the engine and the judge-majority label is **0.0341** — essentially chance (0 = chance, 1 = perfect), far short of the pre-registered 0.40 bar. All three of §8's RQ1 pass sub-criteria fail (§3 below).

Closing the BMAD/Q20 hole was necessary (the old engine recommended `bmad` on **zero** of these 89 vignettes). It was not sufficient: judges still pick `bmad` 26 times and `speckitty` 14 times (not a selectable base), while the engine remains an OpenSpec machine with a thin speckit/bmad tail.

---

## 2. RQ1 — does the engine agree with independent judgment?

### 2.1 Oracle validity

**Inter-judge Fleiss' kappa = 0.5015** across all 100 vignettes, 3 `gpt-5.6-sol` judges, over the 7-framework category space (P̄ = 0.6433 observed agreement, P̄ₑ = 0.2845 chance-expected agreement). Per §8 (≥0.40 → usable), **verdict USABLE**. These accuracy numbers are about the engine, not an unusable oracle.

This kappa is a property of the frozen labels, not of pack 0.4.1.

### 2.2 Engine vs. majority judge label

Of the 100 vignettes, 89 had a 2-of-3 or 3-of-3 judge majority (11 had all three judges pick different frameworks; excluded from accuracy/kappa, per protocol).

- **Top-1 accuracy: 0.3708** (33/89 matches)
- **Cohen's κ: 0.0341** (Pₒ = 0.3708, Pₑ = 0.3486)
- **Per-respondent accuracy:** respondent 0 → 0.3483, respondent 1 → 0.4045, respondent 2 → 0.3596

**Confusion matrix (rows = engine, cols = judge majority, 5 reachable bases only):**

| engine ＼ judge | openspec | speckit | bmad | superpowers | gsd |
|---|---:|---:|---:|---:|---:|
| **openspec** | 30 | 5 | 22 | 0 | 0 |
| **speckit** | 0 | 2 | 0 | 0 | 0 |
| **bmad** | 0 | 0 | 1 | 0 | 0 |
| **superpowers** | 0 | 0 | 0 | 0 | 0 |
| **gsd** | 0 | 0 | 0 | 0 | 0 |

The 5×5 omits engine `no_runtime_match` (20 of 89; always a miss) and judge `speckitty` (14 of 89; not a selectable base). After the fix the engine recommends `bmad` twice in the full reconciled space (one of those two matches the judge majority). Judges' majority distribution on the 89 is `openspec` 42, `bmad` 26, `speckitty` 14, `speckit` 7.

### 2.3 Runner-up credit

Scoring a match if *either* the engine's base *or* its reported runner-up equals the judge-majority label: **0.5618** (+17 matches vs base-only). Runner-up now recovers some OpenSpec-vs-bmad misses that first-match-wins still awards to OpenSpec when `nonRoadmapShare ≥ 40`. That is credit for the *report*, not a pass on RQ1, which scores the base.

### 2.4 Caution precision/recall

Keyword heuristic in `tools/qc/analyze.mjs`: **precision 0.1795, recall 0.1067** (tp=35, fp=160, fn=293). Directional only.

### 2.5 Baselines and final verdict

| Baseline | Accuracy | Method |
|---|---:|---|
| Constant-`openspec` | 0.4719 | Always predict `openspec` |
| Prior-weighted random (analytic) | 0.3390 | Σ(empirical label proportion)² |
| Best single-question stub | 0.5393 (48/89) | `q5.roadmap ≥ 60 → speckit, else → openspec` |
| Runner-up stubs considered | 0.4719 (`q10==microservices→speckit`), 0.3708 (`q7 ∈ {high_level,vague}→bmad`), 0.2360 (`teamSize<5→superpowers`), 0.1798 (`q11 cadence→superpowers`) | |
| **Engine** | **0.3708** | pack 0.4.1 recommendation |

| # | Criterion | Result |
|---|---|---|
| (a) | Cohen's κ ≥ 0.40 | **FAIL** — 0.0341 |
| (b) | Top-1 accuracy beats constant-`openspec` by ≥ 15 pp | **FAIL** — 10.11 pp *worse* |
| (c) | Top-1 accuracy beats the best single-question stub | **FAIL** — 0.3708 < 0.5393 |

**Verdict: RQ1 — FAIL, on all three sub-criteria.**

---

## 3. RQ2 — does the 21-question instrument actually discriminate, and is it reliable?

### 3.1 Part A — offline discrimination (corpus; no LLM)

**A1. Outcome distribution + remaining BMAD hole:**

| Outcome | Count | % |
|---|---:|---:|
| fallback_openspec | 29,457 | 58.53% |
| openspec | 14,219 | 28.25% |
| no_runtime_match | 3,214 | 6.39% |
| bmad | 2,936 | 5.83% |
| speckit | 248 | 0.49% |
| gsd | 215 | 0.43% |
| superpowers | 42 | 0.08% |

OpenSpec + fallback is still **86.78%** of the corpus (was ~91%). Of 27,969 cases with `q20_runtimes` answered, base-3's predicate matched in 3,197 — **1,066 (33.3%) still did not resolve to `bmad`**. That remainder is first-match-wins: base-1 (`nonRoadmapShare ≥ 40`) still preempts base-3. It is no longer the old “answering Q20 deletes BMAD from the candidate set” bug.

**A2. Per-question base influence** (OAT on 2,000 profiles; five predicted rule-inert fields still at 0%):

| Field | Base influence | MI(field, outcome) bits |
|---|---:|---:|
| q20_runtimes | 22.85% | 0.5360 |
| q5_work_breakdown | 14.40% | 1.2478 |
| q7_requirements | 8.93% | 0.1368 |
| q2_team | 4.55% | 1.0993 |
| q14_release_autonomy | 0.72% | 0.0638 |
| q10_architecture | 0.71% | — |

`q10_architecture` collapsed from ~40% base influence to 0.71% after dropping the architecture-only arm; it still drives overlay E. `q20_runtimes` remains the largest OAT mover because Tier 0 can still empty the documented-runtime set (`no_runtime_match`).

**A4. Threshold brittleness:** 5.58% of the corpus sits within ±5 points of `nonRoadmapShare≥40`, 6.57% within ±5 of `q5.roadmap≥60`, 8.26% within ±1 person of `teamSize<5`.

**RQ2(a):** **10 of 18 non-report-only questions (55.6%) have non-zero base influence**, below the 60% bar. The eight zero-influence, non-report-only fields are still `q3_distribution`, `q4_domain_familiarity`, `q8_compliance`, `q9_precision`, `q15_governance`, `q16_bottlenecks`, `q19_change_volume`, `q21_ci_maturity` — overlay/caution questions, **not redesigned in this change**.

### 3.2 Part C — instrument reliability (frozen terra respondents)

**C1. Per-field respondent agreement** (3 `gpt-5.6-terra` respondents, n=100). Lowest:

| Field | Agreement |
|---|---:|
| q17_process_mismatch | 0.00 (`reportOnly` free-text) |
| q20_runtimes | 0.37 |
| q12_quality_gates | 0.39 |
| q16_bottlenecks | 0.46 |
| q3_distribution | 0.54 |
| q21_ci_maturity | 0.59 |

Highest: `q1_domain` and `q11_deploy_cadence` (0.96), `q4_tenure` and `q9_precision` (0.92), `q5_work_breakdown` (0.91). These C1 figures are properties of the frozen answers, not of pack 0.4.1.

**C2. Recommendation stability: 0.77** (77/100 — all 3 respondents' raw outcome label identical). Passes ≥0.70. Lower than a previous panel's 0.88 because more bases are now reachable, so respondent disagreement on Q20/Q5/Q2 more often changes the label.

**C3. Danger quadrant** (base-influence > 5% AND agreement < 0.60): **`q20_runtimes`** (22.85% influence, 0.37 agreement). Fails the empty-quadrant criterion. High Q20 influence is Tier 0; low agreement is this panel's respondents. The pack fix did not add Q20 to the instrument.

### 3.3 Final RQ2 verdict

| # | Criterion | Result |
|---|---|---|
| (a) | ≥ 60% of non-`reportOnly` questions have non-zero base influence | **FAIL** — 55.6% (10/18) |
| (b) | No question lands in the danger quadrant | **FAIL** — `q20_runtimes` |
| (c) | Recommendation stability ≥ 0.70 | **PASS** — 0.77 |

**Verdict: RQ2 — FAIL**, on (a) and (b).

---

## 4. Part D — threshold calibration sweep

Against the terra/sol judge labels:

| Threshold | Shipped | κ at shipped | Peak value | Peak κ | Verdict |
|---|---:|---:|---:|---:|---|
| `nonRoadmapShare ≥ 40` | 40 | 0.0341 | 40 | 0.0341 | AT_PEAK |
| `q5.roadmap ≥ 60` | 60 | 0.0341 | 45 | 0.0341 | NEAR_PEAK (Δ 0) |
| `teamSize < 5` | 5 | 0.0341 | 7 | 0.0419 | NEAR_PEAK (Δ 0.0078) |

The kappa surface is low everywhere (~0.025–0.042). Threshold placement is not the RQ1 failure.

---

## 5. Interpretation

- **The Q20/BMAD hole is closed as a reachability bug.** Empty `runtimes` now means unrestricted; answering Q20 no longer deletes BMAD. Corpus `bmad` went 0.88% → 5.83%. The leftover 33% “hole” among base-3-matched ∩ Q20-answered cases is D1 first-match-wins (brownfield OpenSpec still beats BMAD).
- **OpenSpec over-firing is only partly fixed.** Specific rules can fire on monolith/hybrid/batch when non-roadmap load is low. Source order was kept (D1). Most of the old architecture-arm mass became `fallback_openspec`, not Spec Kit / BMAD / compact-team. Combined OpenSpec share is still ~87% of the corpus and ~72% of the panel.
- **RQ1 still fails on this oracle.** One extra accuracy match vs the old engine on the same 89 vignettes. Judges still want BMAD and Spec Kitty far more than the engine can emit. Spec Kitty is not a selectable base; that alone caps agreement.
- **The eight overlay-only questions were not in scope.** They still cannot move the base. RQ2(a) is unchanged at 10/18.

[QC-EXPERIMENT.md §10](QC-EXPERIMENT.md#10-known-threats-to-validity) still applies: vignettes and respondents share a model family (`gpt-5.6-terra`); judges are `gpt-5.6-sol`. n=100 is small. A re-score cannot validate vignette realism.

---

## 6. Reproduction

```bash
# Re-analyze the already-committed terra/sol data with the current engine
# (deterministic, offline, no API calls):
npm run qc:sensitivity
npm run qc:analyze

# Do NOT regenerate the panel unless you intend to spend tokens and replace
# the frozen vignettes/answers/labels:
# npm run qc:generate && npm run qc:judge && npm run qc:analyze
```

`npm run qc:analyze` reads `tools/qc/data/{vignettes,answers,labels}.json` plus the built engine. It does not call an LLM. `qc:generate` / `qc:judge` are disk-cached under `tools/qc/cache/`; re-running them without deleting the cache reuses the terra/sol responses.
