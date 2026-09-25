const MAX_DEPTH = 32;
const MAX_NODES = 10_000;

export const OPERATORS = new Set([
  "answer", "derived", "result", "flag", "rank",
  "all", "any", "not",
  "eq", "ne", "gt", "gte", "lt", "lte",
  "in", "hasAny", "hasAll", "hasNone", "isSet", "rankAtMost",
  "add", "sub", "mul", "min", "max", "sumFields", "count",
  "countSelected", "bucket", "coalesce",
]);

export function isOperator(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && OPERATORS.has(keys[0]);
}

export function depthOf(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return 1;
  if (seen.has(value)) return Infinity;
  seen.add(value);
  const children = Array.isArray(value)
    ? value
    : Object.keys(value).map((key) => value[key]);
  let depth = 1;
  for (const child of children) depth = Math.max(depth, 1 + depthOf(child, seen));
  seen.delete(value);
  return depth;
}

function own(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function recordValid(value, constraints = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const required = Array.isArray(constraints.requiredKeys)
    ? constraints.requiredKeys
    : [];
  for (const key of required) {
    if (!own(value, key)) return false;
    const item = value[key];
    if (!(isFiniteNumber(item) || (typeof item === "string" && item.length > 0))) {
      return false;
    }
    if (constraints.minimums && own(constraints.minimums, key) &&
        (!isFiniteNumber(item) || item < constraints.minimums[key])) {
      return false;
    }
    if (constraints.allowedValues && own(constraints.allowedValues, key) &&
        (!Array.isArray(constraints.allowedValues[key]) ||
         constraints.allowedValues[key].indexOf(item) === -1)) {
      return false;
    }
  }
  if (own(constraints, "sumTo")) {
    if (!isFiniteNumber(constraints.sumTo) || required.length === 0) return false;
    let sum = 0;
    for (const key of required) {
      const item = value[key];
      if (!isFiniteNumber(item) || item < 0) return false;
      sum += item;
    }
    if (constraints.sumToMode === "normalize") return sum > 0;
    if (sum !== constraints.sumTo) return false;
  }
  return true;
}

/** Scale a sumTo record onto its target. Returns a new object, or the input if it cannot be scaled. */
export function normalizeRecord(value, constraints = {}) {
  if (!recordValid(value, { ...constraints, sumToMode: "normalize" })) return value;
  if (!own(constraints, "sumTo") || constraints.sumToMode !== "normalize") return value;
  const required = Array.isArray(constraints.requiredKeys) ? constraints.requiredKeys : [];
  let sum = 0;
  for (const key of required) sum += value[key];
  if (sum === constraints.sumTo) return value;
  const out = { ...value };
  for (const key of required) out[key] = value[key] * (constraints.sumTo / sum);
  return out;
}

/** Normalize every sumTo-mode record on an answer object using FIELD_INDEX metadata. */
export function normalizeAnswers(answers, fieldIndex) {
  if (!answers || typeof answers !== "object") return answers || {};
  const out = { ...answers };
  const index = fieldIndex || {};
  for (const id of Object.keys(index)) {
    const meta = index[id];
    if (!meta || meta.kind !== "record" || !meta.constraints) continue;
    if (meta.constraints.sumToMode !== "normalize") continue;
    if (out[id] == null) continue;
    out[id] = normalizeRecord(out[id], meta.constraints);
  }
  return out;
}

function readAnswer(path, ctx) {
  if (typeof path !== "string" || !path) return null;
  const parts = path.split(".");
  const root = parts[0];
  const answers = ctx.answers || {};
  if (!own(answers, root)) return null;
  const meta = (ctx.fieldIndex || {})[root];
  let value = answers[root];
  if (meta && meta.kind === "record" && !recordValid(value, meta.constraints || {})) {
    return null;
  }
  for (let i = 1; i < parts.length; i++) {
    if (!value || typeof value !== "object" || !own(value, parts[i])) return null;
    value = value[parts[i]];
  }
  return value === undefined ? null : value;
}

function rankOf(field, value, ctx) {
  const ranked = readAnswer(field, ctx);
  if (!Array.isArray(ranked)) return null;
  const index = ranked.indexOf(value);
  return index === -1 ? null : index + 1;
}

function isSet(value) {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function list(value) {
  return Array.isArray(value) ? value : null;
}

function numericArgs(raw, state, depth, minimum = 2) {
  if (!Array.isArray(raw) || raw.length < minimum) return null;
  const values = raw.map((item) => evalNode(item, state, depth + 1));
  return values.every(isFiniteNumber) ? values : null;
}

function ordered(raw, state, depth, compare) {
  const values = numericArgs(raw, state, depth, 2);
  return values && values.length === 2 ? compare(values[0], values[1]) : false;
}

function membership(raw, state, depth, mode) {
  if (!Array.isArray(raw) || raw.length !== 2) return false;
  const left = evalNode(raw[0], state, depth + 1);
  const right = evalNode(raw[1], state, depth + 1);
  if (left == null || !Array.isArray(right)) return false;
  if (mode === "in") return right.indexOf(left) !== -1;
  if (!Array.isArray(left)) return false;
  if (mode === "hasAny") return right.some((item) => left.indexOf(item) !== -1);
  if (mode === "hasAll") return right.every((item) => left.indexOf(item) !== -1);
  return !right.some((item) => left.indexOf(item) !== -1);
}

function evalNode(expr, state, depth) {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) throw state.limit;
  if (Array.isArray(expr)) return expr.map((item) => evalNode(item, state, depth + 1));
  if (!expr || typeof expr !== "object") return expr;

  const keys = Object.keys(expr);
  if (keys.length !== 1 || !OPERATORS.has(keys[0])) return false;
  const op = keys[0];
  const raw = expr[op];
  const ctx = state.ctx;

  if (op === "answer") return readAnswer(raw, ctx);
  if (op === "derived") return own(ctx.derived || {}, raw) ? ctx.derived[raw] : null;
  if (op === "result") return own(ctx.result || {}, raw) ? ctx.result[raw] : null;
  if (op === "flag") return !!(ctx.flags && ctx.flags[raw] === true);
  if (op === "rank") {
    return raw && typeof raw === "object" ? rankOf(raw.field, raw.of, ctx) : null;
  }
  if (op === "all" || op === "any") {
    if (!Array.isArray(raw)) return false;
    const values = raw.map((item) => evalNode(item, state, depth + 1));
    return op === "all" ? values.every(Boolean) : values.some(Boolean);
  }
  if (op === "not") {
    const value = evalNode(raw, state, depth + 1);
    return value == null ? false : !value;
  }
  if (op === "eq" || op === "ne") {
    if (!Array.isArray(raw) || raw.length !== 2) return false;
    const left = evalNode(raw[0], state, depth + 1);
    const right = evalNode(raw[1], state, depth + 1);
    if (left == null || right == null) return false;
    return op === "eq" ? left === right : left !== right;
  }
  if (op === "gt") return ordered(raw, state, depth, (a, b) => a > b);
  if (op === "gte") return ordered(raw, state, depth, (a, b) => a >= b);
  if (op === "lt") return ordered(raw, state, depth, (a, b) => a < b);
  if (op === "lte") return ordered(raw, state, depth, (a, b) => a <= b);
  if (op === "in" || op === "hasAny" || op === "hasAll" || op === "hasNone") {
    return membership(raw, state, depth, op);
  }
  if (op === "isSet") return isSet(evalNode(raw, state, depth + 1));
  if (op === "rankAtMost") {
    if (!raw || typeof raw !== "object" || !isFiniteNumber(raw.n)) return false;
    const rank = rankOf(raw.field, raw.of, ctx);
    return rank != null && rank <= raw.n;
  }
  if (["add", "sub", "mul", "min", "max"].indexOf(op) !== -1) {
    const values = numericArgs(raw, state, depth);
    if (!values) return null;
    if (op === "add") return values.reduce((a, b) => a + b, 0);
    if (op === "sub") return values.slice(1).reduce((a, b) => a - b, values[0]);
    if (op === "mul") return values.reduce((a, b) => a * b, 1);
    return op === "min" ? Math.min(...values) : Math.max(...values);
  }
  if (op === "sumFields") {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.keys)) return null;
    const values = raw.keys.map((key) => readAnswer(`${raw.field}.${key}`, ctx));
    return values.every(isFiniteNumber) ? values.reduce((a, b) => a + b, 0) : null;
  }
  if (op === "count") {
    const value = evalNode(raw, state, depth + 1);
    return Array.isArray(value) ? value.length : 0;
  }
  if (op === "countSelected") {
    if (!raw || typeof raw !== "object") return 0;
    const value = readAnswer(raw.field, ctx);
    if (value == null) return null;
    if (!Array.isArray(value)) return 0;
    const except = Array.isArray(raw.except) ? raw.except : [];
    return value.filter((item) => except.indexOf(item) === -1).length;
  }
  if (op === "bucket") {
    if (!raw || typeof raw !== "object") return null;
    const value = evalNode(raw.value, state, depth + 1);
    if (value == null) return null;
    if (!isFiniteNumber(value) || !Array.isArray(raw.cuts)) return raw.else ?? null;
    for (const cut of raw.cuts) {
      if (!cut || typeof cut !== "object") continue;
      if (own(cut, "lte") && value <= cut.lte) return cut.then;
      if (own(cut, "lt") && value < cut.lt) return cut.then;
      if (own(cut, "gte") && value >= cut.gte) return cut.then;
      if (own(cut, "gt") && value > cut.gt) return cut.then;
    }
    return raw.else ?? null;
  }
  if (op === "coalesce") {
    if (!Array.isArray(raw)) return null;
    for (const item of raw) {
      const value = evalNode(item, state, depth + 1);
      if (value != null) return value;
    }
    return null;
  }
  return false;
}

