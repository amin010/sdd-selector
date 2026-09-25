# SDD Selector report

**Harness acceptability** (conformal set: Spec Kitty, OpenSpec, GSD Core, GitHub Spec Kit, Superpowers, BMAD Method):
- Spec Kitty — 25%
- OpenSpec — 20%
- GSD Core — 18%
- GitHub Spec Kit — 16%
- Superpowers — 11%
- BMAD Method — 11%

Confidence: low · score -0.268 · margin 0.23541499999999993

## Completeness
Unanswered questions that could change this result: q2_team, q3_distribution, q4_domain_familiarity, q5_work_breakdown, q6_volatility, q7_requirements, q8_compliance, q9_precision, q10_architecture, q11_deploy_cadence, q12_quality_gates, q14_release_autonomy, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Tenure: —; domain familiarity: —
- Deploy cadence: —; cycle time: —
- Branching: —

## Recommended base: Spec Kitty
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `pip install spec-kitty-cli`
- Repo: `spec-kitty/spec-kitty`
- Triggering answers: —
- Counterfactuals:
  - Above 36 on derived.nonRoadmapShare the harness flips to openspec.
  - Above 1 on q6_volatility the harness flips to openspec.
  - Above 1 on q19_change_volume the harness flips to openspec.
- Enforcement:
Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
- Evidence: 1627 stars, unknown commits/30d, —; verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 20% vs 25% for Spec Kitty.

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