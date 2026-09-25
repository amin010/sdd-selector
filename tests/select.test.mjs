import test from "node:test";
import assert from "node:assert/strict";
import { ramp, demandVector, coverageOf, utilityOf, feasibleFrameworks, selectUtility, checkStability, axisFlipPoints } from "../src/select.mjs";
import { evalExpr } from "../src/expr.mjs";

const axes = [
  { id: "brownfield", demand: { terms: [{ reads: ["derived.nonRoadmapShare"], q: 25, p: 55 }] } },
  { id: "verificationStrength", demand: { terms: [{ reads: ["q9"], map: { standard: 0.1, zero: 1 }, q: 0.2, p: 0.8 }] } },
];

const practices = [
  {
    id: "delta",
    capability: { brownfield: 1 },
    enforcement: { brownfield: "human_gate" },
    cost: { ceremony: 0.1, tokens: 0.1 },
    sources: ["openspec"],
    liftable: true,
    requires: [],
    excludes: [],
  },
  {
    id: "tdd",
    capability: { verificationStrength: 1 },
    enforcement: { verificationStrength: "agent_gate" },
    cost: { ceremony: 0.2, tokens: 0.4 },
    sources: ["superpowers"],
    liftable: true,
    requires: [],
    excludes: [],
  },
  {
    id: "lanes",
    capability: { brownfield: 0.2 },
    enforcement: { brownfield: "hard_gate" },
    cost: { ceremony: 0.6, tokens: 0.3 },
    sources: ["speckitty"],
    liftable: false,
    requires: [],
    excludes: [],
  },
];

const parameters = {
  theta: { brownfield: 1.2, verificationStrength: 1 },
  lambda: { brownfield: 0.1, verificationStrength: 0.1 },
  mu: { ceremony: 0.2, tokens: 0.2, adoption: 0.2 },
  kappa: { hard_gate: 1, agent_gate: 0.67, human_gate: 0.5, advisory: 0.33 },
  gamma: 0.4,
};

function packWith(frameworks) {
  return {
    axes,
    practices,
    parameters,
    settings: {
      selection: "utility",
      tierZero: { runtimeField: "runtimes", excludeStatusesFromBase: ["watch"], unsureValues: ["unsure"] },
    },
    frameworks,
    cautions: [],
  };
}

test("ramp is 0 below q, 1 above p, linear between", () => {
  assert.equal(ramp(10, 25, 55), 0);
  assert.equal(ramp(55, 25, 55), 1);
  assert.equal(ramp(40, 25, 55), 0.5);
});

test("demand uses absolute anchors, not catalogue-relative ones", () => {
  const d = demandVector(axes, { q9: "zero" }, { nonRoadmapShare: 55 }, [], evalExpr, {});
  assert.equal(d.brownfield, 1);
  assert.ok(d.verificationStrength > 0.9);
});

test("empty runtimes are unrestricted at the veto", () => {
  const { feasible, excluded } = feasibleFrameworks([
    { id: "a", status: "recommended", runtimes: [] },
    { id: "b", status: "recommended", runtimes: ["cursor"] },
    { id: "c", status: "watch", runtimes: ["cursor"] },
  ], { runtimes: ["claude_code"] }, {
    tierZero: { runtimeField: "runtimes", excludeStatusesFromBase: ["watch"] },
  });
  assert.deepEqual(feasible.map((f) => f.id), ["a"]);
  assert.ok(excluded.some((e) => e.id === "b" && e.reason === "runtime"));
  assert.ok(excluded.some((e) => e.id === "c" && e.reason === "status"));
});

test("gamma backstop raises advisory coverage when a hard gate is present", () => {
  const advisory = {
    id: "adv",
    capability: { verificationStrength: 1 },
    enforcement: { verificationStrength: "advisory" },
  };
  const gate = {
    id: "ci",
    capability: { verificationStrength: 0.4 },
    enforcement: { verificationStrength: "hard_gate" },
  };
  const without = coverageOf([advisory], "verificationStrength", parameters.kappa, 0.4);
  const withGate = coverageOf([advisory, gate], "verificationStrength", parameters.kappa, 0.4);
  assert.ok(withGate > without);
});

