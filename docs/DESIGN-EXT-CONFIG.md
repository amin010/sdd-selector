# SDD Selector — Design Extension: Configurable Rule Packs

| Field | Value |
|---|---|
| Status | Draft — awaiting review |
| Extension ID | EXT-CONFIG |
| Version | 0.2.0 |
| Owner | Amin Rashidi |
| Last updated | 2026-09-16 |
| Extends | `docs/DESIGN.md` v0.3.0 |
| Related | `docs/DESIGN-EXT-UI.md` (EXT-UI) |
| Implementation plan | `docs/IMPLEMENTATION-PLAN.md` — supersedes §17 with a phasing shared with EXT-UI |
| Target release | SDD Selector v0.4.0 |
| Supersedes | DESIGN.md §15 future-work item 1 |

**Changelog**

- **0.2.0** — **Authoring is offline.** Removed the runtime pack-loading surface: file picker, paste box, `?configUrl`, `localStorage` persistence, pack export, pack switching, and the in-page validator and error panel. The page ships exactly one inlined pack; the validator ships in Node only. Pack identity in the URL collapses to a plain digest marker. Security section reduced accordingly — the pack is first-party, not untrusted input. See EXT-UI §10.2 for the full cut list.
- **0.1.0** — Initial extension. Defines the rule pack format, the JSON expression language, the generic field model, pack loading and identity, validation, and a five-phase migration with a parity gate.

---

## 1. Summary

Today the questionnaire, the frameworks, and the decision rules are JavaScript object literals inside `index.html`, and roughly a third of the behaviour they describe is not in those literals at all — it is in hand-written functions that know specific question IDs (`derive`, `readAnswers`, `encodeHash`, the `base-4` split, the `overlay-b` reconciliation note). DESIGN.md G5 claims "rules are data, not code; a non-developer can adjust a threshold or add an overlay." That claim holds for a threshold. It does not hold for adding a framework, and it definitely does not hold for changing the questionnaire.

This extension makes the claim true. It introduces a **rule pack**: one JSON document that carries the frameworks, the questions, the derived views, the rules, and the pack's own regression fixtures.

**Authoring is an offline task.** A pack is edited in a text editor, validated by a Node script, and inlined into `index.html` by a build script. The page itself has no loader, no editor, and no pack switcher — it runs exactly one pack, the one built into it (EXT-UI §1). That single scoping decision removes most of the runtime machinery an earlier draft of this document proposed, and it is what keeps the page at the size and simplicity DESIGN.md N6 asks for.

Two inherited constraints shape everything below and are not negotiable: the tool must keep working when `index.html` is opened from disk over `file://` (G3), and it must stay CSP-compatible with no `eval` and no `unsafe-eval` (N5). The first is why the pack is inlined rather than fetched; the second is why predicates are an interpreted expression tree rather than JavaScript (§8).

## 2. Motivation

Three distinct people want to change this tool, and they need very different amounts of power.

**The threshold tweaker** disagrees that non-roadmap work at 40% is where brownfield safety starts, and wants 35%. Today this is a one-character edit in a JS file that a non-developer will be nervous about touching, in a 1,975-line HTML document, with no validation and no way to know whether they broke the self-test.

**The framework adder** wants to add a newly published SDD framework, give it metadata and an enforcement profile, and put it in the running for base selection. Today this means editing `FRAMEWORKS`, then writing a new entry in `BASE_RULES` with a JavaScript closure, then checking whether the `base-4` special case in `selectBase` needs to know about it, then updating `Appendix A` and `Appendix B` in the design doc by hand. That is a developer task with a design-review dependency.

**The questionnaire replacer** works outside finance and wants to keep the engine but replace the instrument — different questions, different enums, different bottleneck vocabulary. Today this is a rewrite. `derive()`, `readAnswers()`, `applyAnswersToForm()`, `encodeHash()`, `decodeHash()`, `completeness()`, `renderForm()`'s five bespoke question types, `toMarkdown()`'s profile section, and the self-test all name `q1`–`q21` literally. Changing the instrument means touching nine functions across the engine, the codec, and the UI.

The landscape argument from DESIGN.md §17 makes this urgent rather than merely nice: four of seven profiled projects shipped releases within two weeks of the evidence date, and the framework metadata is expected to rot. A rule set that only its author can safely edit will not be edited, and a tool whose recommendations are stale is worse than no tool, because it is stale with confidence.

## 3. Goals and non-goals

### Goals

| ID | Goal |
|---|---|
| CG1 | Everything that determines a recommendation lives in one declarative pack document: frameworks, questions, derived views, base rules, overlays, cautions, settings. |
| CG2 | No JavaScript is required to add a framework, add or remove a question, change an enum, or add an overlay or caution. |
| CG3 | No pack-supplied string is ever executed. Predicates are an interpreted JSON expression tree, not code. |
| CG4 | The page ships one inlined pack and needs no server, no fetch, and no runtime loader, preserving G3 (`file://`) and N1. |
| CG5 | Invalid packs are caught offline by a validator with actionable, located error messages, and can never fail silently at evaluation time. |
| CG6 | A pack carries its own regression fixtures, so "did my edit break something" is answerable by running the page or the validator. |
| CG7 | The v0.4.0 engine reproduces v0.3.0 output exactly for the built-in pack, proven by a parity harness (§16.1), not by inspection. |
| CG8 | A shared URL cannot be silently misread by a page built from a different version of the pack. |

### Non-goals

- **Not a general-purpose survey builder.** The pack format serves this decision model: questions feed rules, rules select one base plus overlays plus cautions. Branching question flow, scoring quizzes, and conditional page logic are out of scope.
- **Not a runtime pack loader.** No file picker, no paste box, no `fetch`, no `localStorage`, no pack switcher, no export. Editing happens offline and is followed by a rebuild (§13, EXT-UI §10.2).
- **Not a plugin system.** Packs are data. If a pack needs behaviour the expression language cannot express, the answer is a reviewed new operator in the interpreter, not an escape hatch (CD9).
- **Not a pack registry or marketplace.** No discovery, no signing, no remote index in v1 (CO4).
- **Not a visual pack editor.** JSON plus a validator plus good error messages in v1 (CO3).
- **Not a change to the recommendations themselves.** v0.4.0 ships the current rules, re-expressed. Any change in output is a bug until the parity gate says otherwise.
- **Not report-layout templating.** Report *strings* become configurable; report *structure* stays in code (CD12).

## 4. What blocks configurability today

An audit of every place the current implementation hard-codes knowledge that belongs in a pack. This table is the work list; §17's phases are organized around clearing it.

| # | Location | Hard-coded coupling | Resolved by |
|---|---|---|---|
| H1 | `index.html:103–106` | `SCHEMA_VERSION`, `FALLBACK_BASE`, `STALE_DAYS`, `Q17_MAX` as module constants | `pack.settings` (§7.2) |
| H2 | `index.html:107` | `REPORT_ONLY` map duplicating the `reportOnly` flag already on questions | Derived from field metadata |
| H3 | `index.html:119` | `BOTTLENECK_LABEL` as a second source of truth for Q16 option labels | Option labels on the ranked field (§9.4) |
| H4 | `index.html:421` | `derive()` names `q5_work_breakdown`, `q2_team`, `q6_volatility`, `q12_quality_gates` literally | `pack.derived` (§10) |
| H5 | `index.html:395, 407` | `q5Complete` / `q2RulesComplete` encode per-question validity | Record constraints (§9.5) |
| H6 | `index.html:481–492` | `pickRule4Framework` / `rule4ForceB`: the entire rule-4 split lives in code | `adoptWhen` branches (§11.1) |
| H7 | `index.html:746–757` | `selectBase` branches on `rule.id === "base-4"` and on framework `"superpowers"` | `adoptWhen` + `ifUnavailable` (§11.1) |
| H8 | `index.html:758` | `forceOverlayB` is a bespoke result field threaded into overlay evaluation | Named flags (§11.2) |
| H9 | `index.html:774` | `applyOverlays` special-cases `overlay-b` and `financial_reconciliation` | Conditional notes (§11.3) |
| H10 | `index.html:829–837` | `fieldPresent` special-cases three field IDs by name | Kind-driven presence (§9.6) |
| H11 | `index.html:852–859` | `completeness` iterates a hand-maintained list of 23 field IDs | Enumerated from pack fields |
| H12 | `index.html:982–992` | `HASH_TO_FIELD` is a hand-maintained bidirectional map | `hashKey` per field (§12.2) |
| H13 | `index.html:994–1004` | `allowedValues` falls back to four inline enum lists for compound sub-fields | Options on record sub-fields |
| H14 | `index.html:1012–1047` | `encodeHash` has per-field branches for Q2, Q5, multi-selects, and Q17 | Kind-driven codec (§12.2) |
| H15 | `index.html:1049–1098` | `decodeHash` likewise, plus inline `dedicated/shared/none` validation | Kind-driven codec |
| H16 | `index.html:1519–1638` | `renderForm` has five bespoke branches (`percents`, `team`, `q4`, `q11`, `ranked`) with hard-coded sub-field names and labels | Six generic kinds (§9.2) |
| H17 | `index.html:1640–1703` | `readAnswers` is 60 lines of per-field extraction | Generic `FormData` walk |
| H18 | `index.html:1705–1752` | `applyAnswersToForm` mirrors it | Generic restore |
| H19 | `index.html:1754–1778` | `preventRankDupes` and `updateQ5Sum` query `#q16-1`, `#q5-roadmap` by ID | Constraint-driven UI behaviour (§9.5) |
| H20 | `index.html:1421–1429` | `toMarkdown`'s "Team profile" section names Q1, Q2, Q4, Q11, Q13 | `pack.report.profileFields` (§7.7) |
| H21 | `index.html:1486` | The list of bottlenecks no overlay addresses is a hard-coded array | Computed from `resolves` across rules |
| H22 | `index.html:1118–1396` | The self-test asserts against literal rule IDs and answer shapes | Pack fixtures (§16.2) |

