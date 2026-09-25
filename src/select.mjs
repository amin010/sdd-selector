/**
 * Practice-selection engine (EXT-SELECT / DESIGN-EXT-SELECTION.md §5).
 *
 * Framework-agnostic utility over a shared axis vocabulary. A framework is a
 * pre-bundled set of practices plus an adoption cost. Feasibility is a veto.
 * No pack field ids or framework ids are hard-coded here.
 */

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function own(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

export function ramp(value, q, p) {
  if (!isFiniteNumber(value)) return 0;
  const lo = isFiniteNumber(q) ? q : 0;
  const hi = isFiniteNumber(p) ? p : 1;
  if (hi <= lo) return value >= hi ? 1 : 0;
  if (value <= lo) return 0;
  if (value >= hi) return 1;
  return (value - lo) / (hi - lo);
}

export function clamp01(value) {
  if (!isFiniteNumber(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function resolveRead(path, answers, derived) {
  if (typeof path !== "string" || !path) return null;
  if (path.indexOf("derived.") === 0) {
    const key = path.slice("derived.".length);
    return derived && own(derived, key) ? derived[key] : null;
  }
  const dot = path.indexOf(".");
  if (dot === -1) return answers && own(answers, path) ? answers[path] : null;
  const root = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  const rec = answers && answers[root];
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return null;
  return own(rec, rest) ? rec[rest] : null;
}

function termValue(term, answers, derived) {
  const reads = term.reads || [];
  let raw = null;
  for (let i = 0; i < reads.length; i++) {
    const got = resolveRead(reads[i], answers, derived);
    if (got != null) {
      raw = got;
      break;
    }
  }
  if (term.map && raw != null && typeof raw !== "object") {
    if (own(term.map, raw)) raw = term.map[raw];
    else if (isFiniteNumber(raw)) {
      /* keep numeric */
    } else raw = null;
  }
  if (term.scale != null && isFiniteNumber(raw) && isFiniteNumber(term.scale)) {
    raw = raw * term.scale;
  }
  if (term.transform === "logRatio" && term.partner != null) {
    const partner = resolveRead(term.partner, answers, derived);
    const eps = 1;
    const a = isFiniteNumber(raw) ? raw : 0;
    const b = isFiniteNumber(partner) ? partner : 0;
    raw = Math.log((a + eps) / (b + eps));
  }
  return raw;
}

export function evalDemandTerm(term, answers, derived) {
  if (!term || typeof term !== "object") return 0;
  const raw = termValue(term, answers, derived);
  if (term.q != null || term.p != null) return ramp(raw, term.q, term.p);
  if (isFiniteNumber(raw)) return clamp01(raw);
  return 0;
}

export function demandVector(axes, answers, derived, scopes, evalExpr, ctx) {
  const demand = {};
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    const spec = axis.demand || {};
    const terms = Array.isArray(spec.terms) ? spec.terms : [spec];
    const combine = spec.combine || "max";
    const values = terms.map((term) => evalDemandTerm(term, answers, derived));
    let d = 0;
    if (combine === "sum") {
      d = values.reduce((a, b) => a + b, 0);
    } else if (combine === "mean") {
      d = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    } else {
      d = values.reduce((a, b) => (b > a ? b : a), 0);
    }
    demand[axis.id] = clamp01(d);
  }
  if (Array.isArray(scopes) && typeof evalExpr === "function") {
    for (let s = 0; s < scopes.length; s++) {
      const scope = scopes[s];
      if (!scope || !scope.when) continue;
      if (evalExpr(scope.when, ctx) !== true) continue;
      const zeros = scope.zero || [];
      for (let z = 0; z < zeros.length; z++) demand[zeros[z]] = 0;
    }
  }
  return demand;
}

export function fieldsReadByPack(pack) {
  const ids = {};
  const axes = (pack && pack.axes) || [];
  for (let i = 0; i < axes.length; i++) {
    const spec = axes[i].demand || {};
    const terms = Array.isArray(spec.terms) ? spec.terms : [spec];
    for (let t = 0; t < terms.length; t++) {
      const extra = terms[t].fields || [];
      for (let f = 0; f < extra.length; f++) ids[extra[f]] = 1;
      const reads = terms[t].reads || [];
      for (let r = 0; r < reads.length; r++) {
        const path = reads[r];
        if (typeof path !== "string" || path.indexOf("derived.") === 0) continue;
        ids[path.split(".")[0]] = 1;
      }
    }
  }
  return Object.keys(ids);
}

function kappaOf(enforcement, kappa) {
  const table = kappa || {};
  const cls = enforcement || "advisory";
  if (isFiniteNumber(table[cls])) return table[cls];
  if (cls === "hard_gate") return 1;
  if (cls === "agent_gate") return 0.67;
  if (cls === "human_gate") return 0.5;
  return 0.33;
}

function practiceList(ids, byId) {
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const p = byId[ids[i]];
    if (p) out.push(p);
  }
  return out;
}

export function backstop(set, axisId) {
  let best = 0;
  for (let i = 0; i < set.length; i++) {
    const p = set[i];
    const cls = (p.enforcement && p.enforcement[axisId]) || "advisory";
    if (cls === "hard_gate") {
      const cap = (p.capability && p.capability[axisId]) || 0;
      if (cap > best) best = cap;
    }
  }
  return best;
}

export function kappaEff(practice, axisId, set, kappa, gamma) {
  const base = kappaOf(practice.enforcement && practice.enforcement[axisId], kappa);
  const bonus = (isFiniteNumber(gamma) ? gamma : 0) * backstop(set, axisId);
  return Math.min(1, base + bonus);
}

export function coverageOf(set, axisId, kappa, gamma) {
  let best = 0;
  for (let i = 0; i < set.length; i++) {
    const p = set[i];
    const cap = (p.capability && p.capability[axisId]) || 0;
    const cov = cap * kappaEff(p, axisId, set, kappa, gamma);
    if (cov > best) best = cov;
  }
  return clamp01(best);
}

function bundleCost(set, framework, mu) {
  const m = mu || {};
  let ceremony = (framework && framework.cost && framework.cost.ceremony) || 0;
  let tokens = (framework && framework.cost && framework.cost.tokens) || 0;
  for (let i = 0; i < set.length; i++) {
    const c = set[i].cost || {};
    ceremony += c.ceremony || 0;
    tokens += c.tokens || 0;
  }
  return (m.ceremony || 0) * ceremony + (m.tokens || 0) * tokens + (m.adoption || 0) * ((framework && framework.cost && framework.cost.adoption) || 0);
}

export function utilityOf(framework, set, axes, demand, params) {
  const theta = (params && params.theta) || {};
  const lambda = (params && params.lambda) || {};
  const kappa = (params && params.kappa) || {};
  const gamma = params && params.gamma;
  let u = 0;
  const contrib = {};
  for (let i = 0; i < axes.length; i++) {
    const id = axes[i].id;
    const d = demand[id] || 0;
    const cov = coverageOf(set, id, kappa, gamma);
    const unmet = (theta[id] || 0) * d * (1 - cov);
    const extra = (lambda[id] || 0) * (1 - d) * cov;
    const axisU = -(unmet + extra);
    contrib[id] = { demand: d, coverage: cov, unmet: unmet, extra: extra, u: axisU };
    u += axisU;
  }
  const cost = bundleCost(set, framework, params && params.mu);
  u -= cost;
  return { u: u, cost: cost, contrib: contrib };
}

function binom(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= n - (k - i);
    den *= i;
  }
  return num / den;
}

function combinations(items, k) {
  const out = [];
  function rec(start, acc) {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  }
  rec(0, []);
  return out;
}

function setHas(ids, id) {
  for (let i = 0; i < ids.length; i++) if (ids[i] === id) return true;
  return false;
}

function eligibleAdded(practice, frameworkId) {
  if (practice.liftable) return true;
  const sources = practice.sources || [];
  return sources.indexOf(frameworkId) !== -1;
}

function respectsGraph(ids, byId) {
  for (let i = 0; i < ids.length; i++) {
    const p = byId[ids[i]];
    if (!p) return false;
    const req = p.requires || [];
    for (let r = 0; r < req.length; r++) {
      if (!setHas(ids, req[r])) return false;
    }
    const exc = p.excludes || [];
    for (let e = 0; e < exc.length; e++) {
      if (setHas(ids, exc[e])) return false;
    }
  }
  return true;
}

function practiceAvailable(practice, answers, derived, evalExpr, fieldIndex) {
  if (!practice.requiresWhen) return true;
  if (typeof evalExpr !== "function") return true;
  return evalExpr(practice.requiresWhen, {
    answers: answers || {},
    derived: derived || {},
    result: null,
    flags: {},
    fieldIndex: fieldIndex || {},
  }) === true;
}

export function feasibleFrameworks(frameworks, answers, settings) {
  const tz = (settings && settings.tierZero) || {};
  const runtimeField = tz.runtimeField;
  const runtimeKey = tz.frameworkKey || "runtimes";
  const unsure = tz.unsureValues || [];
  const raw = runtimeField && Array.isArray(answers[runtimeField]) ? answers[runtimeField] : [];
  const selected = raw.filter((r) => unsure.indexOf(r) === -1);
  const exclude = tz.excludeStatusesFromBase || [];
  const feasible = [];
  const excluded = [];
  const list = Array.isArray(frameworks) ? frameworks : Object.keys(frameworks || {}).map((id) => frameworks[id]);
  for (let i = 0; i < list.length; i++) {
    const fw = list[i];
    if (!fw) continue;
    if (exclude.indexOf(fw.status) !== -1) {
      excluded.push({ id: fw.id, reason: "status" });
      continue;
    }
    const documented = fw[runtimeKey] || [];
    if (selected.length && documented.length && !selected.some((r) => documented.indexOf(r) !== -1)) {
      excluded.push({ id: fw.id, reason: "runtime" });
      continue;
    }
    feasible.push(fw);
  }
  return { feasible: feasible, excluded: excluded, selectedRuntimes: selected };
}

function nativeBundle(framework, byId, answers, derived, evalExpr, fieldIndex) {
  const ids = (framework.bundle || []).filter((id) => {
    const p = byId[id];
    if (!p) return false;
    return practiceAvailable(p, answers, derived, evalExpr, fieldIndex);
  });
  return ids;
}

function enumerateForFramework(framework, practices, byId, axes, demand, params, k, answers, derived, evalExpr, fieldIndex) {
  const native = nativeBundle(framework, byId, answers, derived, evalExpr, fieldIndex);
  const candidates = [];
  for (let i = 0; i < practices.length; i++) {
    const p = practices[i];
    if (native.indexOf(p.id) !== -1) continue;
    if (!eligibleAdded(p, framework.id)) continue;
    if (!practiceAvailable(p, answers, derived, evalExpr, fieldIndex)) continue;
    candidates.push(p.id);
  }
  const cap = isFiniteNumber(k) ? k : 5;
  const maxSize = Math.min(cap, candidates.length);
  const exactCap = 2;
  const rows = [];
  function pushSet(added) {
    const all = native.concat(added);
    if (!respectsGraph(all, byId)) return null;
    const set = practiceList(all, byId);
    const scored = utilityOf(framework, set, axes, demand, params);
    const row = {
      frameworkId: framework.id,
      added: added,
      native: native,
      setIds: all,
      u: scored.u,
      cost: scored.cost,
      contrib: scored.contrib,
    };
    rows.push(row);
    return row;
  }
  for (let size = 0; size <= Math.min(exactCap, maxSize); size++) {
    const combos = size === 0 ? [[]] : combinations(candidates, size);
    for (let c = 0; c < combos.length; c++) pushSet(combos[c]);
  }
  if (maxSize > exactCap) {
    const seed = rows.slice().sort((a, b) => b.u - a.u)[0];
    const added = seed && seed.added ? seed.added.slice() : [];
    const remaining = candidates.filter((id) => added.indexOf(id) === -1);
    while (added.length < maxSize && remaining.length) {
      let bestId = null;
      let bestU = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const trial = added.concat([remaining[i]]);
        const all = native.concat(trial);
        if (!respectsGraph(all, byId)) continue;
        const u = utilityOf(framework, practiceList(all, byId), axes, demand, params).u;
        if (u > bestU) {
          bestU = u;
          bestId = remaining[i];
        }
      }
      if (bestId == null) break;
      added.push(bestId);
      remaining.splice(remaining.indexOf(bestId), 1);
      pushSet(added.slice());
    }
  }
  rows.sort((a, b) => b.u - a.u);
  return rows;
}

