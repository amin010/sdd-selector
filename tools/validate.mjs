import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OPERATORS } from "../src/expr.mjs";

const REQUIRED = [
  "meta", "settings", "frameworks", "sections", "questions",
  "derived", "baseRules", "overlays", "cautions",
];
const KINDS = new Set(["single", "multi", "number", "text", "ranked", "record"]);
const RESULT_KEYS = new Set(["baseFramework", "baseRule", "overlays"]);

function diagnostic(code, path, message, severity = "error", hint) {
  const out = { severity, code, path, message };
  if (hint) out.hint = hint;
  return out;
}

function object(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function slug(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function semver(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function isoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function addDuplicateChecks(items, key, code, path, diagnostics) {
  const seen = new Set();
  array(items).forEach((item, index) => {
    const value = object(item) ? item[key] : undefined;
    if (typeof value === "string" && seen.has(value)) {
      diagnostics.push(diagnostic(code, `${path}[${index}].${key}`, `Duplicate ${key} "${value}".`));
    }
    seen.add(value);
  });
}

function collectFields(pack, diagnostics) {
  const fields = new Map();
  const hashes = new Map();
  const sections = new Set(array(pack.sections).map((section) => section && section.id));

  function visit(field, path, recordDepth, parent) {
    if (!object(field)) {
      diagnostics.push(diagnostic("E-FIELD-011", path, "Field must be an object with a known kind."));
      return;
    }
    if (!KINDS.has(field.kind)) {
      diagnostics.push(diagnostic("E-FIELD-011", `${path}.kind`, `Unknown field kind "${field.kind}".`));
    }
    if (typeof field.id !== "string" || !field.id) {
      diagnostics.push(diagnostic("E-FIELD-010", `${path}.id`, "Field id is required."));
    } else if (!parent) {
      if (fields.has(field.id)) {
        diagnostics.push(diagnostic("E-FIELD-010", `${path}.id`, `Duplicate field id "${field.id}".`));
      } else {
        fields.set(field.id, { ...field, subfields: new Map() });
      }
    } else {
      parent.subfields.set(field.id, field);
    }

    const optionSeen = new Set();
    array(field.options).forEach((option, index) => {
      const value = option && option.value;
      if (optionSeen.has(value)) {
        diagnostics.push(diagnostic(
          "E-FIELD-012",
          `${path}.options[${index}].value`,
          `Duplicate option value "${value}".`,
        ));
      }
      optionSeen.add(value);
    });
    if (field.kind === "ranked" &&
        (!Number.isInteger(field.ranks) || field.ranks < 1 ||
         field.ranks > array(field.options).length)) {
      diagnostics.push(diagnostic(
        "E-FIELD-013",
        `${path}.ranks`,
        "Rank count must be positive and cannot exceed option count.",
      ));
    }
    if (field.kind === "text" &&
        (!Number.isInteger(field.maxLength) || field.maxLength < 1)) {
      diagnostics.push(diagnostic(
        "E-FIELD-015",
        `${path}.maxLength`,
        "Text fields require a positive maxLength.",
      ));
    }
    if (field.kind === "record") {
      if (recordDepth >= 1) {
        diagnostics.push(diagnostic(
          "E-FIELD-014",
          path,
          "Record fields may not contain another record.",
        ));
      }
      const root = parent || fields.get(field.id) || { subfields: new Map() };
      array(field.fields).forEach((child, index) => {
        visit(child, `${path}.fields[${index}]`, recordDepth + 1, root);
      });
    }
    if (field.hashKey != null) {
      if (typeof field.hashKey !== "string" ||
          !/^[A-Za-z0-9_-]{1,12}$/.test(field.hashKey) ||
          hashes.has(field.hashKey)) {
        diagnostics.push(diagnostic(
          "E-HASH-070",
          `${path}.hashKey`,
          "hashKey must be unique and match [A-Za-z0-9_-]{1,12}.",
        ));
      }
      hashes.set(field.hashKey, path);
    }
  }

  array(pack.questions).forEach((question, qi) => {
    const qPath = `questions[${qi}]`;
    if (!object(question) || !sections.has(question.section)) {
      diagnostics.push(diagnostic(
        "E-SECT-020",
        `${qPath}.section`,
        "Question references an undeclared section.",
      ));
    }
    array(question && question.fields).forEach((field, fi) => {
      visit(field, `${qPath}.fields[${fi}]`, 0, null);
    });
  });
  return fields;
}

function fieldRef(ref, fields) {
  if (typeof ref !== "string") return null;
  const [root, sub, ...rest] = ref.split(".");
  if (rest.length || !fields.has(root)) return null;
  if (!sub) return fields.get(root);
  const parent = fields.get(root);
  return parent.kind === "record" && parent.subfields.has(sub)
    ? parent.subfields.get(sub)
    : null;
}

function validateExpr(expr, path, context, diagnostics, depth = 1) {
  if (depth > 32) {
    diagnostics.push(diagnostic("E-EXPR-033", path, "Expression depth exceeds 32."));
    return;
  }
  if (expr == null || typeof expr !== "object") return;
  if (Array.isArray(expr)) {
    expr.forEach((item, index) => validateExpr(item, `${path}[${index}]`, context, diagnostics, depth + 1));
    return;
  }
  const keys = Object.keys(expr);
  if (keys.length !== 1) {
    diagnostics.push(diagnostic("E-EXPR-030", path, "Operator nodes must have exactly one key."));
    return;
  }
  const op = keys[0];
  const raw = expr[op];
  if (!OPERATORS.has(op)) {
    diagnostics.push(diagnostic("E-EXPR-031", `${path}.${op}`, `Unknown operator "${op}".`));
    return;
  }
  const recurse = (value, suffix = "") =>
    validateExpr(value, `${path}.${op}${suffix}`, context, diagnostics, depth + 1);
  const wrong = (message) =>
    diagnostics.push(diagnostic("E-EXPR-032", `${path}.${op}`, message));

  if (op === "answer") {
    if (!fieldRef(raw, context.fields)) {
      diagnostics.push(diagnostic("E-REF-040", `${path}.answer`, `Unknown field reference "${raw}".`));
    }
    return;
  }
  if (op === "derived") {
    if (typeof raw !== "string" || !context.derived.has(raw)) {
      diagnostics.push(diagnostic("E-REF-041", `${path}.derived`, `Unknown derived reference "${raw}".`));
    }
    context.refs && context.refs.add(raw);
    return;
  }
  if (op === "result") {
    if (context.family !== "caution") {
      diagnostics.push(diagnostic("E-REF-043", `${path}.result`, "result is only available to cautions."));
    }
    if (!RESULT_KEYS.has(raw)) wrong("Unknown result property.");
    return;
  }
  if (op === "flag") {
    if (typeof raw !== "string" || !raw) wrong("flag requires a non-empty name.");
    return;
  }
  if (op === "rank" || op === "rankAtMost") {
    if (!object(raw) || typeof raw.field !== "string" || typeof raw.of !== "string" ||
        (op === "rankAtMost" && typeof raw.n !== "number")) {
      wrong(`${op} requires field, of${op === "rankAtMost" ? ", and n" : ""}.`);
      return;
    }
    const field = fieldRef(raw.field, context.fields);
    if (!field || field.kind !== "ranked") {
      diagnostics.push(diagnostic("E-REF-044", `${path}.${op}.field`, "Ranking requires a ranked field."));
    }
    return;
  }
  if (["all", "any", "coalesce"].includes(op)) {
    if (!Array.isArray(raw)) return wrong(`${op} requires a list.`);
    raw.forEach((item, index) => recurse(item, `[${index}]`));
    return;
  }
  if (["eq", "ne", "gt", "gte", "lt", "lte", "in", "hasAny", "hasAll", "hasNone"].includes(op)) {
    if (!Array.isArray(raw) || raw.length !== 2) return wrong(`${op} requires exactly two operands.`);
    raw.forEach((item, index) => recurse(item, `[${index}]`));
    return;
  }
  if (["add", "sub", "mul", "min", "max"].includes(op)) {
    if (!Array.isArray(raw) || raw.length < 2) return wrong(`${op} requires at least two operands.`);
    raw.forEach((item, index) => recurse(item, `[${index}]`));
    return;
  }
  if (op === "not" || op === "isSet" || op === "count") {
    recurse(raw);
    return;
  }
  if (op === "sumFields") {
    if (!object(raw) || typeof raw.field !== "string" || !Array.isArray(raw.keys)) {
      return wrong("sumFields requires field and keys.");
    }
    const field = fieldRef(raw.field, context.fields);
    if (!field || field.kind !== "record" ||
        raw.keys.some((key) => !field.subfields.has(key))) {
      diagnostics.push(diagnostic("E-REF-040", `${path}.sumFields.field`, "Unknown record field or key."));
    }
    return;
  }
  if (op === "countSelected") {
    if (!object(raw) || typeof raw.field !== "string") return wrong("countSelected requires field.");
    if (!fieldRef(raw.field, context.fields)) {
      diagnostics.push(diagnostic("E-REF-040", `${path}.countSelected.field`, "Unknown field reference."));
    }
    return;
  }
  if (op === "bucket") {
    if (!object(raw) || !Array.isArray(raw.cuts) || !Object.hasOwn(raw, "value")) {
      return wrong("bucket requires value, cuts, and optional else.");
    }
    recurse(raw.value, ".value");
    return;
  }
}

function checkDerived(pack, fields, diagnostics) {
  const defs = array(pack.derived);
  const names = new Set(defs.map((def) => def && def.key).filter((key) => typeof key === "string"));
  const graph = new Map();
  defs.forEach((def, index) => {
    if (!object(def) || typeof def.key !== "string") return;
    const refs = new Set();
    validateExpr(
      def.expr,
      `derived[${index}].expr`,
      { fields, derived: names, family: "derived", refs },
      diagnostics,
    );
    graph.set(def.key, refs);
  });
  const visiting = new Set();
  const visited = new Set();
  function walk(key, trail) {
    if (visiting.has(key)) {
      diagnostics.push(diagnostic(
        "E-REF-042",
        `derived[${trail.indexOf(key)}].expr`,
        `Cycle among derived definitions: ${[...trail, key].join(" -> ")}.`,
      ));
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const ref of graph.get(key) || []) if (graph.has(ref)) walk(ref, [...trail, key]);
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of graph.keys()) walk(key, []);
  return names;
}

function checkFrameworks(pack, diagnostics) {
  const frameworks = new Map();
  const statuses = new Map(array(pack.settings && pack.settings.statuses)
    .map((status) => [status && status.id, status]));
  const classes = new Set(array(pack.settings && pack.settings.enforcementClasses)
    .map((item) => item && item.id));
  const ratings = new Set(array(pack.settings && pack.settings.ratings)
    .map((item) => item && item.key));
  addDuplicateChecks(pack.frameworks, "id", "E-FW-050", "frameworks", diagnostics);
  array(pack.frameworks).forEach((framework, index) => {
    if (!object(framework) || typeof framework.id !== "string") return;
    frameworks.set(framework.id, framework);
    if (!statuses.has(framework.status) ||
        array(framework.enforcement).some((entry) => !classes.has(entry && entry.class)) ||
        Object.keys(object(framework.ratings) ? framework.ratings : {}).some((key) => !ratings.has(key))) {
      diagnostics.push(diagnostic("E-FW-052", `frameworks[${index}]`, "Unknown status, enforcement class, or rating key."));
    }
    if (!framework.evidence || !isoDate(framework.evidence.verifiedOn)) {
      diagnostics.push(diagnostic("E-FW-053", `frameworks[${index}].evidence.verifiedOn`, "A valid ISO evidence date is required."));
    }
  });
  const fallback = pack.settings && pack.settings.fallbackBase;
  const fallbackFw = frameworks.get(fallback);
  if (fallback != null &&
      (!fallbackFw || !statuses.get(fallbackFw.status) ||
       statuses.get(fallbackFw.status).selectableAsBase !== true)) {
    diagnostics.push(diagnostic("E-FW-054", "settings.fallbackBase", "Fallback must name a selectable framework."));
  }
  return { frameworks, statuses };
}

function checkRules(pack, fields, derived, fwData, diagnostics) {
  const rankedValues = new Set();
  for (const field of fields.values()) {
    if (field.kind === "ranked") for (const option of array(field.options)) rankedValues.add(option && option.value);
  }
  const allRules = [];
  for (const [familyKey, family] of [["baseRules", "base"], ["overlays", "overlay"], ["cautions", "caution"]]) {
    array(pack[familyKey]).forEach((rule, index) => {
      const path = `${familyKey}[${index}]`;
      allRules.push({ rule, path });
      if (!object(rule)) {
        diagnostics.push(diagnostic("E-RULE-061", path, "Rule must be an object."));
        return;
      }
      if ((family === "caution" && !object(rule.caution)) ||
          (family !== "caution" && !object(rule.adopt))) {
        diagnostics.push(diagnostic("E-RULE-061", path, "Rule is missing its caution or adopt block."));
      }
      validateExpr(rule.when, `${path}.when`, { fields, derived, family }, diagnostics);
      if (family !== "caution" && object(rule.adopt) && rule.adopt.framework != null) {
        const framework = fwData.frameworks.get(rule.adopt.framework);
        if (!framework) {
          diagnostics.push(diagnostic("E-FW-050", `${path}.adopt.framework`, "Rule adopts an unknown framework."));
        } else if (family === "base" &&
                   fwData.statuses.get(framework.status)?.selectableAsBase !== true) {
          diagnostics.push(diagnostic("E-FW-051", `${path}.adopt.framework`, "Base rule adopts a non-selectable framework."));
        }
      }
      array(rule.resolves).forEach((value, ri) => {
        if (!rankedValues.has(value)) {
          diagnostics.push(diagnostic("E-RULE-062", `${path}.resolves[${ri}]`, "Unknown ranked option."));
        }
      });
    });
  }
  addDuplicateChecks(allRules.map((item) => item.rule), "id", "E-RULE-060", "rules", diagnostics);
}

export function validatePack(input) {
  const diagnostics = [];
  try {
    let pack = input;
    if (typeof input === "string") {
      try {
        pack = JSON.parse(input);
      } catch (error) {
        return [diagnostic("E-PACK-002", "$", `Malformed JSON: ${error.message}`)];
      }
    }
    if (!object(pack)) return [diagnostic("E-PACK-002", "$", "Pack must be an object.")];
    if (pack.schema !== 1) {
      diagnostics.push(diagnostic("E-PACK-001", "schema", "Only pack schema 1 is supported."));
    }
    for (const key of REQUIRED) {
      if (!Object.hasOwn(pack, key)) {
        diagnostics.push(diagnostic("E-PACK-003", key, `Missing required top-level key "${key}".`));
      }
    }
    for (const key of ["frameworks", "sections", "questions", "derived", "baseRules", "overlays", "cautions"]) {
      if (Object.hasOwn(pack, key) && !Array.isArray(pack[key])) {
        diagnostics.push(diagnostic("E-PACK-002", key, `Top-level "${key}" must be an array.`));
      }
    }
    if (Object.hasOwn(pack, "settings") && !object(pack.settings)) {
      diagnostics.push(diagnostic("E-PACK-002", "settings", "Top-level \"settings\" must be an object."));
    }
    if (!object(pack.meta) || !slug(pack.meta.id) || !semver(pack.meta.version)) {
      diagnostics.push(diagnostic("E-META-004", "meta", "meta.id must be a slug and meta.version must be semver."));
    }
    addDuplicateChecks(pack.sections, "id", "E-SECT-020", "sections", diagnostics);
    const fields = collectFields(pack, diagnostics);
    const derived = checkDerived(pack, fields, diagnostics);
    const fwData = checkFrameworks(pack, diagnostics);
    checkRules(pack, fields, derived, fwData, diagnostics);
    return diagnostics;
  } catch (error) {
    diagnostics.push(diagnostic(
      "E-PACK-002",
      "$",
      `Validator recovered from malformed input: ${error && error.message ? error.message : String(error)}`,
    ));
    return diagnostics;
  }
}

function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error("usage: node tools/validate.mjs <pack.json>");
    process.exit(2);
  }
  let source;
  try {
    source = fs.readFileSync(path.resolve(filename), "utf8");
  } catch (error) {
    console.error(`E-PACK-002 $ ${error.message}`);
    process.exit(1);
  }
  const diagnostics = validatePack(source);
  for (const item of diagnostics) {
    console.log(`${item.severity} ${item.code} ${item.path}: ${item.message}`);
  }
  if (!diagnostics.some((item) => item.severity === "error")) console.log("ok");
  process.exit(diagnostics.some((item) => item.severity === "error") ? 1 : 0);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();
