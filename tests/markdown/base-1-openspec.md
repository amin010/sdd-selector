# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: OpenSpec
Non-roadmap work or a monolith/hybrid/batch architecture favors specs written only for the change at hand.

- Install: `openspec init (+ openspec config profile for expanded)`
- Repo: `Fission-AI/OpenSpec`
- Triggering answers: q5_work_breakdown = {"roadmap":20,"ops":20,"bugs":20,"regulatory":20,"tech_debt":20}; q10_architecture = microservices
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Practice overlays
_None._
## Cautions
_None._

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── openspec/specs/    # Base: OpenSpec
├── openspec/changes/<name>/{proposal,design,tasks,spec}.md    # Base: OpenSpec
```