# SDD Selector report

**Harness acceptability** (conformal set: OpenSpec, GSD Core, GitHub Spec Kit, BMAD Method):
- OpenSpec — 38%
- GSD Core — 21%
- GitHub Spec Kit — 12%
- BMAD Method — 10%
- Spec Kitty — 10%
- Superpowers — 8%

Confidence: medium · score -2.014336153846154 · margin 0.8483530769230763

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 3 FTE (SWE 3, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: continuous; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: brownfield demand 1.00; contextHygiene demand 1.00; ceremonyTolerance demand 1.00
- Counterfactuals:
  - Below 28 on derived.nonRoadmapShare the harness flips to gsd.
- Axis contributions:
  - brownfield: demand 1.00, coverage 0.47, unmet 0.63
  - ceremonyTolerance: demand 1.00, coverage 0.30, unmet 0.53
  - contextHygiene: demand 1.00, coverage 0.64, unmet 0.24
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
GSD Core — Acceptability 21% vs 38% for OpenSpec.

## Practice overlays
### Delta-only specs (included in base) — 61% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Low-ceremony fast path (included in base) — 57% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Ephemeral subagent waves — 48% inclusion
Source: GSD Core
Fresh-context executor waves for broad file spans.
Enforcement: Agent gate — Plan-checker decision-coverage (Agent-executed check on plans.)
Agent gate — Verify vs shipped code (Stronger than constitution.md; weaker than CI.)
Triggered by: derived view

### Change archive (included in base) — 38% inclusion
Source: OpenSpec
Archived change folders are an audit artifact, but /opsx:verify does not block archive.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

## Cautions
### C7 — high
Per-change ceremony dominates at high change volume. Field measurement puts Spec Kit at roughly one full session per ~2,000 LOC unit.
Mitigation: Adopt overlay G's two-track policy and hold the heavyweight pipeline for architecturally novel work only.
Source: ERP field report; §8.3

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
```