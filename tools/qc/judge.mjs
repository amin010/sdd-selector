/**
 * Part B3 — blind judge panel (tools/qc/judge.mjs).
 *
 * Reads tools/qc/data/vignettes.json. For each vignette, runs 3 independent
 * judge calls asking a model to rank its top-3 framework picks (plus
 * reasoning) from ONLY the vignette prose and the framework best-fit/
 * poor-fit profiles below — never the BASE_RULES predicates, the numeric
 * thresholds, or the 21-question instrument. This is a hard requirement for
 * validity (QC-EXPERIMENT.md §5 B3, §10): judges must reflect an independent
 * read of team-to-framework fit, not a re-derivation of the engine's own
 * logic. Framework order is shuffled independently per (vignette, judgeIndex)
 * to kill position bias. Writes tools/qc/data/labels.json per the fixed
 * contract in docs/QC-EXPERIMENT.md §9.
 *
 * FRAMEWORK_PROFILES below is manually extracted/summarized from
 * docs/DESIGN.md §8 (capability summary + verbatim "Best fit."/"Poor fit."
 * sentences per framework) — it intentionally does NOT reproduce §8's field
 * report citations, cautions text, or anything that leaks the engine's own
 * BASE_RULES/thresholds/instrument. `tessl` and `speckitty` are included on
 * purpose (per §5 B3): the engine can never recommend either, so a judge
 * choosing one anyway is itself informative, not noise to filter out.
 *
 * Usage:
 *   node tools/qc/judge.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, hashObject } from "./llm.mjs";
import { mulberry32 } from "../corpus.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const VIGNETTES_PATH = path.join(DATA_DIR, "vignettes.json");
const OUT_PATH = path.join(DATA_DIR, "labels.json");

const JUDGES_PER_VIGNETTE = 3;

/**
 * Manually extracted from docs/DESIGN.md §8.2-§8.8 (capability summary +
 * verbatim "Best fit."/"Poor fit." sentences only). Order here is the
 * catalog order; presentation order to each judge is shuffled per call
 * (see shuffledFrameworkOrder below) — this array is never shown to a judge
 * in this order directly.
 */
const FRAMEWORK_PROFILES = [
  {
    id: "openspec",
    name: "OpenSpec",
    status: "recommended",
    summary:
      "Delta-spec workflow: write specs only for the change at hand, accumulating " +
      "openspec/specs/ one change at a time rather than documenting a whole codebase " +
      "up front. Supports revising a change's plan mid-flight. Verification exists but " +
      "is advisory and does not block archiving.",
    bestFit: "Brownfield, high-churn, volatile requirements, low ceremony tolerance.",
    poorFit: "Teams that need mechanically enforced gates without adding their own CI.",
  },
  {
    id: "speckit",
    name: "GitHub Spec Kit",
    status: "recommended",
    summary:
      "Seven-phase pipeline (constitution -> specify -> clarify -> plan -> analyze -> " +
      "tasks -> implement) for structured, story-driven greenfield work. The " +
      "constitution is prompt context an agent is instructed to follow, not an " +
      "independently enforced gate. Weak at revising specs once plan/tasks exist.",
    bestFit: "Greenfield 0-to-1, architecturally novel subsystems, teams wanting strict human review gates.",
    poorFit: "Legacy migration at volume, high requirement volatility, small changes.",
  },
  {
    id: "bmad",
    name: "BMAD Method",
    status: "recommended",
    summary:
      "Four-phase method (Analysis, Planning, Solutioning, Implementation) built " +
      "around real role separation (product owner, scrum master, QA personas), plus " +
      "a lightweight Quick Flow track for bug fixes and small changes so ceremony is " +
      "tunable rather than fixed. Sprint-status merges are deterministically protected " +
      "against regression.",
    bestFit: "Teams with real role separation; vague inbound requirements needing discovery; enterprises wanting PRDs and ADRs.",
    poorFit: "Teams that will not use the personas — the structure's value is the separation of concerns, and skipping it leaves overhead without benefit.",
  },
  {
    id: "gsd",
    name: "GSD Core",
    status: "viable",
    summary:
      "Five-step loop per phase (Discuss -> Plan -> Execute -> Verify -> Ship) using " +
      "fresh-context subagents per phase and per execution wave, with requirement IDs " +
      "traced through to shipped code. A plan-checker and verifier give agent-executed " +
      "checks on output, stronger than pure prompt context but weaker than CI. Young " +
      "project (about four months old at last evidence check).",
    bestFit: "Long sessions where context degradation is the binding constraint; monoliths with broad file spans; teams wanting requirement traceability without BMAD's role overhead.",
    poorFit: "Teams needing a long maintenance track record, or unwilling to adopt a four-month-old dependency.",
  },
  {
    id: "superpowers",
    name: "Superpowers",
    status: "viable",
    summary:
      "Mandatory progression (brainstorming -> writing-plans -> subagent-driven " +
      "development -> TDD -> code review) with the strongest hard gate of the group: " +
      "an 'iron law' that production code written before a failing test must be " +
      "deleted and rewritten. Token-intensive by design; no commits on main in the " +
      "most recent 30-day window at last evidence check despite a large install base.",
    bestFit: "Ambiguous multi-file production work where correctness dominates cost; teams with low test coverage needing enforced TDD.",
    poorFit: "Metered token budgets; high volumes of small changes.",
  },
  {
    id: "speckitty",
    name: "Spec Kitty",
    status: "viable",
    summary:
      "Work packages move through a nine-lane state machine with exactly 27 legal " +
      "transitions; overriding a blocked transition requires actor + reason, giving a " +
      "real audit trail. Isolation between concurrent workers is partial (full " +
      "checkouts with ownership metadata, not hidden files). High open-issue count " +
      "relative to project size.",
    bestFit: "Multiple agents or engineers working concurrently; teams needing visible progress and auditable review gates; coupled releases.",
    poorFit: "Solo developers (worktree overhead without concurrency benefit); teams unwilling to manage rebase friction between dependent work packages.",
  },
  {
    id: "tessl",
    name: "Tessl SDD Tile",
    status: "watch",
    summary:
      "Provides spec-writing and requirement-gathering skills plus link-checking " +
      "validation scripts over .spec.md files with inline [@test] anchors. The " +
      "[@test] anchors are reference links, not executable assertions — the tooling " +
      "verifies that links point to existing files, not that linked tests pass. Small " +
      "project, no pushes in roughly five and a half months at last evidence check.",
    bestFit: "Teams that want a lightweight one-question-at-a-time spec interview technique, independent of adopting the tile itself.",
    poorFit: "Any team relying on [@test] anchors as a fail-closed verification gate — they are not one.",
  },
];

