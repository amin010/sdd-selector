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
    if (context.flagReads && typeof raw === "string" && raw) context.flagReads.add(raw);
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

function collectFieldClosure(expr, fields, derivedExprs, out, seenDerived = new Set()) {
  if (expr == null || typeof expr !== "object") return;
  if (Array.isArray(expr)) {
    expr.forEach((item) => collectFieldClosure(item, fields, derivedExprs, out, seenDerived));
    return;
  }
  const keys = Object.keys(expr);
  if (keys.length !== 1 || !OPERATORS.has(keys[0])) {
    for (const value of Object.values(expr)) {
      collectFieldClosure(value, fields, derivedExprs, out, seenDerived);
    }
    return;
  }
  const op = keys[0];
  const raw = expr[op];
  if (op === "answer" && typeof raw === "string") {
    const root = raw.split(".")[0];
    if (fields.has(root)) out.add(root);
    return;
  }
  if (op === "derived" && typeof raw === "string") {
    if (seenDerived.has(raw)) return;
    seenDerived.add(raw);
    const nested = derivedExprs.get(raw);
    if (nested) collectFieldClosure(nested, fields, derivedExprs, out, seenDerived);
    return;
  }
  if (op === "rank" || op === "rankAtMost") {
    if (object(raw) && typeof raw.field === "string" && fields.has(raw.field)) out.add(raw.field);
    return;
  }
  if (op === "sumFields" || op === "countSelected") {
    if (object(raw) && typeof raw.field === "string" && fields.has(raw.field)) out.add(raw.field);
    if (op === "sumFields") return;
  }
  if (op === "bucket" && object(raw)) {
    collectFieldClosure(raw.value, fields, derivedExprs, out, seenDerived);
    return;
  }
  if (Array.isArray(raw)) {
    raw.forEach((item) => collectFieldClosure(item, fields, derivedExprs, out, seenDerived));
    return;
  }
  collectFieldClosure(raw, fields, derivedExprs, out, seenDerived);
}

