# We built a tool that recommends dev frameworks by quiz. Then we checked if the quiz was right.

There's a small HTML page in this repo that asks you 21 questions about your engineering team — team shape, architecture, compliance tier, deploy cadence, where things bottleneck — and then tells you which spec-driven-development framework to adopt. It's called SDD Selector. It's been sitting there, deterministic and confident, recommending frameworks to finance-tech teams.

Nobody had ever checked whether it was *right*.

This post is about designing and running that check, and about what it found. The short version: the tool's own 21-question apparatus recommends a framework by rule, and when we built an independent way to ask "would a competent, blind observer agree with this?", the answer was — not really, and not more often than just picking the same framework every time.

## What SDD Selector actually is

SDD Selector is a single-file diagnostic: open `index.html`, no server, no build step at runtime. You answer a questionnaire about your team and project. A rule engine reads your answers and recommends:

- one **base framework** — the daily workflow harness — chosen from OpenSpec, GitHub Spec Kit, BMAD, GSD Core, or Superpowers
- optional **practice overlays** layered on for specific constraints (a SOX constitution overlay, enforced TDD, a low-ceremony fast path)
- **cautions** — known weak spots of the recommended stack against your specific profile, surfaced with equal visual weight to the recommendation itself, not buried in a footnote

Two other frameworks, Spec Kitty and Tessl SDD Tile, exist in the tool's catalog and can appear as overlay sources or in caution text, but structurally can never be the *base* recommendation — one is overlay-only by design, the other is excluded because its status is `watch` (pre-production, in the tool's own taxonomy). That leaves five reachable outcomes, plus a fallback and a "no framework survived filtering" state — seven canonical outcomes in total.

The whole thing is a pure function: same answers in, same recommendation out, every time. That determinism is a feature. It's also exactly the kind of system where "does this actually work" is a well-posed, checkable question — if you can find something to check it against.

## The problem: there was nothing to check it against

Here's the uncomfortable part. The rules that decide which framework you get weren't derived from a dataset. They came from a source document, layered with primary research into each framework's actual behavior, layered with editorial judgment. The design doc says this about itself, plainly, regarding the ceremony and cost ratings that feed several rules:

> "Ceremony and cost are 1 (minimal) to 5 (heavy). These are editorial ratings derived from the workflow descriptions and field reports below, not measurements."

That admission isn't limited to display-only numbers. The actual thresholds that decide your base framework — team size cutoffs, roadmap-percentage cliffs — are the same kind of construction. In a few places the project goes further and explicitly *declines* to build a rule at all: five of the 21 instrument fields feed no rule whatsoever, on the stated principle of "do not invent [rules for silent fields] ahead of evidence." That's admirable restraint. It's also an admission that a meaningful chunk of the questionnaire was written without evidence to calibrate it either way.

Put plainly: no labeled dataset, no surveyed teams, no adoption-outcome data existed anywhere for this tool. Two questions were open and unanswerable from anything already in the repo:

1. Does the engine's logic actually pick the right framework?
2. Do the 21 questions actually discriminate between different kinds of teams?

You can't check either of those against ground truth that doesn't exist. So the only option was to build a ground truth.

## Designing an experiment with no ground truth to check against

The approach split into two independent tracks.

**Track one needed no LLM at all.** The engine has a 50,000-case seeded corpus of synthetic answer sets already in the test suite. You can run every one of those through `evaluate()` and just *ask the rules themselves* which questions can ever move the outcome, which thresholds are near cliffs a self-reported estimate could tip over, and how the outcomes distribute. This is pure, deterministic, offline analysis — expensive to think through, free to run.

**Track two required constructing an oracle from scratch**, because RQ1 ("is the engine's pick actually right?") has no answer without an external judge. The design:

- Generate roughly 100 synthetic team vignettes — prose descriptions of finance-tech teams, 2–4 paragraphs each, stratified across the seven canonical outcomes so the sample isn't accidentally lopsided.
- Have three independent LLM respondents read each vignette and fill out the *real* 21-question instrument from the story alone — never seeing the rules, the thresholds, or each other's answers. Running three respondents per vignette does double duty: it's also the entire input needed to separately measure whether the questionnaire is *reliable* (do independent readers of the same story answer the same way?).
- Have a separate, blind panel of three LLM judges read only the vignette prose plus each framework's documented best-fit/poor-fit profile — never the rules, never the thresholds, never the questionnaire — and return a ranked top-3.

Critically, none of the pass/fail thresholds were decided after seeing results. Every criterion — the kappa floor for whether the oracle itself is trustworthy, the accuracy margin the engine needed over trivial baselines, the coverage bar for how many questions had to actually matter — was committed to `docs/QC-EXPERIMENT.md` *before a single vignette existed*. If a number came back inconvenient, the finding was "the pre-registered bar wasn't met," not a rewrite of the bar.

## What the offline analysis found (no LLM, no judgment calls, just the rules)

Some of the sharpest findings in the whole experiment needed zero API calls.

**91% of the entire answer space collapses onto one outcome.** Across the 50,330-case corpus, 48.10% of cases resolve to OpenSpec directly and another 42.90% resolve to the fallback — which also happens to be OpenSpec. Add a 7.23% "no framework survives filtering" bucket and you've accounted for nearly the whole corpus before BMAD (0.88%), Spec Kit (0.49%), GSD Core (0.33%), or Superpowers (0.06%) get a look.

