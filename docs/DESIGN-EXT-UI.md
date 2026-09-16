# SDD Selector — Design Extension: UI

| Field | Value |
|---|---|
| Status | Draft — awaiting review |
| Extension ID | EXT-UI |
| Version | 0.1.0 |
| Owner | Amin Rashidi |
| Last updated | 2026-09-16 |
| Extends | `docs/DESIGN.md` v0.3.0 §12 |
| Depends on | `docs/DESIGN-EXT-CONFIG.md` (EXT-CONFIG) for the pack and field model |
| Implementation plan | `docs/IMPLEMENTATION-PLAN.md` — this document lands in phases P2 (input path) and P3 (output path) |
| Target release | SDD Selector v0.4.0 |

**Changelog**

- **0.1.0** — Initial extension. Specifies a deliberately minimal UI: render the questionnaire from the pack, show the recommendation, copy it out. No pack-editing UI; packs are authored offline.

---

## 1. Summary

The UI has one job: let a person read the questions, answer them, and see the recommendation. Nothing else.

Everything about authoring — adding an SDD method, changing a question, adjusting a threshold — happens **offline**, by editing the pack JSON and rebuilding the page (EXT-CONFIG §13). The page has no loader, no editor, no settings, no pack switcher. This is the main scoping decision in this document, and it removes roughly half of what EXT-CONFIG v0.1.0 proposed building (§10).

What remains is small enough to state as a budget: about 500 lines of JavaScript and CSS on top of the engine, one form rendered once, one report rebuilt wholesale on every change, two buttons.

## 2. Who uses it, and for how long

One scenario, from DESIGN.md §4: an engineering lead sits down for fifteen minutes, answers a diagnostic, reads a recommendation, and copies it into an adoption proposal. They visit once, maybe twice. They will not learn an interface, they will not customize anything, and they will not come back often enough to benefit from any affordance that has to be discovered.

That profile is the argument for everything below. A tool used once for fifteen minutes should look like a form and a result, because that is what it is.

## 3. Principles

| ID | Principle | Consequence |
|---|---|---|
| UP1 | The page is a form and a result. | No navigation, no routing, no steps, no tabs. |
| UP2 | The form is the state. | No application state object, no store, no reactive framework. `readAnswers(form)` is the single source of truth (UD2). |
| UP3 | One direction of data flow. | Input → read → evaluate → render. Never the reverse, except the one-time restore from the URL at boot. |
| UP4 | Rebuild, don't reconcile. | The report is discarded and rebuilt on every change. No diffing, no keys, no incremental update (UD1). |
| UP5 | Native controls only. | Radios, checkboxes, number inputs, selects, textarea. No custom widget needs ARIA role emulation, so DESIGN.md N4 is mostly free. |
| UP6 | Nothing is hidden. | No accordions, no modals, no tooltips, no "show more". Help text is always visible; cautions are always expanded (DESIGN.md F12). |
| UP7 | If it echoes what the user just typed, it belongs in the export, not on screen. | The profile block and the free-text note move to Markdown only (§7.2). |
| UP8 | No animation. | Nothing to respect in `prefers-reduced-motion` because nothing moves. |

## 4. Scope

### 4.1 In

- Render every question in the active pack, grouped by section.
- Collect answers with native controls and inline validation feedback for the two constraint kinds that need it.
- Re-evaluate and re-render the result on every change, with no submit button (DESIGN.md F2).
- Show base, runner-up, overlays, cautions, bottleneck matrix, and directory layout.
- Show which unanswered questions could still change the result (DESIGN.md F10).
- Copy the full report as Markdown; copy a shareable link (DESIGN.md F8, F9).
- Show which pack produced the result, and its evidence date.

### 4.2 Out — and staying out

Listed explicitly, because the cost of this tool is not building it, it is the requests that arrive after it exists.

| Not building | Instead |
|---|---|
| Pack loading, editing, import, export | Edit the JSON offline and rebuild (EXT-CONFIG §13) |
| Settings panel, dark-mode toggle | Follow `prefers-color-scheme` (UD12) |
| Multi-step wizard, progress bar, "next question" flow | One scrollable form; you can see how long it is |
| Save, accounts, history of past runs | The URL is the saved state (DESIGN.md §13) |
| Framework comparison table, sortable grid, charts | The report names a base and a runner-up; the design doc holds the comparison |
| Question search or filter | Twenty-one questions fit on a page |
| Tooltips and info popovers | Inline help text under every legend |
| PDF export, print stylesheet | Copy as Markdown (CO2) |
| Animations, transitions, skeleton loaders | Nothing is async; there is nothing to wait for |
| Analytics, telemetry, error reporting | DESIGN.md's no-analytics stance stands |
| Inline "why did I get this?" toggles | The explanation is always rendered with each card (DESIGN.md F11) |

