# SDD Selector report

**Harness acceptability** (conformal set: OpenSpec, GitHub Spec Kit, GSD Core, Superpowers, BMAD Method, Spec Kitty):
- OpenSpec — 21%
- GitHub Spec Kit — 17%
- GSD Core — 17%
- Superpowers — 17%
- BMAD Method — 15%
- Spec Kitty — 13%

Confidence: low · score -1.4744400705128207 · margin 0.2490795769230767

## Completeness
Unanswered questions that could change this result: q3_distribution, q8_compliance, q9_precision, q15_governance, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: high
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: ambiguityHandling demand 0.78
- Axis contributions:
  - ambiguityHandling: demand 0.78, coverage 0.18, unmet 0.61
  - verificationStrength: demand 0.22, coverage 0.00, unmet 0.23
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
GitHub Spec Kit — Acceptability 17% vs 21% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 46% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Delta-only specs (included in base) — 37% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### One question at a time [watch] — 28% inclusion
Source: Tessl SDD Tile
Tessl's interview discipline, recommendable while Tessl stays vetoed as a harness.
Enforcement: Advisory — [@test] link check (Verifies files exist; not that tests pass.)
Human gate — Spec approval (Human approves specs before code.)
Triggered by: derived view

### Change archive (included in base) — 23% inclusion
Source: OpenSpec
Archived change folders are an audit artifact, but /opsx:verify does not block archive.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

## Cautions
_None._

## Bottleneck resolution
1. [blocking] Flaky CI/CD pipelines or slow builds — not addressed by this stack
2. [major] Ambiguous or shifting requirements — not addressed by this stack
3. [minor] Lack of test automation / fear of breaking financial calculations — not addressed by this stack

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
```