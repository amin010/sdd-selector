# SDD Selector report

**Harness acceptability** (conformal set: BMAD Method, OpenSpec, GSD Core, GitHub Spec Kit, Superpowers):
- BMAD Method — 29%
- OpenSpec — 28%
- GSD Core — 12%
- GitHub Spec Kit — 12%
- Superpowers — 11%
- Spec Kitty — 9%

Confidence: low · score -3.0481900000000004 · margin 0.3951499999999992

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
- Triggering answers: midFlightChange demand 1.00; ambiguityHandling demand 1.00; roleSeparation demand 1.00; fastPath demand 1.00
- Counterfactuals:
  - Above 27 on derived.nonRoadmapShare the harness flips to bmad.
  - Below 1 on derived.hasProductOwner the harness flips to bmad.
  - Below 1 on q7_requirements the harness flips to bmad.
- Axis contributions:
  - ambiguityHandling: demand 1.00, coverage 0.30, unmet 0.67
  - fastPath: demand 1.00, coverage 0.31, unmet 0.58
  - roleSeparation: demand 1.00, coverage 0.47, unmet 0.53
  - midFlightChange: demand 1.00, coverage 0.42, unmet 0.49
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 28% vs 28% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 60% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Delta-only specs (included in base) — 52% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Domain reconnaissance — 45% inclusion
Source: BMAD Method
Discovery before implementation when the domain or the ask is still vague.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: derived view

### Role personas — 43% inclusion
Source: BMAD Method
PO, Scrum Master, and QA personas pay off when those roles exist.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: derived view

### Change archive (included in base) — 31% inclusion
Source: OpenSpec
Archived change folders are an audit artifact, but /opsx:verify does not block archive.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

## Cautions
### C12 — high
Interrupt-driven work arrives in real time. Spec Kit, Superpowers' mandatory progression, and BMAD's full method price a session per change that the queue will not wait for.
Mitigation: Prefer OpenSpec (or BMAD Quick Flow if BMAD is already the base) as the daily path. Do not run the full Spec Kit or Superpowers pipeline on interrupt tickets.
Source: D15; V5

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