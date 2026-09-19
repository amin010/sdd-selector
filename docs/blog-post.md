# We built a tool that recommends a framework by quiz. Then we checked if the quiz was right.

There's a small HTML page in this repo that asks 21 questions about your engineering team — team shape, architecture, compliance tier, deploy cadence, where things bottleneck — and then tells you which spec-driven-development framework to adopt. It's called SDD Selector. For a while it sat there, deterministic and confident, recommending frameworks to finance-tech teams.

Nobody had checked whether it was *right*.

This post is about designing that check, running it, and what happened when the first numbers came back ugly. The short version: under first-match-wins the engine lost to always guessing OpenSpec. Weighted scoring, scored against the same frozen judge panel, tied the best one-question stub. A later pack closed two more holes — dead eligibility gates, and a framework the judges kept picking that the engine could not emit — and agreement crossed the kappa bar we wrote down *before seeing any results*. Accuracy still missed the last pre-registered criterion, by 0.39 percentage points.

The bar did not move.

## What SDD Selector actually is

SDD Selector is a single-file diagnostic: open `index.html`, no server, no build step at runtime. You answer a questionnaire about your team and project. A rule engine reads your answers and recommends:

- one **base framework** — the daily workflow harness — chosen from OpenSpec, GitHub Spec Kit, BMAD, Spec Kitty, GSD Core, or Superpowers
- optional **practice overlays** layered on for specific constraints (a SOX constitution overlay, enforced TDD, or a low-ceremony fast path)
- **cautions** — known weak spots of the recommended stack against your profile, surfaced with equal visual weight to the recommendation itself, not buried in a footnote

Tessl SDD Tile is in the catalog as a watch-status, score-penalized candidate. In practice it almost never wins: on a 50,000-case corpus it was 0%. When the top score is too weak or too close to call, the current pack says **insufficient signal** instead of silently falling back to OpenSpec.

The whole thing is a pure function: same answers in, same recommendation out, every time. That determinism is a feature. It's also exactly the kind of system where "does this actually work" is a well-posed, checkable question — if you can find something to check it against.

## The problem: there was nothing to check it against

The rules that decide which framework you get weren't derived from a dataset. They came from a source document, layered with primary research into each framework's actual behavior, layered with editorial judgment. The design doc says this about itself, plainly, regarding the ceremony and cost ratings that feed several rules:

> "Ceremony and cost are 1 (minimal) to 5 (heavy). These are editorial ratings derived from the workflow descriptions and field reports below, not measurements."

That admission isn't limited to display-only numbers. The actual thresholds that decide your base framework — team size cutoffs, roadmap-percentage cliffs — are the same kind of construction. In a few places the project goes further and explicitly *declines* to build a rule at all: five of the 21 instrument fields feed no rule whatsoever, on the stated principle of "do not invent [rules for silent fields] ahead of evidence." That's admirable restraint. It's also an admission that a meaningful chunk of the questionnaire was written without evidence to calibrate it either way.

Put plainly: no labeled dataset, no surveyed teams, no adoption-outcome data existed anywhere for this tool. Two questions were open and unanswerable from anything already in the repo:

1. Does the engine's logic actually pick the right framework?
2. Do the 21 questions actually discriminate between different kinds of teams?

You can't check either of those against ground truth that doesn't exist. So the only option was to build a ground truth.

## Designing an experiment with no ground truth

The approach split into two independent tracks.

**Track one needed no LLM at all.** The engine has a 50,000-case seeded corpus of synthetic answer sets already in the test suite. You can run every one of those through `evaluate()` and just *ask the rules themselves* which questions can ever move the outcome, which thresholds are near cliffs a self-reported estimate could tip over, and how the outcomes distribute. This is pure, deterministic, offline analysis — expensive to think through, free to run.

**Track two required constructing an oracle from scratch**, because RQ1 ("is the engine's pick actually right?") has no answer without an external judge. The design:

- Generate roughly 100 synthetic team vignettes — prose descriptions of finance-tech teams, 2–4 paragraphs each, stratified across the canonical outcomes so the sample isn't accidentally lopsided.
- Have three independent LLM respondents read each vignette and fill out the *real* 21-question instrument from the story alone — never seeing the rules, the thresholds, or each other's answers. Running three respondents per vignette does double duty: it's also the entire input needed to measure whether the questionnaire is *reliable* (do independent readers of the same story answer the same way?).
- Have a separate, blind panel of three LLM judges read only the vignette prose plus each framework's documented best-fit/poor-fit profile — never the rules, never the thresholds, never the questionnaire — and return a ranked top-3.

None of the pass/fail thresholds were decided after seeing results. Every criterion — the kappa floor for whether the oracle itself is trustworthy, the accuracy margin the engine needed over trivial baselines, the coverage bar for how many questions had to actually matter — was committed to `docs/QC-EXPERIMENT.md` *before a single vignette existed*. If a number came back inconvenient, the finding was "the pre-registered bar wasn't met," not a rewrite of the bar.

The panel that all the numbers below come from used **role-differentiated models**: `gpt-5.6-terra` wrote the vignettes and filled the questionnaire; `gpt-5.6-sol` judged. Same frozen `tools/qc/data/{vignettes,answers,labels}.json` for every re-score. Changing the engine does not spend another token. That is how three packs can be compared on one oracle.

## What the offline analysis found (no LLM, no judgment calls, just the rules)

Some of the sharpest findings in the whole experiment needed zero API calls. They also explain why the first engine version never had a chance.

**Under first-match-wins, ~87–91% of the entire answer space collapsed onto OpenSpec.** Across the corpus, almost everything resolved to OpenSpec by rule or by fallback. BMAD, Spec Kit, GSD Core, and Superpowers were rounding error. A recommender that emits one label for nine-tenths of its input space is not discriminating. It is a default with a UI.

**There was a config hole that silently killed BMAD.** BMAD shipped with an empty `runtimes` list in its framework metadata. The engine's filtering stage removed any framework that didn't declare support for at least one runtime named in `q20_runtimes` — and since BMAD declared none, answering that question at all removed BMAD from consideration before the base-selection rules even ran, regardless of whether BMAD's own predicate (dedicated product owner, scrum master, and QA roles; vague requirements) would have matched. Of the corpus cases where that question was answered *and* BMAD's own rule was logically satisfied, **100% never resolved to BMAD.**

That hole is closed. Empty `runtimes` now means "no runtime restriction" at the candidate filter, not "supports nothing." BMAD and Tessl now also document the runtime they actually support, so the score no longer rewards omitted evidence.

**First-match also meant most of the questionnaire couldn't move the base.** On that engine, only 10 of 18 non-cosmetic questions had any measurable influence on the base recommendation — 55.6%, short of the 60% bar the experiment pre-registered as a pass. Overlay and caution questions were doing work the *base* pick never saw.

Weighted scoring changed the corpus picture. Signals add, candidates rank, and a weak or tied top score is reported as insufficient signal instead of a silent OpenSpec fallback. The first weighted pack still had a second hole: a rule whose own `when` gate failed could still win on additive signals. That is how 0.5.0 over-fired BMAD and GSD. The current pack skips ineligible rules. On the same 50,332 cases it now distributes as insufficient signal 59%, OpenSpec 26%, BMAD 8%, Spec Kitty 5%, with GSD, Spec Kit, and Superpowers each under 1%. Twelve of eighteen non-cosmetic questions move the base (66.7%) — that coverage bar passes. The questionnaire was never as inert as first-match made it look; first-match just refused to listen to most of it.

## What the judge panel found — three engines, one frozen oracle

This is where the LLM oracle comes in, and it's the part that matters most.

First, the sanity check: are the judges even worth listening to? Three independent `gpt-5.6-sol` judges, seeing only vignette prose and framework fit profiles, agreed with each other at a Fleiss' kappa of **0.50** across all 100 vignettes — above the 0.40 bar the experiment set for "this oracle is usable." That's not a rubber stamp; three blind readers converged on real signal.

Then the actual test: does the engine's own recommendation agree with that independent judgment? Of the 100 vignettes, 89 had a clear judge majority (eleven were three-way splits and were excluded, per protocol). Same 89 vignettes, same labels, two baselines and three engines:

