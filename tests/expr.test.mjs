import test from "node:test";
import assert from "node:assert/strict";
import {
  depthOf,
  evalDerived,
  evalExpr,
  isOperator,
  recordValid,
} from "../src/expr.mjs";

const fieldIndex = {
  rec: {
    kind: "record",
    constraints: { sumTo: 100, requiredKeys: ["a", "b"] },
  },
  team: {
    kind: "record",
    constraints: { requiredKeys: ["total", "owner"] },
  },
  multi: { kind: "multi" },
  ranked: { kind: "ranked" },
};

function ctx(answers = {}, extra = {}) {
  return {
    answers,
    derived: {},
    result: null,
    flags: {},
    fieldIndex,
    ...extra,
  };
}

test("operator recognition and depth helper", () => {
  assert.equal(isOperator({ eq: [1, 1] }), true);
  assert.equal(isOperator({ nope: [] }), false);
  assert.equal(isOperator({ eq: [], ne: [] }), false);
  assert.equal(depthOf({ all: [{ eq: [1, 1] }] }), 5);
});

test("namespaces: answer, derived, result, flag, rank", () => {
  const c = ctx(
    { plain: "x", rec: { a: 40, b: 60 }, ranked: ["b", "a"] },
    {
      derived: { d: 7 },
      result: { baseFramework: "openspec", baseRule: "base-1", overlays: ["overlay-a"] },
      flags: { force: true },
    },
  );
  assert.equal(evalExpr({ answer: "plain" }, c), "x");
  assert.equal(evalExpr({ answer: "rec.a" }, c), 40);
  assert.equal(evalExpr({ derived: "d" }, c), 7);
  assert.equal(evalExpr({ result: "baseFramework" }, c), "openspec");
  assert.deepEqual(evalExpr({ result: "overlays" }, c), ["overlay-a"]);
  assert.equal(evalExpr({ flag: "force" }, c), true);
  assert.equal(evalExpr({ flag: "missing" }, c), false);
  assert.equal(evalExpr({ rank: { field: "ranked", of: "a" } }, c), 2);
  assert.equal(evalExpr({ rank: { field: "ranked", of: "z" } }, c), null);
});

test("logic operators all, any, not", () => {
  assert.equal(evalExpr({ all: [true, { eq: [1, 1] }] }, ctx()), true);
  assert.equal(evalExpr({ all: [true, false] }, ctx()), false);
  assert.equal(evalExpr({ any: [false, { eq: ["a", "a"] }] }, ctx()), true);
  assert.equal(evalExpr({ any: [false, false] }, ctx()), false);
  assert.equal(evalExpr({ not: false }, ctx()), true);
});

test("comparison operators eq, ne, gt, gte, lt, lte", () => {
  assert.equal(evalExpr({ eq: ["a", "a"] }, ctx()), true);
  assert.equal(evalExpr({ ne: ["a", "b"] }, ctx()), true);
  assert.equal(evalExpr({ gt: [3, 2] }, ctx()), true);
  assert.equal(evalExpr({ gte: [2, 2] }, ctx()), true);
  assert.equal(evalExpr({ lt: [1, 2] }, ctx()), true);
  assert.equal(evalExpr({ lte: [2, 2] }, ctx()), true);
  assert.equal(evalExpr({ gt: ["3", 2] }, ctx()), false);
});

test("membership operators in, hasAny, hasAll, hasNone", () => {
  assert.equal(evalExpr({ in: ["a", ["a", "b"]] }, ctx()), true);
  assert.equal(evalExpr({ in: ["z", ["a", "b"]] }, ctx()), false);
  assert.equal(evalExpr({ hasAny: [["a", "b"], ["b", "c"]] }, ctx()), true);
  assert.equal(evalExpr({ hasAll: [["a", "b"], ["b", "a"]] }, ctx()), true);
  assert.equal(evalExpr({ hasAll: [["a"], ["a", "b"]] }, ctx()), false);
  assert.equal(evalExpr({ hasNone: [["a"], ["b", "c"]] }, ctx()), true);
  assert.equal(evalExpr({ hasNone: [["a"], ["a", "c"]] }, ctx()), false);
});

