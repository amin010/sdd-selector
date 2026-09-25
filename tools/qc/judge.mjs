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

/**
 * Fixed risk taxonomy judges must tag. Ids match engine caution ids so
 * B4.4 can score structured tags instead of keyword-matching free text.
 */
const RISK_TAXONOMY = [
  { id: "C1", label: "Spec Kit fabricating or hallucinating on brownfield / legacy work" },
  { id: "C2", label: "constitution.md / prompt context treated as an audit control" },
  { id: "C3", label: "Token-intensive stack on a metered or rationed budget" },
  { id: "C4", label: "Tessl [@test] anchors mistaken for fail-closed verification" },
  { id: "C5", label: "Verify/archive is advisory and does not block shipping" },
  { id: "C6", label: "Spec Kitty lane / audit-trail overhead" },
  { id: "C7", label: "Ceremony too heavy for high change volume / small changes" },
  { id: "C8", label: "Worktree / concurrency overhead for a solo or tiny team" },
  { id: "C9", label: "Immature or young project / short track record" },
  { id: "C10", label: "Maintenance risk: stale, inactive, or abandoned tooling" },
  { id: "C11", label: "License / legal-review risk" },
  { id: "C12", label: "Interrupt-driven / real-time work vs a planned pipeline" },
  { id: "C13", label: "Delivery blocked on an external vendor release train" },
];
const RISK_TAG_IDS = RISK_TAXONOMY.map((r) => r.id);

/**
 * Practice catalogue shown to judges for best-worst sets (EXT-SELECT T13).
 * Summaries are capability-facing, not engine-facing — no axis weights.
 */
const PRACTICE_CATALOG = [
  { id: "delta-only-specs", label: "Delta-only specs", summary: "Write specs only for the change at hand." },
  { id: "openspec-change-archive", label: "Change archive", summary: "Keep an archived folder per change as an audit artifact." },
  { id: "regulatory-constitution", label: "Regulatory constitution", summary: "Written invariants in the agent session. Advisory, not a gate." },
  { id: "speckit-phase-pipeline", label: "Spec Kit phase pipeline", summary: "Seven-phase specify/plan/tasks pipeline for greenfield work." },
  { id: "tdd-iron-law", label: "TDD iron law", summary: "Failing tests before production code; rewrite if the order is inverted." },
  { id: "two-stage-review", label: "Two-stage review", summary: "Adversarial or two-stage human review of the change." },
  { id: "lane-worktrees", label: "Lane state machine and worktrees", summary: "Auditable work-package lanes with isolated worktrees." },
  { id: "domain-recon", label: "Domain reconnaissance", summary: "Structured discovery before committing a spec." },
  { id: "role-personas", label: "Role personas", summary: "Separate product, delivery, and QA voices in the workflow." },
  { id: "ephemeral-subagent-waves", label: "Ephemeral subagent waves", summary: "Fresh-context agents per phase to fight context degradation." },
  { id: "gsd-req-ids", label: "Requirement IDs", summary: "Trace requirement identifiers from spec through shipped code." },
  { id: "deterministic-ci", label: "Deterministic CI enforcement", summary: "Required status checks and spec-to-test traceability in CI." },
  { id: "low-ceremony-fast-path", label: "Low-ceremony fast path", summary: "A documented two-track policy beside any heavyweight pipeline." },
  { id: "one-question-at-a-time", label: "One question at a time", summary: "Interview discipline: one clarifying question before the next." },
];
const PRACTICE_IDS = PRACTICE_CATALOG.map((p) => p.id);
const BEST_WORST_SETS = 3;

/** Deterministic four-practice set, shuffled per (vignette, judgeIndex, setIndex). */
function shuffledPracticeSet(vignetteId, judgeIndex, setIndex) {
  const seedHex = hashObject({ vignetteId, judgeIndex, setIndex, salt: "qc-practice-bw" });
  const rng = mulberry32(parseInt(seedHex.slice(0, 8), 16));
  const arr = [...PRACTICE_CATALOG];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const offset = (setIndex * 4) % Math.max(1, arr.length - 3);
  return arr.slice(offset, offset + 4);
}

