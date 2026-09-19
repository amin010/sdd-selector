# SDD Selector — QC Experiment Results

| Field | Value |
|---|---|
| Protocol | [docs/QC-EXPERIMENT.md](QC-EXPERIMENT.md) (pre-registered — read that document for definitions, thresholds, and the exact §8 pass/fail criteria applied below) |
| Dataset | **terra/sol**, 2026-09-17. Vignettes and respondent fills: `gpt-5.6-terra`. Judges: `gpt-5.6-sol`. 100 vignettes, 300/300 answers/labels under `tools/qc/data/`. |
| Scoring | **Same oracle, new engine.** Judges and respondents were generated against the pre-0.5 pack. This file reports `qc:sensitivity` + `qc:analyze` re-run after pack **0.5.1** (weighted selection with live `when` gates, Spec Kitty as `base-6`, empty `runtimes` no longer a scoring exemption). No `qc:generate` / `qc:judge`. |
| Generated from | `tools/qc/data/analysis-report.json` + `tools/qc/data/sensitivity-report.json` (re-score) |
| Vignettes / answers / labels | 100 / 300 / 300 |

## 0. Read this first: this is a re-score, not a new panel

The terra/sol panel is a completed real run (vignette generation, three respondents, three judges). Re-running `npm run qc:analyze` against the committed `tools/qc/data/{vignettes,answers,labels}.json` is deterministic and spends no LLM tokens. What changed since those labels were written is the **engine/pack**, not the questionnaire instrument and not the judge panel.

**Do not read this as evidence that the 21 questions were redesigned.** They were not. Pack 0.5.1 is three targeted rule/engine fixes: (1) weighted selection skips a base rule whose `when` gate fails (D23); (2) Spec Kitty is a selectable base; (3) empty `runtimes` is no longer a scoring exemption (D24). Overlay/caution questions are out of scope.

