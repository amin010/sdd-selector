# SDD Selector report

**Harness acceptability** (conformal set: Spec Kitty, OpenSpec, GSD Core, GitHub Spec Kit, Superpowers, BMAD Method):
- Spec Kitty — 25%
- OpenSpec — 21%
- GSD Core — 17%
- GitHub Spec Kit — 16%
- Superpowers — 11%
- BMAD Method — 11%

Confidence: low · score -1.0333846153846156 · margin 0.17199192307692313

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 2 FTE (SWE 2, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: Spec Kitty
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `pip install spec-kitty-cli`
- Repo: `spec-kitty/spec-kitty`
- Triggering answers: concurrencyIsolation demand 0.85
- Counterfactuals:
  - Above 33 on derived.nonRoadmapShare the harness flips to openspec.
  - Above 1 on q6_volatility the harness flips to openspec.
  - Above 1 on q19_change_volume the harness flips to openspec.
- Axis contributions:
  - concurrencyIsolation: demand 0.85, coverage 0.00, unmet 0.63
  - midFlightChange: demand 0.15, coverage 0.00, unmet 0.13
- Enforcement:
Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
- Evidence: 1627 stars, unknown commits/30d, —; verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 21% vs 25% for Spec Kitty.

## Practice overlays
_None._
## Cautions
_None._

## Bottleneck resolution
_No bottlenecks rated._

## Framework catalog
- **OpenSpec** (`openspec`, recommended) — base candidate
- **GitHub Spec Kit** (`speckit`, recommended) — base candidate
- **BMAD Method** (`bmad`, recommended) — base candidate
- **GSD Core** (`gsd`, viable) — base candidate
- **Superpowers** (`superpowers`, viable) — base candidate
- **Spec Kitty** (`speckitty`, viable) — base candidate
- **Tessl SDD Tile** (`tessl`, watch) — watch — selected only with a warning

## Suggested directory layout
```
repo/
├── kitty-specs/    # Base: Spec Kitty
├── .worktrees/    # Base: Spec Kitty
├── .kittify/config.yaml    # Base: Spec Kitty
├── append-only status log    # Base: Spec Kitty
```