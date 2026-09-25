# SDD Selector report

**Harness acceptability** (conformal set: OpenSpec, GSD Core, GitHub Spec Kit, Superpowers, Spec Kitty, BMAD Method):
- OpenSpec — 23%
- GSD Core — 19%
- GitHub Spec Kit — 18%
- Superpowers — 14%
- Spec Kitty — 14%
- BMAD Method — 12%

Confidence: low · score -0.7982611538461539 · margin 0.1820330769230769

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q15_governance, q18_token_budget, q19_change_volume, q21_ci_maturity

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
- Triggering answers: —
- Counterfactuals:
  - Above 0 on q10_architecture the harness flips to gsd.
  - Above 1 on q8_compliance the harness flips to gsd.
- Axis contributions:
  - verificationStrength: demand 0.22, coverage 0.00, unmet 0.23
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
GSD Core — Acceptability 19% vs 23% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 46% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
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
_None._

## Bottleneck resolution
1. [blocking] Flaky CI/CD pipelines or slow builds — not addressed by this stack
2. [major] Technical debt in legacy codebases — Delta-only specs
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