/**
 * Part B2/C1 — respondents (tools/qc/respond.mjs).
 *
 * Reads tools/qc/data/vignettes.json. For each vignette, runs 3 independent
 * respondent calls asking a (possibly different) model to read the vignette
 * prose and answer the full 21-question instrument as that team would,
 * from the narrative alone. Writes tools/qc/data/answers.json per the fixed
 * contract in docs/QC-EXPERIMENT.md §9 — `answers` is passed to
 * evaluateAnswers()/api.evaluate() with no adapter layer.
 *
 * Independence across respondentIndex: each of the 3 calls per vignette
 * includes its index in the prompt text ("respondent N of 3, reading
 * independently") so the three prompts hash differently and are cached as
 * three distinct entries (see llm.mjs's content-addressed cache) rather
 * than the same response served three times.
 *
 * Answer repair strategy (documented here since the task calls for it to be
 * auditable): the mock provider (and, in principle, a real model that
 * ignores instructions) can return structurally invalid values for
 * constrained fields — e.g. q5_work_breakdown's five percentages not
 * summing to 100, or an enum value outside the field's option list. Rather
 * than let one bad field silently zero out a whole rule (the engine's own
 * fieldPresent()/recordValid() would just drop the field, which is "safe"
 * but throws away signal we asked for), repairAnswers() below deterministically
 * repairs every field to something structurally valid:
 *   - single:  snap to the first valid option if the value isn't one.
 *   - multi:   drop invalid values, de-duplicate.
 *   - ranked:  drop invalid values, de-duplicate, then deterministically
 *              backfill from the unused options (in catalog order) until the
 *              field has exactly `ranks` entries.
 *   - number:  clamp to [min, max] (falls back to `min` if non-numeric).
 *   - text:    coerce to a string, truncate to maxLength.
 *   - record:  repair every sub-field per the above, then (for records with a
 *              `sumTo` constraint, i.e. q5_work_breakdown) rescale to sum
 *              exactly to the target using largest-remainder rounding, and
 *              (for records with `minimums`, i.e. q2_team) clamp sub-fields
 *              up to their minimum.
 * After repair, the answers are run through evaluateAnswers() as a
 * validation gate; if that still throws (should not happen given the repair
 * above, but the engine is treated as a black box here), we retry the whole
 * LLM call once with `noCache: true`, and if it throws again we fall back to
 * a known-good baseline answer set (corpus.mjs-style "selftestBase") so one
 * bad respondent never aborts the whole run.
 *
 * Usage:
 *   node tools/qc/respond.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "./llm.mjs";
import { loadEngine, evaluateAnswers, questionSchema } from "./lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const VIGNETTES_PATH = path.join(DATA_DIR, "vignettes.json");
const OUT_PATH = path.join(DATA_DIR, "answers.json");

const RESPONDENTS_PER_VIGNETTE = 3;

// Sensible upper bound for q2_team's numeric sub-fields, which have a `min`
// in the pack but no `max` (a real team could in principle be any size).
// Documented mock-schema convention, not a business rule.
const TEAM_HEADCOUNT_MOCK_MAX = 15;

// ---------------------------------------------------------------------------
// Mock-schema construction — mirrors packs/finance-tech.json field kinds
// exactly (per questionSchema()) so the mock provider's fabricated JSON is
// immediately valid input to api.evaluate(), modulo the repair pass below.
// ---------------------------------------------------------------------------

function fieldMockSchema(f) {
  switch (f.kind) {
    case "single":
      return { type: "string", enum: f.options || [] };
    case "multi": {
      const n = (f.options || []).length;
      return { type: "array", items: { type: "string", enum: f.options || [] }, minItems: 0, maxItems: n };
    }
    case "ranked": {
      const ranks = f.ranks || 3;
      return { type: "array", items: { type: "string", enum: f.options || [] }, minItems: ranks, maxItems: ranks };
    }
    case "record": {
      const properties = {};
      for (const sub of f.fields || []) properties[sub.id] = fieldMockSchema(sub);
      return { type: "object", properties };
    }
    case "number":
      return {
        type: "number",
        min: f.min != null ? f.min : 0,
        max: f.max != null ? f.max : TEAM_HEADCOUNT_MOCK_MAX,
        integer: true,
      };
    case "text":
    default:
      return { type: "string", maxLength: f.maxLength || 300 };
  }
}

function buildInstrumentMockSchema(allFields) {
  const properties = {};
  for (const f of allFields) properties[f.id] = fieldMockSchema(f);
  return { type: "object", properties };
}

// ---------------------------------------------------------------------------
// Prompt rendering — every question (including reportOnly and rule-inert
// ones) is rendered so the respondent fills the *whole* instrument, matching
// a real form fill (QC-EXPERIMENT.md §5 B2: "the full 21-question instrument").
// ---------------------------------------------------------------------------

function renderField(f, indent) {
  const lines = [];
  const label = f.label ? ` (${f.label})` : "";
  lines.push(`${indent}- "${f.id}"${label} — kind: ${f.kind}`);
  if (Array.isArray(f.options) && f.options.length) {
    lines.push(`${indent}  options: ${f.options.join(", ")}`);
  }
  if (f.kind === "ranked") {
    lines.push(`${indent}  rank exactly ${f.ranks || 3} of the options above, most-important first, no repeats`);
  }
  if (f.kind === "record" && Array.isArray(f.fields)) {
    lines.push(`${indent}  sub-fields (answer every one):`);
    for (const sub of f.fields) lines.push(...renderField(sub, indent + "    "));
    if (f.constraints && f.constraints.sumTo != null) {
      lines.push(`${indent}  NOTE: these sub-fields must sum to exactly ${f.constraints.sumTo}.`);
    }
  }
  if (f.kind === "text" && f.maxLength) lines.push(`${indent}  max length: ${f.maxLength} characters`);
  return lines;
}

function renderQuestion(q) {
  const tag = q.reportOnly ? " [report-only: still answer, but it will not affect any recommendation]" : "";
  const lines = [`Q${q.number != null ? q.number : q.id}${tag}: ${q.legend}`];
  if (q.help) lines.push(`  (${q.help})`);
  for (const f of q.fields || []) lines.push(...renderField(f, "  "));
  return lines.join("\n");
}

function buildInstrumentText(schema) {
  return schema.map(renderQuestion).join("\n\n");
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

// ---------------------------------------------------------------------------
// Deterministic answer repair (see file header for the strategy).
// ---------------------------------------------------------------------------

function normalizeSumTo(obj, keys, target) {
  const vals = keys.map((k) => Math.max(0, Number(obj[k]) || 0));
  const sum = vals.reduce((a, b) => a + b, 0);
  const scaled = sum > 0 ? vals.map((v) => (v / sum) * target) : keys.map((_, i) => (i === 0 ? target : 0));
  const floors = scaled.map(Math.floor);
  let remainder = Math.round(target - floors.reduce((a, b) => a + b, 0));
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = floors.slice();
  for (let k = 0; k < remainder && order.length; k++) result[order[k % order.length].i] += 1;
  keys.forEach((k, i) => {
    obj[k] = result[i];
  });
}

function repairField(f, value) {
  switch (f.kind) {
    case "single": {
      if (typeof value === "string" && (f.options || []).includes(value)) return value;
      return (f.options && f.options[0]) != null ? f.options[0] : null;
    }
    case "multi": {
      const arr = Array.isArray(value) ? value : [];
      return [...new Set(arr.filter((v) => (f.options || []).includes(v)))];
    }
    case "ranked": {
      const ranks = f.ranks || 3;
      const seen = new Set();
      const arr = (Array.isArray(value) ? value : []).filter(
        (v) => (f.options || []).includes(v) && !seen.has(v) && seen.add(v),
      );
      for (const opt of f.options || []) {
        if (arr.length >= ranks) break;
        if (!arr.includes(opt)) arr.push(opt);
      }
      return arr.slice(0, ranks);
    }
    case "number": {
      let n = typeof value === "number" && Number.isFinite(value) ? value : f.min != null ? f.min : 0;
      if (f.min != null && n < f.min) n = f.min;
      if (f.max != null && n > f.max) n = f.max;
      return Math.round(n);
    }
    case "record": {
      const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const out = {};
      for (const sub of f.fields || []) out[sub.id] = repairField(sub, src[sub.id]);
      if (f.constraints && f.constraints.sumTo != null) {
        normalizeSumTo(out, (f.fields || []).map((s) => s.id), f.constraints.sumTo);
      }
      if (f.constraints && f.constraints.minimums) {
        for (const [k, min] of Object.entries(f.constraints.minimums)) {
          if (typeof out[k] === "number" && out[k] < min) out[k] = min;
        }
      }
      if (f.constraints && f.constraints.allowedValues) {
        for (const [k, allowed] of Object.entries(f.constraints.allowedValues)) {
          if (!allowed.includes(out[k])) out[k] = allowed[0];
        }
      }
      return out;
    }
    case "text":
    default: {
      let s = typeof value === "string" ? value : value != null ? String(value) : "";
      if (f.maxLength && s.length > f.maxLength) s = s.slice(0, f.maxLength);
      return s;
    }
  }
}

function repairAnswers(raw, allFields) {
  const out = {};
  for (const f of allFields) out[f.id] = repairField(f, raw ? raw[f.id] : undefined);
  return out;
}

/** Deterministic, known-good fallback answer set (mirrors corpus.mjs's selftestBase). */
function fallbackAnswers() {
  return {
    q7_requirements: "structured",
    q10_architecture: "microservices",
    q11_deploy_cadence: "monthly",
    q14_release_autonomy: "autonomous",
    q6_volatility: "moderate",
    q5_work_breakdown: { roadmap: 80, ops: 5, bugs: 5, regulatory: 5, tech_debt: 5 },
    q2_team: {
      total: 8, swe: 6, data_engineers: 0, qa_sdet: 0,
      product_owner: "none", scrum_master: "none",
    },
    q12_quality_gates: ["unit_coverage", "integration_contract", "e2e"],
  };
}

