# SDD Selector — QC Experiment Results

| Field | Value |
|---|---|
| Protocol | [docs/QC-EXPERIMENT.md](QC-EXPERIMENT.md) (historical RQ1 retained; EXT-SELECT replacements in §8.1) |
| Dataset | **terra/sol**, 2026-09-17. Frozen vignettes and judges. Answers remapped onto the v0.6.0 instrument (q16 severities, q3 overlap hours, q21 checklist) without a new respondent panel. |
| Scoring | Pack **0.6.0** utility engine. `qc:sensitivity --quick` (1,500 random + 80 OAT profiles) + `qc:analyze`. No new LLM spend. |
| Generated from | `tools/qc/data/analysis-report.json` + `tools/qc/data/sensitivity-report.json` |
| Vignettes / answers / labels | 100 / 300 / 300 |

## 0. Read this first

This is a **re-score of frozen labels** on the EXT-SELECT utility engine, not a new judge panel. RQ1 (beat constant-OpenSpec by 15 pp on harness top-1) is **withdrawn**. Harness top-1 is reported, not gated (SO5). Practice-set RQ1' cannot be scored: frozen `labels.json` has no `bestWorst` or `riskTags` (T12/T13 re-run pending).

Respondent answers were **shape-migrated** onto the repaired instrument. `c1` reliability for q16/q3/q21 is therefore still the old-panel figure and must not be read as a T33 result.

Sensitivity A1/A2 use the `--quick` sample (utility enumeration is too expensive for a 50k×OAT CI run). Full-corpus figures need `node tools/qc/sensitivity.mjs` without `--quick`.

---

## 1. Headline

**The practice engine ships. The frozen harness oracle is no longer the optimisation target.**

| Predictor | Top-1 vs judge majority (89 consensus) |
|---|---:|
| Always guess `openspec` | 47.19% |
| Best single-question stub | 53.93% |
| **Utility engine (0.6.0)** | **20.22%** (18/89) |
| Cluster-bootstrap 95% CI | 12.4–28.1% |
| Oracle ceiling (single-judge vs majority) | **86.14%** |
| Harness in judge majority top-3 (RQ6') | **70.79%** (63/89) |
| Pre-cutover runner-up credit (0.5.1 T17 proxy) | 75.28% |

Cohen's κ vs majority is **0.0533**. McNemar vs constant-OpenSpec: χ² = 13.23 (the engine is *worse* on top-1, as SO5 allowed). RQ1 verdict is **UNSTATED**.

RQ6' (70.79%) is just under the 75.28% T17 runner-up-credit floor. That is a **diagnose-before-celebrating** finding, not a silent pass. The prior-centered `theta` has not been fitted (no best-worst labels).

---

## 2. Harness distribution (quick corpus, n=1,832)

| Outcome | Share |
|---|---:|
| speckitty | 55.62% |
| openspec | 42.19% |
| no_runtime_match | 1.42% |
| gsd | 0.49% |
| superpowers | 0.16% |
| speckit | 0.11% |
| bmad / tessl / insufficient_signal | 0% |

`insufficient_signal` is gone (was 59.38% under weighted scoring). Tessl stays vetoed. BMAD never wins as a harness on this prior — role-separation demand is not enough to beat Spec Kitty / OpenSpec native bundles. That is a prior-weight finding, not a catalogue bug.

---

## 3. RQ2' / danger quadrant (total influence)

`c3` now uses **total** influence (base + overlay + caution) > 5 and agreement < 0.60. The quadrant is **non-empty** (T1 working as designed):

| Field | Total influence | Agreement |
|---|---:|---:|
| `q21_ci_maturity` | 30.00 | 0.59 |
| `q12_quality_gates` | 20.21 | 0.39 |
| `q20_runtimes` | 15.83 | 0.37 |
| `q16_bottlenecks` | 14.08 | 0.46 |
| `q3_distribution` | 10.20 | 0.54 |

Legacy RQ2 (empty danger quadrant) **FAIL**s — expected after the retarget. RQ2(a) coverage (any-output influence) is **18/18 non-inert fields with a defined score; fraction 1.00** on the fields that have pairs. Recommendation stability (C2) is **0.75**.

T47 check: `q12_quality_gates` overlay influence **19.17**; `q18_token_budget` caution influence **45.42**. Both are globally influential without a question-text edit.

---

## 4. Practice and caution metrics (G-PRACTICE)

Frozen labels have **no `bestWorst` and no `riskTags`**. `b44` precision/recall stay `null` (no keyword fallback). `gPractice` records engine overlay prevalence only.

Most frequent recommended practices on the 100 vignettes (respondent 0): `delta-only-specs`, `low-ceremony-fast-path`, `deterministic-ci`, `lane-worktrees` (when teamSize ≥ 3), `tdd-iron-law`.

---

## 5. Conformal coverage (RQ4')

Judge-majority harness ∈ conformal set: **59.55%** (53/89) vs nominal 80% (`conformalAlpha` 0.2). The live set is a softmax-over-native-U heuristic, not a calibrated split-conformal predictor. T51 is **not met** on this frozen panel.

---

## 6. Instrument reliability (c1) — not a T33 result

Lowest agreement (exact match unless noted):

| Field | Agreement | Match rule |
|---|---:|---|
| `q17_process_mismatch` | 0 | free text |
| `q20_runtimes` | 0.37 | exact; determinability split is reported in `analysis-report.json` |
| `q12_quality_gates` | 0.39 | exact |
| `q16_bottlenecks` | **0.46** | exact — still the old ranking artefact |
| `q3_distribution` | 0.54 | exact |
| `q21_ci_maturity` | 0.59 | exact |
| `q5_work_breakdown` | (tolerance ±10) | labelled `tolerance_pm_10` so it is not read against exact-match scores |

q16 did **not** move off 0.46 because respondents were not re-elicited (T31).

---

## 7. Verdicts

| Claim | Verdict |
|---|---|
| Oracle usable (Fleiss κ ≥ 0.40) | **USABLE** (0.5015) |
| RQ1 (old 15 pp harness bar) | **UNSTATED** (withdrawn) |
| RQ1' practice macro-F1 vs prevalence | **unscored** (no best-worst labels) |
| RQ2' danger quadrant empty | **FAIL** (five fields; retarget working) |
| RQ3' caution P/R | **unscored** (`riskTags` empty) |
| RQ4' conformal nominal coverage | **FAIL** (0.60 vs 0.80) |
| RQ5' G-STABILITY | **PASS** (`tests/select.test.mjs`) |
| RQ6' harness in judge top-3 ≥ T17 runner-up credit | **short** (70.79% vs 75.28%) |
| G-FIT structural | **PASS** (`npm run qc:fit`) |

---

## 8. What to do next

1. Re-run judges on the frozen 100 vignettes for `riskTags` + `bestWorst` (T12–T13). Then fit `theta` (T35–T37) and re-check RQ1'/RQ6' before treating the prior as final.
2. Re-run respondents after the instrument change (T31) before reading q16 reliability as a T26 success or failure.
3. Calibrate the conformal set (T51) once the fit exists; do not read 59.55% as a product claim.
4. Full 50k sensitivity is `node tools/qc/sensitivity.mjs` (no `--quick`); CI uses `--quick` because one evaluate is ~15–30 ms.
