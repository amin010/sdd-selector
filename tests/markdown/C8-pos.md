# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 2 FTE (SWE 2, data 0, QA/SDET 0; PO none, SM none)
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
### Worktree sandboxing and Decision Moments
Source: Spec Kitty
Coupled or heavy internal releases, or global time zones, benefit from auditable lanes and isolated worktrees.
Enforcement: Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
Triggered by: q14_release_autonomy = coupled

## Cautions
### C8 — medium
Spec Kitty's worktree model pays off through concurrency. Below three concurrent workers it adds sync and rebase friction without the benefit. Isolation is partial: full checkouts with ownership metadata.
Mitigation: Use plain git worktrees or Superpowers' using-git-worktrees skill instead of Spec Kitty's full mission model.
Source: Spec Kitty architecture; C8

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── constitution.md    # Base: GitHub Spec Kit
├── spec.md    # Base: GitHub Spec Kit
├── plan.md    # Base: GitHub Spec Kit
├── tasks.md    # Base: GitHub Spec Kit
├── kitty-specs/    # Worktree sandboxing and Decision Moments
├── .worktrees/    # Worktree sandboxing and Decision Moments
├── append-only status log    # Worktree sandboxing and Decision Moments
```