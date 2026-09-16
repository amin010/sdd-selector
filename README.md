# SDD Selector

A single-file diagnostic that recommends a **spec-driven development (SDD)** stack for a finance-tech team: one base framework, optional practice overlays, and cautions for known failure modes.

Open `index.html` in a browser — no server, no build, no dependencies at runtime. Answers stay on the page; a shareable link encodes the questionnaire in the URL.

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

- Unit / harness tests under `tests/`
- **G-PARITY** — current engine vs the frozen v0.3.0 page over a large answer corpus
- A deliberate break-demo (proves the parity gate can fail)
- Structural lint (hard-coded field / framework ids outside an allowlist)

Useful individual commands:

```bash
npm run parity              # full parity sweep
node tools/parity.mjs --quick
node tools/parity.mjs --self
node --test tests/*.test.mjs
npm run lint:structure
npm run inline              # copy src/expr.mjs into index.html markers
node tools/validate.mjs packs/some-pack.json   # pack schema checks (P4+)
```

## Project layout

| Path | Role |
|---|---|
| `index.html` | The product: UI + engine in one file |
| `docs/` | Design and implementation plan |
| `tests/` | Automated tests and golden Markdown snapshots |
| `tests/golden/index-v030.html` | Frozen v0.3.0 baseline for parity |
| `tools/` | Parity harness, corpus, lint, page loader, validator, inliner |
| `src/` | Source modules inlined into the page (`expr.mjs`, rule expression tables) |

## Docs

- [DESIGN.md](docs/DESIGN.md) — product design and rules
- [DESIGN-EXT-CONFIG.md](docs/DESIGN-EXT-CONFIG.md) — pack / config extension
- [DESIGN-EXT-UI.md](docs/DESIGN-EXT-UI.md) — UI extension
- [IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) — phased migration to v0.4.0

## License / status

Private / draft. Version **0.3.0** — working selector with an automated regression harness and expression-based rules (P1); pack-based configuration continues in later plan phases.
