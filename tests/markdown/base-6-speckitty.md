# SDD Selector report

**Harness acceptability** (conformal set: Spec Kitty, OpenSpec, Superpowers):
- Spec Kitty — 49%
- OpenSpec — 15%
- Superpowers — 11%
- GSD Core — 10%
- GitHub Spec Kit — 9%
- BMAD Method — 5%

Confidence: medium · score -2.6145457692307694 · margin 2.7898957692307693

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: Spec Kitty
Selected as the harness whose native bundle plus added practices minimises unmet demand.

- Install: `pip install spec-kitty-cli`
- Repo: `spec-kitty/spec-kitty`
- Triggering answers: brownfield demand 1.00; verificationStrength demand 1.00; deterministicEnforcement demand 1.00; auditTrail demand 1.00; concurrencyIsolation demand 0.85; traceability demand 0.92
- Axis contributions:
  - brownfield: demand 1.00, coverage 0.47, unmet 0.63
  - traceability: demand 0.92, coverage 0.54, unmet 0.30
  - contextHygiene: demand 0.31, coverage 0.00, unmet 0.20
  - verificationStrength: demand 1.00, coverage 0.85, unmet 0.16
  - auditTrail: demand 1.00, coverage 0.85, unmet 0.14
- Enforcement:
Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
- Evidence: 1627 stars, unknown commits/30d, —; verified 2026-09-16

## Runner-up
OpenSpec — Acceptability 15% vs 49% for Spec Kitty.

## Practice overlays
### Lane state machine and worktrees (included in base) — 51% inclusion
Source: Spec Kitty
27-transition lane machine. It is the tool, so it is not liftable.
Enforcement: Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
Triggered by: derived view

### Deterministic CI enforcement — 47% inclusion
Source: native CI
Required status checks. Complements advisory constitutions (overlay-f as arithmetic).
Enforcement: Hard gate — failing CI build.
Triggered by: derived view

### Delta-only specs — 47% inclusion
Source: OpenSpec
Write specs only for the change at hand. Strongest brownfield fit in the catalogue.
Enforcement: Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
Triggered by: derived view

### GSD REQ-id traceability — 39% inclusion
Source: GSD Core
Requirement ids in .planning/ are GSD Core's traceability offer.
Enforcement: Agent gate — Plan-checker decision-coverage (Agent-executed check on plans.)
Agent gate — Verify vs shipped code (Stronger than constitution.md; weaker than CI.)
Triggered by: derived view

### TDD iron law — 37% inclusion
Source: Superpowers
Failing tests before production code. Travels without Superpowers as the harness.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: derived view

## Cautions
### C6 — Positive note
Spec Kitty's lane machine permits exactly 27 transitions and requires implementation evidence to reach for_review; overrides demand actor and reason. This is a stronger audit artifact than Markdown-based governance.
Mitigation: Treat Spec Kitty's status log as an audit record. Protect append-only log merges in review — conflict resolution can lose events.
Source: Spec Kitty architecture; V8

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
├── kitty-specs/    # Base: Spec Kitty
├── .worktrees/    # Base: Spec Kitty
├── .kittify/config.yaml    # Base: Spec Kitty
├── append-only status log    # Base: Spec Kitty
├── .github/workflows/spec-gates.yml    # Deterministic CI enforcement
├── openspec/specs/    # Delta-only specs
├── openspec/changes/<name>/{proposal,design,tasks,spec}.md    # Delta-only specs
├── .planning/REQUIREMENTS.md    # GSD REQ-id traceability
├── tests/    # TDD iron law
```