Two findings fell out of the audit and are worth recording independently of this extension:

- **A1 (dead branch).** In `selectBase`, when the rule-4 pick is `superpowers` but it was filtered out by Tier 0, the code re-evaluates `rule4ForceB` and ORs it into the flag. That call can only return true when the budget is metered, and the metered budget is exactly the condition under which `pickRule4Framework` would not have returned `superpowers`. The OR is unreachable-true. Expressing the branch as data (§11.1) makes this visible rather than hiding it in a boolean expression.
- **A2 (silent divergence risk).** `BOTTLENECK_LABEL` (H3) and the Q16 option labels are two copies of the same seven strings, kept in sync by hand. Nothing detects drift.

## 5. Requirements

### 5.1 Functional

| ID | Requirement |
|---|---|
| CF1 | The page reads a **rule pack** — one JSON document conforming to §7 — and renders the form, engine, and report entirely from it. |
| CF2 | Exactly one pack is inlined in `index.html`. It is the only pack the page can run, and the page works from disk with no input. |
| CF3 | A pack is authored as a standalone JSON file, validated by `tools/validate.mjs`, and inlined by `tools/build.mjs`. Neither tool is needed to *run* the page. |
| CF4 | Validation runs offline and in CI. A pack that fails validation cannot be built into the page. |
| CF5 | Rule predicates are expressions in the language of §8, interpreted by the engine. The engine never calls `eval`, `new Function`, `setTimeout(string)`, or `innerHTML` on pack content. |
| CF6 | Adding a framework requires only a new entry in `pack.frameworks` plus, if it should be selectable as a base, a rule referencing it. |
| CF7 | Adding, removing, reordering, or re-enumerating a question requires only an edit to `pack.questions`. Form, validation, URL codec, completeness, and report follow automatically. |
| CF8 | Derived views are declared in the pack, evaluated in dependency order, and reported in the explanation trail exactly as today. |
| CF9 | The URL fragment carries a digest of the pack's answer-affecting surface (§12.3). A fragment from an incompatible pack version is refused with a visible notice rather than partially applied. |
| CF10 | A pack may carry fixtures. `?selftest` runs engine invariants plus every fixture and reports pass/fail on the page; `tools/validate.mjs` runs the same fixtures in CI. |
| CF11 | The pack's id, version, and evidence date are displayed in the UI and included in the Markdown report. |
| CF12 | Where v0.3.0 hard-codes a behaviour for one specific rule (H6–H9, H21), the pack format expresses it generically and the built-in pack reproduces it. |

### 5.2 Non-functional

| ID | Requirement |
|---|---|
| CN1 | The page issues no network requests at all. Everything it needs is in the file. |
| CN2 | No `unsafe-eval`, no `unsafe-inline` beyond what the current single-file page already requires; the interpreter is pure data traversal. |
| CN3 | Evaluation stays under the N3 budget: input change to rendered result < 50 ms with the built-in pack. The interpreter's added cost is budgeted at < 5 ms. |
| CN4 | `index.html` with the pack inlined stays under the N6 budget of 150 KB uncompressed. The validator does not ship in the page and does not count against it (CD17). |
| CN5 | Expression evaluation is total: no pack input causes a thrown exception or a non-terminating loop. Guarded by a node-count budget per predicate (§8.6). |
| CN6 | Evaluation is deterministic: no clock, no randomness, no locale-sensitive comparison, no host access. `Date.now()` enters only as the injected `now` for evidence staleness. |
| CN7 | Validation of a 200 KB pack completes in under 2 s in Node — a build-time budget, not an interactive one. |
| CN8 | Accessibility (N4) is preserved for every generic field kind, including the compound kinds that replace the bespoke renderers. |

## 6. Architecture

### 6.1 Pipeline

Two pipelines, cleanly separated by when they run. Authoring-time work happens in Node and never ships; runtime work happens in the page and never validates.

```
── offline (Node, tools/) ──────────────────────────────────────────────────
  packs/finance-tech.json
        │
        ▼
  validate.mjs   →  Diagnostic[]  →  non-zero exit in CI on any error
        │
        ▼
  build.mjs      →  inlines the pack into index.html between markers

── runtime (the page) ──────────────────────────────────────────────────────
  inlined pack
        │
        ▼
  compilePack()                          once, at boot
    · topo-sort derived definitions
    · index fields by id
    · precompute the hash codec
    · compute the pack digest
        │
        ├──────────────▶ renderForm(pack)            once
        │
        ▼
  evaluate(answers, pack)  →  derive → tierZero → selectBase
                                     → applyOverlays → applyCautions
                                     → buildMatrix
        │
        ▼
  renderReport / toMarkdown
```

A **compiled pack** is a frozen object: the pack source plus the indexes the engine and UI would otherwise rebuild on every keystroke. Compilation happens once at boot, not per evaluation, which is how CN3 is met.

Note what the runtime pipeline does *not* contain: any validation. The page assumes a valid pack because the only way a pack reaches the page is through `build.mjs`, which refuses to run on a pack `validate.mjs` rejects. Runtime validation would be ~600 lines of code in the size budget, defending against an input that cannot occur (CD17).

### 6.2 Layer boundaries after the change

| Layer | Knows about | Must not know about |
|---|---|---|
| Pack (JSON) | Questions, enums, frameworks, thresholds, rule logic, prose | DOM, engine internals, JavaScript |
| Validator (Node only) | Pack schema, expression grammar, referential integrity | Answers, DOM, the specific finance instrument |
| Interpreter | Expression grammar, null semantics, the answer/derived/result namespaces | Field names, framework IDs, rule IDs |
| Engine | Tiers, ordering, overlay/caution mechanics, compiled pack shape | Any literal question or framework ID |
| UI | Field kinds, sections, report sections | Any literal question or framework ID; pack validity |

The test for whether this is achieved is mechanical and belongs in CI: **after Phase 3, no string matching `/\bq\d+_/` and no framework ID literal may appear outside the inlined pack.** A lint script asserts it (§16.4).

### 6.3 Why a pack format rather than the alternatives

| Alternative | Rejected because |
|---|---|
| Keep JS object literals, document them better | Does not help the threshold tweaker (no validation, no self-test feedback) and does nothing for the questionnaire replacer. Predicates stay code, so packs can never be shared as data. |
| Predicates as JavaScript strings evaluated with `new Function` | Requires `unsafe-eval`, violating N5, and turns a shared link or pasted pack into arbitrary code execution. Non-starter. |
| Adopt JsonLogic | Real prior art and tempting, but it is a third-party dependency (N5), its truthiness coercions are loose enough to make a missing answer behave like `false` in ways that differ per operator, and it has no concept of "unanswered." Our null semantics (§8.4) are the core of correct completeness reporting. We borrow the shape, not the library. |
| YAML packs | More pleasant to hand-edit, but requires a parser in the page (N5, N6). JSON is native. The authoring guide recommends editing with a JSON schema in an editor instead. |
| Let users load packs at runtime (file picker, paste box, URL) | Proposed in v0.1.0 of this document and cut. It adds a loader, a persistence story, a revert affordance, an in-page validator with an error panel, and an untrusted-input threat model — all to serve an authoring task that happens a few times a year and is better done in a text editor with a diff and a CI check. DESIGN.md §6.2's original objection to an external rules file stands and is honoured by inlining. |
| Server-side rule service | Reintroduces every hosting and data-handling obligation DESIGN.md §6.2 rejected. |
| Full SPA with a build step and typed rules | Rules would be typed and testable, but packs could then only be authored by developers with the toolchain — which is the problem this extension exists to solve. |

### 6.4 Relationship to weighted scoring

DESIGN.md §15 item 2 anticipates replacing first-match-wins with weighted scoring. That is a change to the engine's selection strategy, not to the pack format, provided the format leaves room now. Two hooks are reserved and ignored in v1: `settings.selection.strategy` (`"first_match"` in v1) and an optional numeric `score` on base rules. Declaring them now means the eventual change does not break existing packs (CD13).