async function respondOnce(client, api, { vignette, respondentIndex, instrumentText, allFields, mockSchema, onCallComplete }) {
  const system =
    "You are one of three independent respondents filling out a team " +
    "diagnostic instrument on behalf of a finance-tech engineering team, " +
    "based solely on a prose description of that team. Answer every " +
    "question, including the report-only ones, using only what the prose " +
    "implies or a reasonable, typical inference for a team like this. " +
    "Do not invent a specific target framework — answer honestly from the " +
    "narrative. Respond with strict JSON, one key per field id, no prose " +
    "outside the JSON.";

  const user =
    `You are respondent ${respondentIndex} of ${RESPONDENTS_PER_VIGNETTE}, reading this team's ` +
    `story independently (you do not see the other two respondents' answers).\n\n` +
    `--- TEAM STORY (${vignette.id}) ---\n${vignette.prose}\n\n` +
    `--- INSTRUMENT (answer every field) ---\n${instrumentText}\n\n` +
    `Respond with a single JSON object whose keys are exactly the field ids above.`;

  let response = await client.complete({
    system,
    messages: [{ role: "user", content: user }],
    temperature: 0.6,
    maxTokens: 1200,
    mockSchema,
  });
  if (onCallComplete) onCallComplete(response);

  let answers;
  try {
    const parsed = parseJsonResponse(response.text);
    answers = repairAnswers(parsed, allFields);
    evaluateAnswers(api, answers); // validation gate — throws if the engine itself rejects it
  } catch (err) {
    console.warn(
      `respond: ${vignette.id} respondent ${respondentIndex} failed validation (${err.message}); retrying once with noCache`,
    );
    try {
      response = await client.complete({
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.6,
        maxTokens: 1200,
        mockSchema,
        noCache: true,
      });
      const parsed = parseJsonResponse(response.text);
      answers = repairAnswers(parsed, allFields);
      evaluateAnswers(api, answers);
    } catch (err2) {
      console.error(
        `respond: ${vignette.id} respondent ${respondentIndex} failed twice (${err2.message}); falling back to baseline answers`,
      );
      answers = fallbackAnswers();
    }
  }

  return { vignetteId: vignette.id, respondentIndex, model: response.model, answers };
}

