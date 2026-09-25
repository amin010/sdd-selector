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
