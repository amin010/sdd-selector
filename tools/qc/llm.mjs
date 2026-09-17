/**
 * Zero-dependency LLM client for the QC experiment (tools/qc/*).
 *
 * Node 18+ only: uses the global `fetch`, `node:crypto`, `node:fs`, `node:path`.
 * No npm dependencies — this repo has zero runtime deps by design.
 *
 * Provider resolution (createClient({ provider }) omitted):
 *   1. process.env.ANTHROPIC_API_KEY set  -> "anthropic" (Messages API)
 *   2. process.env.OPENAI_API_KEY set     -> "openai"    (Chat Completions API)
 *   3. otherwise                          -> "mock"       (no network, deterministic)
 *
 * Every call is content-addressed and cached to tools/qc/cache/<sha256>.json so
 * re-running any downstream script (personas/respond/judge/analyze) never
 * re-spends tokens for a request it has already made. Pass `noCache: true` to
 * force a fresh call, or `cacheKey` to control the cache slot explicitly.
 *
 * ---------------------------------------------------------------------------
 * PER-ROLE MODEL SELECTION (createClient({ role }))
 * ---------------------------------------------------------------------------
 * The three generation scripts (personas.mjs, respond.mjs, judge.mjs) each
 * play a different "role" in the pipeline and may warrant different model
 * choices (e.g. a stronger model for judging than for persona/vignette
 * generation). Callers may pass `role: "persona" | "respond" | "judge"` to
 * `createClient()` to opt into role-aware model resolution; callers that omit
 * `role` (or pass an unrecognized one) keep the original flat behavior.
 *
 * Model resolution order, when `model` is not passed explicitly (see
 * `resolveModel()` for the authoritative implementation):
 *   1. explicit `model` param                                 (highest priority)
 *   2. `role` given: process.env[ROLE_ENV_VARS[role]]          (e.g. QC_JUDGE_MODEL)
 *   3. `role` given: ROLE_DEFAULT_MODELS[resolvedProvider]?.[role]
 *   4. DEFAULT_MODELS[resolvedProvider]                        (existing flat default)
 *   5. DEFAULT_MODELS.mock                                     (final fallback)
 *
 * Per-role env var overrides:
 *   - QC_PERSONA_MODEL  -> used when role === "persona" (tools/qc/personas.mjs)
 *   - QC_RESPOND_MODEL  -> used when role === "respond" (tools/qc/respond.mjs)
 *   - QC_JUDGE_MODEL    -> used when role === "judge"   (tools/qc/judge.mjs)
 *
 * Per-role defaults are currently only defined for the "openai" provider (see
 * ROLE_DEFAULT_MODELS below); "anthropic" and "mock" continue to use their
 * single flat DEFAULT_MODELS entry for every role, since no per-role
 * Anthropic/mock model names have been requested.
 *
 * ---------------------------------------------------------------------------
 * MOCK SCHEMA CONVENTION (read this if you are building personas/respond/judge)
 * ---------------------------------------------------------------------------
 * The mock provider (used whenever no API key is configured) cannot understand
 * prompt semantics, but downstream scripts still need it to return well-formed,
 * *parseable* output. To get structured mock output, pass `mockSchema` to
 * `complete()`: a tiny ad-hoc JSON-Schema-like description of the JSON value
 * you want back. The mock deterministically fabricates a conforming value
 * (seeded by hashing the prompt — never Math.random()) and returns it as a
 * JSON string in `response.text`, ready for `JSON.parse()`.
 *
 * Supported node shapes:
 *   { type: "object", properties: { <key>: <schema>, ... } }
 *     -> plain object with every listed key present, each fabricated per its
 *        own sub-schema.
 *   { type: "array", items: <schema>, minItems?, maxItems? }
 *     -> array of `items` fabricated repeatedly. Length is deterministic:
 *        fixed at minItems if minItems === maxItems (or only one is given),
 *        otherwise pseudo-randomly chosen in [minItems, maxItems].
 *        Defaults: minItems=3, maxItems=minItems.
 *   { type: "string", enum?: [...], minLength?, maxLength? }
 *     -> if `enum` is given, deterministically picks one member. Otherwise
 *        fabricates deterministic lorem-ish free text sized to
 *        [minLength, maxLength] (sane defaults if omitted).
 *   { type: "number", min?, max?, integer? }
 *     -> deterministic number in [min, max] (defaults 0..1), rounded to an
 *        integer when `integer: true`, else rounded to 2 decimals.
 *   { type: "boolean" }
 *     -> deterministic true/false.
 *
 * This is intentionally *not* full JSON Schema — just enough to describe an
 * object of fields with enums/ranges/free text, or an array of a fixed item
 * shape. Anything else (missing/unknown `type`) falls back to free text.
 *
 * Example:
 *   const { text } = await client.complete({
 *     system: "You are a survey respondent.",
 *     messages: [{ role: "user", content: "Answer as JSON." }],
 *     mockSchema: {
 *       type: "object",
 *       properties: {
 *         pick: { type: "string", enum: ["a", "b", "c"] },
 *         score: { type: "number", min: 1, max: 5 },
 *       },
 *     },
 *   });
 *   const parsed = JSON.parse(text); // { pick: "b", score: 4 }
 *
 * Usage:
 *   node tools/qc/llm.mjs   # runs the built-in self-test (mock path only)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default on-disk cache location: tools/qc/cache/. */
