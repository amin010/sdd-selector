# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q9_precision, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: GitHub Spec Kit
Roadmap-heavy, structured, low-volatility microservice work matches Spec Kit's phase pipeline.

- Install: `uvx specify init`
- Repo: `github/spec-kit`
- Triggering answers: q5_work_breakdown = {"roadmap":80,"ops":5,"bugs":5,"regulatory":5,"tech_debt":5}; q10_architecture = microservices; q7_requirements = structured; q6_volatility = moderate
- Enforcement:
Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
- Evidence: 137140 stars, 100 commits/30d, v1.0.7 (2026-09-15); verified 2026-09-16

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
├── constitution.md    # Base: GitHub Spec Kit
├── spec.md    # Base: GitHub Spec Kit
├── plan.md    # Base: GitHub Spec Kit
├── tasks.md    # Base: GitHub Spec Kit
```