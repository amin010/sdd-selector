# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

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
- Triggering answers: q5_work_breakdown = {"roadmap":20,"ops":20,"bugs":20,"regulatory":20,"tech_debt":20}
- Enforcement:
Advisory — /opsx:verify (expanded profile) (Does not block archiving.)
Human gate — Delta specs ADDED/MODIFIED/REMOVED (Human archives.)
- Evidence: 68430 stars, 66 commits/30d, v1.13.0 (2026-09-09); verified 2026-09-16

## Practice overlays
### Autonomous TDD verification
Source: Superpowers
Zero-tolerance precision or test-fear in the top 2 needs failing tests before production code. Not Tessl [@test] links.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: q9_precision = zero_tolerance

## Cautions
### C5 — high
/opsx:verify exists only in the expanded profile and must be configured explicitly. Even then it flags issues without blocking archiving.
Mitigation: Run openspec config profile to enable expanded. Add overlay F so the actual gate is CI.
Source: OpenSpec docs; V7

### C4 — medium
The source material recommends Tessl [@test] anchors as fail-closed verification. They are not: check-spec-links.sh verifies that links point to existing files. The tile is watch-status and stale.
Mitigation: Use Superpowers' TDD iron law. Borrow Tessl's one-question-at-a-time interview discipline without adopting the tile.
Source: Tessl tile; Fowler; V4

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── openspec/specs/    # Base: OpenSpec
├── openspec/changes/<name>/{proposal,design,tasks,spec}.md    # Base: OpenSpec
├── tests/    # Autonomous TDD verification
```