test("presence and ranking operators", () => {
  assert.equal(evalExpr({ isSet: { answer: "x" } }, ctx({ x: 0 })), true);
  assert.equal(evalExpr({ isSet: { answer: "x" } }, ctx({ x: "" })), false);
  assert.equal(evalExpr({ isSet: { answer: "multi" } }, ctx({ multi: [] })), false);
  assert.equal(
    evalExpr({ rankAtMost: { field: "ranked", of: "test", n: 2 } }, ctx({ ranked: ["ci", "test"] })),
    true,
  );
  assert.equal(
    evalExpr({ rankAtMost: { field: "ranked", of: "test", n: 1 } }, ctx({ ranked: ["ci", "test"] })),
    false,
  );
});

test("arithmetic operators add, sub, mul, min, max", () => {
  assert.equal(evalExpr({ add: [1, 2, 3] }, ctx()), 6);
  assert.equal(evalExpr({ sub: [10, 3, 2] }, ctx()), 5);
  assert.equal(evalExpr({ mul: [2, 3, 4] }, ctx()), 24);
  assert.equal(evalExpr({ min: [4, 2, 8] }, ctx()), 2);
  assert.equal(evalExpr({ max: [4, 2, 8] }, ctx()), 8);
});

test("sumFields, count, and countSelected", () => {
  const c = ctx({ rec: { a: 40, b: 60 }, multi: ["manual", "unit", "e2e"] });
  assert.equal(evalExpr({ sumFields: { field: "rec", keys: ["a", "b"] } }, c), 100);
  assert.equal(evalExpr({ count: ["a", "b", "c"] }, c), 3);
  assert.equal(evalExpr({ countSelected: { field: "multi", except: ["manual"] } }, c), 2);
  assert.equal(evalExpr({ countSelected: { field: "missing" } }, c), 0);
  assert.equal(evalExpr({ countSelected: { field: "multi" } }, ctx({ multi: [] })), 0);
});

test("bucket supports every cut and else", () => {
  assert.equal(evalExpr({ bucket: { value: 0, cuts: [{ lte: 0, then: "a" }], else: "z" } }, ctx()), "a");
  assert.equal(evalExpr({ bucket: { value: 1, cuts: [{ lt: 2, then: "b" }], else: "z" } }, ctx()), "b");
  assert.equal(evalExpr({ bucket: { value: 3, cuts: [{ gte: 3, then: "c" }], else: "z" } }, ctx()), "c");
  assert.equal(evalExpr({ bucket: { value: 4, cuts: [{ gt: 3, then: "d" }], else: "z" } }, ctx()), "d");
  assert.equal(evalExpr({ bucket: { value: 2, cuts: [{ lt: 2, then: "x" }], else: "z" } }, ctx()), "z");
});

test("coalesce returns first non-null value", () => {
  assert.equal(evalExpr({ coalesce: [{ answer: "missing" }, 0, 2] }, ctx()), 0);
  assert.equal(evalExpr({ coalesce: [{ answer: "missing" }, null] }, ctx()), null);
});

test("null table: absent answer and invalid record paths", () => {
  assert.equal(evalExpr({ answer: "missing" }, ctx()), null);
  const invalid = ctx({ rec: { a: 40, b: 50 } });
  assert.equal(evalExpr({ answer: "rec" }, invalid), null);
  assert.equal(evalExpr({ answer: "rec.a" }, invalid), null);
});

test("null table: arithmetic propagates null", () => {
  for (const op of ["add", "sub", "mul", "min", "max"]) {
    assert.equal(evalExpr({ [op]: [1, { answer: "missing" }] }, ctx()), null, op);
  }
  assert.equal(
    evalExpr({ sumFields: { field: "rec", keys: ["a", "b"] } }, ctx({ rec: { a: 40 } })),
    null,
  );
});

test("null table: ordered comparisons absorb null", () => {
  for (const op of ["gt", "gte", "lt", "lte"]) {
    assert.equal(evalExpr({ [op]: [{ answer: "missing" }, 1] }, ctx()), false, op);
  }
});