export function evalExpr(expr, ctx = {}) {
  const state = { ctx, nodes: 0, limit: {} };
  try {
    return evalNode(expr, state, 1);
  } catch {
    return false;
  }
}

function derivedRefs(expr, out = new Set(), seen = new WeakSet()) {
  if (!expr || typeof expr !== "object" || seen.has(expr)) return out;
  seen.add(expr);
  if (!Array.isArray(expr) && Object.keys(expr).length === 1 && own(expr, "derived")) {
    if (typeof expr.derived === "string") out.add(expr.derived);
  } else {
    for (const value of Array.isArray(expr) ? expr : Object.values(expr)) {
      derivedRefs(value, out, seen);
    }
  }
  return out;
}

export function evalDerived(defs, answers, fieldIndex) {
  const source = Array.isArray(defs) ? defs : [];
  const byKey = new Map(source.map((def) => [def.key, def]));
  const remaining = new Set(byKey.keys());
  const derived = {};
  while (remaining.size) {
    let progressed = false;
    for (const key of Array.from(remaining)) {
      const refs = derivedRefs(byKey.get(key).expr);
      const blocked = Array.from(refs).some((ref) => remaining.has(ref));
      if (blocked) continue;
      derived[key] = evalExpr(byKey.get(key).expr, {
        answers: answers || {},
        derived,
        result: null,
        flags: {},
        fieldIndex: fieldIndex || {},
      });
      remaining.delete(key);
      progressed = true;
    }
    if (!progressed) {
      for (const key of remaining) derived[key] = null;
      break;
    }
  }
  return derived;
}