function softmax(values) {
  if (!values.length) return [];
  let max = values[0];
  for (let i = 1; i < values.length; i++) if (values[i] > max) max = values[i];
  const exps = values.map((v) => Math.exp(v - max));
  let sum = 0;
  for (let i = 0; i < exps.length; i++) sum += exps[i];
  return exps.map((e) => e / sum);
}

function scaleParams(params, axisId, factor) {
  const next = {
    theta: { ...(params.theta || {}) },
    lambda: { ...(params.lambda || {}) },
    mu: { ...(params.mu || {}) },
    kappa: params.kappa,
    gamma: params.gamma,
  };
  if (own(next.theta, axisId)) next.theta[axisId] = next.theta[axisId] * factor;
  return next;
}

function attributeRisks(framework, catalog) {
  const ev = (framework && framework.evidence) || {};
  const fired = [];
  for (let i = 0; i < catalog.length; i++) {
    const rule = catalog[i];
    const spec = rule.derivedFrom;
    if (!spec || spec.condition !== "attribute_risk") continue;
    if (spec.harness && spec.harness !== framework.id) continue;
    const evSpec = spec.evidence || {};
    let hit = false;
    if (evSpec.zeroCommits && (ev.commitsLast30d === 0 || ev.commitsLast30d === "unknown")) hit = true;
    if (evSpec.nonMitLicense && ev.license && ev.license !== "MIT") hit = true;
    if (evSpec.any) hit = true;
    if (hit) fired.push(rule);
  }
  return fired;
}