| Predictor | Top-1 accuracy | Cohen's κ vs judges |
|---|---:|---:|
| Always guess OpenSpec, ignore the input entirely | **47.19%** | — |
| A single question (`q5.roadmap ≥ 60` → Spec Kit, else OpenSpec) | **53.93%** | — |
| First-match engine (pack 0.4.1, hole closed) | **37.08%** | **0.03** |
| Weighted engine, gates ignored (pack 0.5.0) | **53.93%** | **0.37** |
| **Weighted engine, live gates, Spec Kitty selectable (pack 0.5.1, shipped)** | **61.80%** | **0.45** |

First-match lost to the constant guess by ten points and sat at chance agreement. Closing the runtime hole let it emit BMAD twice on this panel; independent judges' majority labels on those 89 teams were OpenSpec 42, **BMAD 26**, Spec Kitty 14, Spec Kit 7. The engine still could not agree with most of that BMAD slice — first-match OpenSpec kept winning — and Spec Kitty was not yet a selectable base. Runner-up credit recovered some OpenSpec-vs-BMAD misses (56%) but did not save RQ1.

Weighted scoring, re-run against that same frozen panel, is a different machine. Accuracy matched the best one-question stub (48/89). Kappa went from 0.03 to 0.37. The engine started emitting BMAD, GSD, and Spec Kit, and saying "insufficient signal" instead of laundering a weak case into OpenSpec. It still failed every pre-registered RQ1 pass criterion: kappa 0.37 short of 0.40, the OpenSpec margin +6.7 instead of ≥15, and a *tie* with the stub rather than a win.

The leftover problem was specific. On 0.5.0, **31 of 89** consensus vignettes (35%) resolved through a rule whose own `when` gate was false — 24 of those 31 were wrong. Judges also picked Spec Kitty 14 times, a label the engine structurally could not emit. That 84% reachability ceiling was independent of scoring quality.

Pack 0.5.1 did two targeted things and did not touch the questionnaire. Live gates: zero consensus vignettes now win through a failed `when`. Spec Kitty as `base-6`: the engine emits it 18 times and matches 9 of the 14 gold labels. Label-reachability goes to 100%. False-gate winners go to 0. Accuracy is 55/89. Kappa is **0.45**. Runner-up credit is 75%. Residual errors are OpenSpec↔BMAD swaps and GSD over-firing on compact teams the judges still wanted on OpenSpec — rule precision, not a catalog hole.

It still fails RQ1, on one of the three sub-criteria. We do not get to call 0.39 points rounding error: we did not write a fuzzy bar.

- Cohen's κ is **0.4459**, above 0.40. Pass.
- Beating the best single-question stub was required; **61.80% > 53.93%**. Pass.
- Beating always-OpenSpec by ≥ 15 points was required; the gap is **+14.61**. Fail.

The questionnaire verdict is no longer mixed. Recommendation stability across the three respondents is 82% (pass: ≥ 70%). Influence coverage still passes. The danger quadrant — high-leverage questions that independent readers of the same story cannot agree on — is empty. `q20_runtimes` still has poor respondent agreement (37%), but it no longer moves the base enough to count. RQ2 passes all three pre-registered sub-criteria.

## Limitations of selecting a framework this way

The experiment asks whether the engine agrees with independent judges. That is a narrower question than whether a 21-question quiz is a good way to choose an SDD stack. Even if RQ1 had passed, these bounds would still apply.

**It matches a profile to documentation, not a team to an outcome.** The engine does not know which framework ships better code, fewer defects, or a workflow people will still be using in six months. It maps self-described team shape onto documented capabilities and known failure modes. That is a fit model. It is not a trial.

**It picks one daily harness.** The architecture is one base, optional overlays, and cautions. A team that already mixes tools, or that needs Spec Kit for greenfield services and OpenSpec for the brownfield remainder, still gets a single primary. The runner-up is on the report; the product does not recommend a split stack. On the random corpus, 59% of answer sets now come back as insufficient signal rather than a forced default. That is more honest than silent OpenSpec. It is also an admission that a lot of internally coherent-looking questionnaires do not actually distinguish a winner.

