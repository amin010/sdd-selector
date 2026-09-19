# SDD Selector report

Confidence: medium · score 9 · margin 1

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 3 FTE (SWE 3, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: continuous; cycle time: —
- Branching: —

## Recommended base: GSD Core
A small autonomous team shipping often needs a light harness; coverage and budget split Superpowers vs GSD Core.

- Install: `npx @opengsd/gsd-core`
- Repo: `open-gsd/gsd-core`
- Triggering answers: q2_team = {"total":3,"swe":3,"data_engineers":0,"qa_sdet":0,"product_owner":"none","scrum_master":"none"}; q11_deploy_cadence = continuous; q14_release_autonomy = autonomous; q12_quality_gates = ["unit_coverage","integration_contract","e2e"]
- Enforcement:
Agent gate — Plan-checker decision-coverage (Agent-executed check on plans.)
Agent gate — Verify vs shipped code (Stronger than constitution.md; weaker than CI.)
- Evidence: 9501 stars, 100 commits/30d, v1.14.0 (2026-09-14); verified 2026-09-16

## Runner-up
OpenSpec — Scored 8 vs 9 for Compact autonomous team, frequent deploys.

## Practice overlays
### Ephemeral subagent waves (included in base)
Source: GSD Core
A monolith with broad file spans benefits from GSD Core's clean-context parallel executors.
Enforcement: Agent gate — Plan-checker decision-coverage (Agent-executed check on plans.)
Agent gate — Verify vs shipped code (Stronger than constitution.md; weaker than CI.)
Triggered by: q10_architecture = monolith

## Cautions
### C9 — medium
Created 2026-05-22 — roughly four months old at the evidence date. Release cadence is high but there is little track record, and .planning/ is still evolving.
Mitigation: Pin a version. Budget for migration between minor releases. Re-verify activity before committing a team to it.
Source: Appendix A; V3

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
├── .planning/{PROJECT,REQUIREMENTS,ROADMAP,STATE}.md    # Base: GSD Core
├── .planning/phases/    # Base: GSD Core
├── HANDOFF.json    # Base: GSD Core
```