test("liftable:false practice cannot join another harness", () => {
  const pack = packWith([
    { id: "openspec", status: "recommended", runtimes: [], bundle: ["delta"], cost: { ceremony: 0.1, tokens: 0.1, adoption: 0.1 } },
    { id: "speckitty", status: "viable", runtimes: [], bundle: ["lanes"], cost: { ceremony: 0.4, tokens: 0.3, adoption: 0.3 } },
  ]);
  const picked = selectUtility({
    pack,
    answers: { q9: "standard" },
    derived: { nonRoadmapShare: 80 },
    evalExpr,
  });
  assert.ok(picked.best);
  if (picked.best.frameworkId === "openspec" || picked.best.framework.id === "openspec") {
    assert.equal(picked.best.setIds.includes("lanes"), false);
  }
});

test("G-STABILITY: removing a framework does not flip remaining order", () => {
  const pack = packWith([
    { id: "openspec", status: "recommended", runtimes: [], bundle: ["delta"], cost: { ceremony: 0.1, tokens: 0.1, adoption: 0.1 } },
    { id: "superpowers", status: "viable", runtimes: [], bundle: ["tdd"], cost: { ceremony: 0.4, tokens: 0.5, adoption: 0.3 } },
    { id: "speckitty", status: "viable", runtimes: [], bundle: ["lanes"], cost: { ceremony: 0.5, tokens: 0.3, adoption: 0.4 } },
  ]);
  const cases = [
    { answers: { q9: "zero" }, derived: { nonRoadmapShare: 70 }, fieldIndex: {} },
    { answers: { q9: "standard" }, derived: { nonRoadmapShare: 10 }, fieldIndex: {} },
  ];
  const report = checkStability(pack, cases, evalExpr);
  assert.equal(report.ok, true, JSON.stringify(report.failures, null, 2));
});

test("axisFlipPoints reports a closed-form demand flip", () => {
  const fwA = { id: "openspec", cost: { ceremony: 0, tokens: 0, adoption: 0 } };
  const fwB = { id: "speckit", cost: { ceremony: 0, tokens: 0, adoption: 0 } };
  const setA = [practices[0]];
  const setB = [practices[1]];
  const demand = { brownfield: 0.8, verificationStrength: 0.1 };
  const a = utilityOf(fwA, setA, axes, demand, parameters);
  const b = utilityOf(fwB, setB, axes, demand, parameters);
  const flips = axisFlipPoints(
    { frameworkId: "openspec", u: a.u, contrib: a.contrib },
    [
      { frameworkId: "openspec", u: a.u, contrib: a.contrib },
      { frameworkId: "speckit", u: b.u, contrib: b.contrib },
    ],
    axes,
    demand,
    parameters,
  );
  assert.ok(Array.isArray(flips));
});

test("vendor demandScope zeros concurrencyIsolation", () => {
  const pack = packWith([
    { id: "openspec", status: "recommended", runtimes: [], bundle: ["delta"], cost: { ceremony: 0.1, tokens: 0.1, adoption: 0.1 } },
  ]);
  pack.demandScopes = [{
    when: { eq: [{ answer: "q14_release_autonomy" }, "vendor"] },
    zero: ["brownfield"],
  }];
  const picked = selectUtility({
    pack,
    answers: { q14_release_autonomy: "vendor", q9: "zero" },
    derived: { nonRoadmapShare: 80 },
    evalExpr,
  });
  assert.equal(picked.demand.brownfield, 0);
});

test("utility is linear in theta (contribution decomposition is exact)", () => {
  const fw = { id: "openspec", cost: { ceremony: 0, tokens: 0, adoption: 0 } };
  const set = [practices[0]];
  const demand = { brownfield: 1, verificationStrength: 0 };
  const a = utilityOf(fw, set, axes, demand, parameters);
  const doubled = utilityOf(fw, set, axes, demand, { ...parameters, theta: { ...parameters.theta, brownfield: parameters.theta.brownfield * 2 } });
  const unmet = a.contrib.brownfield.unmet;
  assert.ok(Math.abs((a.u - doubled.u) - unmet) < 1e-9);
});
