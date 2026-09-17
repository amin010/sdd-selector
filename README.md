# SDD Selector

A single-file diagnostic that recommends a **spec-driven development (SDD)** stack for a finance-tech team: one base framework, optional practice overlays, and cautions for known failure modes.

Open `index.html` in a browser — no server, no runtime dependencies. Answers stay on the page; a shareable link encodes the questionnaire in the URL. The questionnaire and rules come from `packs/finance-tech.json`, inlined by `npm run build`.

## What it does

1. You answer the Finance Tech diagnostic (team shape, architecture, compliance, quality gates, bottlenecks, and related constraints).
2. The engine picks a **base** (OpenSpec, Spec Kit, BMAD, Superpowers, or GSD Core) using ordered rules.
3. It layers **overlays** when specific triggers fire (for example SOX constitution practices, TDD, or a low-ceremony fast path).
4. It surfaces **cautions** where the recommended stack is weak for this profile — especially enforcement gaps that matter for regulated teams.
5. You can copy a Markdown report or a link that restores the same answers.

## Requirements

| Use | Need |
|---|---|
| Run the tool | Any modern browser |
| Run tests / tooling | [Node.js](https://nodejs.org/) 18+ |

No `npm install` — the project uses Node’s built-in test runner and has no runtime package dependencies.

## How to run the tool

```bash
# from the repo root — open in your default browser (macOS)
open index.html

# or open the file from Finder / Explorer / your editor’s Simple Browser
```

Optional query flag:

- `?selftest` — runs the in-page fixture suite and prints pass/fail on the page and in the console.

## How to run tests

```bash
npm test
```

That runs:

- Pack validation and build
- Unit / harness tests under `tests/`
- **G-PARITY** — current engine vs the frozen v0.4.0 finance-tech page over a large answer corpus
- **G-MARKDOWN** — Markdown export snapshots for documented fixtures
- A deliberate break-demo (proves the parity gate can fail on a pack threshold edit)
- Structural lint (hard-coded field / framework ids outside an allowlist)
- Second-pack selftest (general-engineering built to a throwaway HTML)

Useful individual commands:

```bash
npm run parity              # full parity sweep
node tools/parity.mjs --quick
node tools/parity.mjs --self
node --test tests/*.test.mjs
npm run lint:structure
npm run build               # inline pack + expr into index.html
npm run validate            # pack schema checks
node tools/validate.mjs --report packs/finance-tech.json
```

## Project layout

| Path | Role |
|---|---|
| `index.html` | The product: UI + engine in one file (built from pack + `src/`) |
| `packs/finance-tech.json` | Shipped rule pack (questions, rules, fixtures) |
| `packs/general-engineering.json` | Second pack — format proof; CI artifact only |
| `docs/` | Design, extensions, implementation plan, authoring guide |
| `docs/AUTHORING.md` | How to edit packs |
| `tests/` | Automated tests and golden Markdown snapshots |
| `tests/golden/index-v040.html` | Frozen v0.4.0 finance-tech baseline for parity |
| `tools/` | Build, validate, parity harness, corpus, lint, page loader |
| `src/` | Source modules inlined into the page (`expr.mjs`) |

## Authoring / build

Edit the pack, then rebuild the page (Node is only for tools — the page still opens from disk with no runtime Node):

```bash
npm run validate          # schema + referential checks
npm run build             # inline pack + src/expr.mjs into index.html (keeps fixtures for ?selftest)
npm run build:release     # same, but strips fixtures (~110 KB)
```

See [docs/AUTHORING.md](docs/AUTHORING.md) for the full loop, cookbook pointers, and how to change a threshold or add a framework.

`?selftest` runs pack fixtures plus a few engine invariants.

## Docs

- [DESIGN.md](docs/DESIGN.md) — product design and rules
- [AUTHORING.md](docs/AUTHORING.md) — pack authoring guide
- [DESIGN-EXT-CONFIG.md](docs/DESIGN-EXT-CONFIG.md) — pack / config extension
- [DESIGN-EXT-UI.md](docs/DESIGN-EXT-UI.md) — UI extension
- [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) — phased migration to v0.4.0

## License / status

Private / draft. Version **0.4.0** — pack-based configuration, generic UI, second-pack format proof, and snapshot regression gates.