## 7. Pack format

### 7.1 Top level

```ts
type Pack = {
  schema: 1;                      // pack format version, not questionnaire version
  meta: PackMeta;
  settings: Settings;
  strings?: Record<string, string>;   // UI copy overrides; unknown keys ignored
  frameworks: Framework[];            // array, not map: order is display order
  sections: Section[];
  questions: Question[];
  derived: DerivedDef[];              // declaration order irrelevant; topo-sorted
  baseRules: BaseRule[];              // ordered; first match wins
  overlays: OverlayRule[];            // unordered
  cautions: CautionRule[];            // unordered; sorted by severity at render
  report?: ReportConfig;
  fixtures?: Fixture[];
};

type PackMeta = {
  id: string;                     // stable slug, e.g. "finance-tech"
  version: string;                // semver of this pack's content
  title: string;                  // shown in the UI header
  description?: string;
  instrumentSource?: string;      // provenance of the questionnaire
  authors?: string[];
  updated: string;                // ISO date
};
```

`frameworks` is an array rather than the current keyed object so that display order is authored rather than accidental, and so a validator can report `frameworks[3]` positionally. The compiler builds the by-ID index.

### 7.2 Settings

Replaces H1 and the Tier 0 hard-coding.

```ts
type Settings = {
  fallbackBase: string | null;    // framework id, or null for "insufficient signal" (CO1 / DESIGN O3)
  staleDays: number;              // default 180
  selection?: { strategy?: 'first_match' };   // reserved, §6.4
  tierZero?: {
    runtimeField?: string;        // field id holding the multi-select of runtimes
    frameworkKey?: string;        // framework property to intersect with; default "runtimes"
    excludeStatusesFromBase?: string[];   // default ["watch"]
    onEmptyCandidates?: 'no_match' | 'ignore_filter';   // default "no_match"
  };
  ratings?: Array<{ key: string; label: string; min: number; max: number; lowLabel: string; highLabel: string }>;
  statuses?: Array<{ id: string; label: string; selectableAsBase: boolean; badge?: string }>;
  enforcementClasses?: Array<{ id: string; label: string; description: string }>;
};
```

Making `statuses` and `enforcementClasses` pack data rather than code is what lets a non-finance pack use a different vocabulary while the report still renders correctly. `fallbackBase: null` finally gives DESIGN.md's open question O3 a real answer: it becomes a pack-level choice rather than a design argument.

### 7.3 Frameworks

Structurally the current `Framework` type (DESIGN.md §7.2) with three changes: `id` moves inside the object, the four editorial ratings collapse into an open `ratings` map keyed by `settings.ratings[].key`, and `status` is validated against `settings.statuses`.

```ts
type Framework = {
  id: string;
  name: string;
  repo: string;
  status: string;                 // must match a settings.statuses[].id
  evidence: {
    verifiedOn: string;           // ISO date; required — drives F14 staleness
    stars?: number; forks?: number; openIssues?: number;
    latestRelease?: string; commitsLast30d?: number | 'unknown';
    language?: string; license?: string; created?: string;
  };
  runtimes: string[];
  ratings: Record<string, number>;      // keys validated against settings.ratings
  install: string;
  commands: string[];
  artifacts: string[];
  enforcement: Array<{ practice: string; class: string; note: string }>;  // class ∈ settings.enforcementClasses
  notes?: string;                 // free prose shown on the framework card
};
```

Requiring `evidence.verifiedOn` is deliberate: a pack author adding a framework is forced to state when they checked, which is the mechanism behind DESIGN.md G9 and F14. A pack whose oldest `verifiedOn` exceeds `settings.staleDays` renders the staleness warning exactly as today — including for packs the maintainers never saw.

### 7.4 Sections and questions

```ts
type Section = { id: string; title: string; intro?: string };

type Question = {
  id: string;                     // presentation grouping id, e.g. "q2"
  number?: string;                // display label, e.g. "Q2"
  section: string;                // section id
  legend: string;
  help?: string;
  reportOnly?: boolean;           // default false; excluded from couldChangeResult
  fields: Field[];                // one or more; compound questions are multi-field
};
```

The split between *question* (a presentation unit with a legend) and *field* (an answer key) is the central modelling decision (CD4). It is what turns the five bespoke renderers of H16 into generic ones. Q4 and Q11 become one question with two `single` fields each; Q2 becomes one question with one `record` field; Q5 becomes one question with one `record` field carrying a `sumTo` constraint. Crucially, **the answer keys do not change** — `q4_tenure` and `q4_domain_familiarity` remain separate top-level keys — which is what makes the parity gate (CG7) achievable.

### 7.5 Rules

All three rule families share the base shape, matching DESIGN.md §7.3, with `when` now an expression rather than a function.

```ts
type RuleBase = {
  id: string;
  label: string;
  when: Expr;
  requires?: string[];            // field ids; optional — see CD7
  notes?: Array<{ when: Expr; text: string }>;   // replaces H9
  resolves?: string[];            // option values of the ranked bottleneck field
};

type Adopt = {
  framework: string | null;       // null = practice belongs to no framework (overlay F)
  practice?: string;
  artifacts?: string[];           // defaults to the framework's artifacts
  commands?: string[];            // defaults to the framework's commands
  rationale: string;
};

type BaseRule = RuleBase & {
  adopt: Adopt;                   // the default / else branch
  adoptWhen?: AdoptBranch[];      // ordered; first match wins; replaces H6/H7
  score?: number;                 // reserved, §6.4
};

type OverlayRule = RuleBase & {
  adopt: Adopt;
  providedByBase?: string[];      // framework ids for which this is "included in base"
};

type CautionRule = RuleBase & {
  caution: {
    severity: 'high' | 'medium';
    kind: 'warning' | 'positive';
    finding: string;
    mitigation: string;
    source: string;
  };
};
```

### 7.6 Fixtures

A pack carries its own regression suite. This is what makes CG6 real: the person who changed a threshold gets an immediate, specific answer about what else moved.

```ts
type Fixture = {
  name: string;
  answers: Answers;               // validated against the pack's own fields
  expect: {
    base?: string | null;         // framework id, or null for no-match
    fallback?: boolean;
    runnerUp?: string | null;
    overlays?: string[];          // exact set of overlay rule ids, order-insensitive
    overlaysIncludedInBase?: string[];
    cautions?: string[];          // exact set of caution ids
    derived?: Record<string, unknown>;
    noRuntimeMatch?: boolean;
    couldChangeResult?: string[];
  };
};
```

Only the keys present are asserted, so a fixture can pin one overlay without over-specifying the whole result. The built-in pack ports every fixture listed in DESIGN.md §14.1.

### 7.7 Report configuration

Structure stays in code (CD12); the pack controls which answers appear in the profile block and supplies prose.

```ts
type ReportConfig = {
  profileFields?: string[];           // replaces H20's hard-coded Q1/Q2/Q4/Q11/Q13 list
  freeTextFields?: string[];          // rendered verbatim, never passed to evaluate() — DESIGN D20
  directoryLayoutRoot?: string;       // default "repo/"
  unaddressedBottlenecks?: 'auto' | 'none';   // "auto" computes H21 from rule.resolves
  sectionTitles?: Record<string, string>;
};
```

`unaddressedBottlenecks: "auto"` removes the hard-coded array at `index.html:1486` by computing the complement of the union of every rule's `resolves` against the ranked field's options — which also means it can never drift from the rules the way the current literal can.

## 8. Expression language

### 8.1 Shape

An expression is a JSON value. Objects with exactly one key drawn from the operator table are operator nodes; every other JSON value is a literal.

```json
{"all": [
  {"gte": [{"derived": "nonRoadmapShare"}, 40]},
  {"in": [{"answer": "q10_architecture"}, ["monolith", "hybrid", "batch_data"]]}
]}
```

The single-key-object form was chosen over a prefix-array form (`["gte", ..., 40]`) because it reads better in a diff, survives JSON formatters intact, and lets the validator report `baseRules[0].when.all[1].in` as a path rather than an index chain.

### 8.2 Namespaces

| Node | Yields | Notes |
|---|---|---|
| `{"answer": "field_id"}` | The answer value, or `null` if absent | Dotted paths address record sub-fields: `q2_team.total` |
| `{"derived": "key"}` | A derived value | Must be a declared key; cycles rejected at validation |
| `{"result": "baseFramework"}` | Framework id of the selected base | Cautions only |
| `{"result": "baseRule"}` | Rule id of the selected base | Cautions only |
| `{"result": "overlays"}` | Array of fired overlay rule ids | Cautions only |
| `{"flag": "name"}` | `true` if the flag was set during base selection | Overlays and cautions (§11.2) |
| `{"rank": {"field": "f", "of": "value"}}` | 1-based rank, or `null` if not ranked | Ranked fields only |

A `{"result": ...}` node inside a base rule or overlay is a validation error, not a runtime surprise — the phase in which each namespace becomes available is part of the grammar.

