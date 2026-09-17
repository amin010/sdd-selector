# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 3 FTE (SWE 3, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: sprint; cycle time: —
- Branching: —

## Recommended base: GSD Core
A small autonomous team shipping often needs a light harness; coverage and budget split Superpowers vs GSD Core.

- Install: `npx @opengsd/gsd-core`
- Repo: `open-gsd/gsd-core`
- Triggering answers: q2_team = {"total":3,"swe":3,"data_engineers":0,"qa_sdet":0,"product_owner":"none","scrum_master":"none"}; q11_deploy_cadence = sprint; q14_release_autonomy = autonomous; q12_quality_gates = ["unit_coverage","integration_contract","e2e"]; q18_token_budget = unmetered
- Enforcement:
Agent gate — Plan-checker decision-coverage (Agent-executed check on plans.)
Agent gate — Verify vs shipped code (Stronger than constitution.md; weaker than CI.)
- Evidence: 9501 stars, 100 commits/30d, v1.14.0 (2026-09-14); verified 2026-09-16

## Practice overlays
_None._
## Cautions
### C9 — medium
Created 2026-05-22 — roughly four months old at the evidence date. Release cadence is high but there is little track record, and .planning/ is still evolving.
Mitigation: Pin a version. Budget for migration between minor releases. Re-verify activity before committing a team to it.
Source: Appendix A; V3

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── .planning/{PROJECT,REQUIREMENTS,ROADMAP,STATE}.md    # Base: GSD Core
├── .planning/phases/    # Base: GSD Core
├── HANDOFF.json    # Base: GSD Core
```