test("null table: eq and ne both absorb null", () => {
  assert.equal(evalExpr({ eq: [{ answer: "missing" }, null] }, ctx()), false);
  assert.equal(evalExpr({ ne: [{ answer: "missing" }, 1] }, ctx()), false);
});

test("null table: membership operators absorb null left side", () => {
  for (const op of ["in", "hasAny", "hasAll", "hasNone"]) {
    assert.equal(evalExpr({ [op]: [{ answer: "missing" }, ["x"]] }, ctx()), false, op);
  }
});

test("null table: not null is false and all/any treat null as false", () => {
  assert.equal(evalExpr({ not: { answer: "missing" } }, ctx()), false);
  assert.equal(evalExpr({ all: [true, { answer: "missing" }] }, ctx()), false);
  assert.equal(evalExpr({ any: [{ answer: "missing" }, true] }, ctx()), true);
  assert.equal(evalExpr({ any: [{ answer: "missing" }, false] }, ctx()), false);
});

test("null table: isSet is always boolean", () => {
  assert.equal(evalExpr({ isSet: { answer: "missing" } }, ctx()), false);
  assert.equal(evalExpr({ isSet: { answer: "x" } }, ctx({ x: "value" })), true);
});

test("null table: bucket null and countSelected absent/empty", () => {
  assert.equal(
    evalExpr({ bucket: { value: { answer: "missing" }, cuts: [], else: "fallback" } }, ctx()),
    null,
  );
  assert.equal(evalExpr({ countSelected: { field: "missing" } }, ctx()), 0);
  assert.equal(evalExpr({ countSelected: { field: "multi" } }, ctx({ multi: [] })), 0);
});

test("recordValid enforces required values and sumTo", () => {
  assert.equal(recordValid({ a: 40, b: 60 }, { sumTo: 100, requiredKeys: ["a", "b"] }), true);
  assert.equal(recordValid({ a: 40, b: -40 }, { sumTo: 0, requiredKeys: ["a", "b"] }), false);
  assert.equal(recordValid({ total: 0, owner: "shared" }, { requiredKeys: ["total", "owner"] }), true);
  assert.equal(recordValid({ total: NaN, owner: "shared" }, { requiredKeys: ["total", "owner"] }), false);
  assert.equal(recordValid({ total: 2, owner: "" }, { requiredKeys: ["total", "owner"] }), false);
});

test("depth and node limits return false without throwing", () => {
  let deep = true;
  for (let i = 0; i < 33; i++) deep = { not: deep };
  assert.equal(evalExpr(deep, ctx()), false);
  assert.ok(depthOf(deep) > 32);
  assert.doesNotThrow(() => evalExpr({ all: new Array(10_001).fill(true) }, ctx()));
  assert.equal(evalExpr({ all: new Array(10_001).fill(true) }, ctx()), false);
});

test("malformed and unknown operators return false", () => {
  assert.equal(evalExpr({ unknown: [] }, ctx()), false);
  assert.equal(evalExpr({ eq: [1, 1], ne: [1, 2] }, ctx()), false);
  const cyclic = {};
  cyclic.not = cyclic;
  assert.doesNotThrow(() => evalExpr(cyclic, ctx()));
  assert.equal(evalExpr(cyclic, ctx()), false);
});

test("evalDerived topologically evaluates flat keys", () => {
  const defs = [
    { key: "twice", expr: { mul: [{ derived: "base" }, 2] } },
    { key: "base", expr: { answer: "n" } },
    { key: "bucketed", expr: { bucket: {
      value: { derived: "twice" },
      cuts: [{ gte: 6, then: "high" }],
      else: "low",
    } } },
  ];
  assert.deepEqual(evalDerived(defs, { n: 3 }, fieldIndex), {
    base: 3,
    twice: 6,
    bucketed: "high",
  });
});

test("evalDerived cycles are total and become null", () => {
  const defs = [
    { key: "a", expr: { derived: "b" } },
    { key: "b", expr: { derived: "a" } },
  ];
  assert.deepEqual(evalDerived(defs, {}, fieldIndex), { a: null, b: null });
});
