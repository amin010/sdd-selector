# SDD Selector report

**Harness acceptability** (conformal set: OpenSpec, Superpowers, BMAD Method, GitHub Spec Kit, GSD Core, Spec Kitty):
- OpenSpec — 23%
- Superpowers — 20%
- BMAD Method — 16%
- GitHub Spec Kit — 15%
- GSD Core — 15%
- Spec Kitty — 11%

Confidence: low · score -1.716586153846154 · margin 0.5212430769230769

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q19_change_volume, q21_ci_maturity

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
- Triggering answers: verificationStrength demand 1.00; ceremonyTolerance demand 1.00
- Counterfactuals:
  - Above 0 on q8_compliance the harness flips to superpowers.
  - Above 0 on q7_requirements the harness flips to superpowers.
  - Below 1 on q19_change_volume the harness flips to superpowers.
- Axis contributions:
  - ceremonyTolerance: demand 1.00, coverage 0.30, unmet 0.53
  - verificationStrength: demand 1.00, coverage 0.64, unmet 0.38
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
Superpowers — Acceptability 20% vs 23% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 51% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### TDD iron law — 42% inclusion
Source: Superpowers
Failing tests before production code. Travels without Superpowers as the harness.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: derived view

### Delta-only specs (included in base) — 38% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Change archive (included in base) — 24% inclusion
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
├── tests/    # TDD iron law
```