export const DEFAULT_CACHE_DIR = path.join(__dirname, "cache");

/**
 * Fallback model ids used when the caller does not pass `model` explicitly.
 * These are just sensible defaults — always overridable via createClient({ model }).
 */
export const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-4-5-20250929",
  openai: "gpt-4.1-mini",
  mock: "mock-v1",
};

/**
 * Maps each pipeline "role" to the environment variable that overrides its
 * resolved model. See `resolveModel()` for how these are consulted.
 */
export const ROLE_ENV_VARS = {
  persona: "QC_PERSONA_MODEL",
  respond: "QC_RESPOND_MODEL",
  judge: "QC_JUDGE_MODEL",
};

/**
 * Per-role default model ids, keyed by provider then role. Only populated
 * for "openai" per the current ask — "anthropic" and "mock" have no
 * per-role defaults and fall back to the flat DEFAULT_MODELS entry for
 * every role instead.
 */
export const ROLE_DEFAULT_MODELS = {
  openai: { persona: "gpt-5.6-terra", respond: "gpt-5.6-terra", judge: "gpt-5.6-sol" },
};

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/**
 * HTTP statuses treated as transient (retry the same request body).
 * 400 invalid_request / 401 / 403 are intentionally absent: those are
 * permanent for a given body (or, for 400, handled by KNOWN_QUIRKS).
 */
const TRANSIENT_HTTP_STATUSES = new Set([
  408, 409, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524,
]);

/** Total fetch attempts for one request body facing transient failures. */
const MAX_TRANSIENT_ATTEMPTS = 5;

