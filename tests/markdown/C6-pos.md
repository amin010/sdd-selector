# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

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
### Regulatory constitution (included in base)
Source: GitHub Spec Kit
SOX Tier 1 or CAB-on-every-release needs written invariants in the agent session. Advisory only — pair with CI.
Enforcement: Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
Triggered by: q8_compliance = sox_tier1

### Worktree sandboxing and Decision Moments
Source: Spec Kitty
Coupled or heavy internal releases, or global time zones, benefit from auditable lanes and isolated worktrees.
Enforcement: Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
Triggered by: q14_release_autonomy = coupled

## Cautions
### C2 — high
constitution.md is prompt context, not a control. Nothing outside the agent re-reads it or blocks a violating change. It will not satisfy an auditor asking what prevents a violation.
Mitigation: Pair with overlay F. Treat the constitution as documentation of intent and CI as the enforcement. If segregation of duties must be provable, prefer Spec Kitty's lane state machine.
Source: Spec Kit README; §8.3; V1

### C6 — Positive note
Spec Kitty's lane machine permits exactly 27 transitions and requires implementation evidence to reach for_review; overrides demand actor and reason. This is a stronger audit artifact than Markdown-based governance.
Mitigation: Treat Spec Kitty's status log as an audit record. Protect append-only log merges in review — conflict resolution can lose events.
Source: Spec Kitty architecture; V8

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