# Pack authoring guide

How to edit an SDD Selector pack offline: change questions, thresholds, frameworks, and rules without touching engine code.

## Pack format overview

A pack is a single JSON file under `packs/` with `schema: 1`. Top-level keys:

| Key | Role |
|---|---|
| `meta` | `id` (slug), `version` (semver), title, description, `updated` |
| `settings` | Fallback base, stale days, Tier 0 runtime filter (`mode: hard|soft`), `selection: first-match\|weighted\|utility`, rating/status vocabularies. Utility packs add `settings.utility.k` and `conformalAlpha`. |
| `frameworks` | Candidate harnesses. Utility packs add `bundle` (practice ids) and `cost` `{ceremony, tokens, adoption}`. Empty `runtimes` means no restriction at the veto. |
| `axes` / `practices` / `parameters` | Utility selection model: 14-axis demand, practice catalogue, prior or fitted `theta`/`lambda`/`mu`/`kappa`/`gamma` |
| `sections` / `questions` | Questionnaire: questions group **fields** of six kinds |
| `derived` | Named scalar views (`key` + expression) |
| `baseRules` / `overlays` / `cautions` | Ordered rules with expression `when` predicates. Base rules may add `signals: [{ when, weight, label }]` used when `settings.selection` is `weighted` |
| `report` | Profile fields, free-text fields, unaddressed-bottleneck mode |
| `fixtures` | Answer sets with `expect` for `?selftest` |

**Field kinds** (only these): `single`, `multi`, `number`, `text`, `ranked`, `record`.

**Predicates** are JSON expression trees over a closed operator table (`src/expr.mjs`). No `eval`, no custom functions in the pack. If you need a new operator, that is a CD9 review — prefer composing existing ones.

Shipped product: one pack is inlined into `index.html` at build time. A second pack is a **CI format proof**, not a second page in the same HTML (EXT-CONFIG CF2).

## Cookbook

Worked examples live in `docs/archive/DESIGN-EXT-CONFIG.md` Appendix B:

- **B.1** Change a threshold (one number in an expression)
- **B.2** Add a framework + a base rule that can select it
- **B.3** Add a question (generic renderer picks it up)
- **B.4** Add an overlay with a conditional note
- **B.5** Replace the questionnaire (copy a pack, change `meta.id`, rebuild)

## Validator codes (summary)

Errors fail `validate` / `build`. Warnings print but do not block (unless you treat them as such in review).

| Code | Severity | Meaning |
|---|---|---|
| `E-PACK-001`…`003` | error | Schema / malformed / missing keys |
| `E-META-004` | error | Bad `meta.id` / `meta.version` |
| `E-FIELD-010`…`015` | error | Field id, kind, options, ranks, text length |
| `E-SECT-020` | error | Duplicate section id |
| `E-REF-040` | error | Unknown field reference |
| `E-FW-050`…`054` | error | Framework / status / evidence / fallback |
| `E-RULE-060`…`062` | error | Rule shape, duplicate ids, bad `resolves` |
| `E-HASH-070` | error | Bad or duplicate `hashKey` |
| `E-AXIS-080` | error | Axis id missing or duplicate |
| `E-PRAC-081`…`085` | error | Practice id, capability keys, `liftable:false` sources, `requires`/`excludes` refs or cycles |
| `E-FIT-090` | error | Fitted coefficient is not an AxisId (must not be a FrameworkId) |
| `W-RULE-100` | warning | Statically unsatisfiable predicate |
| `W-FLAG-101` | warning | Flag set/read mismatch |
| `W-RULE-102` | warning | Authored `requires` ≠ computed closure |
| `W-FIELD-103` | warning | Non-`reportOnly` field no rule reads |
| `W-FW-104` | warning | Framework no rule can select |
| `W-EVID-105` | warning | Evidence older than `staleDays` |

Coverage detail (unread fields, unselected frameworks, unused option values):

```bash
node tools/validate.mjs --report packs/your-pack.json
```

## Workflow

```bash
# 1. Edit the pack JSON
# 2. Validate (+ coverage while drafting)
node tools/validate.mjs --report packs/finance-tech.json

# 3. Inline into the page (default pack → index.html)
npm run build

# 4. Confirm fixtures on the built page
open 'index.html?selftest'
# or headless:
node tools/selftest-page.mjs
```

Full regression (parity, markdown goldens, structure lint):

```bash
npm test
```

### Second pack (format proof only)

Do **not** commit a second pack as `index.html`. Build to a throwaway file and self-test:

```bash
node tools/build.mjs --pack packs/general-engineering.json --out /tmp/general-engineering.html
node tools/selftest-page.mjs /tmp/general-engineering.html
```

Shipped `index.html` remains `finance-tech`.

## Finance-tech: change demand or cost

Finance-tech ships `settings.selection: utility`. To make brownfield demand rise sooner, edit the `brownfield` axis `(q, p)` pair or the `theta.brownfield` prior. Then:

```bash
node tools/validate.mjs packs/finance-tech.json
npm run build
node tools/qc/fit.mjs
open 'index.html?selftest'
```

G-STABILITY (`tests/select.test.mjs`) must stay green: removing a framework must not flip the remaining harness order.

## Finance-tech: add a framework

1. Append a framework object to `frameworks` (id, evidence, runtimes, ratings, install, commands, artifacts, enforcement, **`bundle`**, **`cost`**).
2. Harvest its practices into `practices` (capability, enforcement, sources, `liftable`). Deduplicate against existing nodes (same capability → one practice, multiple `sources`).
3. Validate with `--report` — capability keys must be axis ids; `requires`/`excludes` acyclic; `liftable: false` needs sources.
4. Add at least one fixture that expects the new harness (or that it stays out when vetoed).
5. `npm run build`, `?selftest`, and re-run G-STABILITY.

`general-engineering` still ships `first-match` as a format proof. First-match / weighted authoring is unchanged for those packs.

## See also

- `docs/DESIGN.md` — product design and rules (v0.6.0 utility cutover)
- `docs/archive/DESIGN-EXT-SELECTION.md` — practice-selection design this release implements
- `docs/archive/DESIGN-EXT-CONFIG.md` — pack schema, operators, null semantics, security
- `docs/archive/DESIGN-EXT-UI.md` — generic form and report (no pack editor in the page)
- `docs/archive/IMPLEMENTATION-PLAN.md` — how the migration reached pack-based v0.4.0
