# SDD Selector report

Confidence: medium · score 9 · margin 2

## Completeness
Unanswered questions that could change this result: q3_distribution, q4_domain_familiarity, q8_compliance, q15_governance, q16_bottlenecks, q19_change_volume, q21_ci_maturity

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
- Triggering answers: q5_work_breakdown = {"roadmap":80,"ops":5,"bugs":5,"regulatory":5,"tech_debt":5}; q10_architecture = microservices; q7_requirements = structured; q6_volatility = moderate; q9_precision = zero_tolerance
- Enforcement:
Advisory — constitution.md (Prompt context; not an independent gate.)
Human gate — Phase reviews (Human advances each phase.)
- Evidence: 137140 stars, 100 commits/30d, v1.0.7 (2026-09-15); verified 2026-09-16

## Runner-up
Spec Kitty — Scored 7 vs 9 for GitHub Spec Kit — structured greenfield services.

## Practice overlays
### Autonomous TDD verification
Source: Superpowers
Zero-tolerance precision or test-fear in the top 2 needs failing tests before production code. Not Tessl [@test] links.
Enforcement: Agent gate — TDD iron law (Production code before a failing test must be deleted.)
Human gate — Brainstorming design approval (Blocks implementation until a design is approved.)
Triggered by: q9_precision = zero_tolerance

## Cautions
### C3 — high
Superpowers' full loop is token-intensive by design; users under metered plans report slowdowns and reversion. Setup runs 10–20 minutes per feature.
Mitigation: Adopt TDD and code-review skills selectively rather than the full mandatory progression. Reserve brainstorming for genuinely ambiguous work.
Source: Superpowers release notes and field reports; §8.6

### C4 — medium
The source material recommends Tessl [@test] anchors as fail-closed verification. They are not: check-spec-links.sh verifies that links point to existing files. The tile is watch-status and stale.
Mitigation: Use Superpowers' TDD iron law. Borrow Tessl's one-question-at-a-time interview discipline without adopting the tile.
Source: Tessl tile; Fowler; V4

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
├── constitution.md    # Base: GitHub Spec Kit
├── spec.md    # Base: GitHub Spec Kit
├── plan.md    # Base: GitHub Spec Kit
├── tasks.md    # Base: GitHub Spec Kit
├── tests/    # Autonomous TDD verification
```