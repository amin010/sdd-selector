/**
 * Part B1 — vignette generation (tools/qc/personas.mjs).
 *
 * Generates a stratified batch of ~100 prose finance-tech team vignettes,
 * one per (targetOutcome, index) pair, and writes tools/qc/data/vignettes.json
 * per the fixed contract in docs/QC-EXPERIMENT.md §9.
 *
 * `targetOutcome` is a *generation-time stratification label*, not a
 * guarantee — see QC-EXPERIMENT.md §9's note that a large mismatch rate
 * between targetOutcome and what the engine actually resolves is itself
 * reportable, not a bug in this script.
 *
 * Usage:
 *   node tools/qc/personas.mjs
 *
 * Provider auto-detects via createClient()/detectProvider() (llm.mjs): with
 * no ANTHROPIC_API_KEY/OPENAI_API_KEY exported (the case in this sandbox,
 * QC-EXPERIMENT.md §11), every call goes to the deterministic mock provider.
 * The mock provider cannot read semantics, so mock-generated `prose` will
 * NOT actually describe a team that plausibly leads to `targetOutcome` — it
 * is lorem-ish filler shaped only to satisfy `mockSchema`. This is expected
 * and is why docs/qc-report.md must caveat Part B/C/D as pipeline-validation
 * only. The moment a real key is exported, re-running this script (with a
 * fresh cache or `noCache`) produces real, semantically-targeted vignettes
 * with no code changes required.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "./llm.mjs";
import { REACHABLE_OUTCOMES } from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const OUT_PATH = path.join(DATA_DIR, "vignettes.json");

/**
 * Stratification plan (documented judgment call — QC-EXPERIMENT.md §5 B1
 * asks for ~100 vignettes, roughly proportional to real-world frequency
 * (Part A's A1 outcome distribution: openspec ~48%, fallback_openspec
 * ~43%, no_runtime_match ~7%, bmad ~0.9%, speckit ~0.5%, gsd ~0.3%,
 * superpowers ~0.06%) but with every one of the 7 labels represented by at
 * least 8-10 vignettes so the judge panel actually gets to see and rank
 * teams shaped like each reachable base, not just the two dominant outcomes.
 * This gives the two dominant outcomes a larger (but not fully
 * proportional) share and a flat floor of 12 to every rare outcome.
 */
const STRATA = {
  openspec: 22,
  fallback_openspec: 18,
  no_runtime_match: 12,
  speckit: 12,
  bmad: 12,
  superpowers: 12,
  gsd: 12,
};

const TOTAL = Object.values(STRATA).reduce((a, b) => a + b, 0);

// Sanity: STRATA must cover exactly the 7 canonical outcome labels, in the
// same set as lib.mjs's REACHABLE_OUTCOMES (order doesn't matter here).
for (const label of REACHABLE_OUTCOMES) {
  if (!(label in STRATA)) throw new Error(`STRATA missing canonical outcome "${label}"`);
}
for (const label of Object.keys(STRATA)) {
  if (!REACHABLE_OUTCOMES.includes(label)) throw new Error(`STRATA has unknown outcome "${label}"`);
}

// Diversity axes cycled across a stratum's vignettes so prompts vary
// domain/size/architecture/compliance/cadence even though the mock provider
// cannot honor them semantically (a real model reads them as suggestions,
// not constraints — it is still free to write whatever is most plausible
// for the target outcome).
const DOMAINS = ["ledger", "reporting_compliance", "treasury", "data_pipeline", "internal_platform"];
const SIZES = ["tiny (2-3 FTE)", "small (4-8 FTE)", "mid (9-20 FTE)", "large (20+ FTE)"];
const ARCHITECTURES = ["microservices", "monolith", "hybrid legacy+cloud", "batch data pipeline", "event-driven streaming"];
const COMPLIANCE_TIERS = ["SOX Tier 1 critical", "internal governance / high risk", "standard enterprise", "low / non-financial"];
const CADENCES = ["continuous / on-demand", "sprint (1-2 weeks)", "monthly", "quarterly or longer"];

function pickCycled(arr, i) {
  return arr[i % arr.length];
}

/**
 * Progress reporter for the ~100 sequential LLM calls in main()'s loop —
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

/** Strip common LLM wrapping (markdown code fences) before JSON.parse. */
function parseJsonResponse(text) {
  let cleaned = String(text || "").trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) cleaned = fenced[1].trim();
  return JSON.parse(cleaned);
}

function outcomeHint(targetOutcome) {
  switch (targetOutcome) {
    case "openspec":
      return "a team doing mostly brownfield/legacy work (heavy non-roadmap load: ops, bugs, regulatory, or tech debt), or working against a monolith/hybrid/batch architecture";
    case "speckit":
      return "a team building a structured, low-volatility, roadmap-heavy greenfield microservices subsystem with well-defined stories and acceptance criteria";
    case "bmad":
      return "a team with real dedicated role separation (a product owner, a scrum master, and QA/SDET) facing high-level or vague inbound requirements needing discovery";
    case "superpowers":
      return "a small (under 5 people), fully autonomous team shipping continuously or every sprint, with light/manual quality gates and an unmetered or generous token budget";
    case "gsd":
      return "a small (under 5 people), fully autonomous team shipping continuously or every sprint, but under a metered or strict token budget";
    case "fallback_openspec":
      return "a team whose profile is genuinely ambiguous or middling on every axis — no strong brownfield signal, no strong structured-greenfield signal, no dedicated roles, not a small autonomous shop — such that no single strong recommendation stands out";
    case "no_runtime_match":
      return "a team whose AI coding agent runtime is an obscure or in-house tool not on the common list (Claude Code, Cursor, Codex, Copilot, Gemini CLI, Windsurf, OpenCode) — mention explicitly that they use some other, unusual runtime";
    default:
      return "a plausible finance-tech team";
  }
}