export function deriveCautions(opts) {
  const demand = opts.demand;
  const contrib = opts.contrib || {};
  const set = opts.set || [];
  const framework = opts.framework;
  const catalog = opts.catalog || [];
  const params = opts.params || {};
  const axes = opts.axes || [];
  const kappa = params.kappa || {};
  const gamma = params.gamma;
  const fired = [];
  const setIds = {};
  for (let i = 0; i < set.length; i++) setIds[set[i].id] = set[i];

  function gapSize(axisId) {
    const row = contrib[axisId] || {};
    return (row.unmet != null) ? row.unmet : 0;
  }

  for (let a = 0; a < axes.length; a++) {
    const id = axes[a].id;
    const d = demand[id] || 0;
    const cov = coverageOf(set, id, kappa, gamma);
    let advisoryShare = 0;
    let totalCap = 0;
    for (let i = 0; i < set.length; i++) {
      const cap = (set[i].capability && set[i].capability[id]) || 0;
      if (!cap) continue;
      totalCap += cap;
      const cls = (set[i].enforcement && set[i].enforcement[id]) || "advisory";
      if (cls === "advisory") advisoryShare += cap;
    }
    const mostlyAdvisory = totalCap > 0 && advisoryShare / totalCap >= 0.6;

    for (let c = 0; c < catalog.length; c++) {
      const rule = catalog[c];
      const spec = rule.derivedFrom;
      if (!spec || spec.retired) continue;
      if (spec.axis && spec.axis !== id) continue;
      if (spec.harness && spec.harness !== framework.id) continue;
      if (spec.practice && !setIds[spec.practice]) continue;
      let match = false;
      if (spec.condition === "uncovered_demand" && d >= (spec.demandMin || 0.55) && cov <= (spec.coverageMax || 0.45)) {
        match = true;
      } else if (spec.condition === "enforcement_gap" && d >= (spec.demandMin || 0.55) && mostlyAdvisory) {
        match = true;
      } else if (spec.condition === "enforcement_strength" && d >= (spec.demandMin || 0.55) && cov >= (spec.coverageMin || 0.6)) {
        match = true;
      } else if (spec.condition === "cost_mismatch") {
        const costHigh = (opts.cost || 0) >= (spec.costMin || 0.35);
        const tight = d >= (spec.demandMin || 0.55);
        if (costHigh && tight) match = true;
      }
      if (match && fired.indexOf(rule) === -1) {
        rule._gap = gapSize(id);
        fired.push(rule);
      }
    }
  }

  const attrs = attributeRisks(framework, catalog);
  for (let i = 0; i < attrs.length; i++) {
    if (fired.indexOf(attrs[i]) === -1) fired.push(attrs[i]);
  }

  fired.sort((a, b) => {
    const rank = { high: 0, medium: 1 };
    const sa = (a.caution && a.caution.severity) || "medium";
    const sb = (b.caution && b.caution.severity) || "medium";
    return (rank[sa] - rank[sb]) || String(a.id).localeCompare(String(b.id));
  });
  return fired;
}

