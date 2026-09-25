# SDD Selector report

**Harness acceptability** (conformal set: Superpowers, OpenSpec, Spec Kitty, GitHub Spec Kit, BMAD Method, GSD Core):
- Superpowers — 24%
- OpenSpec — 24%
- Spec Kitty — 19%
- GitHub Spec Kit — 12%
- BMAD Method — 11%
- GSD Core — 10%

Confidence: low · score -2.0855088461538465 · margin 1.7055407692307694

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: brownfield demand 1.00; ambiguityHandling demand 0.54; verificationStrength demand 1.00; deterministicEnforcement demand 1.00
- Counterfactuals:
  - Above 0 on q6_volatility the harness flips to superpowers.
  - Below 1 on q8_compliance the harness flips to superpowers.
  - Below 1 on q7_requirements the harness flips to superpowers.
- Axis contributions:
  - brownfield: demand 1.00, coverage 0.47, unmet 0.63
  - ambiguityHandling: demand 0.54, coverage 0.18, unmet 0.42
  - verificationStrength: demand 1.00, coverage 0.85, unmet 0.16
  - deterministicEnforcement: demand 1.00, coverage 1.00, unmet 0.00
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 24% vs 24% for OpenSpec.

## Practice overlays
### Delta-only specs (included in base) — 55% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Deterministic CI enforcement — 52% inclusion
Source: native CI
Required status checks. Complements advisory constitutions (overlay-f as arithmetic).
Enforcement: Hard gate — failing CI build.
Triggered by: derived view

### TDD iron law — 46% inclusion
Source: Superpowers
Failing tests before production code. Travels without Superpowers as the harness.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: derived view

### Low-ceremony fast path (included in base) — 43% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Change archive (included in base) — 32% inclusion
Source: OpenSpec
Archived change folders are an audit artifact, but /opsx:verify does not block archive.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### One question at a time [watch] — 27% inclusion
Source: Tessl SDD Tile
Tessl's interview discipline, recommendable while Tessl stays vetoed as a harness.
Enforcement: Advisory — [@test] link check (Verifies files exist; not that tests pass.)
Human gate — Spec approval (Human approves specs before code.)
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
├── openspec/specs/    # Base: OpenSpec
├── openspec/changes/<name>/{proposal,design,tasks,spec}.md    # Base: OpenSpec
├── .github/workflows/spec-gates.yml    # Deterministic CI enforcement
├── tests/    # TDD iron law
```