### 8.3 Operators

| Category | Operators | Arity | Returns |
|---|---|---|---|
| Logic | `all`, `any` | list | boolean |
| | `not` | 1 | boolean |
| Comparison | `eq`, `ne` | 2 | boolean |
| | `gt`, `gte`, `lt`, `lte` | 2 | boolean (numbers only) |
| Membership | `in` | value, list | boolean |
| | `hasAny`, `hasAll`, `hasNone` | multi-value, list | boolean |
| Presence | `isSet` | 1 | boolean |
| Ranking | `rankAtMost` | `{field, of, n}` | boolean |
| Arithmetic | `add`, `sub`, `mul`, `min`, `max` | 2+ | number or null |
| | `sumFields` | `{field, keys}` | number or null |
| | `count` | list | number |
| | `countSelected` | `{field, except?}` | number (0 if the field is absent or empty) |
| Mapping | `bucket` | `{value, cuts, else}` | string or null |
| | `coalesce` | list | first non-null |

Anything not in this table is `E-EXPR-031` at validation time. There is no user-defined operator mechanism and no arbitrary property access, which is what keeps CN5 provable by inspection.

### 8.4 Null semantics

The most important part of the specification, because it is what makes DESIGN.md's completeness reporting (F10) correct rather than approximate. `null` means **unanswered or not yet valid**, and it is distinct from `false`.

| Situation | Result | Rationale |
|---|---|---|
| `{"answer": "x"}` where `x` is absent | `null` | |
| `{"answer": "rec.k"}` where the record fails its constraints | `null` | Reproduces `q5Complete` / `q2RulesComplete` (H5) without naming them |
| Arithmetic with any `null` operand | `null` | Propagation: a partial sum is not a number |
| Ordered comparison with a `null` operand | `false` | Absorption at the predicate boundary |
| `eq`/`ne` with a `null` operand | `false` | `ne` is *not* `not(eq)` here; both are false on unknown input, so "unanswered" never satisfies a rule by accident |
| `in` / `hasAny` / `hasAll` with a `null` left side | `false` | |
| `hasNone` with a `null` left side | `false` | Deliberately not `true`: an unanswered multi-select must not satisfy a negative test |
| `not(null)` | `false` | |
| `all` / `any` over `null` members | `null` treated as `false` | |
| `isSet` | always boolean | The only way to test for unknown |
| `bucket` on a `null` value | `null` | |
| `countSelected` on an absent or empty multi-select | `0` | Matches today's `coverageLevel(undefined) === "low"`. An unanswered Q12 must not behave as "coverage unknown" or rule 4's Superpowers arm silently stops firing. |

The rule authors need to remember is one sentence: **an unanswered question never makes a rule fire.** Current behaviour, now written down and unit-tested per operator rather than emerging from JavaScript coercion.

### 8.5 Worked translations

Every existing predicate translates without loss. Four representative cases:

Base rule 1, the brownfield/non-roadmap gate (`index.html:498–502`):

```json
{"any": [
  {"gte": [{"derived": "nonRoadmapShare"}, 40]},
  {"in": [{"answer": "q10_architecture"}, ["monolith", "hybrid", "batch_data"]]}
]}
```

Base rule 2, which today needs an explicit `q5Complete` guard before it may read `roadmap` (`index.html:510–512`). Under §8.4 the guard is structural — an invalid record yields `null`, and `gte` against `null` is `false`:

```json
{"all": [
  {"gte": [{"answer": "q5_work_breakdown.roadmap"}, 60]},
  {"eq":  [{"answer": "q10_architecture"}, "microservices"]},
  {"eq":  [{"answer": "q7_requirements"}, "structured"]},
  {"not": {"derived": "volatilityIsHigh"}}
]}
```

Overlay B, including the rank-sensitivity that DESIGN.md §14.1 tests ("`test_fear` at rank 2 fires, at rank 3 does not") and the flag that replaces `forceOverlayB`:

```json
{"any": [
  {"eq": [{"answer": "q9_precision"}, "zero_tolerance"]},
  {"rankAtMost": {"field": "q16_bottlenecks", "of": "test_fear", "n": 2}},
  {"flag": "force_tdd_overlay"}
]}
```

Caution C2, reading the partial result:

```json
{"all": [
  {"hasAny": [{"result": "overlays"}, ["overlay-a"]]},
  {"eq": [{"answer": "q8_compliance"}, "sox_tier1"]}
]}
```

### 8.6 Evaluation limits

Guarding CN5 against both hostile and merely careless packs:

- **Depth limit** 32 nodes, enforced at validation (`E-EXPR-033`).
- **Node budget** 10,000 evaluations per predicate, enforced at runtime. Exceeding it yields `false` plus a diagnostic in the report's debug panel rather than a throw. Validation already caps depth, so this is a backstop, not an expected path.
- **No recursion.** Expressions are trees; `derived` references are resolved through the topologically ordered table, not by re-entering the interpreter on an unbounded graph. Cycles are `E-REF-042` at validation.

## 9. Field model

### 9.1 Answers

Unchanged in shape from DESIGN.md §7.1: a flat object keyed by field id, where `record` fields hold one level of nesting. This is a hard constraint, not a convenience — the parity harness compares v0.3.0 and v0.4.0 output over the same answer objects, which is only meaningful if the answer shape is identical.

### 9.2 Kinds

Six kinds replace the eight ad-hoc `type` values of the current `QUESTIONS` array.

```ts
type Field =
  | { kind: 'single';  id: string; label?: string; options: Option[] }
  | { kind: 'multi';   id: string; label?: string; options: Option[]; min?: number; max?: number }
  | { kind: 'number';  id: string; label?: string; min?: number; max?: number; integer?: boolean }
  | { kind: 'text';    id: string; label?: string; maxLength: number }
  | { kind: 'ranked';  id: string; label?: string; options: Option[]; ranks: number; unique?: boolean;
                       rankLabels?: string[] }
  | { kind: 'record';  id: string; label?: string; fields: Field[];
                       constraints?: { sumTo?: number; requiredKeys?: string[] } };

type Option = { value: string; label: string; help?: string };
```

The mapping from today:

| Today | Becomes |
|---|---|
| `type: "radio"` | `single` |
| `type: "checkbox"` | `multi` |
| `type: "textarea"` | `text` |
| `type: "percents"` (Q5) | `record` of five `number` fields, `constraints.sumTo: 100` |
| `type: "team"` (Q2) | `record` of four `number` fields and two `single` fields, `constraints.requiredKeys` |
| `type: "q4"` | one question, two `single` fields |
| `type: "q11"` | one question, two `single` fields |
| `type: "ranked"` (Q16) | `ranked` with `ranks: 3`, `unique: true` |

`q4` and `q11` disappear entirely as concepts: they were never data shapes, only renderers that happened to emit two radio groups under one legend. Fields inside a question render under one `<fieldset>` with the question's legend, each field getting its own sub-label — which is exactly what the bespoke code produces today, so the rendered DOM is near-identical and the N4 accessibility posture carries over unchanged.

### 9.3 Rendering contract

One generic renderer per kind, keyed off `kind`, emitting the same native controls as today (radios, checkboxes, number inputs, textarea, selects). `readAnswers` becomes a walk over the compiled field index reading `FormData` by field id; `applyAnswersToForm` becomes its inverse. H16–H18 collapse from roughly 170 lines of per-question code into six small functions plus a walk.

### 9.4 Vocabularies

Option labels are the single source of truth for their values. `BOTTLENECK_LABEL` (H3, A2) disappears: the report looks up the ranked field's options. Any pack that adds an eighth bottleneck gets it in the matrix and the "not addressed" line with no code change.

### 9.5 Constraints and validity

Record constraints do triple duty, which is why they are worth the schema weight:

1. **Validity gate.** A record failing `sumTo` or `requiredKeys` yields `null` for itself and for every dotted path into it (§8.4). This reproduces `q5Complete` / `q2RulesComplete` (H5) declaratively.
2. **Completeness.** `isSet` on an invalid record is `false`, so the field appears in `missing` and, if a rule requires it, in `couldChangeResult`.
3. **UI affordance.** `sumTo` renders the live sum indicator and the inline error (today's `updateQ5Sum`, H19); `unique` on a `ranked` field disables duplicate options across rank selects (today's `preventRankDupes`). Both become generic behaviours triggered by the constraint's presence.

### 9.6 Presence

`fieldPresent` (H10) becomes a `switch` on kind: `single`/`text` non-empty; `multi`/`ranked` non-empty array; `number` finite and within bounds; `record` satisfies its constraints. No field id appears in the function.

## 10. Derived views

```ts
type DerivedDef = {
  key: string;
  expr: Expr;
  label?: string;            // shown in the explanation trail and debug panel
  description?: string;
};
```

The current `derive()` (H4) becomes eight declarations. Dependency order is computed at compile time by topological sort over `{"derived": ...}` references; a cycle is `E-REF-042`.

