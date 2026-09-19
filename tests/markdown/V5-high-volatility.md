# SDD Selector report

Confidence: high · score 8 · margin 8

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Non-roadmap work favors specs written only for the change at hand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: q5_work_breakdown = {"roadmap":40,"ops":20,"bugs":20,"regulatory":10,"tech_debt":10}; q10_architecture = microservices; q6_volatility = high
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Practice overlays
### Low-ceremony fast path (included in base)
Source: BMAD Method
Many small changes or high/interrupt-driven volatility need a documented fast path beside any heavyweight pipeline.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: q6_volatility = high

## Cautions
_None._

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

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