# We built a tool that recommends a framework by quiz. Then we checked if the quiz was right.

There's a small HTML page in this repo that asks 21 questions about your engineering team — team shape, architecture, compliance tier, deploy cadence, where things bottleneck — and then tells you which spec-driven-development framework to adopt. It's called SDD Selector. For a while it sat there, deterministic and confident, recommending frameworks to finance-tech teams.

Nobody had checked whether it was *right*.

So we checked. We wrote the pass marks down before seeing any results, built a panel of blind AI judges, and scored three versions of the engine against them. The first lost to a strategy of always guessing the same answer. The third got within **0.39 percentage points** of passing. We didn't round that up.

Then we noticed something worse: the check was aimed at the wrong output. The framework pick carried about a quarter of what the quiz actually influences. So we rebuilt the tool around the part that mattered, re-scored it against the same judges — and watched the headline number fall from 62% to 20%.

This post is about how that happened, why the drop was the expected result and not the disaster it looks like, and why it still isn't good news.

## What the tool does

You open `index.html` — no server, nothing to install — and answer the questionnaire. The page gives you three things:

- **A base framework** (the page calls it a *harness*): the daily workflow your team stands on. The candidates are OpenSpec, GitHub Spec Kit, BMAD, Spec Kitty, GSD Core, and Superpowers.
- **Practices** to layer on top: a regulatory constitution, enforced test-driven development, deterministic CI gates, a low-ceremony fast path for small changes. Some of these come from frameworks you *don't* adopt.
- **Cautions**: the places where your recommended stack is weak for your particular team, shown with the same visual weight as the recommendation itself, not buried in a footnote.

It's a pure function. Same answers in, same recommendation out, every time. That makes "does this actually work?" a fair, checkable question — if you have something to check it against.

## There was nothing to check it against

The rules that picked your framework weren't derived from data. They came from a source document, layered with research into how each framework actually behaves, layered with editorial judgment. The design doc is candid about this:

> "Ceremony and cost are 1 (minimal) to 5 (heavy). These are editorial ratings derived from the workflow descriptions and field reports below, not measurements."

The same goes for the thresholds that decided the pick: team size under 5, roadmap work at 60% or more. Five of the 21 questions feed no rule at all, on the principle of not inventing rules "ahead of evidence." That's admirable restraint, and also an admission that nobody knew how to calibrate them.

There was no labeled dataset, no survey of real teams, no data on which adoptions worked. That left two questions nobody could answer:

1. **Does the engine pick the right framework?** (We called this RQ1.)
2. **Do the 21 questions actually tell teams apart?** (RQ2.)

You can't grade answers against a key that doesn't exist. So we had to build the key.

## Building an answer key from scratch

The experiment ran on two tracks.

**Track one needed no AI at all.** The test suite already had 50,000 randomly generated answer sets. Run all of them through the engine and you learn, from the rules alone, which questions can ever change the outcome, which thresholds sit on a knife-edge, and how the recommendations spread out. It's free to run and completely deterministic.

**Track two built the answer key**, using language models in three separate roles that never see each other's work:

- **A writer** produced about 100 short stories, each describing a fictional finance-tech team in two to four paragraphs.
- **Three respondents** read each story and filled out the real questionnaire from the story alone, without seeing the rules. Using three of them also measures *reliability*: do independent readers of the same story answer the same way?
- **Three judges** read only the story plus each framework's documented strengths and weaknesses — no rules, no questionnaire — and ranked their top three frameworks.

The judges' majority pick is the answer key. `gpt-5.6-terra` wrote the stories and filled out the questionnaires, and `gpt-5.6-sol` judged. All of it is frozen on disk, so every later engine is graded against exactly the same key without spending another token.

The important part: **every pass mark was committed to `docs/QC-EXPERIMENT.md` before a single story existed.** That includes how much the judges had to agree with each other, how far the engine had to beat simple baselines, and how many questions had to matter. If a result came back inconvenient, the finding was "didn't pass." The mark stayed where it was.

## What the rules revealed on their own

Some of the sharpest findings needed zero AI calls.

**The first engine was a default with a user interface.** It used *first match wins*: walk the rules in order, take the first one that fits. Roughly 87–91% of all possible answer sets ended up at OpenSpec. BMAD, Spec Kit, GSD Core, and Superpowers were rounding error.

**A config typo silently deleted BMAD.** BMAD's metadata listed no supported agent runtimes (Claude Code, Cursor, and so on). The engine read that empty list as "supports nothing," so any team that answered the runtime question lost BMAD before the rules even ran. Among teams that matched BMAD's own rule *and* answered that question, BMAD won **0%** of the time. We fixed it: an empty list now means "no restriction."

**Most of the questionnaire couldn't reach the pick.** Only 10 of 18 meaningful questions could change the framework, short of the 60% bar. The rest only affected practices and cautions.

The next version switched to *weighted scoring*: every rule adds points, the highest total wins, and a weak or tied result says "insufficient signal" instead of quietly defaulting to OpenSpec. After two more fixes (version 0.5.1, described below), 12 of 18 questions moved the pick. The questionnaire was never as useless as first-match made it look. First-match just ignored most of it.

