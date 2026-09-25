# SDD Selector report

**Harness acceptability** (conformal set: OpenSpec, GSD Core, BMAD Method, GitHub Spec Kit, Superpowers):
- OpenSpec — 28%
- GSD Core — 20%
- BMAD Method — 19%
- GitHub Spec Kit — 12%
- Superpowers — 11%
- Spec Kitty — 9%

Confidence: low · score -3.071636153846154 · margin 0.9910530769230772

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 4, data 1, QA/SDET 1; PO dedicated, SM shared)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: brownfield demand 1.00; ambiguityHandling demand 1.00; roleSeparation demand 1.00; contextHygiene demand 1.00
- Counterfactuals:
  - Below 39 on derived.nonRoadmapShare the harness flips to gsd.
- Axis contributions:
  - ambiguityHandling: demand 1.00, coverage 0.30, unmet 0.67
  - brownfield: demand 1.00, coverage 0.47, unmet 0.63
  - roleSeparation: demand 1.00, coverage 0.47, unmet 0.53
  - contextHygiene: demand 1.00, coverage 0.64, unmet 0.24
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
GSD Core — Acceptability 20% vs 28% for OpenSpec.

## Practice overlays
### Delta-only specs (included in base) — 56% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Low-ceremony fast path (included in base) — 48% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Ephemeral subagent waves — 47% inclusion
Source: GSD Core
Fresh-context executor waves for broad file spans.
Enforcement: Agent gate — Plan-checker decision-coverage (Agent-executed check on plans.)
Agent gate — Verify vs shipped code (Stronger than constitution.md; weaker than CI.)
Triggered by: derived view

### Domain reconnaissance — 44% inclusion
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

### Change archive (included in base) — 32% inclusion
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
├── .planning/phases/    # Ephemeral subagent waves
├── research notes    # Domain reconnaissance
├── PRD.md    # Domain reconnaissance
├── _bmad/    # Role personas
├── sprint-status.yaml    # Role personas
```