function shapleyAxes(framework, set, axes, demand, params) {
  const n = axes.length;
  if (n === 0) return {};
  if (n > 14) {
    const scored = utilityOf(framework, set, axes, demand, params);
    const out = {};
    for (let i = 0; i < n; i++) out[axes[i].id] = scored.contrib[axes[i].id];
    return out;
  }
  const baseline = { ...demand };
  Object.keys(baseline).forEach((k) => { baseline[k] = 0; });
  const phi = {};
  for (let i = 0; i < n; i++) phi[axes[i].id] = 0;
  const limit = 1 << n;
  for (let mask = 0; mask < limit; mask++) {
    const dOff = { ...baseline };
    let size = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        dOff[axes[i].id] = demand[axes[i].id] || 0;
        size++;
      }
    }
    const uOff = utilityOf(framework, set, axes, dOff, params).u;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) continue;
      const dOn = { ...dOff };
      dOn[axes[i].id] = demand[axes[i].id] || 0;
      const uOn = utilityOf(framework, set, axes, dOn, params).u;
      const weight = factorial(size) * factorial(n - size - 1) / factorial(n);
      phi[axes[i].id] += weight * (uOn - uOff);
    }
  }
  return phi;
}

function factorial(n) {
  let x = 1;
  for (let i = 2; i <= n; i++) x *= i;
  return x;
}