function repairBestWorst(raw, presentedIds) {
  if (!raw || typeof raw !== "object") return { ok: false };
  const most = raw.most;
  const least = raw.least;
  if (!presentedIds.includes(most) || !presentedIds.includes(least) || most === least) {
    return { ok: false };
  }
  return { ok: true, most, least, presented: presentedIds };
}

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
 * Deduplicate a rankedTop3 response. Does NOT backfill missing or invalid
 * ids from presentation order — a short or polluted ranking is a parse
 * failure, not a fabricated label. Returns { rankedTop3, parseFailure }.
 */
function repairRankedTop3(raw) {
  const seen = new Set();
  const cleaned = (Array.isArray(raw) ? raw : []).filter(
    (id) => ALL_FRAMEWORK_IDS.includes(id) && !seen.has(id) && seen.add(id),
  );
  if (cleaned.length < 3) {
    return { rankedTop3: null, parseFailure: true };
  }
  return { rankedTop3: cleaned.slice(0, 3), parseFailure: false };
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
    `first, plus 1-3 sentences of reasoning, plus zero or more risk tags from ` +
    `this fixed taxonomy (use the ids only): ${RISK_TAXONOMY.map((r) => `${r.id}=${r.label}`).join("; ")}. ` +
    `Also complete ${BEST_WORST_SETS} best-worst practice questions. For each set, ` +
    `name the most and least valuable practice for this team (ids only). ` +
    `Respond with strict JSON: ` +
    `{"rankedTop3": ["<id>", "<id>", "<id>"], "reasoning": "<text>", "riskTags": ["<C-id>", ...], ` +
    `"bestWorst": [{"setIndex": 0, "most": "<id>", "least": "<id>"}, ...]}. No ` +
    `commentary outside the JSON.`;

  const practiceSets = [];
  for (let setIndex = 0; setIndex < BEST_WORST_SETS; setIndex++) {
    practiceSets.push(shuffledPracticeSet(vignette.id, judgeIndex, setIndex));
  }
  const practiceText = practiceSets.map((set, i) => (
    `Set ${i} (pick most and least valuable):\n` +
    set.map((p, j) => `  ${j + 1}. ${p.label} (id: "${p.id}") — ${p.summary}`).join("\n")
  )).join("\n\n");

  const userWithPractices = `${user}\n\n--- PRACTICE SETS ---\n${practiceText}\n`;

  const mockSchema = {
    type: "object",
    properties: {
      rankedTop3: { type: "array", items: { type: "string", enum: ALL_FRAMEWORK_IDS }, minItems: 3, maxItems: 3 },
      reasoning: { type: "string", minLength: 60, maxLength: 400 },
      riskTags: { type: "array", items: { type: "string", enum: RISK_TAG_IDS }, minItems: 0, maxItems: RISK_TAG_IDS.length },
      bestWorst: {
        type: "array",
        minItems: BEST_WORST_SETS,
        maxItems: BEST_WORST_SETS,
        items: {
          type: "object",
          properties: {
            setIndex: { type: "number", min: 0, max: BEST_WORST_SETS - 1, integer: true },
            most: { type: "string", enum: PRACTICE_IDS },
            least: { type: "string", enum: PRACTICE_IDS },
          },
        },
      },
    },
  };

  const response = await client.complete({
    system,
    messages: [{ role: "user", content: userWithPractices }],
    temperature: 0.5,
    maxTokens: 4096,
    mockSchema,
  });
  if (onCallComplete) onCallComplete(response);

  let rankedTop3 = null;
  let reasoning = "";
  let riskTags = [];
  let bestWorst = [];
  let parseFailure = false;
  let bestWorstParseFailure = false;
  try {
    const parsed = parseJsonResponse(response.text);
    const repaired = repairRankedTop3(parsed.rankedTop3);
    rankedTop3 = repaired.rankedTop3;
    parseFailure = repaired.parseFailure;
    reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
    riskTags = [...new Set((Array.isArray(parsed.riskTags) ? parsed.riskTags : []).filter((id) => RISK_TAG_IDS.includes(id)))];
    const rawBW = Array.isArray(parsed.bestWorst) ? parsed.bestWorst : [];
    for (let setIndex = 0; setIndex < practiceSets.length; setIndex++) {
      const presented = practiceSets[setIndex].map((p) => p.id);
      const row = rawBW.find((item) => item && item.setIndex === setIndex) || rawBW[setIndex];
      const fixed = repairBestWorst(row, presented);
      if (!fixed.ok) {
        bestWorstParseFailure = true;
        continue;
      }
      bestWorst.push({ setIndex, presented, most: fixed.most, least: fixed.least });
    }
    if (parseFailure) {
      console.warn(`judge: ${vignette.id} judge ${judgeIndex} returned an incomplete ranking; recording parseFailure`);
    }
  } catch (err) {
    console.warn(`judge: ${vignette.id} judge ${judgeIndex} failed to parse response (${err.message}); recording parseFailure`);
    parseFailure = true;
    rankedTop3 = null;
    reasoning = "";
    riskTags = [];
    bestWorst = [];
    bestWorstParseFailure = true;
  }

  return {
    vignetteId: vignette.id,
    judgeIndex,
    model: response.model,
    rankedTop3,
    reasoning,
    riskTags,
    bestWorst,
    parseFailure,
    bestWorstParseFailure,
  };
}

