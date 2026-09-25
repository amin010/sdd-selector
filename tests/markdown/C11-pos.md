# SDD Selector report

**Harness acceptability** (conformal set: BMAD Method, OpenSpec, GSD Core, GitHub Spec Kit, Superpowers, Spec Kitty):
- BMAD Method — 24%
- OpenSpec — 19%
- GSD Core — 16%
- GitHub Spec Kit — 16%
- Superpowers — 14%
- Spec Kitty — 12%

Confidence: low · score -2.125611153846154 · margin 0.3951500000000001

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 4, data 1, QA/SDET 1; PO dedicated, SM dedicated)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: ambiguityHandling demand 1.00; roleSeparation demand 1.00
- Counterfactuals:
  - Above 37 on derived.nonRoadmapShare the harness flips to bmad.
  - Below 1 on derived.hasProductOwner the harness flips to bmad.
  - Below 0 on q7_requirements the harness flips to bmad.
- Axis contributions:
  - ambiguityHandling: demand 1.00, coverage 0.30, unmet 0.67
  - roleSeparation: demand 1.00, coverage 0.47, unmet 0.53
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 19% vs 19% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 49% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Domain reconnaissance — 46% inclusion
Source: BMAD Method
Discovery before implementation when the domain or the ask is still vague.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: derived view

### Role personas — 42% inclusion
Source: BMAD Method
PO, Scrum Master, and QA personas pay off when those roles exist.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: derived view

### Delta-only specs (included in base) — 36% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Change archive (included in base) — 22% inclusion
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
├── research notes    # Domain reconnaissance
├── PRD.md    # Domain reconnaissance
├── _bmad/    # Role personas
├── sprint-status.yaml    # Role personas
```