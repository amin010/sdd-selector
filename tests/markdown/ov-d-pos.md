# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q18_token_budget, q19_change_volume, q21_ci_maturity

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
### Domain reconnaissance
Source: BMAD Method
Low domain familiarity, vague goals, or ambiguous-or-shifting as the #1 bottleneck need discovery before implementation.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: q7_requirements = structured; q16_bottlenecks = ["ambiguous_or_shifting","flaky_cicd","test_fear"]

## Cautions
_None._

## Bottleneck resolution
1. Ambiguous or shifting requirements — Domain reconnaissance
2. Flaky CI/CD pipelines or slow builds — not addressed by this stack
3. Lack of test automation / fear of breaking financial calculations — not addressed by this stack

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── constitution.md    # Base: GitHub Spec Kit
├── spec.md    # Base: GitHub Spec Kit
├── plan.md    # Base: GitHub Spec Kit
├── tasks.md    # Base: GitHub Spec Kit
├── research notes    # Domain reconnaissance
├── PRD.md    # Domain reconnaissance
```