## Three engines, one answer key

First, a sanity check on the judges themselves. Their agreement scored **0.50** on Fleiss' kappa, a standard measure where 0 means chance-level and 1 means perfect agreement. The pre-set bar for "usable" was 0.40, so it passed. For a sense of the ceiling: a single judge matches the three-judge majority **86%** of the time. No engine should be expected to beat that.

Eleven of the 100 stories had three judges picking three different frameworks, so they were set aside. On the remaining 89:

| Predictor | Matches the judges | Agreement beyond chance (κ) |
|---|---:|---:|
| Always guess OpenSpec | 47.2% | — |
| Ask one question (roadmap ≥ 60% → Spec Kit, else OpenSpec) | 53.9% | — |
| First-match engine | 37.1% | 0.03 |
| Weighted engine, first version | 53.9% | 0.37 |
| **Weighted engine, version 0.5.1** | **61.8%** | **0.45** |

**First match lost to a constant guess** by ten points. The judges wanted BMAD for 26 of the 89 teams, and the engine kept saying OpenSpec.

**The first weighted engine tied the one-question shortcut.** Big improvement, still not good enough. Two specific bugs remained. A rule could win on points even when its own eligibility check said it didn't apply, and that decided 31 of the 89 teams (24 of them wrongly). Separately, the judges picked Spec Kitty 14 times, and the engine had no way to recommend it at all.

**Version 0.5.1 fixed exactly those two things** and touched nothing else. Rules that fail their eligibility check are now skipped, and Spec Kitty became a selectable framework. The engine got 9 of the 14 Spec Kitty teams right.

The pre-set pass mark for RQ1 had three parts:

- Agreement beyond chance of at least 0.40: **0.446.** Pass.
- Beat the one-question shortcut: **61.8% vs 53.9%.** Pass.
- Beat always-guess-OpenSpec by at least 15 points: **+14.61.** Fail.

We missed by 0.39 points. We didn't write a fuzzy bar, so it's a fail.

The questionnaire check (RQ2) passed on every count. Answers were stable across the three respondents (82%), enough questions moved the pick, and the "danger zone" was empty. That zone is where we'd flag questions that are both *influential* and *unreliable*, meaning readers of the same story disagree and the disagreement changes the answer.

That empty danger zone turned out to be the clue.

## We were grading the wrong output

The danger zone only counted a question as influential if it moved the *framework*. But the tool has three outputs. Measuring how much the answers move each one, from the same data we already had, gave this:

| Output | How much the answers move it |
|---|---:|
| Framework pick | 54 |
| Practices | 211 |
| Cautions | 152 |

The framework pick, the only output we had graded, carries about a quarter of the behaviour. The judges had never been asked about practices or cautions at all. The single most influential question, how independently the team can release, barely touched the framework (1.25) and heavily drove cautions (41.70).

Re-draw the danger zone using influence on *any* output, and it's no longer empty. Four questions were influential and unreliable the whole time:

| Question | Influence | Respondents agree |
|---|---:|---:|
| Top bottlenecks | 23.4 | 46% |
| Team distribution | 16.6 | 54% |
| CI maturity | 10.2 | 59% |
| Agent runtimes | 8.1 | 37% |

The worst was the bottleneck question: pick your top three out of seven, in order. The rules then acted on rank position. Whether something is your #2 or #3 bottleneck is close to arbitrary for a person, but it was a hard switch for the engine.

The weighted engine's 59% "insufficient signal" rate had a similar root. Each rule's points only meant something relative to that rule's own signals, so totals across rules weren't really comparable. Well-motivated questions such as quality gates and token budget looked useless because the one rule they fed almost never won.

So RQ1 — the criterion that failed at +14.61 — was measuring a design error, not engine quality in either direction. We withdrew it. That is different from passing it. The original criterion stays in the protocol, marked **unstated**, not edited from 15 down to 14.61. Before building anything new, we wrote replacement criteria:

- **Practices** beat a "recommend whatever's usually right" baseline, with the margin clearly outside the noise.
- **Every question** moves *some* output, and the danger zone is empty using influence on all outputs.
- **Cautions** match the risks judges identify.
- **The shortlist** the page shows contains the judges' pick as often as it claims to (80%).
- **Removing a framework** from the catalogue doesn't reshuffle the others.
- **A sanity floor:** the recommended framework lands in the judges' top three at least as often as 0.5.1's runner-up did (75%).

Matching the judges' #1 framework is now reported but not graded. We said up front that it could get worse.

## The rebuild

The new engine rests on one idea: **a framework is just a pre-bundled set of practices plus the cost of adopting it.**

Frameworks and individual practices are scored the same way, by how well they cover 14 needs a team might have: handling legacy code, surviving mid-flight requirement changes, audit trails, CI enforcement, token budget, and so on. Coverage is discounted by how strongly something is actually enforced. A CI check that blocks a merge counts fully, and a line in a prompt that the agent may ignore counts for about a third. The engine searches for the framework plus up to five extra practices that best cover the team's needs at the lowest cost.