function conformalSet(nativeRows, alpha, qhat) {
  const shares = softmax(nativeRows.map((r) => r.u));
  const ranked = nativeRows.map((r, i) => ({ id: r.frameworkId, u: r.u, share: shares[i] }))
    .sort((x, y) => y.share - x.share);
  const set = [];
  if (isFiniteNumber(qhat)) {
    for (let i = 0; i < ranked.length; i++) {
      if (i === 0 || (1 - ranked[i].share) <= qhat) set.push(ranked[i].id);
    }
  } else {
    const a = isFiniteNumber(alpha) ? alpha : 0.2;
    let cum = 0;
    for (let i = 0; i < ranked.length; i++) {
      set.push(ranked[i].id);
      cum += ranked[i].share;
      if (cum >= 1 - a && set.length >= 1) break;
    }
  }
  return { set: set, shares: Object.fromEntries(ranked.map((r) => [r.id, r.share])) };
}

export function selectUtility(input) {
  const pack = input.pack;
  const answers = input.answers || {};
  const derived = input.derived || {};
  const fieldIndex = input.fieldIndex || {};
  const settings = input.settings || pack.settings || {};
  const evalExpr = input.evalExpr;
  const axes = pack.axes || [];
  const practices = pack.practices || [];
  const byId = {};
  for (let i = 0; i < practices.length; i++) byId[practices[i].id] = practices[i];
  const params = pack.parameters || {};
  const k = (settings.utility && settings.utility.k) || 5;
  const frameworks = input.frameworksList || pack.frameworks || [];
  const ctx = {
    answers: answers,
    derived: derived,
    result: null,
    flags: {},
    fieldIndex: fieldIndex,
  };
  const demand = demandVector(axes, answers, derived, pack.demandScopes || [], evalExpr, ctx);
  const feas = feasibleFrameworks(frameworks, answers, settings);
  const exclusions = feas.excluded;
  if (!feas.feasible.length) {
    return {
      demand: demand,
      feasible: [],
      excluded: exclusions,
      best: null,
      nativeRanking: [],
      practiceProb: {},
      harnessAccept: {},
      conformal: [],
      shapley: {},
      contrib: {},
    };
  }

  const perFw = [];
  for (let i = 0; i < feas.feasible.length; i++) {
    const rows = enumerateForFramework(
      feas.feasible[i], practices, byId, axes, demand, params, k,
      answers, derived, evalExpr, fieldIndex,
    );
    if (rows.length) perFw.push({ framework: feas.feasible[i], rows: rows, native: rows.find((r) => r.added.length === 0) || rows[0] });
  }
  if (!perFw.length) {
    return {
      demand: demand,
      feasible: feas.feasible.map((f) => f.id),
      excluded: exclusions,
      best: null,
      nativeRanking: [],
      practiceProb: {},
      harnessAccept: {},
      conformal: [],
      shapley: {},
      contrib: {},
    };
  }

  let best = null;
  for (let i = 0; i < perFw.length; i++) {
    const top = perFw[i].rows[0];
    if (!best || top.u > best.u) best = { ...top, framework: perFw[i].framework };
  }

  const nativeRows = perFw.map((x) => x.native).sort((a, b) => b.u - a.u);
  const qhat = params.conformal && params.conformal.qhat;
  const conf = conformalSet(nativeRows, settings.utility && settings.utility.conformalAlpha, qhat);
  const allRows = [];
  for (let i = 0; i < perFw.length; i++) {
    const rows = perFw[i].rows;
    for (let r = 0; r < rows.length; r++) allRows.push(rows[r]);
  }
  const masses = softmax(allRows.map((r) => r.u));
  const practiceProb = {};
  for (let i = 0; i < practices.length; i++) practiceProb[practices[i].id] = 0;
  for (let r = 0; r < allRows.length; r++) {
    const mass = masses[r];
    const ids = allRows[r].setIds || [];
    for (let s = 0; s < ids.length; s++) {
      practiceProb[ids[s]] = (practiceProb[ids[s]] || 0) + mass;
    }
  }

  const set = practiceList(best.setIds, byId);
  const cautions = deriveCautions({
    demand: demand,
    contrib: best.contrib,
    set: set,
    framework: best.framework,
    catalog: pack.cautions || [],
    params: params,
    axes: axes,
    cost: best.cost,
  });

  return {
    demand: demand,
    feasible: feas.feasible.map((f) => f.id),
    excluded: exclusions,
    best: best,
    set: set,
    nativeRanking: nativeRows,
    practiceProb: practiceProb,
    harnessAccept: conf.shares,
    conformal: conf.set,
    shapley: input.wantShapley
      ? shapleyAxes(best.framework, set, axes, demand, params)
      : {},
    contrib: best.contrib,
    cautions: cautions,
    k: k,
    counterfactuals: axisFlipPoints(best, nativeRows, axes, demand, params),
  };
}

