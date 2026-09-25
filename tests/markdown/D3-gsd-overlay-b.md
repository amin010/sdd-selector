# SDD Selector report

**Harness acceptability** (conformal set: Superpowers, OpenSpec, GitHub Spec Kit, GSD Core, BMAD Method, Spec Kitty):
- Superpowers — 21%
- OpenSpec — 21%
- GitHub Spec Kit — 16%
- GSD Core — 16%
- BMAD Method — 15%
- Spec Kitty — 11%

Confidence: low · score -2.0604015384615386 · margin 0.40172500000000033

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 3 FTE (SWE 3, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: sprint; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: verificationStrength demand 1.00; tokenBudget demand 1.00
- Counterfactuals:
  - Below 1 on q9_precision the harness flips to superpowers.
  - Above 27 on derived.nonRoadmapShare the harness flips to superpowers.
  - Above 0 on q6_volatility the harness flips to superpowers.
- Axis contributions:
  - tokenBudget: demand 1.00, coverage 0.00, unmet 0.65
  - verificationStrength: demand 1.00, coverage 0.64, unmet 0.38
  - ceremonyTolerance: demand 0.38, coverage 0.30, unmet 0.20
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 21% vs 21% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 49% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### TDD iron law — 43% inclusion
Source: Superpowers
Failing tests before production code. Travels without Superpowers as the harness.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: derived view

### Delta-only specs (included in base) — 36% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Change archive (included in base) — 23% inclusion
Source: OpenSpec
Archived change folders are an audit artifact, but /opsx:verify does not block archive.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

## Cautions
### C3 — high
Superpowers' full loop is token-intensive by design; users under metered plans report slowdowns and reversion. Setup runs 10–20 minutes per feature.
Mitigation: Adopt TDD and code-review skills selectively rather than the full mandatory progression. Reserve brainstorming for genuinely ambiguous work.
Source: Superpowers release notes and field reports; §8.6

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