```json
[
  { "key": "unplannedShare",
    "expr": {"sumFields": {"field": "q5_work_breakdown", "keys": ["ops", "bugs"]}} },

  { "key": "nonRoadmapShare",
    "expr": {"sumFields": {"field": "q5_work_breakdown",
                           "keys": ["ops", "bugs", "regulatory", "tech_debt"]}} },

  { "key": "volatilityIsHigh",
    "expr": {"in": [{"answer": "q6_volatility"}, ["high", "interrupt_driven"]]} },

  { "key": "coverageLevel",
    "expr": {"bucket": {
      "value": {"countSelected": {"field": "q12_quality_gates", "except": ["mostly_manual"]}},
      "cuts": [{"lte": 0, "then": "low"}, {"lte": 2, "then": "partial"}],
      "else": "high"}} },

  { "key": "teamSize", "expr": {"answer": "q2_team.total"} },

  { "key": "hasProductOwner",
    "expr": {"in": [{"answer": "q2_team.product_owner"}, ["dedicated", "shared"]]} },
  { "key": "hasScrumMaster",
    "expr": {"in": [{"answer": "q2_team.scrum_master"}, ["dedicated", "shared"]]} },
  { "key": "hasQaSdet",
    "expr": {"gte": [{"answer": "q2_team.qa_sdet"}, 1]} }
]
```

The nested `hasRoles` object flattens into three boolean keys (CD6). Base rule 3 currently short-circuits on `if (!d.hasRoles) return false`; with an invalid `q2_team` record every dotted read is `null`, `in` and `gte` return `false`, and the conjunction fails identically. Flat keys keep the interpreter free of structured derived values, and the parity harness proves the equivalence rather than assuming it.

## 11. Generalizing the special cases

### 11.1 Conditional adoption (replaces H6, H7)

The rule-4 split — the one place where DESIGN.md's D3′ decision lives in code rather than data — becomes an ordered branch list evaluated after the rule's `when` fires. `ifUnavailable` handles the Tier 0 interaction that `selectBase` currently hard-codes against the literal `"superpowers"`.

```json
{
  "id": "base-4",
  "label": "Compact autonomous team, frequent deploys",
  "requires": ["q2_team", "q11_deploy_cadence", "q14_release_autonomy",
               "q12_quality_gates", "q18_token_budget"],
  "when": {"all": [
    {"lt": [{"derived": "teamSize"}, 5]},
    {"in": [{"answer": "q11_deploy_cadence"}, ["continuous", "sprint"]]},
    {"eq": [{"answer": "q14_release_autonomy"}, "autonomous"]}
  ]},
  "adoptWhen": [
    { "when": {"all": [
        {"eq": [{"derived": "coverageLevel"}, "low"]},
        {"in": [{"answer": "q18_token_budget"}, ["unmetered", "team_plan"]]}]},
      "framework": "superpowers",
      "ifUnavailable": {"framework": "gsd"},
      "rationale": "Low automated coverage with an affordable budget: enforced TDD is the point." },
    { "when": {"all": [
        {"eq": [{"derived": "coverageLevel"}, "low"]},
        {"in": [{"answer": "q18_token_budget"}, ["individual_pro", "strict"]]}]},
      "framework": "gsd",
      "setFlags": ["force_tdd_overlay"],
      "rationale": "Low coverage but a metered budget: TDD as a practice, without Superpowers' full cost." }
  ],
  "adopt": {
    "framework": "gsd",
    "rationale": "A small autonomous team shipping often needs a light harness; GSD Core's context hygiene applies regardless of coverage."
  }
}
```

Note what this exposes. Finding A1 (§4) — the unreachable `|| rule4ForceB(...)` in the availability fallback — simply has nowhere to be written here: the first branch's `ifUnavailable` sets no flag because, in that branch, the budget is unmetered by construction. A behaviour that took reading two functions and a boolean OR to verify is now locally obvious.

### 11.2 Flags (replaces H8)

`forceOverlayB` is currently a named field threaded from `selectBase` through `partial` into one overlay's closure. It becomes a general mechanism: any `adoptWhen` branch may `setFlags: [...]`; overlays and cautions read them with `{"flag": "name"}`. Flag names are declared implicitly by use, and the validator warns on a flag that is set but never read, or read but never set (`W-FLAG-101`) — the kind of drift that is invisible today.

### 11.3 Conditional notes (replaces H9)

The financial-reconciliation note hard-coded in `applyOverlays` becomes a `notes` entry on overlay B:

```json
"notes": [
  { "when": {"hasAny": [{"answer": "q12_quality_gates"}, ["financial_reconciliation"]]},
    "text": "Existing financial reconciliation tests are a related control already in place; TDD is a different control." }
]
```

Available on all three rule families, so any rule can carry conditional prose without an engine change — which is what stops the next such request from becoming another special case.

### 11.4 Requires and explanation

`requires` currently serves two purposes: completeness analysis (F10) and the explanation trail (F11). With expressions, the set of fields a rule reads is **derivable** by walking its `when` tree and the transitive closure of any `derived` references. The pack may still declare `requires` explicitly, but the validator computes the true set and reports a mismatch as `W-RULE-102` (CD7). This closes a real hazard in the current design: a hand-written `requires` list that drifts from the closure silently degrades completeness reporting, and nothing detects it.

## 12. URL state

### 12.1 What changes

The answer encoding stays fragment-based, `history.replaceState`-driven, and derived-view-free, exactly as DESIGN.md §13 specifies. What changes is that the key map (H12) and the per-field branches (H14, H15) are generated from the pack instead of hand-maintained.

### 12.2 Generated codec

Each field may declare `hashKey`, matching `[A-Za-z0-9_-]{1,12}`, unique across the pack (`E-HASH-070`). Omitted, the key defaults to the field id — correct but verbose, which is the right default bias: links get longer, never wrong. Encoding by kind:

| Kind | Encoding |
|---|---|
| `single` | the option value |
| `multi` | comma-joined values, in the pack's option order |
| `number` | decimal |
| `text` | `encodeURIComponent`, truncated to `maxLength` with a visible notice |
| `ranked` | comma-joined values in rank order |
| `record` | comma-joined sub-field values in declared field order |

Decoding validates every scalar against the field's options and every record against its constraints; unknown values are dropped and the field shows as unanswered, preserving current behaviour. The current fixed-width record checks (`p.length !== 6`, the inline `dedicated/shared/none` list at `index.html:1074–1075`) fall out of the field declarations.

### 12.3 Pack version in the link

DESIGN.md's `v=3` guards against a questionnaire schema change invalidating a shared link. The same guard is needed here, computed rather than hand-incremented, because a pack author who renames an enum value will not think to bump a version constant.

```
#v=7f3a91c4&q1=ledger&q5=50,10,10,20,10&...
```

`v` is an 8-hex-character digest of the pack's **answer-affecting surface**: field ids in order, kinds, option values in order, record sub-field order, hash keys, `maxLength`, and `ranks`. On decode, a mismatch fills nothing and shows a notice explaining that the link was created against a different version of the questionnaire. A missing `v`, or the literal `v=3`, is treated as a v0.3.0 link and accepted only if the digest matches the recorded v0.3.0 surface.

The digest deliberately excludes labels, help text, rationales, framework prose, and evidence numbers, so fixing a typo or refreshing a star count does not invalidate every link anyone has shared, while renaming an enum value does. FNV-1a rather than SHA-256 because `crypto.subtle` is asynchronous and unavailable in non-secure contexts, which includes `file://` in some browsers; collision resistance is not a property we need here, only change detection.

Because only one pack exists per build, the pack *id* need not appear in the fragment — the digest alone distinguishes both "different pack" and "same pack, edited."

## 13. Authoring workflow

### 13.1 The loop

Editing a pack is a text-editor task with two Node scripts around it. No part of it happens in the browser.

```
1. edit     packs/finance-tech.json
2. validate node tools/validate.mjs packs/finance-tech.json
              → diagnostics with JSON paths, or "ok · 21 fields · 4 base rules · 40 fixtures pass"
3. build    node tools/build.mjs
              → rewrites the inlined pack block in index.html
4. check    open index.html?selftest
5. commit   the pack and the rebuilt index.html together
```

Both scripts are dependency-free single files. `validate.mjs` runs the §14 validator plus the pack's fixtures and exits non-zero on any error, which is also how it runs in CI. `build.mjs` refuses to inline a pack that does not validate, which is the mechanism behind CD17: an invalid pack cannot physically reach the page.

### 13.2 What ships

`index.html` in the repository is always a complete, working artifact with the pack already inlined. Someone who clones the repository and double-clicks the file gets a working tool; Node is needed only to *change* it. This preserves DESIGN.md G3 exactly as it stands today.

### 13.3 For a non-developer who wants to change a threshold

The honest answer is that they need to edit a JSON file and run one command, or ask someone to run it for them. That is a real cost, and it is the cost this scoping decision accepts. What they get in exchange is a validator that catches a mistyped enum with a JSON path, a fixture suite that reports which recommendations their change moved, and a diff a reviewer can read — none of which a paste box in the browser would have given them.