export function stabilityOrdering(pack, answers, derived, fieldIndex, evalExpr, omitId, insertFw) {
  const frameworks = (pack.frameworks || []).filter((f) => f.id !== omitId);
  if (insertFw) frameworks.push(insertFw);
  const next = { ...pack, frameworks: frameworks };
  const picked = selectUtility({
    pack: next,
    answers: answers,
    derived: derived,
    fieldIndex: fieldIndex,
    settings: pack.settings,
    evalExpr: evalExpr,
    frameworksList: frameworks,
  });
  const order = (picked.nativeRanking || []).map((r) => r.frameworkId);
  const signs = {};
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      signs[order[i] + ">" + order[j]] = 1;
    }
  }
  return { order: order, signs: signs, selection: picked };
}

function axisCoeff(row, theta, lambda, axisId) {
  const cov = (row && row.coverage) || 0;
  const th = theta[axisId] || 0;
  const lam = lambda[axisId] || 0;
  return -th * (1 - cov) + lam * cov;
}

/**
 * Exact 1-D flip points on native utilities (T53). U is bilinear in demand,
 * so the demand that ties the winner and runner-up is a closed form.
 */
export function axisFlipPoints(best, nativeRanking, axes, demand, params) {
  if (!best || !Array.isArray(nativeRanking) || nativeRanking.length < 2) return [];
  const theta = (params && params.theta) || {};
  const lambda = (params && params.lambda) || {};
  const bestId = best.frameworkId || (best.framework && best.framework.id);
  const bestNative = nativeRanking.find((r) => r.frameworkId === bestId) || best;
  const runner = nativeRanking.find((r) => r.frameworkId !== bestId);
  if (!runner || !bestNative) return [];
  const out = [];
  const list = Array.isArray(axes) ? axes : [];
  for (let i = 0; i < list.length; i++) {
    const axis = list[i];
    const id = axis.id;
    const d = demand[id] || 0;
    const cf = axisCoeff((bestNative.contrib || {})[id], theta, lambda, id);
    const cg = axisCoeff((runner.contrib || {})[id], theta, lambda, id);
    const denom = cf - cg;
    if (Math.abs(denom) < 1e-9) continue;
    const dFlip = d - ((bestNative.u || 0) - (runner.u || 0)) / denom;
    if (!(dFlip > 0 && dFlip < 1) || Math.abs(dFlip - d) < 0.03) continue;
    const spec = axis.demand || {};
    const term = (Array.isArray(spec.terms) ? spec.terms[0] : spec) || {};
    const q = term.q;
    const p = term.p;
    const read = (term.reads && term.reads[0]) || id;
    let threshold = null;
    if (isFiniteNumber(q) && isFiniteNumber(p) && p > q) {
      threshold = q + dFlip * (p - q);
    }
    const direction = dFlip < d ? "below" : "above";
    const pretty = threshold != null
      ? (direction === "below"
        ? `Below ${Math.round(threshold)} on ${read} the harness flips to ${runner.frameworkId}.`
        : `Above ${Math.round(threshold)} on ${read} the harness flips to ${runner.frameworkId}.`)
      : (direction === "below"
        ? `Lower ${id} demand (${dFlip.toFixed(2)}) flips the harness to ${runner.frameworkId}.`
        : `Higher ${id} demand (${dFlip.toFixed(2)}) flips the harness to ${runner.frameworkId}.`);
    out.push({
      axis: id,
      from: bestId,
      to: runner.frameworkId,
      demandNow: d,
      demandFlip: clamp01(dFlip),
      threshold: threshold,
      read: read,
      sentence: pretty,
    });
  }
  out.sort((a, b) => Math.abs(a.demandFlip - a.demandNow) - Math.abs(b.demandFlip - b.demandNow));
  return out.slice(0, 3);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Prior-centered Laplace stand-in (T48). Samples theta ~ logN(prior, sigma)
 * and re-solves. Live evaluate stays on the point estimate to meet N3;
 * this is the offline / on-demand path.
 */
export function samplePosterior(input, opts) {
  const n = (opts && opts.n) || 16;
  const sigma = (opts && opts.sigma) || 0.25;
  const rng = mulberry32((opts && opts.seed) || 0x51ec7);
  const pack = input.pack;
  const prior = (pack.parameters && pack.parameters.theta) || {};
  const practiceProb = {};
  const harness = {};
  let covered = 0;
  for (let i = 0; i < n; i++) {
    const theta = {};
    const keys = Object.keys(prior);
    for (let k = 0; k < keys.length; k++) {
      const id = keys[k];
      const noise = sigma * (rng() * 2 - 1);
      theta[id] = Math.max(0, prior[id] * Math.exp(noise));
    }
    const nextPack = { ...pack, parameters: { ...pack.parameters, theta: theta } };
    const picked = selectUtility({ ...input, pack: nextPack });
    if (!picked.best) continue;
    covered++;
    const hid = picked.best.frameworkId || (picked.best.framework && picked.best.framework.id);
    harness[hid] = (harness[hid] || 0) + 1;
    const ids = (picked.best.setIds || []).concat(picked.best.native || []);
    const seen = {};
    for (let s = 0; s < ids.length; s++) {
      if (seen[ids[s]]) continue;
      seen[ids[s]] = 1;
      practiceProb[ids[s]] = (practiceProb[ids[s]] || 0) + 1;
    }
  }
  const denom = covered || 1;
  const practiceShare = {};
  Object.keys(practiceProb).forEach((id) => { practiceShare[id] = practiceProb[id] / denom; });
  const harnessShare = {};
  Object.keys(harness).forEach((id) => { harnessShare[id] = harness[id] / denom; });
  return { n: covered, practiceShare: practiceShare, harnessShare: harnessShare, tier: "prior-laplace" };
}

export function checkStability(pack, cases, evalExpr) {
  const frameworks = pack.frameworks || [];
  const failures = [];
  for (let f = 0; f < frameworks.length; f++) {
    const omit = frameworks[f].id;
    for (let c = 0; c < cases.length; c++) {
      const base = stabilityOrdering(pack, cases[c].answers, cases[c].derived, cases[c].fieldIndex, evalExpr, null, null);
      const without = stabilityOrdering(pack, cases[c].answers, cases[c].derived, cases[c].fieldIndex, evalExpr, omit, null);
      const remaining = Object.keys(base.signs).filter((k) => k.indexOf(omit) === -1);
      for (let i = 0; i < remaining.length; i++) {
        const key = remaining[i];
        const [g, h] = key.split(">");
        if (without.order.indexOf(g) === -1 || without.order.indexOf(h) === -1) continue;
        const baseSign = base.order.indexOf(g) < base.order.indexOf(h);
        const nextSign = without.order.indexOf(g) < without.order.indexOf(h);
        if (baseSign !== nextSign) {
          failures.push({ kind: "remove", omit: omit, pair: [g, h], caseIndex: c });
        }
      }
    }
  }
  const synth = {
    id: "synthetic-eighth",
    name: "Synthetic Eighth",
    status: "viable",
    runtimes: [],
    bundle: [],
    cost: { ceremony: 0.2, tokens: 0.2, adoption: 0.2 },
    evidence: { verifiedOn: "2026-09-16", license: "MIT", commitsLast30d: 10 },
  };
  for (let c = 0; c < cases.length; c++) {
    const base = stabilityOrdering(pack, cases[c].answers, cases[c].derived, cases[c].fieldIndex, evalExpr, null, null);
    const withSynth = stabilityOrdering(pack, cases[c].answers, cases[c].derived, cases[c].fieldIndex, evalExpr, null, synth);
    for (const key of Object.keys(base.signs)) {
      const [g, h] = key.split(">");
      if (withSynth.order.indexOf(g) === -1 || withSynth.order.indexOf(h) === -1) continue;
      const baseSign = base.order.indexOf(g) < base.order.indexOf(h);
      const nextSign = withSynth.order.indexOf(g) < withSynth.order.indexOf(h);
      if (baseSign !== nextSign) {
        failures.push({ kind: "insert", pair: [g, h], caseIndex: c });
      }
    }
  }
  return { ok: failures.length === 0, failures: failures };
}
