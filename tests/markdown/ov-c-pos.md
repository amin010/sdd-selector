# SDD Selector report

**Harness acceptability** (conformal set: Spec Kitty, OpenSpec, GSD Core, GitHub Spec Kit, Superpowers):
- Spec Kitty — 29%
- OpenSpec — 19%
- GSD Core — 16%
- GitHub Spec Kit — 15%
- Superpowers — 10%
- BMAD Method — 10%

Confidence: low · score -0.9087692307692308 · margin 0.4119919230769231

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: Spec Kitty
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `pip install spec-kitty-cli`
- Repo: `spec-kitty/spec-kitty`
- Triggering answers: concurrencyIsolation demand 1.00
- Counterfactuals:
  - Below 1 on q3_distribution the harness flips to openspec.
  - Above 44 on derived.nonRoadmapShare the harness flips to openspec.
- Axis contributions:
  - midFlightChange: demand 0.15, coverage 0.00, unmet 0.13
  - concurrencyIsolation: demand 1.00, coverage 0.95, unmet 0.04
- Enforcement:
Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
- Evidence: 1627 stars, unknown commits/30d, —; verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 19% vs 29% for Spec Kitty.

## Practice overlays
### Lane state machine and worktrees (included in base) — 38% inclusion
Source: Spec Kitty
27-transition lane machine. It is the tool, so it is not liftable.
Enforcement: Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
Triggered by: derived view

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