If that trade turns out to be wrong, the thing to build is a static pack-editor page that emits JSON (a separate artifact, still offline), not a loader inside the tool.

## 14. Validation

### 14.1 Diagnostics

```ts
type Diagnostic = {
  severity: 'error' | 'warning';
  code: string;
  path: string;        // JSON pointer-ish, e.g. "baseRules[3].when.all[1]"
  message: string;
  hint?: string;
};
```

### 14.2 Codes

| Code | Severity | Condition |
|---|---|---|
| `E-PACK-001` | error | `schema` missing or unsupported |
| `E-PACK-002` | error | Malformed JSON, or the document is not an object |
| `E-PACK-003` | error | Required top-level key missing |
| `E-META-004` | error | `meta.id` not a slug, or `meta.version` not semver |
| `E-FIELD-010` | error | Duplicate field id across the pack |
| `E-FIELD-011` | error | Unknown `kind` |
| `E-FIELD-012` | error | Duplicate option value within a field |
| `E-FIELD-013` | error | `ranked` field with `ranks` exceeding its option count |
| `E-FIELD-014` | error | `record` nesting deeper than one level |
| `E-FIELD-015` | error | `text` field missing `maxLength` |
| `E-SECT-020` | error | Question references an undeclared section |
| `E-EXPR-030` | error | Operator node with other than exactly one key |
| `E-EXPR-031` | error | Unknown operator |
| `E-EXPR-032` | error | Wrong arity or operand type for an operator |
| `E-EXPR-033` | error | Expression depth exceeds 32 |
| `E-REF-040` | error | `{"answer": ...}` names an unknown field or sub-field |
| `E-REF-041` | error | `{"derived": ...}` names an undeclared key |
| `E-REF-042` | error | Cycle among derived definitions |
| `E-REF-043` | error | `{"result": ...}` used outside a caution |
| `E-REF-044` | error | `rank` or `rankAtMost` applied to a non-`ranked` field |
| `E-FW-050` | error | Rule adopts an unknown framework id |
| `E-FW-051` | error | A base rule adopts a framework whose status is not `selectableAsBase` (DESIGN F15) |
| `E-FW-052` | error | Unknown `status`, `enforcement.class`, or `ratings` key |
| `E-FW-053` | error | `evidence.verifiedOn` missing or not an ISO date |
| `E-FW-054` | error | `settings.fallbackBase` names an unknown or non-selectable framework |
| `E-RULE-060` | error | Duplicate rule id |
| `E-RULE-061` | error | Caution without a `caution` block, or base/overlay without `adopt` |
| `E-RULE-062` | error | `resolves` names a value that is not an option of a `ranked` field |
| `E-HASH-070` | error | Duplicate or malformed `hashKey` |
| `E-FIX-080` | error | A fixture's answers fail the pack's own field validation |
| `W-RULE-100` | warning | A base rule can never fire (its `when` is statically unsatisfiable) |
| `W-FLAG-101` | warning | A flag is set but never read, or read but never set |
| `W-RULE-102` | warning | Declared `requires` differs from the computed field closure (§11.4) |
| `W-FIELD-103` | warning | A non-`reportOnly` field is read by no rule — likely `reportOnly` was forgotten |
| `W-FW-104` | warning | A framework is referenced by no rule |
| `W-EVID-105` | warning | `evidence.verifiedOn` older than `settings.staleDays` |

`W-RULE-100` is worth the implementation cost: statically unsatisfiable predicates (`{"all": [{"eq": [x, "a"]}, {"eq": [x, "b"]}]}`) are the characteristic error of someone editing rules by copy-paste, and they are invisible at runtime because the rule simply never matches.

### 14.3 Where validation runs

In `tools/validate.mjs` only: on demand while authoring, and in CI on every commit touching a pack. `tools/build.mjs` calls it and refuses to inline a failing pack. A `--report` flag prints the coverage summary — which fields no rule reads, which frameworks no rule can select, which options never appear in any predicate — for someone reviewing a pack before adopting it.

Nothing validates in the page (CD17). The fixture runner does ship, behind `?selftest`, because it is ~30 lines and is the fastest way for an author to confirm a rebuilt page behaves.

## 15. Security posture

With offline authoring, the pack is **first-party content compiled into the page**, not untrusted input. That collapses most of what a loader would have had to defend against. Three properties are still worth stating, because they are cheap to keep and expensive to reintroduce.

| Property | Why it stays |
|---|---|
| No `eval`, no `new Function`, no dynamic `import`, no string timers | Required by DESIGN.md N5 (CSP compatibility) regardless of pack provenance. It is also what keeps rules *data* — the moment a pack can carry code, it can no longer be validated, diffed, or reasoned about statically (CD2, CD9). |
| Pack prose renders via `textContent`, never `innerHTML` | Standard hygiene, and it keeps the door closed if packs ever do become loadable. The one `innerHTML` use in the current `el()` helper (`index.html:1511`) is removed for pack-sourced content; a small allowlisting formatter handles backtick code spans by emitting elements. |
| Evaluation limits (§8.6) | Protect against an author's mistake, not an attacker: a deeply nested or pathological expression should fail validation offline and, if it somehow ships, degrade to `false` rather than hang the page. |

Answer privacy is unchanged from DESIGN.md §13 and, if anything, stronger: answers live in the URL fragment only, and with pack persistence cut there is now nothing at all in `localStorage`.

Provenance remains a disclosure matter rather than a technical one. The pack's id, version, authors, and evidence date appear in the UI and in the exported Markdown, so a reader of a report can always tell which rule set produced it (CF11).

## 16. Testing

### 16.1 The parity gate

The single most important test, and the gate on the whole extension (CG7). `tools/parity.mjs` loads both the v0.3.0 engine and the v0.4.0 config engine with the ported built-in pack, evaluates both over the same answer sets, and asserts deep equality of the full `Result`, field by field:

1. Every fixture from DESIGN.md §14.1 — roughly 40 cases covering each base rule, each overlay positive and negative, each caution positive and negative, and the documented edge cases.
2. A seeded pseudorandom sweep of 50,000 answer sets drawn from the declared enums, including partial and invalid ones (Q5 summing to 97, `q2_team` with no PO, empty multi-selects, absent fields).
3. An exhaustive sweep over the cross product of the fields that rules actually read, with the high-cardinality numeric fields sampled at their boundaries (39/40/41, 24/25/26, 59/60/61, teamSize 2/3/4/5).

Any difference is a release blocker. The harness runs in CI and prints a minimized differing answer set, because "something differs across 50,000 cases" is not actionable on its own.

### 16.2 Pack fixtures

Every fixture in §14.1 of the base design becomes a `fixtures[]` entry in the built-in pack, so they survive as the pack's own regression suite rather than as assertions in the page's JavaScript (H22). `?selftest` runs them and reports on the page. A pack author who changes a threshold sees exactly which fixtures moved.

### 16.3 Component tests

- **Interpreter:** one case per operator, plus the complete null-semantics table from §8.4 asserted cell by cell. This table is the specification; if it is not tested exhaustively it is not real.
- **Validator:** one malformed pack per error code in §14.2, asserting the code and the reported path. Node-side only.
- **Fuzzing:** randomly mutated packs (truncated JSON, wrong types, cycles, huge nesting) must always produce diagnostics and never throw. Since the validator is the only thing that ever sees a malformed pack, this is where the CN5 guarantee is actually established.
- **Codec:** property test — for every field kind, `decode(encode(a)) === a` for all valid `a`, and `decode` of arbitrary garbage yields a subset of valid answers with no throw. The garbage case is not hypothetical: fragments are user-editable.
- **Digest:** label-only edits do not change the digest; option-value edits do.

### 16.4 Structural lint

A CI script asserting §6.2's boundary: outside the inlined pack block, `index.html` contains no `/\bq\d+_[a-z]/` identifier and no framework id literal. This is the objective test of whether the extension actually achieved its goal, as opposed to relocating some of the hard-coding.

### 16.5 Accessibility

Re-run DESIGN.md §12.4 and §14.2 checks against the generic renderers, since every control in the form is now produced by different code. Particular attention to the `record` and `ranked` kinds, which replace the hand-tuned Q2, Q5, and Q16 markup.

## 17. Implementation plan

*Superseded by `docs/IMPLEMENTATION-PLAN.md`, which sequences this extension together with EXT-UI across seven phases. The summary below is retained as the config-side view; where the two differ, the plan document is authoritative — notably, it adds a test-harness phase before any refactor and splits the UI work into input-path and output-path phases.*

Five phases. Each is independently reviewable and leaves the page working; the parity harness arrives in Phase 1 and gates every phase after it.