const ALL_FRAMEWORK_IDS = FRAMEWORK_PROFILES.map((f) => f.id);

/** Deterministic per-(vignette, judgeIndex) shuffle of framework presentation order. */
function shuffledFrameworkOrder(vignetteId, judgeIndex) {
  const seedHex = hashObject({ vignetteId, judgeIndex, salt: "qc-judge-shuffle" });
  const rng = mulberry32(parseInt(seedHex.slice(0, 8), 16));
  const arr = [...FRAMEWORK_PROFILES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderProfile(fw, i) {
  return (
    `${i + 1}. ${fw.name} (id: "${fw.id}", status: ${fw.status})\n` +
    `   ${fw.summary}\n` +
    `   Best fit: ${fw.bestFit}\n` +
    `   Poor fit: ${fw.poorFit}`
  );
}

/** Strip common LLM wrapping (markdown code fences) before JSON.parse. */
function parseJsonResponse(text) {
  let cleaned = String(text || "").trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) cleaned = fenced[1].trim();
  return JSON.parse(cleaned);
}

/**
 * Progress reporter for the ~300 sequential LLM calls in main()'s loop —
 * this script has no per-call logging otherwise, which can look "stuck"
 * for the minutes it takes to run against a real provider. On a TTY,
 * prints a single self-overwriting line (\r, no trailing newline). When
 * stdout is not a TTY (piped to a file/CI log), falls back to a plain
 * console.log line every 10 items (or every item when total <= 30) so
 * redirected output stays readable.
 */
function reportProgress(label, done, total, provider, cached) {
  const line = `${label}: ${String(done).padStart(String(total).length, " ")}/${total} (${provider}, cached=${cached})`;
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
  } else if (total <= 30 || done % 10 === 0 || done === total) {
    console.log(line);
  }
}

/**
 * Deduplicate a rankedTop3 response and backfill to exactly 3 distinct ids
 * if the model (mock or real) returned fewer than 3 distinct entries. The
 * mock provider in particular fabricates each array slot independently, so
 * duplicates are expected there; backfill is deterministic, walking the
 * per-call shuffled presentation order (not the raw catalog order) so the
 * fallback picks are still "the next thing this judge was shown" rather
 * than an arbitrary global default.
 */