/** Backoff between transient retries (attempt 1→2, 2→3, 3→4, 4→5). */
const TRANSIENT_BACKOFF_MS = [1000, 2000, 4000, 8000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHttp(status) {
  return TRANSIENT_HTTP_STATUSES.has(status);
}

/**
 * Thrown fetch/network failures worth retrying. TypeError covers the
 * standard `fetch failed` / aborted-connection cases; ECONNRESET is
 * named explicitly because some Node paths expose it as `err.code`
 * on a non-TypeError.
 */
function isTransientError(err) {
  if (!err) return false;
  if (err.name === "TypeError") return true;
  if (err.code === "ECONNRESET") return true;
  const msg = String(err.message != null ? err.message : err);
  return /fetch failed|ECONNRESET/i.test(msg);
}

function formatTransientReason(statusOrErr) {
  if (typeof statusOrErr === "number") return String(statusOrErr);
  if (statusOrErr && statusOrErr.code) return String(statusOrErr.code);
  if (statusOrErr && statusOrErr.message) return String(statusOrErr.message);
  return "network error";
}

/**
 * Run `doFetch()` up to MAX_TRANSIENT_ATTEMPTS times for one request body.
 * Returns as soon as the Response is ok or a non-transient HTTP status
 * (so 400 still reaches KNOWN_QUIRKS, and 401/403 throw immediately).
 * Transient HTTP statuses and thrown network errors retry the same
 * request with exponential backoff. After the last attempt, a leftover
 * transient Response is returned (caller formats the error); a leftover
 * thrown error is rethrown.
 */
async function fetchWithTransientRetry(doFetch) {
  for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
    try {
      const res = await doFetch();
      if (res.ok || !isTransientHttp(res.status)) return res;
      if (attempt >= MAX_TRANSIENT_ATTEMPTS) return res;
      const delay = TRANSIENT_BACKOFF_MS[attempt - 1];
      console.error(
        `llm: transient ${res.status}, retry ${attempt + 1}/${MAX_TRANSIENT_ATTEMPTS} in ${delay}ms`,
      );
      await sleep(delay);
    } catch (err) {
      if (!isTransientError(err) || attempt >= MAX_TRANSIENT_ATTEMPTS) throw err;
      const delay = TRANSIENT_BACKOFF_MS[attempt - 1];
      console.error(
        `llm: transient ${formatTransientReason(err)}, retry ${attempt + 1}/${MAX_TRANSIENT_ATTEMPTS} in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  throw new Error("fetchWithTransientRetry: exceeded max attempts");
}

/**
 * Deep-sort object keys so JSON.stringify output is stable regardless of
 * insertion order. Arrays keep their original order (order is meaningful).
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/** Stable (sorted-key) JSON stringification, so identical objects hash identically. */
export function stableStringify(value) {
  return JSON.stringify(sortKeysDeep(value));
}

/** sha256 hex digest of the stable-stringified object. */
export function hashObject(obj) {
  return crypto.createHash("sha256").update(stableStringify(obj)).digest("hex");
}

/**
 * Deterministic 32-bit PRNG (mulberry32), seeded from a hex string.
 * Returns a function that yields floats in [0, 1) on each call.
 */
function makeRng(seedHex) {
  let t = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  return function rng() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const LOREM_WORDS = [
  "alpha", "baseline", "calibrate", "delta", "epsilon", "framework", "governance",
  "horizon", "iterate", "junction", "kappa", "latency", "milestone", "nominal",
  "overlay", "pipeline", "quorum", "runtime", "signal", "threshold", "unify",
  "vector", "workflow", "cascade", "yield", "zenith", "backlog", "cadence",
  "compliance", "domain", "endpoint", "fallback", "gateway", "heuristic",
  "inference", "ledger", "modular", "notation", "outcome", "posture",
  "quarterly", "resilient", "surface", "tenure", "upstream", "variance",
];

/** Deterministic lorem-ish free text, sized roughly to [minLength, maxLength]. */
function fabricateFreeText(rng, minLength, maxLength) {
  const targetMin = minLength != null ? minLength : 24;
  const targetMax = maxLength != null ? maxLength : Math.max(targetMin + 40, 80);
  const words = [];
  let text = "";
  while (words.length < 3 || text.length < targetMin) {
    const word = LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)];
    words.push(word);
    text = words.join(" ");
    if (text.length >= targetMax) break;
  }
  if (text.length > targetMax) text = text.slice(0, targetMax).trim();
  if (!text) text = "note";
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/**
 * Fabricate a JSON value conforming to the ad-hoc mockSchema subset
 * documented at the top of this file. Unknown/missing `type` -> free text.
 */
function fabricateFromSchema(schema, rng) {
  if (!schema || typeof schema !== "object") return fabricateFreeText(rng);
  switch (schema.type) {
    case "object": {
      const out = {};
      const props = schema.properties || {};
      for (const key of Object.keys(props)) {
        out[key] = fabricateFromSchema(props[key], rng);
      }
      return out;
    }
    case "array": {
      const min = schema.minItems != null ? schema.minItems : 3;
      const max = schema.maxItems != null ? schema.maxItems : min;
      const count = max > min ? min + Math.floor(rng() * (max - min + 1)) : min;
      const items = [];
      for (let i = 0; i < count; i++) items.push(fabricateFromSchema(schema.items, rng));
      return items;
    }
    case "string": {
      if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        return schema.enum[Math.floor(rng() * schema.enum.length)];
      }
      return fabricateFreeText(rng, schema.minLength, schema.maxLength);
    }
    case "number": {
      const min = schema.min != null ? schema.min : (schema.minimum != null ? schema.minimum : 0);
      const max = schema.max != null ? schema.max : (schema.maximum != null ? schema.maximum : 1);
      const value = min + rng() * (max - min);
      return schema.integer ? Math.round(value) : Math.round(value * 100) / 100;
    }
    case "boolean":
      return rng() < 0.5;
    default:
      return fabricateFreeText(rng);
  }
}

/**
 * Build the deterministic mock completion text for a request. Seeded purely
 * from the prompt content (system/messages/mockSchema) — never Math.random() —
 * so identical prompts always produce identical mock output, cache or no cache.
 */
function generateMockText({ system, messages, mockSchema, maxTokens }) {
  const seedHex = hashObject({ system, messages, mockSchema });
  const rng = makeRng(seedHex);
  if (mockSchema) {
    return JSON.stringify(fabricateFromSchema(mockSchema, rng));
  }
  const target = Math.min(Math.max((maxTokens || 256) * 3, 60), 2000);
  return fabricateFreeText(rng, Math.floor(target * 0.6), target);
}

/** Auto-detect provider from environment API keys, falling back to "mock". */
export function detectProvider() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/**
 * Call the real Anthropic Messages API. Only exercised when
 * ANTHROPIC_API_KEY is set — untested in this sandbox (no key available)
 * but written to be a correct, minimal implementation.
 */
async function callAnthropic({ model, system, messages, temperature, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetchWithTransientRetry(() =>
    fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens != null ? maxTokens : 1024,
        temperature: temperature != null ? temperature : 0.7,
        system: system || undefined,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    }),
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  return blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
}

/**
 * Best-effort parse of a failed OpenAI response body into its `error`
 * object. Returns `null` if the body isn't the expected `{ error: {...} }`
 * JSON shape (e.g. an unparseable/empty body) — callers must treat `null`
 * as "no known quirk can match this".
 */
function parseOpenAIError(bodyText) {
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }
  return (parsed && parsed.error) || null;
}

/**
 * Known OpenAI Chat Completions request-body "quirks": model-tier-specific
 * 400 rejections of a parameter we sent, each with a matching `apply()` fix
 * to retry with. This list has grown out of two real incidents hitting this
 * pipeline's newer gpt-5.x/6.x models, and is written to be easy to extend
 * with a third if another one shows up:
 *
 *   1. "tokenParamSwap" — the model rejects whichever token-limit param
 *      name we sent (`max_tokens` vs `max_completion_tokens`) and wants the
 *      other one instead. Fix: rename the key, carrying over the value
 *      from whichever of the two keys is actually present in the body
 *      (not necessarily the one the error reported as rejected).
 *   2. "temperatureUnsupported" — the model only accepts the API's own
 *      default `temperature` and rejects any explicit value we send. Fix:
 *      delete the `temperature` key entirely so the API falls back to its
 *      default, rather than guessing/hardcoding what that default is.
 *
 * Each entry is `{ id, matches(status, err), apply(body, err) }`:
 *   - `matches` inspects the failed response's status + parsed `error`
 *     object and returns true iff this quirk explains that specific error.
 *   - `apply` returns a *new* request body with the fix applied.
 */
const KNOWN_QUIRKS = [
  {
    id: "tokenParamSwap",
    matches(status, err) {
      return (
        status === 400 &&
        !!err &&
        err.code === "unsupported_parameter" &&
        (err.param === "max_tokens" || err.param === "max_completion_tokens")
      );
    },
    apply(body, err) {
      const to = err.param === "max_tokens" ? "max_completion_tokens" : "max_tokens";
      // Read the value from whichever of the two known key names is
      // actually present in `body` (rather than assuming it's `err.param`),
      // so this can't silently drop the value to `undefined` if the
      // error's reported param name and the body's actual key ever diverge.
      const tokenValue = body.max_tokens !== undefined ? body.max_tokens : body.max_completion_tokens;
      const next = { ...body };
      delete next.max_tokens;
      delete next.max_completion_tokens;
      next[to] = tokenValue;
      return next;
    },
  },
  {
    id: "temperatureUnsupported",
    matches(status, err) {
      return (
        status === 400 &&
        !!err &&
        (err.code === "unsupported_value" || err.code === "unsupported_parameter") &&
        err.param === "temperature"
      );
    },
    apply(body) {
      const next = { ...body };
      delete next.temperature;
      return next;
    },
  },
];

/**
 * Hard cap on quirk-adaptation attempts made by `postChatCompletion()`: the
 * initial attempt plus up to 3 quirk-fix retries. Transient HTTP/network
 * retries (see `fetchWithTransientRetry`) are a separate inner bound and
 * do not consume this counter. This bound applies regardless of the
 * per-quirk dedup below, so there is no possible infinite loop even if a
 * server keeps returning an error a quirk's `apply()` didn't actually resolve.
 */
const MAX_CHAT_COMPLETION_ATTEMPTS = 4;

/**
 * POST a Chat Completions request body to the OpenAI endpoint, adapting to
 * known model-tier quirks (see `KNOWN_QUIRKS`) and retrying in a small
 * bounded loop. Each fetch is itself wrapped in `fetchWithTransientRetry`
 * (5xx / 429 / Cloudflare 520 / network errors), which retries the *same*
 * body and does not count as a quirk. On each failed (non-ok) *non-transient*
 * response (or a transient response that exhausted its retries), this looks
 * for the first known quirk whose `matches()` fires for that error AND that
 * hasn't already been applied earlier in this same call chain (tracked in a
 * Set, so a given quirk is never applied twice — this alone rules out
 * infinite loops even if a "fix" doesn't actually help). If a fresh matching
 * quirk is found, its fix is applied and the request is retried; otherwise
 * (no quirk matches, or every matching quirk has already been tried) the
 * error is thrown immediately, as-is. `MAX_CHAT_COMPLETION_ATTEMPTS` caps
 * quirk-adaptation attempts (not transient retries) as a second safety bound.
 */
async function postChatCompletion(apiKey, initialBody) {
  const doFetch = (payload) =>
    fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

  let body = initialBody;
  const appliedQuirks = new Set();

  for (let attempt = 1; attempt <= MAX_CHAT_COMPLETION_ATTEMPTS; attempt++) {
    const res = await fetchWithTransientRetry(() => doFetch(body));
    if (res.ok) return res;

    const bodyText = await res.text().catch(() => "");
    const err = parseOpenAIError(bodyText);
    const quirk =
      attempt < MAX_CHAT_COMPLETION_ATTEMPTS
        ? KNOWN_QUIRKS.find((q) => !appliedQuirks.has(q.id) && q.matches(res.status, err))
        : undefined;

    if (!quirk) {
      throw new Error(`OpenAI API error ${res.status}: ${bodyText}`);
    }

    appliedQuirks.add(quirk.id);
    body = quirk.apply(body, err);
  }

  // Unreachable: the loop above always either returns or throws before
  // falling off the end, but keep control flow explicit for readability.
  throw new Error("postChatCompletion: exceeded max attempts");
}

/**
 * Call the real OpenAI Chat Completions API. Only exercised when
 * OPENAI_API_KEY is set — untested in this sandbox (no key available)
 * but written to be a correct, minimal implementation.
 */
async function callOpenAI({ model, system, messages, temperature, maxTokens }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const chatMessages = [];
  if (system) chatMessages.push({ role: "system", content: system });
  for (const m of messages) chatMessages.push({ role: m.role, content: m.content });
  const res = await postChatCompletion(apiKey, {
    model,
    temperature: temperature != null ? temperature : 0.7,
    // Current OpenAI models (the gpt-5.x/6.x family) require
    // `max_completion_tokens` instead of the legacy `max_tokens`, and some
    // of them also reject a custom `temperature` altogether. If the
    // resolved model hits either of these (or another known quirk),
    // postChatCompletion() adapts the request body and retries — see
    // `KNOWN_QUIRKS` for the full, current list of handled cases.
    max_completion_tokens: maxTokens != null ? maxTokens : 1024,
    messages: chatMessages,
  });
  const data = await res.json();
  const choice = (data.choices || [])[0];
  return choice && choice.message ? choice.message.content || "" : "";
}

/**
 * Resolve the model id to use for a given provider/model/role combination.
 * This is the single source of truth for model resolution — see the
 * "PER-ROLE MODEL SELECTION" doc block at the top of this file for the
 * full explanation of the ordering below.
 *
 * @param {object} opts
 * @param {string} opts.resolvedProvider - already-resolved provider (never omitted here)
 * @param {string} [opts.model] - explicit model, if the caller passed one
 * @param {"persona"|"respond"|"judge"} [opts.role] - pipeline role, if any
 * @returns {string} the resolved model id
 */
function resolveModel({ resolvedProvider, model, role }) {
  // 1. Explicit `model` param always wins.
  if (model) return model;

  if (role) {
    // 2. Role-specific env var override (e.g. QC_JUDGE_MODEL).
    const envVar = ROLE_ENV_VARS[role];
    const envValue = envVar && process.env[envVar];
    if (envValue) return envValue;

    // 3. Role-specific default for this provider, if one is defined.
    const roleDefault = ROLE_DEFAULT_MODELS[resolvedProvider]?.[role];
    if (roleDefault) return roleDefault;
  }

  // 4. Existing flat per-provider default, then 5. the mock default.
  return DEFAULT_MODELS[resolvedProvider] || DEFAULT_MODELS.mock;
}

/**
 * Create an LLM client.
 *
 * @param {object} [opts]
 * @param {"anthropic"|"openai"|"mock"} [opts.provider] - defaults to detectProvider()
 * @param {string} [opts.model] - defaults to role/provider resolution, see resolveModel()
 * @param {"persona"|"respond"|"judge"} [opts.role] - pipeline role used for per-role
 *   model resolution (env var override, then per-role default); omit for callers that
 *   don't care about role-specific models (falls back to the flat DEFAULT_MODELS)
 * @param {string} [opts.cacheDir] - defaults to tools/qc/cache/
 * @returns {{
 *   provider: string,
 *   model: string,
 *   cacheDir: string,
 *   complete: (req: {
 *     system?: string,
 *     messages?: Array<{role: string, content: string}>,
 *     temperature?: number,
 *     maxTokens?: number,
 *     mockSchema?: object,
 *     cacheKey?: string,
 *     noCache?: boolean,
 *   }) => Promise<{ text: string, model: string, provider: string, cached: boolean }>,
 * }}
 */
export function createClient({ provider, model, role, cacheDir } = {}) {
  const resolvedProvider = provider || detectProvider();
  const resolvedModel = resolveModel({ resolvedProvider, model, role });
  const resolvedCacheDir = cacheDir || DEFAULT_CACHE_DIR;

  async function complete(req = {}) {
    const {
      system = "",
      messages = [],
      temperature = 0.7,
      maxTokens = 1024,
      mockSchema,
      cacheKey,
      noCache = false,
    } = req;

    const canonicalRequest = cacheKey
      ? { cacheKey }
      : {
        provider: resolvedProvider,
        model: resolvedModel,
        system,
        messages,
        temperature,
        mockSchema,
      };
    const hash = hashObject(canonicalRequest);
    const cachePath = path.join(resolvedCacheDir, `${hash}.json`);

    if (!noCache && fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      return { ...cached, cached: true };
    }

    let text;
    if (resolvedProvider === "anthropic") {
      text = await callAnthropic({ model: resolvedModel, system, messages, temperature, maxTokens });
    } else if (resolvedProvider === "openai") {
      text = await callOpenAI({ model: resolvedModel, system, messages, temperature, maxTokens });
    } else {
      text = generateMockText({ system, messages, mockSchema, maxTokens });
    }

    const response = { text, model: resolvedModel, provider: resolvedProvider, cached: false };

    if (!noCache) {
      fs.mkdirSync(resolvedCacheDir, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(response, null, 2));
    }

    return response;
  }

  return { provider: resolvedProvider, model: resolvedModel, cacheDir: resolvedCacheDir, complete };
}

// ---------------------------------------------------------------------------
// Self-test (mock path only — no network calls, no API keys required).
// ---------------------------------------------------------------------------
function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

async function selfTest() {
  const tmpCacheDir = path.join(__dirname, "cache", `selftest-${process.pid}`);
  const client = createClient({ provider: "mock", cacheDir: tmpCacheDir });

  const req = {
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "Say hello." }],
  };

  const first = await client.complete(req);
  assert(first.cached === false, "first call should not be a cache hit");
  assert(typeof first.text === "string" && first.text.length > 0, "first call should return text");

  const second = await client.complete(req);
  assert(second.cached === true, "second identical call should be a cache hit");
  assert(second.text === first.text, "cached text should be identical to original");

  const schema = {
    type: "object",
    properties: {
      pick: { type: "string", enum: ["a", "b", "c"] },
      score: { type: "number", min: 1, max: 5 },
    },
  };
  const structured = await client.complete({
    system: "Respond as JSON.",
    messages: [{ role: "user", content: "Pick and score." }],
    mockSchema: schema,
  });
  const parsed = JSON.parse(structured.text);
  assert(["a", "b", "c"].includes(parsed.pick), `pick "${parsed.pick}" must be one of a/b/c`);
  assert(
    typeof parsed.score === "number" && parsed.score >= 1 && parsed.score <= 5,
    `score ${parsed.score} must be in [1, 5]`,
  );

  // Clean up the scratch cache directory used for this self-test run.
  fs.rmSync(tmpCacheDir, { recursive: true, force: true });
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  selfTest()
    .then(() => {
      console.log("PASS");
      process.exit(0);
    })
    .catch((err) => {
      console.error("FAIL:", err && err.stack ? err.stack : err);
      process.exit(1);
    });
}
