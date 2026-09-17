# SDD Selector — Implementation Plan for v0.4.0

| Field | Value |
|---|---|
| Status | Draft — awaiting review |
| Version | 0.2.0 |
| Owner | Amin Rashidi |
| Last updated | 2026-09-16 |
| Implements | `DESIGN-EXT-CONFIG.md` v0.2.0 (EXT-CONFIG) and `DESIGN-EXT-UI.md` v0.1.0 (EXT-UI) |
| Archived | Moved to `docs/archive/` after v0.4.0 shipped. Living docs: `docs/DESIGN.md`, `docs/AUTHORING.md`. |
| Baseline | `index.html` at v0.3.0 — 1,975 lines, working, no tests outside `?selftest` |

**Changelog**

- **0.2.0** — Review fixes. G-PARITY compares a recommendation projection, not the raw `Result` (functions and derived shape would false-fail). P1 now includes derived dual-run and the interpreter cutover, so P4 is actually a serialization. Golden freeze is a snapshot of `index.html` loaded in a VM, not a fake engine extract. H11/H20 phase assignments corrected. Stopping-after-P4 claim narrowed. P6 is explicit that the second pack is a CI artifact, not a second inlined product.
- **0.1.0** — Initial plan. Seven phases, two automated gates, three findings to resolve, and two defined stopping points.

---

## 1. How to read this plan

The two extensions are one body of work. EXT-CONFIG moves the questionnaire and rules into a pack; EXT-UI renders whatever is in that pack. Neither is useful alone — a pack with no generic renderer cannot change the form, and a generic renderer with no pack has nothing to generalize over. So the phases below interleave them, and each phase is organized around **one dimension of change** rather than one document.

Two properties hold at every phase boundary, and they are what make the plan iterative rather than a rewrite with checkpoints:

1. **The page works.** Every phase ends with an `index.html` you could open from disk. No phase leaves the tool half-migrated.
2. **The recommendation is unchanged.** Until P5, identical answers produce the same base, overlays, cautions, and Markdown report. This is enforced by two automated gates (§3), not by inspection.

The second property is the entire safety model. This is a 2,000-line single file with interdependent hard-coding in 22 places (EXT-CONFIG §4); the only way to take it apart confidently is to have a machine tell you, on every commit, that you have not changed what it says.

"Unchanged recommendation" is not "unchanged bytes of every object the engine returns." The `Result` object today embeds function-valued `when` closures and a nested `derived.hasRoles`; the pack engine stores expressions and flat derived keys. Comparing those raw objects would fail for structural reasons even when the user-visible recommendation is identical. §3.1 defines the projection the gate actually compares.

### 1.1 Sequencing rationale

The order was chosen to change **one dimension at a time**:

| Phase changes… | …while holding constant |
|---|---|
| P0: nothing (adds tests) | everything |
| P1: how predicates and derived views are *evaluated* | where the data lives, the UI, the shape of questions |
| P2: the *shape* of questions and the input path | where the data lives (still JS), what the rules say |
| P3: the *on-screen* report | the data, the engine, the Markdown export |
| P4: *where* the data lives (JS → pack JSON) | the shape, the UI, the logic |
| P5: the last hard-coded *logic* | everything else |
| P6: a second pack as a format proof | the shipped finance page |

The tempting shortcut — write the pack JSON first and make everything read it — changes shape, location, *and* evaluation at once. P1's job is to take evaluation off the critical path of P4. That is why P1 does not stop at a side-by-side dual-run: it **cuts the engine over** to the interpreter while the data is still JavaScript object literals. P4 then really is a serialization.

### 1.2 Prerequisite

The work needs version control so a phase can be reverted. If this directory is not a git repository yet, initialize one before P0 and commit the current tree as the v0.3.0 baseline. P0 itself does not "do git init" as product work; it snapshots `index.html` into `tests/golden/` so the harness can execute that baseline even after later commits rewrite the file.

---

## 2. Phase overview