Scoring is against [QC-EXPERIMENT.md §8](QC-EXPERIMENT.md#8-pre-registered-pass-fail-criteria)'s pre-registered pass/fail criteria.

### 0.1 Before / after (0.4.1 vs 0.5.1, same labels + same corpus)

Part A is the 50,332-case seeded corpus (`tools/corpus.mjs`). Part B “before” is the 0.4.1-era first-match engine on this same terra/sol `answers.json` / `labels.json`. The intermediate 0.5.0 weighted path (gates ignored) is also shown because that is what 0.5.1 repaired.

| Metric | Pack 0.4.1 | Weighted, gates dead (0.5.0) | Pack 0.5.1 |
|---|---:|---:|---:|
| Engine top-1 accuracy (89 consensus vignettes) | 37.08% | 53.93% | **61.80% (55/89)** |
| Cohen's κ vs judge majority | 0.0341 | 0.3659 | **0.4459** |
| Beats constant-`openspec` by | −10.11 pp | +6.74 pp | **+14.61 pp** |
| False-gate winners (rule `when` is false) | n/a (first-match) | 31/89 (34.8%) | **0/89** |
| Corpus `speckitty` | 0% (unreachable) | 0% (unreachable) | **4.94%** |
| Label-reachability ceiling | 84.27% | 84.27% | **100%** |

Closing the dead-gate defect and making Spec Kitty selectable moved κ across the 0.40 bar and recovered the 14 judge-majority `speckitty` vignettes as a reachable label. RQ1 still fails criterion (b) — the engine is 14.61 pp above constant-`openspec`, 0.39 pp short of the pre-registered 15 pp margin.

---

## 1. Headline finding

**The engine now beats both required comparators except the 15 pp constant-openspec margin.** Scored against 89 vignettes with a usable independent-judge consensus:

| Predictor | Top-1 accuracy |
|---|---:|
| Always guess `openspec` (constant baseline) | 47.19% |
| Single-question stub: `q5.roadmap ≥ 60 → speckit, else → openspec` | 53.93% |
| **The engine's actual recommendation (0.5.1)** | **61.80%** |

Cohen's kappa between the engine and the judge-majority label is **0.4459** — above the pre-registered 0.40 bar. Two of three RQ1 sub-criteria pass; the 15 pp-over-constant bar does not (14.61 pp). RQ2 now passes all three sub-criteria.

---

## 2. RQ1 — does the engine agree with independent judgment?

### 2.1 Oracle validity

**Inter-judge Fleiss' kappa = 0.5015** across all 100 vignettes, 3 `gpt-5.6-sol` judges, over the 7-framework category space (P̄ = 0.6433 observed agreement, P̄ₑ = 0.2845 chance-expected agreement). Per §8 (≥0.40 → usable), **verdict USABLE**. These accuracy numbers are about the engine, not an unusable oracle.

This kappa is a property of the frozen labels, not of pack 0.5.1.

### 2.2 Engine vs. majority judge label

Of the 100 vignettes, 89 had a 2-of-3 or 3-of-3 judge majority (11 had all three judges pick different frameworks; excluded from accuracy/kappa, per protocol).

- **Top-1 accuracy: 0.6180** (55/89 matches)
- **Cohen's κ: 0.4459** (Pₒ = 0.6180)
- **Per-respondent accuracy:** respondent 0 → 0.6292, respondent 1 → 0.6067, respondent 2 → 0.6404

**Confusion matrix (rows = engine, cols = judge majority):**

| engine ＼ judge | openspec | speckit | bmad | superpowers | gsd | speckitty |
|---|---:|---:|---:|---:|---:|---:|
| **openspec** | 27 | 0 | 8 | 0 | 0 | 3 |
| **speckit** | 0 | 2 | 0 | 0 | 0 | 0 |
| **bmad** | 4 | 0 | 17 | 0 | 0 | 2 |
| **superpowers** | 1 | 0 | 0 | 0 | 0 | 0 |
| **gsd** | 6 | 0 | 0 | 0 | 0 | 0 |
| **speckitty** | 4 | 4 | 1 | 0 | 0 | 9 |

Judges' majority distribution on the 89 is `openspec` 42, `bmad` 26, `speckitty` 14, `speckit` 7. The engine now emits `speckitty` 18 times and matches 9 of those 14 gold labels. Residual errors are mostly OpenSpec↔BMAD swaps and GSD over-firing on OpenSpec-gold compact teams.

### 2.3 Runner-up credit

Scoring a match if *either* the engine's base *or* its reported runner-up equals the judge-majority label: **0.7528** (+12 matches vs base-only).

### 2.4 Headroom (new, tracked in `analyze.mjs`)

| Bound | Accuracy |
|---|---:|
| All-3-agree-and-right (floor) | 56.18% (50/89) |
| Mode-of-3 (shipped scoring) | 61.80% (55/89) |
| Best-of-3 (optimistic elicitation) | 69.66% (62/89) |
| Label-reachability ceiling | **100%** (0 unreachable gold labels) |
| Elicitation headroom (best-of-3 − mode) | 7.87 pp |
| False-gate winners | **0 / 89** |

Spec Kitty being selectable removed the 15.7% structural ceiling. The remaining gap to the judges is rule precision, not catalog reachability or a dead `when` gate.

### 2.5 Caution precision/recall

Frozen labels have no `riskTags`. Precision/recall are not scored (no keyword fallback).

### 2.6 Baselines and final verdict

| Baseline | Accuracy | Method |
|---|---:|---|
| Constant-`openspec` | 0.4719 | Always predict `openspec` |
| Prior-weighted random (analytic) | 0.3390 | Σ(empirical label proportion)² |
| Best single-question stub | 0.5393 (48/89) | `q5.roadmap ≥ 60 → speckit, else → openspec` |
| **Engine** | **0.6180** | pack 0.5.1 recommendation |

| # | Criterion | Result |
|---|---|---|
| (a) | Cohen's κ ≥ 0.40 | **PASS** — 0.4459 |
| (b) | Top-1 accuracy beats constant-`openspec` by ≥ 15 pp | **FAIL** — +14.61 pp |
| (c) | Top-1 accuracy beats the best single-question stub | **PASS** — 0.6180 > 0.5393 |

**Verdict: RQ1 — FAIL**, on criterion (b) only, and narrowly.

---

## 3. RQ2 — does the 21-question instrument actually discriminate, and is it reliable?

### 3.1 Part A — offline discrimination (corpus; no LLM)

**A1. Outcome distribution + remaining BMAD hole:**

| Outcome | Count | % |
|---|---:|---:|
| insufficient_signal | 29,886 | 59.38% |
| openspec | 13,096 | 26.02% |
| bmad | 4,158 | 8.26% |
| speckitty | 2,485 | 4.94% |
| gsd | 344 | 0.68% |
| speckit | 294 | 0.58% |
| superpowers | 69 | 0.14% |
| tessl | 0 | 0.00% |

Weighted scoring with live gates no longer dumps unmatched mass onto `fallback_openspec`; it reports `insufficient_signal` instead. Combined OpenSpec (rule-1 only; fallback is unused in weighted mode) is 26.02% of the corpus. Of 3,174 cases where base-3's predicate matched, **334 (10.5%) still did not resolve to `bmad`** — a later-or-higher-scoring eligible rule won, not the old Q20 deletion bug.

**A2. Per-question base influence** (OAT on 2,000 profiles):

| Field | Base influence | MI(field, outcome) bits |
|---|---:|---:|
| q7_requirements | 18.44% | 0.2663 |
| q5_work_breakdown | 13.10% | 1.3034 |
| q9_precision | 10.92% | 0.1898 |
| q2_team | 6.02% | 1.1275 |
| q10_architecture | 1.59% | — |
| q20_runtimes | 0.38% | 0.3714 |

`q20_runtimes` dropped from the danger quadrant: live gates plus documented BMAD/Tessl runtimes mean answering Q20 no longer deletes or silently boosts a base. `q9_precision` is now a real base mover because it gates Spec Kitty.

**A4. Threshold brittleness:** 5.63% of the corpus sits within ±5 points of `nonRoadmapShare≥40`, 6.62% within ±5 of `q5.roadmap≥60`, 8.01% within ±1 person of `teamSize<5`.

**RQ2(a):** **12 of 18 non-report-only questions (66.7%) have non-zero base influence**, above the 60% bar.

### 3.2 Part C — instrument reliability (frozen terra respondents)

**C1.** Lowest agreement is unchanged (property of the frozen answers): `q17_process_mismatch` 0.00, `q20_runtimes` 0.37, `q12_quality_gates` 0.39, `q16_bottlenecks` 0.46.

**C2. Recommendation stability: 0.82** (82/100). Passes ≥0.70.

**C3. Danger quadrant:** empty. `q20_runtimes` influence is 0.38% (below the 5% cutoff).

### 3.3 Final RQ2 verdict

| # | Criterion | Result |
|---|---|---|
| (a) | ≥ 60% of non-`reportOnly` questions have non-zero base influence | **PASS** — 66.7% (12/18) |
| (b) | No question lands in the danger quadrant | **PASS** — empty |
| (c) | Recommendation stability ≥ 0.70 | **PASS** — 0.82 |

**Verdict: RQ2 — PASS.**

---

## 4. Part D — threshold calibration sweep

Against the terra/sol judge labels:

| Threshold | Shipped | κ at shipped | Peak value | Peak κ | Verdict |
|---|---:|---:|---:|---:|---|
| `nonRoadmapShare ≥ 40` | 40 | 0.4459 | 35 | 0.4459 | NEAR_PEAK (Δ 0) |
| `q5.roadmap ≥ 60` | 60 | 0.4459 | 45 | 0.4459 | NEAR_PEAK (Δ 0) |
| `teamSize < 5` | 5 | 0.4459 | 4 | 0.4787 | AWAY_FROM_PEAK (Δ 0.0328) |

`teamSize < 5` is the one cliff whose peak is away from the shipped value. That is a Part D finding, not a license to retune against this panel (see the 0.5.1 guardrail: do not fit signal weights or thresholds to n=89 without a holdout).

---

## 5. Interpretation

- **D23 closed the dead-gate defect.** Zero consensus vignettes now resolve via a rule whose own `when` is false. That was 31/89 (24 of them wrong) on the 0.5.0 weighted path.
- **Spec Kitty is reachable.** Corpus share 4.94%; panel matches 9 of 14 judge-majority `speckitty` labels. The structural 84% ceiling is gone.
- **Empty-`runtimes` scoring exemption is gone.** BMAD and Tessl document `claude_code`. The candidate filter still treats an empty list as unrestricted (0.4.1); the score no longer rewards omitted evidence.
- **RQ1 is close and still a fail.** κ and the stub comparison pass. The 15 pp-over-constant bar is missed by 0.39 pp. Residual errors are OpenSpec↔BMAD and GSD-on-OpenSpec, not catalog holes.
- **RQ2 passes.** Influence coverage, empty danger quadrant, and stability all clear their pre-registered bars. The questionnaire was not rewritten.

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