async function main() {
  if (!fs.existsSync(VIGNETTES_PATH)) {
    throw new Error(`tools/qc/respond.mjs: ${VIGNETTES_PATH} does not exist — run \`node tools/qc/personas.mjs\` first.`);
  }
  const vignettes = JSON.parse(fs.readFileSync(VIGNETTES_PATH, "utf8"));
  const api = loadEngine();
  const client = createClient({ role: "respond" });
  const schema = questionSchema(api);
  const allFields = schema.flatMap((q) => q.fields || []);
  const instrumentText = buildInstrumentText(schema);
  const mockSchema = buildInstrumentMockSchema(allFields);

  const totalCalls = vignettes.length * RESPONDENTS_PER_VIGNETTE;
  console.log(`tools/qc/respond.mjs — provider=${client.provider} model=${client.model}`);
  console.log(`${vignettes.length} vignettes x ${RESPONDENTS_PER_VIGNETTE} respondents = ${totalCalls} calls`);

  const out = [];
  let repaired = 0;
  let fellBack = 0;
  let done = 0;
  for (const vignette of vignettes) {
    for (let respondentIndex = 0; respondentIndex < RESPONDENTS_PER_VIGNETTE; respondentIndex++) {
      const rec = await respondOnce(client, api, {
        vignette,
        respondentIndex,
        instrumentText,
        allFields,
        mockSchema,
        onCallComplete: (response) => {
          done++;
          reportProgress("responding", done, totalCalls, client.provider, response.cached);
        },
      });
      out.push(rec);
    }
  }
  if (process.stdout.isTTY) process.stdout.write("\n");

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "answers.json.tmp"), JSON.stringify(out, null, 2));
  fs.renameSync(path.join(DATA_DIR, "answers.json.tmp"), OUT_PATH);

  console.log(`wrote ${out.length} respondent answer records to ${path.relative(process.cwd(), OUT_PATH)}`);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("tools/qc/respond.mjs FAILED");
      console.error(err && err.stack ? err.stack : err);
      process.exit(1);
    });
}

export { repairAnswers, fieldMockSchema, buildInstrumentMockSchema };