async function main() {
  if (!fs.existsSync(VIGNETTES_PATH)) {
    throw new Error(`tools/qc/judge.mjs: ${VIGNETTES_PATH} does not exist — run \`node tools/qc/personas.mjs\` first.`);
  }
  const vignettes = JSON.parse(fs.readFileSync(VIGNETTES_PATH, "utf8"));
  const clients = Array.from({ length: JUDGES_PER_VIGNETTE }, (_, judgeIndex) =>
    createClient({ role: "judge", judgeIndex }),
  );

  const totalCalls = vignettes.length * JUDGES_PER_VIGNETTE;
  console.log(`tools/qc/judge.mjs — ${clients.map((c, i) => `judge${i}=${c.provider}/${c.model}`).join(" ")}`);
  console.log(`${vignettes.length} vignettes x ${JUDGES_PER_VIGNETTE} judges = ${totalCalls} calls`);
  console.log(`framework menu (${ALL_FRAMEWORK_IDS.length}): ${ALL_FRAMEWORK_IDS.join(", ")}`);

  const out = [];
  let done = 0;
  let parseFailures = 0;
  for (const vignette of vignettes) {
    for (let judgeIndex = 0; judgeIndex < JUDGES_PER_VIGNETTE; judgeIndex++) {
      const client = clients[judgeIndex];
      const rec = await judgeOnce(client, {
        vignette,
        judgeIndex,
        onCallComplete: (response) => {
          done++;
          reportProgress("judging", done, totalCalls, client.provider, response.cached);
        },
      });
      if (rec.parseFailure) parseFailures++;
      out.push(rec);
    }
  }
  if (process.stdout.isTTY) process.stdout.write("\n");

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "labels.json.tmp"), JSON.stringify(out, null, 2));
  fs.renameSync(path.join(DATA_DIR, "labels.json.tmp"), OUT_PATH);

  console.log(`wrote ${out.length} judge label records (${parseFailures} parse failures) to ${path.relative(process.cwd(), OUT_PATH)}`);
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

export { FRAMEWORK_PROFILES, ALL_FRAMEWORK_IDS, RISK_TAXONOMY, RISK_TAG_IDS, PRACTICE_CATALOG, PRACTICE_IDS, shuffledFrameworkOrder, shuffledPracticeSet, repairRankedTop3, repairBestWorst };
