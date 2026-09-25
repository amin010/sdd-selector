# SDD Selector report

**Harness acceptability** (conformal set: Spec Kitty, OpenSpec, GSD Core, GitHub Spec Kit, Superpowers):
- Spec Kitty — 24%
- OpenSpec — 20%
- GSD Core — 18%
- GitHub Spec Kit — 17%
- Superpowers — 12%
- BMAD Method — 10%

Confidence: low · score -1.3531923076923078 · margin 0.1661450000000002

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

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
- Triggering answers: auditTrail demand 0.46
- Counterfactuals:
  - Below 0 on q8_compliance the harness flips to openspec.
  - Below 0 on q8_compliance the harness flips to openspec.
  - Above 33 on derived.nonRoadmapShare the harness flips to openspec.
- Axis contributions:
  - traceability: demand 0.31, coverage 0.00, unmet 0.22
  - midFlightChange: demand 0.15, coverage 0.00, unmet 0.13
  - deterministicEnforcement: demand 0.38, coverage 0.70, unmet 0.13
  - auditTrail: demand 0.46, coverage 0.85, unmet 0.06
- Enforcement:
Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
- Evidence: 1627 stars, unknown commits/30d, —; verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 20% vs 24% for Spec Kitty.

## Practice overlays
### Lane state machine and worktrees (included in base) — 30% inclusion
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