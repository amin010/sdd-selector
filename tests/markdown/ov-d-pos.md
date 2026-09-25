# SDD Selector report

**Harness acceptability** (conformal set: OpenSpec, Superpowers, GitHub Spec Kit, GSD Core, BMAD Method, Spec Kitty):
- OpenSpec — 20%
- Superpowers — 18%
- GitHub Spec Kit — 17%
- GSD Core — 17%
- BMAD Method — 16%
- Spec Kitty — 12%

Confidence: low · score -1.628111153846154 · margin 0.24991807692307666

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q18_token_budget, q19_change_volume, q21_ci_maturity

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
- Triggering answers: ambiguityHandling demand 1.00
- Counterfactuals:
  - Above 0 on q9_precision the harness flips to superpowers.
  - Above 0 on q8_compliance the harness flips to superpowers.
- Axis contributions:
  - ambiguityHandling: demand 1.00, coverage 0.30, unmet 0.67
  - verificationStrength: demand 0.22, coverage 0.00, unmet 0.23
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Runner-up
Superpowers — Acceptability 18% vs 20% for OpenSpec.

## Practice overlays
### Low-ceremony fast path (included in base) — 46% inclusion
Source: OpenSpec
A documented two-track policy beside any heavyweight pipeline.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### Domain reconnaissance — 44% inclusion
Source: BMAD Method
Discovery before implementation when the domain or the ask is still vague.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
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
_None._

## Bottleneck resolution
1. [blocking] Ambiguous or shifting requirements — Domain reconnaissance
2. [major] Flaky CI/CD pipelines or slow builds — not addressed by this stack
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
├── research notes    # Domain reconnaissance
├── PRD.md    # Domain reconnaissance
```