| Phase | Scope | Done when |
|---|---|---|
| **P1** Interpreter and validator | Expression interpreter, null semantics, `tools/validate.mjs` with the §14.2 codes, pack type definitions, parity harness comparing interpreted predicates against the existing closures. Rules still shipped as JS. | Interpreter passes the §8.4 table; the existing rule set, hand-translated to expressions, produces identical selection to the closures over the §16.1 sweep. |
| **P2** Pack as source of truth for data | `FRAMEWORKS`, `QUESTIONS`, `derived`, `baseRules`, `overlays`, `cautions` move into the inlined pack; `compilePack`; `tools/build.mjs`; the engine reads the compiled pack. `derive()` (H4), `REPORT_ONLY` (H2), `BOTTLENECK_LABEL` (H3), settings constants (H1) deleted. | Parity green. No behavioural change. The authoring loop of §13.1 works end to end. |
| **P3** Generic UI and codec | Six field kinds, generic `renderForm` / `readAnswers` / `applyAnswersToForm`, constraint-driven sum and rank-dedupe behaviour, generated hash codec, digest in the fragment. H10–H21 cleared. Implements EXT-UI §6–§8. | Parity green; URL round-trip property tests green; §16.4 lint green; accessibility re-check passes. |
| **P4** Special-case generalization | `adoptWhen` / `ifUnavailable` / `setFlags` / `notes`; `selectBase` loses its `base-4` and `superpowers` literals; `applyOverlays` loses its `overlay-b` literal; `unaddressedBottlenecks: "auto"`. | Parity green with the special cases removed from code. |
| **P5** Second pack and authoring guide | A second pack (general software engineering, non-finance), written against the format by following the guide; `validate.mjs --report`; the authoring guide itself. | Someone following the guide produces a valid pack, builds it, and gets a working tool — without reading the engine source. |

P5's second pack is not decoration, and it is the reason P5 is not simply "write docs." An abstraction validated against exactly one instance is a rename, not an abstraction; the general-engineering pack is where it becomes clear whether the field model and the operator table are actually sufficient, and it should be written before v0.4.0 is tagged rather than after.

With the runtime loader cut, P5 is roughly a third of what it was, and the extension's total scope drops by about the same amount — all of it from the delivery surface, none of it from the parity gate, the interpreter, the field model, or the validator.

## 18. Impact on the base design document

| DESIGN.md location | Change |
|---|---|
| §1 Summary | Note that rules and questionnaire are pack data |
| G5 | Restated: "the questionnaire, frameworks, and rules are a validated JSON pack; no code change is needed to add a framework, change a question, or adjust a rule" |
| New G10 | "Pack-supplied content is never executed" |
| §6.2 table | Unchanged and still correct. The "HTML + separate `rules.json`" row's objection — `fetch` over `file://` — is honoured by inlining the pack at build time (§13.2) |
| §6.3 Module boundaries | Replaced by §6.1–6.2 here |
| §7.1–7.3 | Types move to §7 and §9 here; the `Answers` shape is unchanged by design |
| §7.6 Derived views | Becomes pack data (§10) |
| §10.2 Rule 4 / D3′ | The split is pack data (§11.1), not engine code |
| §12 User interface | Superseded in part by EXT-UI; §12.2's per-question form spec becomes the generic field kinds of §9 |
| §13 URL encoding | `v=3` becomes a computed digest, `v=<digest8>` (§12.3) |
| §14.1 | Fixtures become pack fixtures; §16.1 parity harness added |
| §15 item 1 | Delivered by this extension |
| §15 item 2 (weighted scoring) | Unblocked; hooks reserved (§6.4) |
| §15 item 6 (localization) | Unblocked by `pack.strings` |
| O3 (fallback vs "insufficient signal") | Becomes a pack setting (`fallbackBase: null`), not a global decision |
| N1, N5, N6 | Preserved; restated as CN1, CN2, CN4 with pack-specific budgets |

## 19. Design decisions

| ID | Question | Decision | Rationale |
|---|---|---|---|
| CD1 | Can a user load or edit a pack in the browser? | No. Authoring is offline: edit, validate, build (§13). | The task happens a few times a year and is better served by a text editor, a validator, and a diff than by a paste box. Cutting it removes the loader, persistence, revert UX, in-page validator, error panel, and the untrusted-input threat model — with no loss to the people who *use* the tool, who never author a pack (EXT-UI §2). |
| CD1a | Where does the pack live? | Inlined in `index.html`, regenerated by a build script from `packs/<id>.json` | G3 and N1 are non-negotiable. The page must be complete on disk with no fetch and no Node. |
| CD2 | How are predicates expressed? | Interpreted JSON expression trees over a closed operator table | The only option that satisfies N5 and keeps a shared pack from being arbitrary code. Accepting the expressiveness ceiling is the price (CD9). |
| CD3 | Adopt JsonLogic? | No; borrow the shape, define our own strict subset | Avoids a third-party dependency (N5) and lets us define null semantics (§8.4), which JsonLogic's truthiness cannot express and which completeness reporting depends on. |
| CD4 | How are compound questions modelled? | Question (presentation) is separate from field (answer key); a question holds one or more fields | Turns five bespoke renderers into six generic kinds while keeping the answer shape byte-identical, which is what makes the parity gate possible. |
| CD5 | How is per-question validity expressed? | Record constraints (`sumTo`, `requiredKeys`), with invalid records reading as `null` | One declaration drives rule gating, completeness, and UI feedback. Replaces `q5Complete` and `q2RulesComplete` without naming any field. |
| CD6 | Flat or structured derived values? | Flat scalars only in v1 | Keeps the interpreter free of structured access. `hasRoles.*` flattens to three booleans with proven-identical behaviour. Revisit only if a real pack needs it. |
| CD7 | Is `requires` authored or computed? | Computed from the expression closure; an authored list is checked against it and mismatch warns (`W-RULE-102`) | A hand-written `requires` that drifts silently degrades F10 completeness reporting. Computing it removes an entire class of quiet bug. |
| CD8 | How is the rule-4 split expressed? | Ordered `adoptWhen` branches with `ifUnavailable` and `setFlags` | Generalizes the one place where a documented decision (D3′) lived in code. Also surfaces finding A1. |
| CD9 | What happens when a pack needs logic the language lacks? | Add a reviewed operator to the interpreter; never an escape hatch | An escape hatch would be `eval` with extra steps, forfeiting CD2's entire value. The operator table is expected to grow slowly and deliberately. |
| CD10 | How do we prevent a link being read against a different questionnaire? | A computed content digest in the fragment; strict refusal on mismatch | An author who renames an enum value will not remember to bump a version constant. Silent partial application would produce a confident wrong answer — the failure mode this tool exists to prevent. Computing the marker means it cannot be forgotten. |
| CD11 | What does the digest cover? | Only the answer-affecting surface: field ids, kinds, option values, order, hash keys | Typo fixes and evidence refreshes must not invalidate shared links; enum renames must. |
| CD12 | Is the report layout configurable? | No. Section order and structure stay in code; strings, profile fields, and free-text fields are pack data | Report structure encodes design commitments — cautions at equal weight (F12), enforcement classes mandatory (F5), runner-up shown (F13). A pack that could reorder or suppress those could produce a report that looks authoritative while hiding the part that matters. |
| CD13 | Accommodate weighted scoring now? | Reserve `settings.selection.strategy` and an optional `score`; ignore both in v1 | Cheap now, avoids a breaking format change later (§6.4). |
| CD14 | Do packs support i18n in v1? | `strings` overrides exist; no language negotiation | Enough to unblock DESIGN.md §15 item 6 without designing a translation system speculatively. |
| CD15 | What is persisted? | Nothing. No `localStorage`, no cookies, no storage of any kind. | With no loadable pack there is nothing to remember, and answers were never going to be stored (DESIGN.md §13). The tool's storage story is now simply "there isn't one." |
| CD16 | Strict or lenient on an invalid pack? | Strict: `build.mjs` refuses to inline it, so it never reaches the page | Failing at build time is strictly better than failing in front of a user, and it is only available because authoring is offline. |
| CD17 | Does the validator ship in the page? | No. Node only. | It would be ~600 lines inside a 150 KB budget (CN4), defending against an input that cannot occur once `build.mjs` gates on validation. The fixture runner does ship, at ~30 lines, because it verifies the *built* artifact rather than the source. |

