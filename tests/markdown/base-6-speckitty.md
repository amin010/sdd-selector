# SDD Selector report

Confidence: high · score 13 · margin 7

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q15_governance, q16_bottlenecks, q18_token_budget, q19_change_volume, q21_ci_maturity

## Team profile
- Domain: —
- Team: 8 FTE (SWE 6, data 0, QA/SDET 0; PO none, SM none)
- Tenure: —; domain familiarity: —
- Deploy cadence: monthly; cycle time: —
- Branching: —

## Recommended base: Spec Kitty
Structured requirements plus zero-tolerance precision need a hard-gated lane machine, not advisory Markdown.

- Install: `pip install spec-kitty-cli`
- Repo: `spec-kitty/spec-kitty`
- Triggering answers: q7_requirements = structured; q9_precision = zero_tolerance; q5_work_breakdown = {"roadmap":40,"ops":15,"bugs":15,"regulatory":15,"tech_debt":15}; q8_compliance = sox_tier1; q14_release_autonomy = coupled
- Enforcement:
Hard gate — 27-transition lane machine (--force requires actor + reason.)
Human gate — Decision Moments (Human review to advance.)
- Evidence: 1627 stars, unknown commits/30d, —; verified 2026-09-16

## Runner-up
OpenSpec — Scored 6 vs 13 for Spec Kitty — hard-gated lanes for structured, zero-tolerance work.

## Practice overlays
### Regulatory constitution
Source: GitHub Spec Kit
SOX Tier 1 or CAB-on-every-release needs written invariants in the agent session. Advisory only — pair with CI.
Enforcement: Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
Triggered by: q8_compliance = sox_tier1

### Autonomous TDD verification
Source: Superpowers
Zero-tolerance precision or test-fear in the top 2 needs failing tests before production code. Not Tessl [@test] links.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: q9_precision = zero_tolerance

### Worktree sandboxing and Decision Moments (included in base)
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

### C4 — medium
The source material recommends Tessl [@test] anchors as fail-closed verification. They are not: check-spec-links.sh verifies that links point to existing files. The tile is watch-status and stale.
Mitigation: Use Superpowers' TDD iron law. Borrow Tessl's one-question-at-a-time interview discipline without adopting the tile.
Source: Tessl tile; Fowler; V4

### C6 — Positive note
Spec Kitty's lane machine permits exactly 27 transitions and requires implementation evidence to reach for_review; overrides demand actor and reason. This is a stronger audit artifact than Markdown-based governance.
Mitigation: Treat Spec Kitty's status log as an audit record. Protect append-only log merges in review — conflict resolution can lose events.
Source: Spec Kitty architecture; V8

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
├── kitty-specs/    # Base: Spec Kitty
├── .worktrees/    # Base: Spec Kitty
├── .kittify/config.yaml    # Base: Spec Kitty
├── append-only status log    # Base: Spec Kitty
├── constitution.md    # Regulatory constitution
├── tests/    # Autonomous TDD verification
```