| Phase | Name | Size | Clears (EXT-CONFIG §4) | Ships? |
|---|---|---|---|---|
| **P0** | Test harness and golden freeze | M (~400 new lines, 0 changed in `index.html`) | — | Yes, invisibly |
| **P1** | Interpreter, derived dual-run, engine cutover | L (~700 new; ~200 of them inlined into the page) | H4 (evaluation path; data still JS) | Yes, invisibly |
| **P2** | Field model and generic input path | L (~250 net removed) | H2, H3, H5, H10–H19 | Yes — URL marker changes; legacy `v=3` still restores |
| **P3** | Report pass (EXT-UI output path) | M (~150 net) | on-screen profile / mismatch (not H20) | Yes — first user-visible screen change |
| **P4** | Pack extraction and build pipeline | M (~200 net removed from the page, added as JSON) | H1, H20, H22 | Yes — **questions and simple rules become data** |
| **P5** | Special-case generalization | M (~120 net removed) | H6–H9, H21 | Yes — **CG1 actually holds** |
| **P6** | Second pack, authoring guide, release | M (~600 new, all data/docs) | — | Yes — v0.4.0 |

"Size" is relative effort. The negative numbers in P2, P4, and P5 are the point.

---

## 3. The gates

Both gates run in CI on every commit and locally via `npm test`. Neither requires a browser. P3 adds a small DOM check that may use jsdom; Lighthouse and keyboard-only completion stay manual.

### 3.1 G-PARITY — identical recommendation

`tools/parity.mjs` loads the frozen v0.3.0 page (§3.3) and the current engine, evaluates both over the same answer sets with a **pinned `now`** (`Date.parse("2026-09-16T12:00:00Z")`), and asserts deep equality on this projection:

```ts
type Rec = {
  baseId: string | null;
  fallback: boolean;
  runnerUpId: string | null;
  overlays: Array<{ id: string; includedInBase: boolean }>;  // sorted by id
  cautions: string[];                                         // sorted
  bottleneckMatrix: Array<{ bottleneck: string; rank: number; resolvedBy: string[] | null }>;
  directoryLayout: string[];
  completeness: { answered: string[]; missing: string[]; couldChangeResult: string[] };
  evidenceAge: { verifiedOn: string; stale: boolean };
  noRuntimeMatch: boolean;
  closest?: string[];
};
```

That is what a user can observe as "the recommendation." It deliberately omits:

- `rule.when` — a function today, an expression later; `JSON.stringify` drops functions, so a naive full-`Result` compare would pass until P1 and then fail for a reason that is not a behaviour change.
- `result.derived` — nested `hasRoles` today, flat keys after the P1 cutover (EXT-CONFIG CD6). Equivalence of derived values is a *separate* assertion in P1 (§5), not part of this projection.
- `forceOverlayB` — an internal flag; its user-visible effect is whether overlay B is in `overlays`.
- `reconciliationNote` — internal; user-visible effect is a string in Markdown, caught by G-MARKDOWN.

The corpus, defined once in P0 and reused by every later phase:

| Set | Count | Purpose |
|---|---|---|
| Documented fixtures | ~40 | Every case in DESIGN.md §14.1 — each base rule, each overlay ±, each caution ±, Tier 0, fallback |
| Boundary sweep | ~500 | Every numeric threshold at −1 / = / +1: `nonRoadmapShare` 39/40/41 and 24/25/26, `q5.roadmap` 59/60/61, `teamSize` 2/3/4/5, coverage counts 0/1/2/3 |
| Seeded random | 50,000 | Uniform draws over declared enums, including absent fields, empty multi-selects, `q5` sums ≠ 100, `q2_team` with missing roles |
| Malformed | ~200 | Wrong types, unknown enum values, negative numbers, oversized text — must not throw in either engine |

On failure the harness prints a **minimized** differing answer set: repeatedly drop one field and re-test, keeping the reduction if it still differs. A raw failure out of 50,000 cases is not actionable; a four-field answer set is.

Pinning `now` is load-bearing. `evidenceAge.stale` flips 180 days after the evidence date. Without a pin, CI goes red in March 2027 with no code change.

### 3.2 G-MARKDOWN — byte-identical exports