## 5. Screen

Two columns at ≥ 900 px: form on the left, report sticky on the right. One column below, report after the form, with the summary line pinned to the top (§8.3). No other responsive behaviour.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SDD Selector                          pack: finance-tech 1.0.0 · 2026-09-16│
├────────────────────────────────────┬─────────────────────────────────────┤
│ Diagnostic                         │ Recommended base: OpenSpec.          │  ← aria-live summary
│                                    │ 3 overlays, 2 cautions.              │
│ Q1. Core functional domain         │                                      │
│  ( ) Core Financial Ledger         │ ⌁ 2 unanswered questions could       │
│  ( ) Reporting & Compliance        │   change this result: Q10, Q18       │
│  ...                               │                                      │
│  Shown in the report; does not     │ ── Recommended base ──               │
│  change the recommendation.        │ OpenSpec                             │
│                                    │ Non-roadmap work or a monolith...    │
│ Q2. Team size and makeup (FTE)     │ Install: openspec init               │
│  Total        [  8 ]               │ Enforcement: /opsx:verify — advisory │
│  Software eng [  5 ]               │ Evidence: 68,430 stars, 66 commits/  │
│  QA / SDET    [  1 ]               │   30d, verified 2026-09-16           │
│  Product Owner  (•) Dedicated      │ Because: q10_architecture = monolith │
│                 ( ) Shared         │                                      │
│                 ( ) None           │ Runner-up: GSD Core — base-1 matched │
│  ...                               │   first (ordered evaluation).        │
│                                    │                                      │
│ Q5. Breakdown of incoming work     │ ── Overlays (3) ──                   │
│  Roadmap    [ 40 ]                 │ [A] Regulatory constitution          │
│  Ops        [ 20 ]                 │     source: Spec Kit · advisory      │
│  ...                               │ [G] Low-ceremony fast path           │
│  Sum: 100 ✓                        │     included in base                 │
│                                    │                                      │
│ Constraints                        │ ── Cautions (2) ──                   │
│                                    │ │ C2 · high                          │
│ Q18. Token / plan budget           │ │ constitution.md is prompt context… │
│  ( ) Unmetered                     │ │ Mitigation: pair with overlay F…   │
│  ...                               │ │ Source: Spec Kit README; §8.3      │
│                                    │                                      │
│                                    │ ── Bottlenecks ── ── Layout ──       │
│                                    │ [Copy as Markdown] [Copy link]       │
└────────────────────────────────────┴─────────────────────────────────────┘
```

## 6. Rendering model

### 6.1 Data flow

```
boot
  renderForm(pack, formEl)            once, from the compiled pack
  decodeHash(location.hash) → answers
  applyAnswersToForm(formEl, answers)
  refresh()

on any 'input' or 'change' event on the form   (one delegated listener)
  answers = readAnswers(formEl)
  applyConstraintFeedback(formEl)      sum indicator, rank de-duplication
  result  = evaluate(answers, pack)
  renderReport(result, reportEl)       #report-body replaced wholesale
  updateSummary(result)                one-line aria-live text
  scheduleHashUpdate(answers)          debounced 300 ms → history.replaceState
```

Four functions and one listener. There is no second path into the report, which is why there is no class of stale-render bug to design against.

### 6.2 Why wholesale rebuild is the right call here

The report is on the order of 200 DOM nodes. Rebuilding it costs well under the 50 ms budget in DESIGN.md N3, and buys three things that would otherwise need real machinery: no diffing logic, no component identity, and no possibility of the view disagreeing with the result object.

The one thing wholesale rebuild usually breaks is focus, and it does not break it here, because **the form is never rebuilt**. It is rendered once at boot and then only mutated in place by the two constraint behaviours in §7.3, neither of which moves focus or replaces a node the user is interacting with. The rebuild is confined to the report subtree, which contains no focusable elements except the two buttons at the end — and those are re-created with stable IDs, so a keyboard user who tabs to "Copy as Markdown" and then changes nothing keeps their position.

### 6.3 What the UI may not know

Per EXT-CONFIG §6.2, no question ID and no framework ID appears in UI code. The renderers dispatch on `field.kind` and on result structure. The CI lint in EXT-CONFIG §16.4 enforces it. This is what makes the UI survive a pack swap, and it is the only abstraction the UI layer is allowed to have.

## 7. The form

### 7.1 Structure

```
<form id="diagnostic">
  <h2>{section.title}</h2>            per section, in pack order
    <fieldset>                        per question
      <legend>Q5. Breakdown of incoming work (must total 100%)</legend>
      <p class="help" id="q5-help">…</p>
      …one control group per field…
    </fieldset>