async function generateVignette(client, { id, targetOutcome, index, countInStratum, onCallComplete }) {
  const domain = pickCycled(DOMAINS, index);
  const size = pickCycled(SIZES, index + 1);
  const architecture = pickCycled(ARCHITECTURES, index + 2);
  const compliance = pickCycled(COMPLIANCE_TIERS, index + 3);
  const cadence = pickCycled(CADENCES, index + 4);

  const system =
    "You are generating a realistic prose vignette describing a finance-tech " +
    "engineering team, for use as a test case in an independent evaluation. " +
    "Write ONLY the team's operational reality (domain, size, architecture, " +
    "compliance posture, requirements clarity, deploy cadence, tooling). Do " +
    "NOT mention any spec-driven-development framework, tool name, or " +
    "recommendation system by name, and do not mention this instrument.";

  const user =
    `Write a 2-4 paragraph vignette (roughly 400-1200 characters) for vignette ` +
    `${id} (${index + 1} of ${countInStratum} in this batch). The team's profile ` +
    `should plausibly lead an independent evaluator to conclude they need: ` +
    `${outcomeHint(targetOutcome)}.\n\n` +
    `Vary these axes naturally in your narrative rather than stating them as a ` +
    `checklist: functional domain (suggestion: ${domain}), team size (suggestion: ` +
    `${size}), system architecture (suggestion: ${architecture}), regulatory/` +
    `compliance tier (suggestion: ${compliance}), and deploy cadence (suggestion: ` +
    `${cadence}). Make this vignette distinct from a generic/central example of ` +
    `this profile.\n\n` +
    `Respond with strict JSON only, matching this shape: ` +
    `{"prose": "<2-4 paragraph narrative>", "tags": {"domain": "<short label>", ` +
    `"size": "<short label>", "architecture": "<short label>", "compliance": ` +
    `"<short label>", "cadence": "<short label>"}}. No commentary outside the JSON.`;

  const mockSchema = {
    type: "object",
    properties: {
      prose: { type: "string", minLength: 400, maxLength: 1200 },
      tags: {
        type: "object",
        properties: {
          domain: { type: "string", enum: DOMAINS },
          size: { type: "string", enum: SIZES },
          architecture: { type: "string", enum: ARCHITECTURES },
          compliance: { type: "string", enum: COMPLIANCE_TIERS },
          cadence: { type: "string", enum: CADENCES },
        },
      },
    },
  };

  const response = await client.complete({
    system,
    messages: [{ role: "user", content: user }],
    temperature: 0.9,
    maxTokens: 700,
    mockSchema,
  });
  if (onCallComplete) onCallComplete(response);

  let parsed;
  try {
    parsed = parseJsonResponse(response.text);
  } catch (err) {
    // One retry, bypassing cache, before falling back to a deterministic stub.
    const retry = await client.complete({
      system,
      messages: [{ role: "user", content: user }],
      temperature: 0.9,
      maxTokens: 700,
      mockSchema,
      noCache: true,
    });
    try {
      parsed = parseJsonResponse(retry.text);
    } catch (err2) {
      console.error(`personas: failed to parse response for ${id}, using fallback prose (${err2.message})`);
      parsed = {
        prose: `Fallback vignette for ${id} (${targetOutcome}): parsing failed twice; ` +
          `see tools/qc/cache/ for the raw model responses.`,
        tags: { domain, size, architecture, compliance, cadence },
      };
    }
  }

  return {
    id,
    targetOutcome,
    prose: typeof parsed.prose === "string" ? parsed.prose : String(parsed.prose || ""),
    tags: parsed.tags && typeof parsed.tags === "object" ? parsed.tags : { domain, size, architecture, compliance, cadence },
    generatorModel: response.model,
  };
}

async function main() {
  const client = createClient({ role: "persona" });
  console.log(`tools/qc/personas.mjs — provider=${client.provider} model=${client.model}`);
  console.log(`generating ${TOTAL} vignettes across ${Object.keys(STRATA).length} strata:`);
  for (const [label, count] of Object.entries(STRATA)) console.log(`  ${label.padEnd(18)} ${count}`);

  const vignettes = [];
  let seq = 0;
  for (const [targetOutcome, count] of Object.entries(STRATA)) {
    for (let i = 0; i < count; i++) {
      seq++;
      const id = `v${String(seq).padStart(3, "0")}`;
      const vignette = await generateVignette(client, {
        id,
        targetOutcome,
        index: i,
        countInStratum: count,
        onCallComplete: (response) => reportProgress("generating vignettes", seq, TOTAL, client.provider, response.cached),
      });
      vignettes.push(vignette);
    }
  }
  if (process.stdout.isTTY) process.stdout.write("\n");

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "vignettes.json.tmp"), JSON.stringify(vignettes, null, 2));
  fs.renameSync(path.join(DATA_DIR, "vignettes.json.tmp"), OUT_PATH);

  console.log(`wrote ${vignettes.length} vignettes to ${path.relative(process.cwd(), OUT_PATH)}`);
  const byOutcome = {};
  for (const v of vignettes) byOutcome[v.targetOutcome] = (byOutcome[v.targetOutcome] || 0) + 1;
  console.log("counts by targetOutcome:", JSON.stringify(byOutcome));
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("tools/qc/personas.mjs FAILED");
      console.error(err && err.stack ? err.stack : err);
      process.exit(1);
    });
}

export { STRATA, TOTAL };