**There's a config hole that silently kills BMAD.** BMAD ships with an empty `runtimes` list in its framework metadata. The engine's filtering stage removes any framework that doesn't declare support for at least one runtime named in the `q20_runtimes` question — and since BMAD declares none, answering that question at all removes BMAD from consideration before the base-selection rules even run, regardless of whether BMAD's own predicate (dedicated product owner, scrum master, and QA roles; vague requirements) would have matched. The corpus makes the blast radius concrete: of the cases where that question was answered, BMAD's own rule was logically satisfied in 3,196 of them — and **100% of those never resolved to BMAD.**

**Less than two-thirds of the questions that could matter, do.** Only 10 of the 18 non-cosmetic instrument questions have any measurable influence on the base recommendation at all — 55.6%, short of the 60% bar the experiment pre-registered as a pass condition. The other 8 feed only overlays or cautions, on top of five fields already known to be inert by design. Add it up and 13 of the 23 underlying answer fields — well over half — cannot move the actual framework recommendation under any input.

## What the judge panel found — the real headline

This is where the LLM oracle comes in, and it's the part that matters most.

First, the sanity check: are the judges even worth listening to? Three independent LLM judges, seeing only vignette prose and framework fit profiles, agreed with each other at a Fleiss' kappa of **0.5427** across all 100 vignettes — comfortably above the 0.40 bar the experiment set for "this oracle is usable." That's not a rubber stamp; three blind readers converged on real signal.

Then the actual test: does the engine's own recommendation agree with that independent judgment?

Of the 100 vignettes, 96 had a clear judge majority (four were three-way splits and were excluded, per protocol). Against those 96:

| Predictor | Top-1 accuracy |
|---|---:|
| Always guess OpenSpec, ignore the input entirely | **50.00%** |
| A single question (`q7_requirements`: vague/high-level → BMAD, else → OpenSpec) | **45.83%** |
| **The engine's actual 21-question recommendation** | **41.67%** |

**The engine is beaten by a coin-flip-grade constant guess, and by a rule that looks at exactly one of its 21 questions.** Cohen's kappa between the engine and the judge-majority label came out to 0.0856 — barely above chance agreement, nowhere near the pre-registered 0.40 pass bar. All three of the experiment's pre-registered RQ1 pass criteria failed, and not narrowly: the engine's accuracy is 8.33 percentage points *worse* than the constant baseline, not better by the required 15 points.

The confusion matrix explains most of it on its own. Over the 96 consensus vignettes, the engine recommended OpenSpec 69 times and never once recommended BMAD, Superpowers, or GSD Core. But the judges' own majority-label distribution over those same 96 teams was OpenSpec 48, **BMAD 41**, Spec Kit 5, GSD Core 2. Independent judges think something like 43% of these teams are a BMAD fit. The engine structurally cannot agree with any of them — that's the runtime-filtering hole from the offline analysis, showing up as real disagreement on real vignettes, not just as a corpus statistic. The engine's own runner-up mechanism, designed to soften exactly this kind of miss, recovered zero additional matches when checked.

## What this doesn't mean

A few things are worth being upfront about, because "LLM judges everything" claims deserve skepticism by default.

This run used **`gpt-4.1-mini` for every role** — vignette generation, all three respondents, and all three judges. The experiment's own pre-registered validity concerns flag exactly this configuration as a self-preference risk: a shared model family across supposedly independent stages can inflate agreement between them. If anything, that makes the headline finding more notable rather than less — even with every structural advantage a shared model family could provide, the engine still lost to guessing the same answer every time. But it's a real caveat, and a second run using better, role-differentiated models (a stronger judge model, a distinct respondent/persona model) was underway at the time of writing, specifically to check whether this finding holds up once that confound is removed.

The sample is n=100 vignettes from one generator. The experiment's own authors note the accuracy numbers shouldn't be read as more precise than roughly ±5–10 percentage points of sampling noise. And LLM-judged prose vignettes standing in for real engineering teams are themselves an imperfect oracle — nothing here claims to have surveyed actual finance-tech teams.

It's also worth saying: the pre-registered protocol treats "no stable ground truth" as a *legitimate finding in its own right*, not a failure state for the experiment to avoid. That didn't happen here — the oracle cleared its usability bar cleanly — but it's a sign the experiment was designed to be honest about a null result, not just built to confirm what everyone already suspected.

None of this is proof. It's the first empirical evidence that exists for this tool at all, where before there was none.

## Why this is reusable beyond one HTML page

The pattern here isn't specific to a spec-driven-development framework picker. Any rules-based recommender that was designed by intuition and field research rather than measured data — which describes a lot of internal tooling — can be checked the same way:

1. Pre-register your pass/fail thresholds before you have any results, so a disappointing number can't quietly become a moved goalpost.
2. Run a cheap, deterministic sensitivity analysis over the rules' own logic first — no LLM required, and it'll often find real bugs (like a config field silently disabling an entire outcome) before you spend a token on the harder question.
3. Where no ground truth exists, construct one deliberately: independent generation, independent response, independent — genuinely blind — judgment, with reliability measured as a first-class output rather than assumed.

The finding, in this case, was uncomfortable: a fair amount of a 21-question apparatus isn't earning its keep, and the recommendations it produces don't yet beat guessing. But finding that out, with numbers, pre-registered, before it went further into production use, is exactly the point of doing the check at all.