function repairRankedTop3(raw, presentationOrderIds) {
  const seen = new Set();
  const cleaned = (Array.isArray(raw) ? raw : []).filter(
    (id) => ALL_FRAMEWORK_IDS.includes(id) && !seen.has(id) && seen.add(id),
  );
  for (const id of presentationOrderIds) {
    if (cleaned.length >= 3) break;
    if (!cleaned.includes(id)) cleaned.push(id);
  }
  return cleaned.slice(0, 3);
}

async function judgeOnce(client, { vignette, judgeIndex, onCallComplete }) {
  const order = shuffledFrameworkOrder(vignette.id, judgeIndex);
  const profilesText = order.map(renderProfile).join("\n\n");

  const system =
    "You are one of three independent, blind judges evaluating which " +
    "spec-driven-development framework best fits a described engineering " +
    "team. You are shown ONLY the team's story and a set of framework " +
    "profiles below — you have no visibility into any recommendation " +
    "engine, its rules, or the other two judges' answers. Judge purely on " +
    "your own read of the fit between the team's story and each framework's " +
    "best-fit / poor-fit description.";

  const user =
    `You are judge ${judgeIndex} of ${JUDGES_PER_VIGNETTE}.\n\n` +
    `--- TEAM STORY (${vignette.id}) ---\n${vignette.prose}\n\n` +
    `--- FRAMEWORK PROFILES (presented in randomized order this call) ---\n${profilesText}\n\n` +
    `Return your ranked top-3 framework picks (by id) for this team, best fit ` +
    `first, plus 1-3 sentences of reasoning. Respond with strict JSON: ` +
    `{"rankedTop3": ["<id>", "<id>", "<id>"], "reasoning": "<text>"}. No ` +
    `commentary outside the JSON.`;

  const mockSchema = {
    type: "object",
    properties: {
      rankedTop3: { type: "array", items: { type: "string", enum: ALL_FRAMEWORK_IDS }, minItems: 3, maxItems: 3 },
      reasoning: { type: "string", minLength: 60, maxLength: 400 },
    },
  };

  const response = await client.complete({
    system,
    messages: [{ role: "user", content: user }],
    temperature: 0.5,
    maxTokens: 400,
    mockSchema,
  });
  if (onCallComplete) onCallComplete(response);

  let rankedTop3;
  let reasoning;
  try {
    const parsed = parseJsonResponse(response.text);
    rankedTop3 = repairRankedTop3(parsed.rankedTop3, order.map((f) => f.id));
    reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
  } catch (err) {
    console.warn(`judge: ${vignette.id} judge ${judgeIndex} failed to parse response (${err.message}); using presentation-order fallback`);
    rankedTop3 = order.slice(0, 3).map((f) => f.id);
    reasoning = "";
  }

  return { vignetteId: vignette.id, judgeIndex, model: response.model, rankedTop3, reasoning };
}

async function main() {
  if (!fs.existsSync(VIGNETTES_PATH)) {
    throw new Error(`tools/qc/judge.mjs: ${VIGNETTES_PATH} does not exist — run \`node tools/qc/personas.mjs\` first.`);
  }
  const vignettes = JSON.parse(fs.readFileSync(VIGNETTES_PATH, "utf8"));
  const client = createClient({ role: "judge" });

  const totalCalls = vignettes.length * JUDGES_PER_VIGNETTE;
  console.log(`tools/qc/judge.mjs — provider=${client.provider} model=${client.model}`);
  console.log(`${vignettes.length} vignettes x ${JUDGES_PER_VIGNETTE} judges = ${totalCalls} calls`);
  console.log(`framework menu (${ALL_FRAMEWORK_IDS.length}): ${ALL_FRAMEWORK_IDS.join(", ")}`);

  const out = [];
  let done = 0;
  for (const vignette of vignettes) {
    for (let judgeIndex = 0; judgeIndex < JUDGES_PER_VIGNETTE; judgeIndex++) {
      out.push(
        await judgeOnce(client, {
          vignette,
          judgeIndex,
          onCallComplete: (response) => {
            done++;
            reportProgress("judging", done, totalCalls, client.provider, response.cached);
          },
        }),
      );
    }
  }
  if (process.stdout.isTTY) process.stdout.write("\n");

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "labels.json.tmp"), JSON.stringify(out, null, 2));
  fs.renameSync(path.join(DATA_DIR, "labels.json.tmp"), OUT_PATH);

  console.log(`wrote ${out.length} judge label records to ${path.relative(process.cwd(), OUT_PATH)}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("tools/qc/judge.mjs FAILED");
      console.error(err && err.stack ? err.stack : err);
      process.exit(1);
    });
}

export { FRAMEWORK_PROFILES, ALL_FRAMEWORK_IDS, shuffledFrameworkOrder, repairRankedTop3 };