That design buys things the old rules couldn't:

- **Adding or removing a framework takes one edit.** There are no new rules, weights, or hand-written warnings to update. A test proves that dropping any framework leaves the ranking of the rest unchanged, and it passes.
- **Cautions come from gaps** such as unmet needs, enforcement that's only advisory, or costs the team can't afford, instead of 16 hand-written triggers.
- **Unrunnable frameworks are removed, not penalized.** If a framework doesn't support your runtime, it's out, and the report says so. It can't be outvoted back in by enough positive signals.
- **The worst questions were rewritten.** Bottlenecks became seven independent severity ratings instead of a forced top three. Team distribution asks for overlapping working hours. CI maturity is a checklist of what actually runs on each pull request.

Two caveats. The scoring weights are still a starting guess, centered on the old hand-tuned numbers. The data needed to fit them properly (judges saying which practices are most and least valuable for each team) hasn't been collected yet. And the respondent answers were *converted* to the new question formats rather than collected fresh, so we can't yet say whether the rewrites made those questions more reliable.

## Grading the rebuild

Same 89 teams, same frozen judges, no new tokens:

| Predictor | Matches the judges' #1 |
|---|---:|
| Always guess OpenSpec | 47.2% |
| Ask one question | 53.9% |
| Weighted engine (0.5.1) | 61.8% |
| **New engine (0.6.0)** | **20.2%** (range 12–28%) |

Agreement beyond chance fell to **0.05**. Even the top of the uncertainty range is well below the constant guess. We said a drop was acceptable, but that doesn't mean we can shrug at this one. Against an 86% ceiling, 20% leaves a lot of signal unused.

Here's how the new criteria came out:

- **Sanity floor: short.** The recommended framework lands in the judges' top three **70.8%** of the time, against a floor of 75.3%. The protocol calls that "diagnose before celebrating."
- **Shortlist: fails.** The page's shortlist contains the judges' pick **59.6%** of the time, not the 80% it's meant to guarantee. It's a heuristic, not yet calibrated.
- **Danger zone: fails, as intended.** Under the new definition it shows five questions (CI maturity, quality gates, runtimes, bottlenecks, distribution) instead of a false all-clear. Every question now moves some output. Quality gates and token budget, previously stranded, now matter. Stability across respondents is 75%, still above the bar.
- **Removing frameworks doesn't reshuffle the rest: passes.**
- **Practices and cautions: can't be graded yet.** The judges were never asked about them. The criterion the whole rebuild was designed around has no data.

On a sample of random teams, the recommendations spread out like this: Spec Kitty 56%, OpenSpec 42%, everything else about 2%. "Insufficient signal" is gone, but so is BMAD, which the judges wanted 26 times. The old engine abstained on 59% of teams. The new one splits nearly everyone between two frameworks. Those are different failures, and neither is a fix.

## What this doesn't tell you

**About the tool.** It matches a self-described team to documented capabilities. It doesn't know which framework ships better code, or which one your team will still be using in six months. It recommends a single base framework even when a team would be better served by two. Its weights are still editorial, and now labeled that way. The catalogue is a dated snapshot of a fast-moving field, and it can't see that a project went quiet last month.

**About the check.** The answer key comes from 100 AI-written stories judged by AI, not surveyed teams, and nobody has checked how realistic the stories are. Numbers from a sample this size are good to roughly ±5–10 points. The writer and respondents share a model family, so self-preference risk is reduced, not eliminated. And the judges never saw the new engine's outputs. That's the point of a frozen answer key, and also its limit.

The honest summary of where the tool stands: it's a defensible first cut that puts its failure modes on the same screen as its recommendation. It is not "the framework you should standardize on." And until the judges are asked about practices, the claim that practices are the real product is a design argument, not a measured result.

## What's reusable here

None of this is specific to a framework picker. Any rules-based recommender built from intuition and research instead of data — which describes a lot of internal tooling — can be checked the same way:

1. **Write the pass marks down before you see results**, so a disappointing number can't quietly move the goalposts.
2. **Analyze the rules on their own first.** It's free, and it finds real bugs, like a config field that deletes an entire outcome.
3. **If there's no ground truth, build one deliberately**, with independent writers, respondents, and blind judges, and measure their agreement instead of assuming it.
4. **When you change the engine, re-grade against the same frozen answer key.** The change in score is the finding.
5. **If the metric and the product disagree about what matters, the metric is the bug.** Withdraw it in writing instead of tuning it into a pass. Write its replacement before collecting new data, and publish the number that got worse alongside the one you hope gets better.

Our result, in four parts. First-match wasn't earning its keep. Weighted scoring got within 0.39 points of a bar we refused to lower. That bar was grading a quarter of the tool. And the rebuilt tool, graded on the only answer key we have, agrees with the judges a fifth of the time and can't yet be graded on the part it exists for.

Finding that out before trusting it is the whole point of checking.
