# SDD Selector report

**Harness acceptability** (conformal set: GitHub Spec Kit, Spec Kitty, Superpowers):
- GitHub Spec Kit — 40%
- Spec Kitty — 32%
- Superpowers — 28%

Confidence: medium · score -0.8506192307692308 · margin 0.21064999999999978

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: GitHub Spec Kit
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `uvx specify init`
- Repo: `github/spec-kit`
- Triggering answers: —
- Counterfactuals:
  - Above 0 on q3_distribution the harness flips to speckitty.
  - Above 0 on q8_compliance the harness flips to speckitty.
  - Above 0 on q8_compliance the harness flips to speckitty.
- Axis contributions:
  - midFlightChange: demand 0.15, coverage 0.00, unmet 0.13
- Enforcement:
Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
- Evidence: 137140 stars, 100 commits/30d, v1.0.7 (2026-09-15); verified 2026-09-16

## Runner-up
Spec Kitty — Acceptability 32% vs 40% for GitHub Spec Kit.

## Practice overlays
### Regulatory constitution (included in base) — 53% inclusion
Source: GitHub Spec Kit
Written invariants in the agent session. Advisory only — pair with CI.
Enforcement: Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
Triggered by: derived view

### Spec Kit phase pipeline (included in base) — 40% inclusion
Source: GitHub Spec Kit
Seven-phase pipeline for structured greenfield work. The pipeline is the tool.
Enforcement: Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
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
├── constitution.md    # Base: GitHub Spec Kit
├── spec.md    # Base: GitHub Spec Kit
├── plan.md    # Base: GitHub Spec Kit
├── tasks.md    # Base: GitHub Spec Kit
```