</form>
```

One fieldset per *question*, not per field, so the compound items (Q2, Q4, Q5, Q11) read as one item with several inputs — matching the printed instrument and preserving the current rendered structure (EXT-CONFIG §9.2).

### 7.2 Controls by field kind

Six kinds, six small renderers, no exceptions.

| Kind | Markup | Notes |
|---|---|---|
| `single` | `<label><input type="radio">` per option | One group per field; `name` = field id |
| `multi` | `<label><input type="checkbox">` per option | |
| `number` | `<label><input type="number" min max step="1">` | |
| `text` | `<textarea maxlength>` | Never read by the engine (DESIGN.md D20) |
| `ranked` | One `<select>` per rank, labelled "1st (biggest)", "2nd", "3rd" | Labels from `field.rankLabels`, defaulted |
| `record` | The sub-fields, rendered by kind, each with its own label | One level deep only |

Each field's label comes from `field.label`; each question's from `legend` and `help`. No renderer contains a string that belongs to a particular questionnaire.

### 7.3 Constraint feedback

Only two behaviours, both driven by declared constraints (EXT-CONFIG §9.5) rather than by field identity:

- **`record.constraints.sumTo`** renders a live sum line under the group: `Sum: 100 ✓`, or `Sum: 97 (must equal 100)` with the error style. The engine already treats an unsatisfied record as unanswered, so this line explains a result the user would otherwise find mysterious — the one case where silence would be a usability bug rather than restraint.
- **`ranked.unique`** disables an option in the other rank selects once it is chosen, so a duplicate ranking cannot be entered.

Everything else relies on the native control being unable to produce an invalid value. There is no validation summary, no error list, no blocking of the result.

### 7.4 Reset

One "Reset" link at the end of the form: clears the form, clears the hash, re-renders. It is the only destructive action and it needs no confirmation, because nothing is stored and the URL is recoverable by the back button.

## 8. The report

### 8.1 Sections kept, and what moved to the export

DESIGN.md §12.3 specifies ten report sections. Three of them echo the user's own input back at them a few hundred pixels from where they typed it. Those stay in the Markdown — where the report is an adoption proposal for a reader who did not fill in the form — and come off the screen (UP7).

| DESIGN.md §12.3 section | On screen | In Markdown | Reasoning |
|---|---|---|---|
| 1. Completeness banner | One line | Yes | Compressed to a single sentence naming the questions; the full answered/missing lists were never useful on screen |
| 2. Team profile | **No** | Yes | Echo of Q1, Q2, Q4, Q11, Q13, visible in the form directly opposite |
| 3. Recommended base | Yes | Yes | The answer |
| 4. Runner-up | Yes, one line | Yes | DESIGN.md F13 |
| 5. Practice overlays | Yes, one card each | Yes | |
| 6. Cautions | Yes, equal weight | Yes | DESIGN.md F12 — never collapsed, never behind a toggle |
| 7. Bottleneck matrix | Yes, small table | Yes | DESIGN.md F6 |
| 8. Process mismatch note | **No** | Yes | Echo of the textarea |
| 9. Directory layout | Yes, `<pre>` | Yes | DESIGN.md F7; it is the "what do I actually create" answer |
| 10. Actions | Yes | — | Two buttons |

### 8.2 Card contents

Each base and overlay card carries, in order: name, rationale, install or command line, enforcement class with its note (DESIGN.md F5), and the triggering answers as a "Because:" line (F11). The base card adds the evidence line with its verification date and the staleness warning (F14). Overlays that the base already provides are labelled `included in base` and styled with reduced emphasis but are *not* hidden (F4).

Caution cards carry severity as text, finding, mitigation, and source. Severity and kind are conveyed by a text label plus a left border colour, never by colour alone (DESIGN.md §12.4). A positive note (C6) is labelled "Positive note", not "medium".

### 8.3 The summary line

A single sentence at the top of the report column:

> Recommended base: OpenSpec. 3 overlays, 2 cautions.

It does three jobs at once, which is why it is worth its five lines of code:

1. It is the **only** `aria-live="polite"` region on the page. The report body is not live. Announcing an entire rebuilt report on every keystroke would make the page unusable with a screen reader; announcing one sentence that only changes when the recommendation actually changes is informative. The debouncing is inherent — typing `4`, `40`, `400` in a percentage box mostly produces the same sentence, so nothing is announced.
2. On narrow screens it is `position: sticky; top: 0`, so the current recommendation stays visible while scrolling the form. This is the entire mobile strategy (UD10).
3. It gives the empty and no-match states somewhere to live (§8.4).

### 8.4 States

| State | Screen |
|---|---|
| Nothing answered yet | Summary reads "Answer the questions to see a recommendation." No base card, no fallback. |
| Some answers, no rule fired | Fallback base card with the visible "Default recommendation — no strong signal" notice (DESIGN.md F3, D2), plus the completeness line. |
| Complete | Full report. |
| Tier 0 filtered everything out | Summary reads "No framework documents support for your runtimes." Card lists the closest matches (DESIGN.md §10.1). No base, no fallback. |
| Pack fixtures failing (`?selftest`) | A banner above the form. Developer-facing; never seen in a released build. |

The empty state matters more than it looks. The engine will happily return the OpenSpec fallback for an empty answer set, and rendering that on page load would present a confident recommendation to someone who has told the tool nothing. Suppressing it until at least one rule-relevant answer exists is an honesty requirement, not a cosmetic one (UD4).

## 9. Cross-cutting

### 9.1 Accessibility

Inherits DESIGN.md N4 and §12.4; the notes specific to this design:

- Native controls throughout (UP5), so no `role`, `aria-expanded`, or focus-trap emulation exists to get wrong.
- One live region, the summary line (§8.3). The report body is `aria-live="off"` by omission.
- The form is never re-rendered, so focus and scroll position are stable while typing (§6.2).
- Every `<fieldset>` has a `<legend>`; every input has a real `<label>`; help text is associated with `aria-describedby`.
- Severity, "included in base", and staleness are all text labels first, colour second.
- Tab order is document order, which is question order, because there is no layout trickery.
- Target: keyboard-only completion of the whole questionnaire, and Lighthouse accessibility ≥ 95 (DESIGN.md §14.2).

### 9.2 Styling

One `<style>` block. A handful of custom properties for colour and spacing, a two-column CSS grid with one breakpoint, system font stack, no CSS framework, no icon font, no web fonts (DESIGN.md N5). Dark mode via `prefers-color-scheme` only; no toggle, because a toggle needs persistence and persistence needs storage (UD12).

### 9.3 URL sync

Unchanged from DESIGN.md §13 and EXT-CONFIG §12, with one UI-level detail: `history.replaceState` is debounced 300 ms so that typing in a number or textarea field does not write the URL on every keystroke. The report itself is *not* debounced — it updates immediately, because that is the feedback the user is looking at.

"Copy link" copies the current URL. If the fragment exceeds ~1,800 characters, the button shows a one-line warning that some chat clients truncate long links.

### 9.4 Budgets

Concrete numbers, because "keep it simple" is not a reviewable criterion.

| Piece | Budget |
|---|---|
| `renderForm` plus six kind renderers | ~120 lines |
| `readAnswers` + `applyAnswersToForm` | ~60 lines |
| `renderReport` + `updateSummary` | ~130 lines |
| Boot, listener, URL sync, copy actions | ~60 lines |
| CSS | ~130 lines |
| **Total UI layer** | **~500 lines** |
| Report rebuild, mid-range laptop | < 10 ms (within the 50 ms of N3) |

Exceeding a budget is not forbidden; it is a prompt to ask which principle in §3 was abandoned.

## 10. Impact on the other documents

### 10.1 On DESIGN.md

| Location | Change |
|---|---|
| §12.1 Layout | Unchanged (two columns, sticky report, no modals) |
| §12.2 Form | Replaced by §7: generic kinds, not per-question renderers |
| §12.3 Report | Replaced by §8.1: sections 2 and 8 become Markdown-only |
| §12.4 Accessibility | Preserved; extended by §9.1 with the single-live-region rule |

### 10.2 On DESIGN-EXT-CONFIG.md

"Editing stays offline" removes the runtime pack-loading surface that EXT-CONFIG v0.1.0 proposed. The following are cut, and EXT-CONFIG v0.2.0 reflects it:

| Cut | Was | Now |
|---|---|---|
| File picker, paste box, `?configUrl` | CF3, §13.1 channels 1–5 | The inlined pack is the only pack |
| `localStorage` persistence and revert banner | CF12, CD15 | Nothing is stored |
| Export pack action | CF13 | Edit the JSON file directly |
| Runtime validation panel | CF4 | Validation runs in `tools/validate.mjs` and CI |
| In-page validator | §14.3 | The validator ships in Node only, not in the page |
| `?packcheck` mode | §14.3 | A `tools/validate.mjs` flag |
| Pack id + digest in the URL | §12.3, CD10 | A plain `v=<digest8>` marker — there is only ever one pack per build |
| Untrusted-pack threat model | §15 | The pack is first-party and inlined; the no-`eval` property is kept for CSP and clarity, not as a sandbox |

This is a large simplification and it lands almost entirely on EXT-CONFIG's Phase 5. The parity gate, the expression interpreter, the generic field model, and the offline validator — the parts that actually make the pack editable — are untouched.

## 11. Decisions

| ID | Question | Decision | Rationale |
|---|---|---|---|
| UD1 | How does the report update? | Discarded and rebuilt wholesale; the form is never rebuilt | ~200 nodes is far inside the performance budget, and it removes diffing, component identity, and stale-view bugs in one move. Focus is safe because the form is untouched. |
| UD2 | Where does state live? | In the form DOM and the URL. No state object. | Two sources of truth is one too many for twenty-one inputs. `readAnswers(form)` already exists and is already tested. |
| UD3 | How many event listeners? | One delegated `input`/`change` listener on the form | Adding a question must not require wiring. |
| UD4 | Show a recommendation before anything is answered? | No. Suppress until a rule-relevant answer exists. | The engine returns the OpenSpec fallback for an empty answer set; rendering that on load would be a confident recommendation based on nothing. |
| UD5 | What is announced to screen readers? | One summary sentence, the only live region | Announcing a rebuilt report per keystroke is worse than announcing nothing. |
| UD6 | Do we echo the user's answers back in the report? | Not on screen; yes in the Markdown | The Markdown has a reader who never saw the form. The screen does not. |
| UD7 | How many actions? | Two: Copy as Markdown, Copy link. Plus Reset in the form. | Every further action needs a home, a label, and a reason. |
| UD8 | Any pack UI? | None | Authoring is an offline task with a validator and a diff; putting it in the page would double the UI and give a once-a-quarter task permanent screen space. |
| UD9 | Custom widgets? | None. Native controls only. | Buys most of WCAG 2.1 AA for free and keeps the renderers small. |
| UD10 | Mobile strategy? | Single column, report below the form, summary line sticky at top | Reuses the accessibility summary element; costs about five lines of CSS. |
| UD11 | Build tooling for the UI? | None. Plain DOM calls in the single file. | Consistent with DESIGN.md §6.2; a framework for one form and one report is the disproportion that section already rejected. |
| UD12 | Theme toggle? | No. `prefers-color-scheme` only. | A toggle needs persistence; persistence needs storage; the tool stores nothing. |

## 12. Risks and open questions

| ID | Item | Assessment |
|---|---|---|
| UR1 | Rebuilding the report interrupts a user selecting text in it while still editing the form | Low impact, accepted. Editing and reading are sequential in practice. |
| UR2 | The sticky report column overflows on short viewports | Mitigated: `max-height: 100vh; overflow: auto` on the column. |
| UR3 | "Everything visible" makes the report long for a team that fires many cautions | Accepted deliberately. DESIGN.md F12 exists because collapsing cautions is how a regulated team misses the part that mattered. |
| UR4 | The budget in §9.4 erodes request by request | The §4.2 "not building" table is the defence, and it is the section to update — with a reason — when something is added. |
| CO1 | Should the bottleneck matrix and directory layout be Markdown-only too, shortening the screen further? | Keep on screen for now; both answer a question the base and overlay cards raise. Revisit after the first real users. |
| CO2 | Print stylesheet? | No for v1. "Copy as Markdown" is the export path. Cheap to add later if anyone asks. |
| CO3 | Should the summary line name the cautions' highest severity ("2 cautions, 1 high")? | Probably yes; deferred until the copy is written against real output. |