function checkRules(pack, fields, derived, fwData, diagnostics) {
  const rankedValues = new Set();
  for (const field of fields.values()) {
    if (field.kind === "ranked") for (const option of array(field.options)) rankedValues.add(option && option.value);
  }
  const derivedExprs = new Map();
  array(pack.derived).forEach((def) => {
    if (object(def) && typeof def.key === "string") derivedExprs.set(def.key, def.expr);
  });
  const flagSets = new Set();
  const flagReads = new Set();
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
      const exprCtx = { fields, derived, family, flagReads };
      validateExpr(rule.when, `${path}.when`, exprCtx, diagnostics);
      const computed = new Set();
      collectFieldClosure(rule.when, fields, derivedExprs, computed);
      if (family === "base" && rule.signals != null) {
        if (!Array.isArray(rule.signals)) {
          diagnostics.push(diagnostic("E-RULE-061", `${path}.signals`, "signals must be an array."));
        } else {
          rule.signals.forEach((sig, si) => {
            const sPath = `${path}.signals[${si}]`;
            if (!object(sig)) {
              diagnostics.push(diagnostic("E-RULE-061", sPath, "Each signal must be an object."));
              return;
            }
            if (typeof sig.weight !== "number" || !Number.isFinite(sig.weight)) {
              diagnostics.push(diagnostic("E-RULE-061", `${sPath}.weight`, "Signal weight must be a finite number."));
            }
            if (sig.when == null) {
              diagnostics.push(diagnostic("E-RULE-061", `${sPath}.when`, "Signal needs a when expression."));
            } else {
              validateExpr(sig.when, `${sPath}.when`, exprCtx, diagnostics);
              collectFieldClosure(sig.when, fields, derivedExprs, computed);
            }
          });
        }
      }
      array(rule.adoptWhen).forEach((branch, bi) => {
        const bPath = `${path}.adoptWhen[${bi}]`;
        if (!object(branch)) {
          diagnostics.push(diagnostic("E-RULE-061", bPath, "adoptWhen branch must be an object."));
          return;
        }
        validateExpr(branch.when, `${bPath}.when`, exprCtx, diagnostics);
        collectFieldClosure(branch.when, fields, derivedExprs, computed);
        array(branch.setFlags).forEach((name) => {
          if (typeof name === "string" && name) flagSets.add(name);
        });
        if (branch.framework != null) {
          const framework = fwData.frameworks.get(branch.framework);
          if (!framework) {
            diagnostics.push(diagnostic("E-FW-050", `${bPath}.framework`, "Rule adopts an unknown framework."));
          } else if (family === "base" &&
                     fwData.statuses.get(framework.status)?.selectableAsBase !== true) {
            diagnostics.push(diagnostic("E-FW-051", `${bPath}.framework`, "Base rule adopts a non-selectable framework."));
          }
        }
        if (object(branch.ifUnavailable)) {
          array(branch.ifUnavailable.setFlags).forEach((name) => {
            if (typeof name === "string" && name) flagSets.add(name);
          });
          if (branch.ifUnavailable.framework != null &&
              !fwData.frameworks.has(branch.ifUnavailable.framework)) {
            diagnostics.push(diagnostic(
              "E-FW-050",
              `${bPath}.ifUnavailable.framework`,
              "Rule adopts an unknown framework.",
            ));
          }
        }
      });
      array(rule.notes).forEach((note, ni) => {
        const nPath = `${path}.notes[${ni}]`;
        if (!object(note) || typeof note.text !== "string") {
          diagnostics.push(diagnostic("E-RULE-061", nPath, "notes entries need when and text."));
          return;
        }
        if (note.when != null) validateExpr(note.when, `${nPath}.when`, exprCtx, diagnostics);
      });
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
      if (Object.hasOwn(rule, "requires")) {
        const declared = array(rule.requires).filter((id) => typeof id === "string").slice().sort();
        const computedList = [...computed].sort();
        if (declared.join("\0") !== computedList.join("\0")) {
          diagnostics.push(diagnostic(
            "W-RULE-102",
            `${path}.requires`,
            `Declared requires [${declared.join(", ")}] differs from computed closure [${computedList.join(", ")}].`,
            "warning",
          ));
        }
      }
    });
  }
  for (const name of flagSets) {
    if (!flagReads.has(name)) {
      diagnostics.push(diagnostic(
        "W-FLAG-101",
        "flags",
        `Flag "${name}" is set but never read.`,
        "warning",
      ));
    }
  }
  for (const name of flagReads) {
    if (!flagSets.has(name)) {
      diagnostics.push(diagnostic(
        "W-FLAG-101",
        "flags",
        `Flag "${name}" is read but never set.`,
        "warning",
      ));
    }
  }
  addDuplicateChecks(allRules.map((item) => item.rule), "id", "E-RULE-060", "rules", diagnostics);
}

function checkReport(pack, fields, diagnostics) {
  if (!Object.hasOwn(pack, "report")) return;
  if (!object(pack.report)) {
    diagnostics.push(diagnostic("E-PACK-002", "report", "report must be an object."));
    return;
  }
  array(pack.report.profileFields).forEach((entry, index) => {
    const path = `report.profileFields[${index}]`;
    if (!object(entry)) {
      diagnostics.push(diagnostic("E-PACK-002", path, "profileFields entries must be objects."));
      return;
    }
    const ids = [];
    if (typeof entry.field === "string") ids.push(entry.field);
    array(entry.fields).forEach((id) => ids.push(id));
    ids.forEach((id) => {
      if (!fields.has(id)) {
        diagnostics.push(diagnostic("E-REF-040", path, `Unknown profile field "${id}".`));
      }
    });
  });
  array(pack.report.freeTextFields).forEach((id, index) => {
    if (!fields.has(id)) {
      diagnostics.push(diagnostic(
        "E-REF-040",
        `report.freeTextFields[${index}]`,
        `Unknown free-text field "${id}".`,
      ));
    }
  });
}

