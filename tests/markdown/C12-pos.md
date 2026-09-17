# SDD Selector report

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q9_precision, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 4, data 1, QA/SDET 1; PO dedicated, SM dedicated)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: BMAD Method
PO, Scrum Master, and QA exist, and requirements are not yet stories — BMAD's personas pay off.

- Install: `/plugin marketplace add bmad-code-org/bmad-plugins`
- Repo: `bmad-code-org/BMAD-METHOD`
- Triggering answers: q2_team = {"total":8,"swe":4,"data_engineers":1,"qa_sdet":1,"product_owner":"dedicated","scrum_master":"dedicated"}; q7_requirements = vague
- Enforcement:
Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
- Evidence: 53070 stars, 100 commits/30d, v6.12.0 (2026-09-04); verified 2026-09-16

## Practice overlays
### Domain reconnaissance (included in base)
Source: BMAD Method
Low domain familiarity, vague goals, or ambiguous-or-shifting as the #1 bottleneck need discovery before implementation.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: q7_requirements = vague

### Low-ceremony fast path
Source: BMAD Method
Many small changes or high/interrupt-driven volatility need a documented fast path beside any heavyweight pipeline.
Enforcement: Hard gate — Python-backed sprint-status merge (Prevents state regression.)
Human gate — Personas and phase gates (Value depends on using the roles.)
Triggered by: q6_volatility = interrupt_driven

## Cautions
### C12 — high
Interrupt-driven work arrives in real time. Spec Kit, Superpowers' mandatory progression, and BMAD's full method price a session per change that the queue will not wait for.
Mitigation: Prefer OpenSpec (or BMAD Quick Flow if BMAD is already the base) as the daily path. Do not run the full Spec Kit or Superpowers pipeline on interrupt tickets.
Source: D15; V5

### C11 — medium
The GitHub API reports a non-standard license (NOASSERTION) where comparable projects are MIT.
Mitigation: Have legal review the license terms before enterprise adoption.
Source: GitHub API; §8.4

## Bottleneck resolution
_No bottlenecks ranked._

Overlays in this revision do not address: Flaky CI/CD pipelines or slow builds; High volume of interruptive support tickets/incidents; Complex compliance/audit documentation overhead; Technical debt in legacy codebases.

## Suggested directory layout
```
repo/
├── _bmad/    # Base: BMAD Method
├── PRD.md    # Base: BMAD Method
├── ARCHITECTURE-SPINE.md    # Base: BMAD Method
├── tech-spec.md    # Base: BMAD Method
├── sprint-status.yaml    # Base: BMAD Method
├── written scope rule for when not to run the full pipeline    # Low-ceremony fast path
```