## 20. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The expression language proves insufficient for a real pack, creating pressure for an escape hatch | **Medium** | **High** — an escape hatch forfeits CD2 and the whole security model | Write the second, non-finance pack during P5 and before tagging. Treat every gap as an operator proposal with a review, and record rejected ones. |
| Behaviour drifts from v0.3.0 during migration | Medium | High | §16.1 parity harness, in place from P1, gating every subsequent phase. Not inspection. |
| The new indirection makes the page harder for a developer to read than the current literals | Medium | Medium | Keep the interpreter under ~200 lines and fully unit-tested; the authoring guide documents the format; §6.2's boundary table plus the §16.4 lint keep the layering honest rather than aspirational. |
| Pack authors publish unsupported enforcement claims, undermining DESIGN.md G8 | Medium | **High** for regulated teams | `enforcement.class` is validated against the pack's declared vocabulary; `evidence.verifiedOn` is required; the report always names the pack and its authors so a reader can weigh the source. |
| The offline authoring loop is enough friction that packs stop being maintained | **Medium** | Medium | The honest risk of CD1, and the reason §13.3 states the trade explicitly. Mitigations are ergonomic: a one-command loop, a validator that names the JSON path, and fixtures that report what a change moved. If it still bites, the answer is a separate offline editor page, not a loader in the tool. |
| URL length grows past what chat tools and email clients preserve | Medium | Low | Short `hashKey`s in the built-in pack; only answered fields encoded; a length warning on copy above ~1,800 characters (EXT-UI §9.3). |
| Fixture suites in packs rot alongside the rules they guard | Medium | Medium | `tools/validate.mjs` runs fixtures in CI on every pack change; `?selftest` surfaces failures against the built page. |

## 21. Open questions

| ID | Question | Owner | Blocking? |
|---|---|---|---|
| CO1 | With one pack per build, do we ship two builds (finance and general engineering) or pick one? | Amin | No — P5 produces both packs; whether both are published is a packaging decision made then. |
| CO2 | Is a standalone offline pack-editor page worth building once the schema is stable? | Amin | No — validator plus good diagnostics first; revisit only if §20's maintenance-friction risk materializes. |
| CO4 | Should packs carry provenance metadata beyond `meta.authors`? | Reviewer | No — packs are first-party and compiled in (§15); the question is about trusting *claims*, which disclosure addresses. |
| CO5 | Should the expression language support arithmetic on framework ratings, enabling DESIGN.md D11's "rules branch on ratings"? | Amin | No — D11 deliberately keeps ratings display-only. Revisit with weighted scoring (§6.4). |
| CO6 | Should a pack be able to declare additional derived *result* facts (e.g. a computed adoption-effort estimate) for the report? | Reviewer | No — v1 keeps derived views over answers only. |
| CO7 | How should two pack versions be diffed for a reviewer — raw JSON, or a rendered rule-level diff? | Amin | No — raw JSON in v1; a rule-level diff is a natural `tools/validate.mjs` extension, and offline authoring means a normal `git diff` already covers most of it. |

---

## Appendix A — Minimal pack

The smallest document that validates and runs: one framework, one question, one base rule, one fixture. Useful as a starting template and as the validator's happy-path test.

```json
{
  "schema": 1,
  "meta": { "id": "minimal", "version": "1.0.0", "title": "Minimal example", "updated": "2026-09-16" },
  "settings": {
    "fallbackBase": "openspec",
    "staleDays": 180,
    "statuses": [{ "id": "recommended", "label": "Recommended", "selectableAsBase": true }],
    "enforcementClasses": [{ "id": "advisory", "label": "Advisory", "description": "Prompt context only." }]
  },
  "frameworks": [{
    "id": "openspec",
    "name": "OpenSpec",
    "repo": "Fission-AI/OpenSpec",
    "status": "recommended",
    "evidence": { "verifiedOn": "2026-09-16" },
    "runtimes": ["claude_code", "cursor"],
    "ratings": {},
    "install": "openspec init",
    "commands": ["/opsx:propose"],
    "artifacts": ["openspec/specs/"],
    "enforcement": [{ "practice": "/opsx:verify", "class": "advisory", "note": "Does not block archiving." }]
  }],
  "sections": [{ "id": "main", "title": "Diagnostic" }],
  "questions": [{
    "id": "q1", "number": "Q1", "section": "main",
    "legend": "Primary system architecture",
    "fields": [{
      "kind": "single", "id": "q1_architecture", "hashKey": "a",
      "options": [
        { "value": "monolith", "label": "Monolith or legacy application" },
        { "value": "microservices", "label": "Cloud-native microservices" }
      ]
    }]
  }],
  "derived": [],
  "baseRules": [{
    "id": "base-1",
    "label": "OpenSpec — brownfield",
    "when": { "eq": [{ "answer": "q1_architecture" }, "monolith"] },
    "adopt": { "framework": "openspec", "rationale": "Specs written only for the change at hand." }
  }],
  "overlays": [],
  "cautions": [],
  "fixtures": [
    { "name": "monolith selects OpenSpec",
      "answers": { "q1_architecture": "monolith" },
      "expect": { "base": "openspec", "fallback": false } },
    { "name": "microservices falls back",
      "answers": { "q1_architecture": "microservices" },
      "expect": { "base": "openspec", "fallback": true } }
  ]
}
```

## Appendix B — Cookbook

### B.1 Change a threshold

DESIGN.md's rule 1 fires at 40% non-roadmap work. To move it to 35%, edit one number:

```json
{"gte": [{"derived": "nonRoadmapShare"}, 35]}
```

Then open `index.html?selftest`. Fixtures that pinned the boundary (the sweep in §16.1 samples 39/40/41) will report the change, which is the point: the tool tells you what else moved before you ship it.

### B.2 Add a framework

Append to `frameworks`, then give it a way to be selected. Two edits, no code:

```json
{
  "id": "newframework",
  "name": "New Framework",
  "repo": "org/new-framework",
  "status": "viable",
  "evidence": { "verifiedOn": "2026-09-16", "stars": 1200, "commitsLast30d": 40,
                "latestRelease": "v0.4.0", "language": "TypeScript", "license": "MIT" },
  "runtimes": ["claude_code", "cursor", "codex"],
  "ratings": { "ceremony": 2, "tokenCost": 2, "brownfieldFit": 4, "midFlightChange": 4 },
  "install": "npx new-framework init",
  "commands": ["/nf:plan", "/nf:build"],
  "artifacts": [".newframework/"],
  "enforcement": [
    { "practice": "Plan gate", "class": "agent_gate", "note": "Agent refuses to build without an approved plan." }
  ]
}
```

```json
{
  "id": "base-5",
  "label": "New Framework — streaming architectures",
  "when": { "all": [
    { "eq": [{ "answer": "q10_architecture" }, "streaming"] },
    { "not": { "derived": "volatilityIsHigh" } }
  ]},
  "adopt": { "framework": "newframework",
             "rationale": "Event-driven topologies are this framework's documented focus." }
}
```

Base rules are ordered and first-match-wins, so *where* the rule is inserted is itself a decision — before rule 1 it outranks brownfield safety, after rule 4 it only catches what nothing else claimed. This is the same decision DESIGN.md D1 records, now made by the pack author. The validator's `W-RULE-100` catches a rule that can never fire; ordering that merely makes a rule unlikely is a judgement the author must make consciously.

### B.3 Add a question

```json
{
  "id": "q22", "number": "Q22", "section": "constraints",
  "legend": "Do you maintain a shared component library?",
  "help": "Shared components raise the cost of uncoordinated change.",
  "fields": [{
    "kind": "single", "id": "q22_shared_components", "hashKey": "q22",
    "options": [
      { "value": "yes_versioned", "label": "Yes, versioned and published" },
      { "value": "yes_internal", "label": "Yes, internal and unversioned" },
      { "value": "no", "label": "No" }
    ]
  }]
}
```

That is the whole change. The form renders it, the URL codec encodes it under `q22`, completeness tracks it, and the report lists it. If no rule reads it, the validator emits `W-FIELD-103` suggesting `reportOnly: true` — the pack format's way of enforcing DESIGN.md's D19 discipline about collected-but-unused fields.

### B.4 Add an overlay with a conditional note

```json
{
  "id": "overlay-h",
  "label": "Component contract tests",
  "when": { "eq": [{ "answer": "q22_shared_components" }, "yes_versioned"] },
  "providedByBase": [],
  "resolves": ["cross_team_approvals"],
  "adopt": {
    "framework": null,
    "practice": "Consumer-driven contract tests on the shared library",
    "artifacts": ["contracts/"],
    "rationale": "A versioned shared library needs a mechanical check that consumers still pass."
  },
  "notes": [
    { "when": { "hasAny": [{ "answer": "q12_quality_gates" }, ["integration_contract"]] },
      "text": "You already run integration/contract tests; extend them to the library boundary rather than adding a parallel suite." }
  ]
}
```

`"framework": null` is how overlay F already models a practice belonging to no framework (DESIGN.md §10.3), and `resolves` feeds the bottleneck matrix automatically — including removing that bottleneck from the "not addressed" line, which today is a hard-coded array someone would have had to remember to edit.

### B.5 Replace the questionnaire

Copy `packs/finance-tech.json`, change `meta.id`, replace `sections`, `questions`, `derived`, and the three rule arrays, keep or replace `frameworks`. Then:

```
node tools/validate.mjs --report packs/my-pack.json
node tools/build.mjs --pack my-pack
```

`--report` lists which fields no rule reads and which frameworks no rule can select. Those two lists are where a freshly written pack is usually wrong — a question everyone assumed was driving something, and a framework nobody wired a rule to. The digest changes, so links generated against the old questionnaire are refused rather than misread (§12.3).