/**
 * Coverage used by --report and W-FIELD-103 / W-FW-104.
 * A field is "read" if a rule expression closes over it, or if settings.tierZero
 * names it as the runtime filter field. reportOnly fields are omitted from the
 * unread list (they are intentionally unused by rules).
 */
export function coverageReport(pack) {
  const diagnostics = [];
  const fields = collectFields(pack, diagnostics);
  const derivedExprs = new Map();
  array(pack.derived).forEach((def) => {
    if (object(def) && typeof def.key === "string") derivedExprs.set(def.key, def.expr);
  });

  const fieldsRead = new Set();
  const frameworksSelected = new Set();
  const optionsMentioned = new Set();

  function walkOptions(expr) {
    if (expr == null || typeof expr !== "object") return;
    if (Array.isArray(expr)) {
      expr.forEach(walkOptions);
      return;
    }
    const keys = Object.keys(expr);
    if (keys.length === 1 && OPERATORS.has(keys[0])) {
      const op = keys[0];
      const raw = expr[op];
      if (op === "eq" || op === "ne" || op === "in") {
        const vals = Array.isArray(raw) ? raw.slice(1) : [];
        for (const v of vals) {
          if (typeof v === "string") optionsMentioned.add(v);
          else if (Array.isArray(v)) v.forEach((item) => {
            if (typeof item === "string") optionsMentioned.add(item);
          });
        }
      }
      if (op === "hasAny" || op === "hasAll" || op === "hasNone") {
        const list = Array.isArray(raw) && Array.isArray(raw[1]) ? raw[1] : [];
        list.forEach((item) => {
          if (typeof item === "string") optionsMentioned.add(item);
        });
      }
      if (op === "rankAtMost" && object(raw) && typeof raw.of === "string") {
        optionsMentioned.add(raw.of);
      }
      if (op === "countSelected" && object(raw)) {
        array(raw.except).forEach((item) => {
          if (typeof item === "string") optionsMentioned.add(item);
        });
      }
      if (op === "sumFields" && object(raw)) {
        array(raw.keys).forEach((item) => {
          if (typeof item === "string") optionsMentioned.add(item);
        });
      }
      if (Array.isArray(raw)) raw.forEach(walkOptions);
      else walkOptions(raw);
      return;
    }
    Object.values(expr).forEach(walkOptions);
  }

  function noteFramework(id) {
    if (typeof id === "string" && id) frameworksSelected.add(id);
  }

  for (const familyKey of ["baseRules", "overlays", "cautions"]) {
    array(pack[familyKey]).forEach((rule) => {
      if (!object(rule)) return;
      collectFieldClosure(rule.when, fields, derivedExprs, fieldsRead);
      walkOptions(rule.when);
      array(rule.signals).forEach((sig) => {
        if (!object(sig)) return;
        collectFieldClosure(sig.when, fields, derivedExprs, fieldsRead);
        walkOptions(sig.when);
      });
      array(rule.adoptWhen).forEach((branch) => {
        if (!object(branch)) return;
        collectFieldClosure(branch.when, fields, derivedExprs, fieldsRead);
        walkOptions(branch.when);
        noteFramework(branch.framework);
        if (object(branch.ifUnavailable)) noteFramework(branch.ifUnavailable.framework);
      });
      array(rule.notes).forEach((note) => {
        if (object(note) && note.when != null) {
          collectFieldClosure(note.when, fields, derivedExprs, fieldsRead);
          walkOptions(note.when);
        }
      });
      if (object(rule.adopt)) noteFramework(rule.adopt.framework);
      array(rule.providedByBase).forEach(noteFramework);
    });
  }

  for (const expr of derivedExprs.values()) walkOptions(expr);

  const tierRuntime = pack.settings && pack.settings.tierZero &&
    pack.settings.tierZero.runtimeField;
  if (typeof tierRuntime === "string" && fields.has(tierRuntime)) {
    fieldsRead.add(tierRuntime);
  }
  array(pack.settings && pack.settings.tierZero && pack.settings.tierZero.unsureValues)
    .forEach((value) => { if (typeof value === "string") optionsMentioned.add(value); });
  noteFramework(pack.settings && pack.settings.fallbackBase);

  const unreadFields = [];
  for (const [id, field] of fields) {
    const question = array(pack.questions).find((q) =>
      array(q && q.fields).some((f) => f && f.id === id));
    const reportOnly = !!(question && question.reportOnly) || !!field.reportOnly;
    if (!fieldsRead.has(id) && !reportOnly) unreadFields.push(id);
  }

  const statuses = new Map(array(pack.settings && pack.settings.statuses)
    .map((status) => [status && status.id, status]));
  const unselectedFrameworks = array(pack.frameworks)
    .map((fw) => fw && fw.id)
    .filter((id) => {
      if (typeof id !== "string" || frameworksSelected.has(id)) return false;
      const fw = array(pack.frameworks).find((item) => item && item.id === id);
      const status = fw && statuses.get(fw.status);
      // Watch / non-selectable frameworks are intentionally out of base selection.
      if (status && status.selectableAsBase === false) return false;
      return true;
    });

  const unreadOptions = [];
  for (const field of fields.values()) {
    array(field.options).forEach((opt) => {
      if (opt && typeof opt.value === "string" && !optionsMentioned.has(opt.value)) {
        unreadOptions.push(`${field.id}:${opt.value}`);
      }
    });
  }

  return {
    fieldsRead: [...fieldsRead].sort(),
    unreadFields: unreadFields.sort(),
    frameworksSelected: [...frameworksSelected].sort(),
    unselectedFrameworks: unselectedFrameworks.sort(),
    optionsMentioned: [...optionsMentioned].sort(),
    unreadOptions: unreadOptions.sort(),
  };
}

