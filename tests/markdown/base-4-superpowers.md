# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 3 FTE (SWE 3, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: continuous; cycle time: —
- Branching: —

## Recommended base: Superpowers
A small autonomous team shipping often needs a light harness; coverage and budget split Superpowers vs GSD Core.

- Install: `/plugin install superpowers@claude-plugins-official`
- Repo: `obra/superpowers`
- Triggering answers: q2_team = {"total":3,"swe":3,"data_engineers":0,"qa_sdet":0,"product_owner":"none","scrum_master":"none"}; q11_deploy_cadence = continuous; q14_release_autonomy = autonomous; q12_quality_gates = ["mostly_manual"]; q18_token_budget = unmetered
- Enforcement:
Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
- Evidence: 287303 stars, 0 commits/30d, v6.3.0 (2026-08-12); verified 2026-09-16

## Practice overlays
_None._
## Cautions
### C10 — medium
No commits on main in the 30 days before the evidence date (v6.3.0, 2026-08-12), while comparable projects posted 100+. Star count reflects historical popularity.
Mitigation: Check current repository activity before adopting. The methodology is portable, so a pause is survivable — do not assume active upstream support.
Source: Appendix A; V12

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── design docs    # Base: Superpowers
├── implementation plans    # Base: Superpowers
├── git worktrees    # Base: Superpowers
```