`toMarkdown(result, answers)` is a pure string function, which makes it a free and very strict second gate. Golden `.md` files are generated in P0 for the ~40 documented fixtures and must match byte for byte through P4.

This gate catches things G-PARITY cannot: label lookups, number formatting, section ordering, the reconciliation note, and the enforcement and evidence lines.

**P5 has exactly one authorized diff**, the unaddressed-bottlenecks line, for the reason in §9.1. It requires a recorded decision before the golden file is regenerated. No other authorized diffs exist; if a phase wants one, that is a design change and belongs in a design doc first.

### 3.3 The golden freeze

P0 copies the current `index.html` to `tests/golden/index-v030.html` and never edits that copy. `tools/load-page.mjs` extracts the `<script>` IIFE and runs it in a Node `vm` context that provides `module.exports` and **does not** provide `document`, so `bootUi` does not run and `globalThis.SDDSelector` / `module.exports` is the engine.

This is mechanical because the current file already guards UI boot with `typeof document !== "undefined"` and already assigns `module.exports = api`. It is *not* an extraction of "just the engine functions" into a `.mjs` — those functions close over `FRAMEWORKS`, `QUESTIONS`, and the rule tables, so a real extract is the whole script. Snapshotting the page avoids a second copy that would drift.

The frozen file is deleted in P6, once the gates convert to snapshot-based regression against P5 output.

---

## 4. P0 — Test harness and golden freeze

**Goal.** Make the current behaviour executable and asserted, before touching anything.

**Why first.** There is currently no way to run this code outside a browser and no automated assertion of any kind — `?selftest` is in-page and manual. Every later phase depends on the gates, so the gates come before the first refactor.

**In scope**

- Snapshot `index.html` → `tests/golden/index-v030.html`.
- `package.json` with no dependencies; scripts wired to Node's built-in runner (`node --test`).
- `tools/load-page.mjs` — VM-load a selector page and return the exported API.
- `tools/corpus.mjs` — generates the four answer-set families of §3.1 from a fixed seed, so the corpus is reproducible rather than stored.
- `tools/parity.mjs` with the minimizing reducer, pinned `now`, and the `Rec` projection.
- Golden Markdown snapshots for the documented fixtures.
- `tools/lint-structure.mjs` — the EXT-CONFIG §16.4 check (no `/\bq\d+_/` identifiers, no framework-id literals outside the data block). It **fails** at P0; it is added with an explicit allowlist of current offenders, and phases remove entries from the allowlist. An empty allowlist is P5's exit criterion, not P4's — P4 still contains the four special cases.
- CI workflow running `node --test`, parity, and the structural lint.

**Out of scope.** Any change to `index.html`.

**Exit criteria**

- `npm test` is green and runs in under 60 s.
- Parity compares the frozen page against *itself* and passes — proving the harness is wired correctly before it has to prove anything about a refactor.
- Deliberately break one threshold in a scratch copy and confirm the harness fails and minimizes to a sensible answer set. An unfalsified gate is not a gate.

**Rollback.** Delete the new files; no product code changed.

---

## 5. P1 — Interpreter, derived dual-run, engine cutover

**Goal.** Prove the expression language (EXT-CONFIG §8) can express every current rule *and* every derived view, then switch the page to use it. After this phase the closures are gone; the data is still JavaScript.

**Why now, and why a cutover rather than a dual-run-only phase.** The expression language is the riskiest single assumption in both extensions. If the null semantics are subtly wrong, every phase after this inherits the error. A dual-run that never becomes the execution path leaves the actual cutover for P4, bundled with JSON extraction — two migrations, one red gate. P1 takes that cutover while the data shape is still the one the closures were written against.

**In scope**