function emitCoverageWarnings(pack, diagnostics) {
  const report = coverageReport(pack);
  for (const id of report.unreadFields) {
    diagnostics.push(diagnostic(
      "W-FIELD-103",
      `fields.${id}`,
      `Field "${id}" is read by no rule — likely reportOnly was forgotten.`,
      "warning",
      "Mark the question reportOnly: true, or wire a rule that reads it.",
    ));
  }
  for (const id of report.unselectedFrameworks) {
    diagnostics.push(diagnostic(
      "W-FW-104",
      `frameworks.${id}`,
      `Framework "${id}" is referenced by no rule.`,
      "warning",
      "Add a base or overlay adopt that selects it, or remove it from the pack.",
    ));
  }
}

function checkFixtures(pack, fields, fwData, diagnostics) {
  if (!Object.hasOwn(pack, "fixtures")) return;
  if (!Array.isArray(pack.fixtures)) {
    diagnostics.push(diagnostic("E-PACK-002", "fixtures", "fixtures must be an array."));
    return;
  }
  const names = new Set();
  array(pack.fixtures).forEach((fx, index) => {
    const path = `fixtures[${index}]`;
    if (!object(fx) || typeof fx.name !== "string" || !fx.name) {
      diagnostics.push(diagnostic("E-PACK-002", `${path}.name`, "Fixture requires a name."));
      return;
    }
    if (names.has(fx.name)) {
      diagnostics.push(diagnostic("E-PACK-002", `${path}.name`, `Duplicate fixture name "${fx.name}".`));
    }
    names.add(fx.name);
    if (!object(fx.answers)) {
      diagnostics.push(diagnostic("E-PACK-002", `${path}.answers`, "Fixture answers must be an object."));
    } else {
      for (const key of Object.keys(fx.answers)) {
        if (!fields.has(key)) {
          diagnostics.push(diagnostic("E-REF-040", `${path}.answers.${key}`, `Unknown answer field "${key}".`));
        }
      }
    }
    if (!object(fx.expect)) {
      diagnostics.push(diagnostic("E-PACK-002", `${path}.expect`, "Fixture expect must be an object."));
      return;
    }
    if (Object.hasOwn(fx.expect, "base") && fx.expect.base != null &&
        !fwData.frameworks.has(fx.expect.base)) {
      diagnostics.push(diagnostic("E-FW-050", `${path}.expect.base`, "Unknown expected base framework."));
    }
    for (const key of ["overlays", "overlaysIncludedInBase", "cautions", "couldChangeResult"]) {
      if (Object.hasOwn(fx.expect, key) && !Array.isArray(fx.expect[key])) {
        diagnostics.push(diagnostic("E-PACK-002", `${path}.expect.${key}`, `${key} must be an array.`));
      }
    }
  });
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
    if (object(pack.settings) && pack.settings.selection != null &&
        pack.settings.selection !== "first-match" && pack.settings.selection !== "weighted") {
      diagnostics.push(diagnostic("E-PACK-002", "settings.selection", "settings.selection must be \"first-match\" or \"weighted\"."));
    }
    if (object(pack.settings) && object(pack.settings.tierZero) && pack.settings.tierZero.mode != null &&
        pack.settings.tierZero.mode !== "hard" && pack.settings.tierZero.mode !== "soft") {
      diagnostics.push(diagnostic("E-PACK-002", "settings.tierZero.mode", "tierZero.mode must be \"hard\" or \"soft\"."));
    }
    if (!object(pack.meta) || !slug(pack.meta.id) || !semver(pack.meta.version)) {
      diagnostics.push(diagnostic("E-META-004", "meta", "meta.id must be a slug and meta.version must be semver."));
    }
    addDuplicateChecks(pack.sections, "id", "E-SECT-020", "sections", diagnostics);
    const fields = collectFields(pack, diagnostics);
    const derived = checkDerived(pack, fields, diagnostics);
    const fwData = checkFrameworks(pack, diagnostics);
    checkRules(pack, fields, derived, fwData, diagnostics);
    emitCoverageWarnings(pack, diagnostics);
    checkReport(pack, fields, diagnostics);
    checkFixtures(pack, fields, fwData, diagnostics);
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

function parseArgs(argv) {
  let report = false;
  let filename = null;
  for (const arg of argv) {
    if (arg === "--report") report = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("usage: node tools/validate.mjs [--report] <pack.json>");
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      filename = arg;
    }
  }
  return { report, filename };
}

