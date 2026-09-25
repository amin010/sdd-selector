# SDD Selector

A single HTML file that recommends a spec-driven development stack for a finance-tech team. Open `index.html` in a browser. There is no server, no account, and no install. Answers stay in the page; a link encodes them in the URL.

The questionnaire and the scoring pack live in `packs/finance-tech.json` and are inlined into the page by `npm run build`. Node is only for tests and that build.

## What you get

1. A diagnostic covering team shape, architecture, compliance, quality gates, bottlenecks, and related constraints.
2. A **harness** — OpenSpec, Spec Kit, BMAD, Spec Kitty, Superpowers, or GSD Core — scored as a pre-bundled set of practices plus an adoption cost. The report shows acceptability shares and a short set of acceptable harnesses. Tessl is not offered as a harness.
3. **Practices** with inclusion probabilities, including a technique from a watch-status source when that technique can be adopted without the tool.
4. **Cautions** where the chosen stack leaves a real gap, especially enforcement that a regulated team cannot treat as optional.
5. A Markdown report and a link that restores the same answers.

Runtime and watch status are vetoes. A framework that does not document your runtimes is excluded and named, not quietly down-scored.

## Packs

A pack is one JSON file: the questionnaire, the candidate harnesses, the practice catalogue, the scoring parameters, and the fixtures the page checks itself against. The engine in `src/` reads whichever pack the build inlined. `npm run build` validates that file and writes it into `index.html`. The browser never fetches the JSON — a page opened from disk cannot load a sibling file — so the file you open is the built copy. Edit the JSON, then validate and rebuild. Field-level steps are in [docs/AUTHORING.md](docs/AUTHORING.md).

One HTML file holds one pack. The share link starts with a short digest of that pack's questions and answer values. A link minted from a different pack is refused.

### Finance-tech

`packs/finance-tech.json` is the pack the shipped page uses. `settings.selection` is `utility`.

Answers become demand on 14 axes: brownfield load, mid-flight change, audit trail, verification, token budget, and the rest. Each axis ramps from the fields that feed it. A harness is a bundle of practices plus a cost for ceremony, tokens, and adoption. A practice covers some of those axes, and coverage is scaled by how the practice is enforced:

| Enforcement | Weight (`kappa`) |
|---|---|
| Hard gate (blocks until satisfied) | 1 |
| Agent gate | 0.67 |
| Human gate | 0.5 |
| Advisory (prompt context) | 0.33 |

On each axis the set keeps its strongest practice. A hard gate in the same set lifts the others: their weight rises by `gamma` (0.4 here) times that gate's capability, and the result is capped at 1.

Two vetoes run before that score. A harness whose documented runtimes miss the team's is removed and named in the report. An empty `runtimes` list means the harness states no restriction. A harness with status `watch` is removed the same way. Tessl stays in the catalogue as a source of liftable practices.

The engine then tries each surviving harness together with up to five extra practices (`settings.utility.k`) and keeps the combination that covers the team's demand at the lowest cost. A practice whose only source is watch-status can still be added when `liftable` is true. The report shows how acceptable each surviving harness is, a short set of acceptable ones, and an inclusion probability for each practice. Cautions are what that combination still leaves open: demand it does not cover, enforcement a regulated team cannot treat as optional, or a cost the answers say the team will not carry.

Axis weights in the pack (`theta`, `lambda`, `mu`) are a prior centered on the 0.5.1 hand scores. See [Status](#status).

### General engineering

`packs/general-engineering.json` uses the same schema. It leaves `settings.selection` unset, so the engine falls back to first-match: ordered base rules, the first predicate that fits wins, then overlays and cautions. It is there so a pack other than finance-tech still validates, builds, and passes its own fixtures. Build it beside the shipped page:

```bash
node tools/build.mjs --pack packs/general-engineering.json --out /tmp/general-engineering.html
```

The engine also accepts `weighted`: every eligible rule adds points, and a weak or tied total is reported as insufficient signal. Finance-tech no longer selects that way.

## Run

```bash
open index.html
```

On Windows or Linux, open the file from the file manager. `?selftest` runs the in-page fixture suite and prints pass or fail.

## Develop

Node.js 18 or newer. No `npm install`. The test runner is Node's built-in one.

```bash
npm test
```

That validates both packs, rebuilds the page, runs `tests/`, checks the current page against itself on a quick answer corpus, proves the parity gate can fail, lints hard-coded ids, and builds the general-engineering pack as a format check.

```bash
npm run validate            # schema and references for finance-tech
npm run build               # inline pack + src/ into index.html
npm run build:release       # same, without fixtures
npm run lint:structure
node --test tests/*.test.mjs
```

Edit `packs/finance-tech.json`, then `npm run validate` and `npm run build`. The page you open is the built file, not the JSON. [docs/AUTHORING.md](docs/AUTHORING.md) is the pack guide: add a framework, harvest its practices, keep G-STABILITY green.

The QC scripts under `tools/qc/` are offline measurement. They call a model only when you run `qc:generate` or `qc:judge`, and only if a key is present. Using the selector does not.

## Layout

| Path | Role |
|---|---|
| `index.html` | The product. UI and engine, built from the pack and `src/`. |
| `packs/finance-tech.json` | Shipped pack: questions, frameworks, practices, prior weights, fixtures. |
| `packs/general-engineering.json` | Second pack. Proves the format. Not a second product page. |
| `src/expr.mjs` | Expression language inlined into the page. |
| `src/select.mjs` | Practice-selection utility. |
| `src/rules-expr.mjs` | Shared rule helpers. |
| `docs/DESIGN.md` | Product design. |
| `docs/AUTHORING.md` | How to change a pack. |
| `docs/QC-EXPERIMENT.md` | Measurement protocol. |
| `docs/qc-report.md` | Latest measurement write-up. |
| `docs/archive/` | Superseded design notes, including the practice-selection extension. |
| `tests/` | Unit tests and Markdown snapshots. |
| `tools/` | Build, validate, parity, corpus, QC. |

## Status

Version **0.6.0**. Finance-tech selects with the practice utility. Axis weights in the pack are a prior centered on the 0.5.1 hand scores. A joint fit against the judge panel was run and not shipped: holdout practice macro-F1 did not beat the prevalence baseline. Harness top-3 on that same split did clear its floor. See [docs/qc-report.md](docs/qc-report.md) and `tools/qc/data/fit-report.json`.

## License

MIT. See [LICENSE](LICENSE).
