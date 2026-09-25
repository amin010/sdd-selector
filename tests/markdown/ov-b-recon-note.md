# SDD Selector report

**Harness acceptability** (conformal set: Superpowers, Spec Kitty, OpenSpec, GitHub Spec Kit, GSD Core, BMAD Method):
- Superpowers — 24%
- Spec Kitty — 23%
- OpenSpec — 15%
- GitHub Spec Kit — 14%
- GSD Core — 13%
- BMAD Method — 11%

Confidence: low · score -1.032986153846154 · margin 1.2682830769230768

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
- Triggering answers: verificationStrength demand 1.00; deterministicEnforcement demand 1.00
- Counterfactuals:
  - Below 0 on q9_precision the harness flips to superpowers.
  - Above 48 on derived.nonRoadmapShare the harness flips to superpowers.
- Axis contributions:
  - verificationStrength: demand 1.00, coverage 0.85, unmet 0.16
  - deterministicEnforcement: demand 1.00, coverage 1.00, unmet 0.00
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
Spec Kitty — Acceptability 23% vs 15% for OpenSpec.

## Practice overlays
### Deterministic CI enforcement — 51% inclusion
Source: native CI
Required status checks. Complements advisory constitutions (overlay-f as arithmetic).
Enforcement: Hard gate — failing CI build.
Triggered by: derived view

### TDD iron law — 44% inclusion
Source: Superpowers
Failing tests before production code. Travels without Superpowers as the harness.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: derived view

### Low-ceremony fast path (included in base) — 42% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Delta-only specs (included in base) — 31% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Change archive (included in base) — 19% inclusion
Source: OpenSpec
Archived change folders are an audit artifact, but /opsx:verify does not block archive.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
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