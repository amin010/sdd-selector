# Pack authoring guide

How to edit an SDD Selector pack offline: change questions, thresholds, frameworks, and rules without touching engine code.

## Pack format overview

A pack is a single JSON file under `packs/` with `schema: 1`. Top-level keys:

| Key | Role |
|---|---|
| `meta` | `id` (slug), `version` (semver), title, description, `updated` |
| `settings` | Fallback base, stale days, Tier 0 runtime filter, rating/status vocabularies |
| `frameworks` | Candidate bases and overlay sources (evidence, runtimes, enforcement) |
| `sections` / `questions` | Questionnaire: questions group **fields** of six kinds |
| `derived` | Named scalar views (`key` + expression) |
| `baseRules` / `overlays` / `cautions` | Ordered rules with expression `when` predicates |
| `report` | Profile fields, free-text fields, unaddressed-bottleneck mode |
| `fixtures` | Answer sets with `expect` for `?selftest` |

**Field kinds** (only these): `single`, `multi`, `number`, `text`, `ranked`, `record`.

**Predicates** are JSON expression trees over a closed operator table (`src/expr.mjs`). No `eval`, no custom functions in the pack. If you need a new operator, that is a CD9 review — prefer composing existing ones.

Shipped product: one pack is inlined into `index.html` at build time. A second pack is a **CI format proof**, not a second page in the same HTML (EXT-CONFIG CF2).

## Cookbook

Worked examples live in `docs/DESIGN-EXT-CONFIG.md` Appendix B:

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

## Finance-tech: change a threshold

Rule 1 fires when non-roadmap work is ≥ 40%. To move it to 35%, edit `packs/finance-tech.json` — find the `nonRoadmapShare` `gte` in `baseRules` and change `40` to `35`. Then:

```bash
node tools/validate.mjs packs/finance-tech.json
npm run build
open 'index.html?selftest'
```

Fixtures and G-PARITY will show what else moved. That is intentional: you learn the blast radius before shipping.

## Finance-tech: add a framework

1. Append a framework object to `frameworks` (id, evidence, runtimes, ratings, install, commands, artifacts, enforcement).
2. Add a `baseRules` entry (or overlay) whose `adopt.framework` names that id, with a `when` expression that can actually fire.
3. Validate with `--report` — the new id must leave the “frameworks no rule can select” list.
4. Add at least one fixture under `fixtures` that expects the new base.
5. `npm run build` and `?selftest`.

Base rules are **first-match wins** in array order. Where you insert the rule is a product decision (same as DESIGN.md D1), not an engine special case.

## See also

- `docs/DESIGN-EXT-CONFIG.md` — pack schema, operators, null semantics, security
- `docs/DESIGN-EXT-UI.md` — generic form and report (no pack editor in the page)
- `docs/IMPLEMENTATION-PLAN.md` — how the migration reached pack-based v0.4.0