- `src/expr.mjs` — the interpreter: namespaces (§8.2), the operator table (§8.3), null semantics (§8.4), limits (§8.6). Target ~200 lines. This is the **only** source; `tools/inline.mjs` copies it into `index.html` between marker comments. (P4's `build.mjs` will absorb this inliner.)
- Exhaustive unit tests: one per operator, plus every cell of the §8.4 null-semantics table.
- Derived-view expressions for the eight keys in EXT-CONFIG §10, stored as a JS array next to the existing `derive()`. **Dual-run derived:** for every corpus answer, the expression table must match the current `derive()` on the recommendation-relevant scalars (`nonRoadmapShare`, `unplannedShare`, `volatilityIsHigh`, `coverageLevel`, `teamSize`, and the three role booleans). Nested `hasRoles` vs flat keys is adapted in this comparison, not ignored.
- Hand-translate all 4 base rules, 7 overlays, and 13 cautions to expressions. **Dual-run rules:** every closure and its expression twin return the same boolean over the corpus.
- **Cutover:** `evaluate` / `selectBase` / `applyOverlays` / `applyCautions` call the interpreter; `when: function` is replaced with `when: { … }`; the hand-written `derive()` body is replaced by evaluating `pack.derived`-shaped JS. Closures deleted.
- `tools/validate.mjs` — pack schema and referential validation with the §14.2 codes, plus one malformed-pack test per code. It can already validate the in-memory JS as if it were JSON. Its first production customer is still P4.

**Out of scope.** Moving data into a `.json` file. Any UI change. `adoptWhen` / flags / notes — those stay as the existing JS special cases (H6–H9) wrapping interpreter results.

**Exit criteria**

- Interpreter unit tests green, including all of §8.4.
- Derived dual-run and rule dual-run green across the full corpus.
- After cutover, G-PARITY and G-MARKDOWN green against the frozen v0.3.0 page.
- `validate.mjs` produces the right code and JSON path for each of its ~30 negative fixtures.
- Fuzzed packs (truncated, wrong types, cyclic, deeply nested) always produce diagnostics and never throw.
- `index.html` still opens from disk with no Node involved at runtime; the interpreter is inlined, not fetched.

**Rollback.** Revert the P1 commits. P0's harness and golden file stay.

**Tripwire.** If any rule or derived view cannot be expressed without a new operator category — something taking a lambda, or reaching into arbitrary structure — stop and revisit EXT-CONFIG CD9 before continuing. Adding an escape hatch here would quietly forfeit the whole security and validation model.

**Known semantic matches the dual-run must prove, not assume**

- Unanswered `q6` → `volatilityIsHigh === false` (current code), and `{"in":[null, …]}` is `false` (§8.4). Same outcome.
- Unanswered `q12` → `coverageLevel === "low"` (current `coverageLevel(undefined)` uses `[]`). `countSelected` on an absent multi-select must return 0, not `null`, or rule 4's Superpowers arm fires differently. If the operator as specified returns `null`, fix the spec in EXT-CONFIG §8.3 before cutting over — that is a design bug, not an implementation choice.
- Invalid `q2_team` → current `hasRoles` is `null` and rule 3 returns false; flat keys are `false`. Dual-run must confirm rule 3 still does not fire.

---

## 6. P2 — Field model and generic input path

**Goal.** Replace the eight ad-hoc question types with the six field kinds, and make the form, the readers, and the URL codec generic. Data stays in JavaScript.

**Why now.** This is the largest deletion in the plan and the one that unblocks both remaining goals: the pack cannot describe questions until questions have a describable shape, and the UI cannot render an arbitrary pack until it stops knowing question names.

**In scope**

- Restructure `QUESTIONS` into the question/fields shape (EXT-CONFIG §7.4, §9.2) — still a JS literal, same answer keys.
- Six kind renderers replacing the five bespoke branches (H16).
- Generic `readAnswers` / `applyAnswersToForm` (H17, H18).
- Record constraints (`sumTo`, `requiredKeys`) replacing `q5Complete` / `q2RulesComplete` (H5), driving validity, presence, and the two UI behaviours (H19).
- Kind-driven `fieldPresent` (H10) and field-enumerated `completeness` (H11). Completeness IDs stay the same 23 keys, so G-PARITY's `completeness` projection does not move.
- Generated hash codec with `hashKey` (H12–H15), the FNV-1a digest, and `v=<digest8>` replacing `v=3`. Legacy fragments with `v=3` (no digest) are decoded with the frozen v0.3.0 field map **if and only if** the current pack's answer-affecting surface equals the recorded v0.3.0 surface. After any later enum change, `v=3` is refused.
- Delete `REPORT_ONLY` (H2) and `BOTTLENECK_LABEL` (H3); labels live on options. **`toMarkdown` and `renderReport` look those labels up from the ranked field's options in this phase.** Section structure of either output does not change. (P0.1 left this implicit; deleting `BOTTLENECK_LABEL` without updating the two consumers would fail G-MARKDOWN immediately.)

**Out of scope.** Trimming the on-screen report (P3). The pack file (P4). Rule logic.

**Exit criteria**

- G-PARITY and G-MARKDOWN green.
- URL round-trip property test: for every field kind, `decode(encode(a)) === a` over generated valid answers; `decode` of random garbage never throws and yields only valid answers.
- A legacy `v=3` link produced by v0.3.0 restores identically.
- Manual keyboard pass over the whole form; the rendered DOM for Q2, Q5, and Q16 is structurally equivalent to v0.3.0 (same native controls, same names).
- Structural-lint allowlist shrinks to the report's remaining field-name reads, engine specials (H6–H9, H21), and constants (H1).

**Risks.** The rendered markup shifts slightly and takes CSS with it. Budget for it here rather than discovering it in P3, and keep the class names stable where the DOM shape is unchanged.

**Rollback.** Revert the phase PR. P1's interpreter cutover stays.

---

## 7. P3 — Report pass

**Goal.** Implement EXT-UI's output path: wholesale rebuild, one live region, trimmed on-screen report.

**Why now.** The input path is generic, so the report is the last place that still reads answers by name *on screen*. Doing it directly after P2 keeps all UI churn — and the accessibility re-check both phases need — in one window.

**In scope**

- Wholesale rebuild of `#report-body` on every change; the form is never rebuilt (EXT-UI §6.2).
- One delegated `input`/`change` listener; `refresh()` as the single path.
- The summary line: the only `aria-live` region, and the sticky mobile bar (EXT-UI §8.3). **Move `aria-live` off `#report` onto that line** — today the whole report column is live, which is the opposite of EXT-UI §8.3.
- Section trimming: team profile and the Q17 note come off the **screen** and stay in the Markdown (EXT-UI §8.1). This is not H20. H20 is `toMarkdown` naming those fields, and it stays until P4 gives it `pack.report.profileFields`.
- Empty state (EXT-UI UD4): suppress the fallback card until at least one rule-relevant answer exists. **This is UI-only.** The engine still returns the OpenSpec fallback for `{}`; G-PARITY is unchanged. A DOM or render-function test asserts the empty state, because the parity gate cannot see it.
- Other states: fallback banner, no-runtime-match, `?selftest` banner (EXT-UI §8.4).
- Debounced (300 ms) `history.replaceState`; immediate report updates.
- Two actions plus Reset; the long-link warning above ~1,800 characters.
- CSS pass to the EXT-UI §9.2 budget; accessibility pass to §9.1.

**Out of scope.** Changing `toMarkdown` output. The Markdown keeps the profile and the mismatch note, which is why G-MARKDOWN still applies unchanged through this phase.

**Exit criteria**

- G-PARITY and G-MARKDOWN green — the screen changed, the export did not.
- Report rebuild measured under 10 ms; input-to-render under the 50 ms of DESIGN.md N3.
- A jsdom (or equivalent) test: after `renderReport`, the form node's identity is unchanged and a focused input remains focused. Lighthouse ≥ 95 and keyboard-only completion stay **manual** — they are not CI gates, and this plan does not add a browser runner.
- UI layer within the ~500-line budget, or a recorded reason.

**Rollback.** Revert the PR; P2's generic input path is independent and stays.

---

## 8. P4 — Pack extraction and build pipeline

**Goal.** Move all data out of `index.html` into `packs/finance-tech.json`, and make the build script the only way it gets back in.

**Why now.** Predicates already evaluate as expressions (P1) and questions already have a describable shape (P2), so this phase is a serialization plus a build loop — not an interpreter cutover and not a form rewrite.

**In scope**

- Author `packs/finance-tech.json`: meta, settings, frameworks, sections, questions, derived, rules, report config, and all ~40 fixtures (EXT-CONFIG §7). Rule `when` values are the expressions already living in the JS literals.
- `compilePack()` at boot: topo-sort derived, index fields, precompute the codec, compute the digest.
- `toMarkdown` profile block reads `pack.report.profileFields` (H20). Same fields, same order, same Markdown — G-MARKDOWN stays green.
- Delete the remaining settings constants (H1) in favour of `pack.settings` and per-field `maxLength` (Q17's 500 is the text field's constraint, not a global).
- `tools/build.mjs`, absorbing P1's inliner, gated on `validate.mjs` (EXT-CONFIG CD16), with a `--strip-fixtures` flag for the release build. It inlines **both** the pack and `src/expr.mjs`.
- `?selftest` becomes a thin runner over pack fixtures (H22); the 280-line in-page fixture body is deleted.
- CI runs `validate` → `build` → assert `index.html` matches the freshly built artifact, which is how a hand-edited inline block gets caught.

**Out of scope.** The four remaining special cases (P5). A second pack (P6).

**Exit criteria**

- G-PARITY and G-MARKDOWN green.
- Structural lint allowlist contains **only** the four special cases P5 removes (H6–H9, H21).
- `index.html` under 150 KB (DESIGN.md N6) with fixtures stripped.
- Round-trip: `validate` → `build` → `?selftest` all green from a clean checkout, with Node used only for the tools, not to *run* the page.
- Boot time (compile + first render) under 50 ms.

**What "the goal is met" means here, honestly.** After P4 a non-developer can change a question, an enum, a threshold, a simple base/overlay/caution, or a framework's metadata, then run two commands. They **cannot** yet express a rule-4-style split, a `forceOverlayB`-style flag, or a conditional note without the remaining JS special cases. That is CG2 for the common edits, not yet CG1. Do not publish an authoring guide at this point that implies the special cases are pack data.

**Tripwire.** If the inlined pack pushes the file over budget even with fixtures stripped, the next lever is shortening framework prose — not splitting the file, which would reintroduce the `file://` problem DESIGN.md §6.2 rejected.

**Rollback.** Revert the PR. The interpreter and generic UI stay; data goes back to JS literals.

---

## 9. P5 — Special-case generalization

**Goal.** Remove the last four places where engine code knows about a specific rule. After this phase CG1 holds.

**In scope**

- `adoptWhen` / `ifUnavailable` branches for the rule-4 split (H6, H7).
- Named flags replacing `forceOverlayB` (H8), with the `W-FLAG-101` validator warning.
- Conditional `notes` replacing the `overlay-b` reconciliation note (H9). G-MARKDOWN still matches because the note text does not change — only its source does.
- `unaddressedBottlenecks: "auto"` replacing the hard-coded array (H21) — see §9.1. This is the one authorized Markdown diff.
- Computed `requires` closure with the `W-RULE-102` mismatch warning (EXT-CONFIG §11.4).

**Exit criteria**

- G-PARITY green.
- G-MARKDOWN green **except** the one authorized line in §9.1.
- Structural lint allowlist is empty.
- Findings A1–A3 (§11) each closed with a recorded decision.

### 9.1 The one authorized output change

The hard-coded list at `index.html:1486` names three bottlenecks as unaddressed: `interruptive_support`, `compliance_overhead`, `legacy_tech_debt`. Computing the same list from the rules gives **four** — only overlays B, C, and D declare `resolves`, so `flaky_cicd` is unaddressed too and the hard-coded line omits it. DESIGN.md §12.3 item 7 repeats the same three, so the code and the design doc agree with each other and both disagree with the rules.

This needs a decision, not a silent regeneration of the golden file:

- **Either** overlay F (deterministic CI enforcement) should declare `resolves: ["flaky_cicd"]` — arguable, since required status checks and spec-to-test traceability do address flaky CI/CD, but overlay F only fires for SOX or zero-tolerance teams with weak CI, so a team whose top bottleneck is flaky pipelines would often not get it;
- **Or** the list is right to grow to four, and DESIGN.md §12.3 is corrected alongside it.

**Decision (taken for P5):** grow the unaddressed list to four. Include `flaky_cicd` when computing from rules' `resolves`. Overlay F does **not** get `resolves: ["flaky_cicd"]` — F6 exists to name what the stack does not address; overlay F is not a general CI-reliability overlay. DESIGN.md §12.3 item 7 lists four bottlenecks. Golden Markdown under `tests/markdown/` is regenerated for this authorized §9.1 diff only.

---

## 10. P6 — Second pack, authoring guide, release

**Goal.** Prove the abstraction on a pack it was not designed around, then ship.

**In scope**

- `packs/general-engineering.json`: a non-finance questionnaire with different questions, enums, and bottleneck vocabulary, written **by following the authoring guide**, not by reading the engine.
- The authoring guide: the format, the cookbook (EXT-CONFIG Appendix B), the validator codes, the workflow.
- `validate.mjs --report` coverage output.
- CI job: `build.mjs --pack general-engineering` into a throwaway file (not committed as `index.html`), then load that file in the VM and run the pack's own fixtures. The **shipped** `index.html` remains the finance-tech pack. Two packs in one page would contradict EXT-CONFIG CF2; publishing a second downloadable HTML is a packaging decision (EXT-CONFIG CO1) and is not required to tag v0.4.0.
- Delete `tests/golden/index-v030.html`; the gates convert to snapshot-based regression against P5 finance-tech output.
- Update DESIGN.md per EXT-CONFIG §18 and EXT-UI §10.1; tag v0.4.0.

**Exit criteria**

- The second pack validates; a `--pack` build of it self-tests green; no new operator was required, or every new operator is reviewed under CD9.
- Someone other than the author follows the guide and successfully changes a threshold and adds a framework in the finance pack.

**Why this is not optional for the format, even if it is optional for the product.** An abstraction validated against exactly one instance is a rename. The second pack is the only real test of whether the six field kinds and the operator table are sufficient. Shipping v0.4.0 without it means treating the pack schema as provisional — which is the P4 stopping point, not a release.

---

## 11. Findings to resolve during implementation

Three inconsistencies in the current implementation, surfaced while writing the extensions, plus one the P1 dual-run is likely to hit. None is urgent on its own; each should be closed deliberately in the phase that touches it, rather than preserved by the parity gate forever.

| ID | Finding | Phase | Disposition |
|---|---|---|---|
| **A1** | In `selectBase`, the Tier 0 fallback path ORs in `rule4ForceB(...)`, which can only be true when the budget is metered — the exact condition under which that branch is unreachable. Dead code. | P5 | **Closed.** Disappeared with `adoptWhen` / `ifUnavailable` (no place to express the dead OR). G-PARITY confirms unchanged behaviour. Unavailable Superpowers with an unmetered budget falls through to GSD *without* overlay B. |
| **A2** | `BOTTLENECK_LABEL` and the Q16 option labels are two hand-synced copies of the same seven strings, with no drift detection. | P2 | **Closed.** Deleted; options own their labels. |
| **A3** | The hard-coded unaddressed-bottleneck list omits `flaky_cicd`, disagreeing with the rules' `resolves` declarations. DESIGN.md §12.3 has the same omission. | P5 | **Closed.** Decision §9.1: grow to four (`flaky_cicd` included); overlay F does not declare `resolves: ["flaky_cicd"]`. DESIGN.md §12.3 and Markdown goldens updated. |
| **A4** | `countSelected` on an unanswered multi-select vs current `coverageLevel(undefined) === "low"`. If §8.4 makes `countSelected(null)` return `null`, `bucket` yields `null` and rule 4's Superpowers arm does not fire; today it does, because coverage of "no answer" is treated as `low`. | P1 | Dual-run will catch it. Fix: define `countSelected` on an absent/empty multi as 0, and record that in EXT-CONFIG §8.3 as a spec correction, not a silent interpreter quirk. |

---

## 12. Stopping points

Two places where the work is genuinely shippable and the rest could be deferred without leaving a mess.

**After P4 — common edits become data.** Changing a question, threshold, or simple rule is a JSON edit plus two commands. The engine still contains four named special cases, so the pack format is **provisional**. Do not publish an authoring guide. Do not tag v0.4.0.

**After P5 — CG1 holds, format still unproven on a second instance.** Shippable as a finance-only v0.4.0-pre if P6 is delayed; still do not freeze the schema.

**After P1 — a quiet win.** If the whole effort is abandoned, P0 and P1 still leave the project with a headless test suite, a 50,000-case regression corpus, and an engine whose rules are data-shaped expressions, against a codebase that today has no automated tests at all. That is worth having on its own terms.

---

## 13. Risks and tripwires

| ID | Risk | Response |
|---|---|---|
| R1 | A parity difference appears that nobody can explain | **Stop.** Do not fix forward. An unexplained difference means the model of the old behaviour is wrong, and every later phase compounds it. |
| R2 | The expression language needs an escape hatch | **Stop** and revisit EXT-CONFIG CD9 (P1 tripwire). This is the one decision that cannot be walked back after packs exist. |
| R3 | A phase PR exceeds ~600 changed lines | Split it. P2 splits cleanly into "restructure QUESTIONS" / "generic renderers" / "generic codec"; P4 into "author pack" / "switch `evaluate` to `compilePack`" / "build script". |
| R4 | `index.html` exceeds 150 KB at P4 | `--strip-fixtures` for the release build; then shorten framework prose. Never split the file. |
| R5 | Accessibility regresses across the P2/P3 rewrite | P2's keyboard pass and P3's focus-stability jsdom test are the automated floor; Lighthouse remains a manual P3 exit check. |
| R6 | The work stalls mid-migration with the codebase half-generic | Every phase is independently shippable and independently revertable; the structural-lint allowlist makes "how far did we get" a number rather than an archaeology exercise. |
| R7 | Golden files get regenerated to make a gate pass | Regenerating a golden file requires a recorded decision in this document. Only one is authorized (§9.1). Treat any other as a bug. |
| R8 | P4 bundles interpreter cutover with JSON extraction | **Already mitigated:** P1 cuts the engine over. If a future edit tries to defer that cutover, it recreates the original sequencing bug — reject the edit. |
| R9 | Full-`Result` deep-equal is used instead of the `Rec` projection | It will fail at P1 for `when` and `derived` shape. The projection in §3.1 is the gate; do not "fix" a red run by widening the compare. |

---

## 14. Traceability

Every audit item from EXT-CONFIG §4 is assigned to exactly one phase.

| Phase | Clears |
|---|---|
| P1 | H4 `derive()` *evaluation path* (the function body; the declarations still live as JS until P4) |
| P2 | H2 `REPORT_ONLY`, H3 `BOTTLENECK_LABEL`, H5 completeness helpers, H10 `fieldPresent`, H11 completeness list, H12–H15 URL codec, H16 `renderForm`, H17 `readAnswers`, H18 `applyAnswersToForm`, H19 constraint behaviours |
| P3 | On-screen team profile and process-mismatch note (EXT-UI §8.1). Not an H-item — those H-items name `toMarkdown`. |
| P4 | H1 settings constants, H20 Markdown profile fields, H22 self-test fixtures; H4 data *location* (derived declarations move into the pack file) |
| P5 | H6 `pickRule4Framework`, H7 `selectBase` specials, H8 `forceOverlayB`, H9 overlay-B note, H21 unaddressed list |

Requirement coverage: EXT-CONFIG CF5 lands in P1; CF7/CF9 in P2; CF1–CF4, CF8, CF10, CF11 in P4; CF6 (simple case) in P4 and CF12 / full CF6 in P5. CN1–CN8 are exit criteria on the phases that can violate them. EXT-UI UP1–UP8 and §4.1 scope land in P2 (input) and P3 (output); CF11's pack identity line in the header is P4, because there is no pack identity until then. The §4.2 "not building" list is a standing constraint on every phase, and adding to it requires editing that table with a reason.