function printCoverage(pack) {
  const cov = coverageReport(pack);
  console.log("\n--- coverage report ---");
  console.log(`fields read by rules (${cov.fieldsRead.length}): ${cov.fieldsRead.join(", ") || "(none)"}`);
  console.log(`fields no rule reads (${cov.unreadFields.length}): ${cov.unreadFields.join(", ") || "(none)"}`);
  console.log(`frameworks selectable (${cov.frameworksSelected.length}): ${cov.frameworksSelected.join(", ") || "(none)"}`);
  console.log(`frameworks no rule can select (${cov.unselectedFrameworks.length}): ${cov.unselectedFrameworks.join(", ") || "(none)"}`);
  if (cov.unreadOptions.length) {
    console.log(`option values never appearing in a predicate (${cov.unreadOptions.length}):`);
    for (const item of cov.unreadOptions) console.log(`  ${item}`);
  } else {
    console.log("option values never appearing in a predicate: (none)");
  }
  console.log("--- end coverage ---\n");
}

function main() {
  const { report, filename } = parseArgs(process.argv.slice(2));
  if (!filename) {
    console.error("usage: node tools/validate.mjs [--report] <pack.json>");
    process.exit(2);
  }
  let source;
  try {
    source = fs.readFileSync(path.resolve(filename), "utf8");
  } catch (error) {
    console.error(`E-PACK-002 $ ${error.message}`);
    process.exit(1);
  }
  let pack;
  try {
    pack = JSON.parse(source);
  } catch (error) {
    console.error(`E-PACK-002 $ Malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const diagnostics = validatePack(pack);
  for (const item of diagnostics) {
    console.log(`${item.severity} ${item.code} ${item.path}: ${item.message}`);
  }
  if (report) printCoverage(pack);
  if (!diagnostics.some((item) => item.severity === "error")) console.log("ok");
  process.exit(diagnostics.some((item) => item.severity === "error") ? 1 : 0);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();