**The gates and weights are still editorial.** Team size under 5, roadmap share at 60, non-roadmap share at 40, and the signal weights that rank eligible rules were not fit to adoption data. A calibration sweep against this panel put the team-size cliff slightly off its empirical peak; we did not retune on n=89. Five of the 21 questions — domain, tenure, cycle time, branching, process-mismatch free text — feed no rule at all, by design. The most human answer on the form is copied into the Markdown report and never seen by `evaluate()`.

**The inputs are self-reported, and some of them sit on cliffs.** Work-breakdown percentages and role designations are estimates. A few points either side of a threshold can change the base. Independent readers of the same vignette agreed on runtimes only 37% of the time. Soft runtime filtering means a mismatch is a score penalty, not an exclusion: you can still be recommended a framework your agent runtime does not officially document.

**The catalog is a dated slice of a fast-moving field.** Framework profiles are evidence-dated. Superpowers' star count and GSD Core's age already disagree with each other as adoption signals. A quiz cannot see that a project went quiet last month, or that a "watch" tile became production-ready, unless someone refreshes the pack. Residual engine-vs-judge errors are now OpenSpec↔BMAD swaps and GSD over-firing on compact teams the judges still wanted on OpenSpec — precision inside the catalog, not a missing name. Overlays and cautions were never scored against the judges; only the base pick was.

None of this is an argument against using the page. It is the difference between "this is a defensible first cut, with failure modes on the same screen as the pick" and "this is the framework you should standardize on." The second claim is not what the selector is for.

## What this doesn't mean

Those are limits of the *selector*. These next ones are limits of the *check*. "LLM judges everything" claims deserve skepticism by default.

This is a re-score of a completed panel, not a new panel generated against the current engine. Judges and respondents never saw weighted scoring, insufficient-signal, live gates, or Spec Kitty as a base. That is the point of a frozen oracle — and it is also a limit: we did not ask whether *new* vignettes, written with the current product in mind, would look the same.

The sample is n=100 vignettes from one generator. The experiment's own authors note the accuracy numbers shouldn't be read as more precise than roughly ±5–10 percentage points of sampling noise. Missing a 15-point margin by 0.39 points is a fail on a bar we wrote down in advance; it is not a claim that the next 100 vignettes would miss by the same amount. And LLM-judged prose vignettes standing in for real engineering teams are themselves an imperfect oracle — nothing here claims to have surveyed actual finance-tech teams. Vignette realism was not independently validated.

Generator and respondents share a model family (`gpt-5.6-terra`); judges are a different one (`gpt-5.6-sol`). That is better than the earlier all-`gpt-4.1-mini` smoke configuration, and it is still not three unrelated families. Self-preference risk is reduced, not gone.

It's also worth saying: the pre-registered protocol treats "no stable ground truth" as a *legitimate finding in its own right*, not a failure state for the experiment to avoid. That didn't happen here — the oracle cleared its usability bar cleanly — but it's a sign the experiment was designed to be honest about a null result. We used that honesty. The bar did not move when the first engine failed, and it did not move when the third engine got to 14.61.

None of this is proof. It is the first empirical evidence that exists for this tool at all, plus a documented three-pack comparison on the same labels.

## Why this is reusable beyond one HTML page

The pattern here isn't specific to a spec-driven-development framework picker. Any rules-based recommender that was designed by intuition and field research rather than measured data — which describes a lot of internal tooling — can be checked the same way:

1. Pre-register your pass/fail thresholds before you have any results, so a disappointing number can't quietly become a moved goalpost.
2. Run a cheap, deterministic sensitivity analysis over the rules' own logic first — no LLM required, and it'll often find real bugs (a config field silently disabling an entire outcome; a gate that scoring then ignores) before you spend a token on the harder question.
3. Where no ground truth exists, construct one deliberately: independent generation, independent response, independent — genuinely blind — judgment, with reliability measured as a first-class output rather than assumed.
4. When you change the engine, re-score the *frozen* labels. Don't regenerate the oracle until you intend to. The delta is the finding.

The finding, in this case, was three-part and all three parts are useful. First-match-wins on this instrument was not earning its keep. Weighted scoring is a large improvement that, with live gates and a previously unreachable label restored, beats a one-question stub and clears the kappa bar. It still does not beat a constant OpenSpec guess by the margin we refused to lower. Finding that out with numbers, pre-registered, before it went further into production use, is exactly the point of doing the check at all.
