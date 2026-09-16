import test from "node:test";
import assert from "node:assert/strict";
import { evalExpr } from "../src/expr.mjs";
import {
  BASE_RULE_EXPRS,
  CAUTION_EXPRS,
  DERIVED_DEFS,
  OVERLAY_EXPRS,
} from "../src/rules-expr.mjs";
import { loadCurrent, loadGolden } from "../tools/load-page.mjs";
import {
  PINNED_NOW,
  boundarySweep,
  documentedFixtures,
  malformedSets,
  seededRandom,
} from "../tools/corpus.mjs";

const golden = loadGolden({ now: PINNED_NOW });
const current = loadCurrent({ now: PINNED_NOW });
const cases = [
  ...documentedFixtures(),
  ...boundarySweep(),
  ...seededRandom(2_000, 0x5dd5e1ec, golden),
  ...malformedSets(),
];

function byId(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function partialResult(result) {
  const base = result && result.base && result.base.rule;
  return {
    baseId: base && base.adopt ? base.adopt.framework : null,
    baseRule: base ? base.id : null,
    overlayIds: (result && result.overlays || []).map((item) => item.rule.id),
    forceOverlayB: !!(result && result.forceOverlayB),
  };
}

function expressionContext(answers, derived, partial) {
  return {
    answers,
    derived,
    result: partial ? {
      baseFramework: partial.baseId,
      baseRule: partial.baseRule,
      overlays: partial.overlayIds,
    } : null,
    flags: partial && partial.forceOverlayB ? { force_tdd_overlay: true } : {},
    fieldIndex: current.FIELD_INDEX,
  };
}

function deriveProjection(oldDerived) {
  const roles = oldDerived.hasRoles;
  return {
    unplannedShare: oldDerived.unplannedShare,
    nonRoadmapShare: oldDerived.nonRoadmapShare,
    volatilityIsHigh: oldDerived.volatilityIsHigh,
    coverageLevel: oldDerived.coverageLevel,
    teamSize: oldDerived.teamSize,
    hasProductOwner: !!(roles && roles.product_owner),
    hasScrumMaster: !!(roles && roles.scrum_master),
    hasQaSdet: !!(roles && roles.qa_sdet),
  };
}

function hostJson(value) {
  // VM-loaded page objects are cross-realm; JSON round-trip brings them
  // into the host realm so deepEqual can compare structure.
  return JSON.parse(JSON.stringify(value));
}

test("current page carries the hand-translated expression tables", () => {
  assert.deepEqual(hostJson(current.DERIVED_DEFS), DERIVED_DEFS);
  for (const [actual, expected] of [
    [current.BASE_RULES, BASE_RULE_EXPRS],
    [current.OVERLAYS, OVERLAY_EXPRS],
    [current.CAUTIONS, CAUTION_EXPRS],
  ]) {
    assert.deepEqual(
      hostJson(Array.from(actual).map((rule) => ({ id: rule.id, when: rule.when }))),
      expected,
    );
  }
});

test("derived expressions match frozen closures over the P1 corpus", () => {
  for (const { name, answers } of cases) {
    let oldDerived;
    let oldError;
    try {
      oldDerived = golden.derive(answers);
    } catch (error) {
      oldError = `${error.name}: ${error.message}`;
    }
    let newDerived;
    let newError;
    try {
      newDerived = current.derive(answers);
    } catch (error) {
      newError = `${error.name}: ${error.message}`;
    }
    // Current derive must be total (plan §3.1 / A4). Golden still throws on
    // some malformed multi-selects; that asymmetry is expected hardening.
    assert.equal(newError, undefined, `${name}: current derive must not throw`);
    if (!oldError) {
      assert.deepEqual(
        hostJson(newDerived),
        deriveProjection(oldDerived),
        `${name}: derived values`,
      );
    }
  }
});

test("every rule expression matches its frozen closure over the P1 corpus", () => {
  const exprSets = [
    ["base", golden.BASE_RULES, byId(BASE_RULE_EXPRS)],
    ["overlay", golden.OVERLAYS, byId(OVERLAY_EXPRS)],
    ["caution", golden.CAUTIONS, byId(CAUTION_EXPRS)],
  ];
  for (const { name, answers } of cases) {
    let derived;
    let result;
    try {
      derived = golden.derive(answers);
      result = golden.evaluate(answers, null, PINNED_NOW);
    } catch {
      continue;
    }
    const flat = current.derive(answers);
    const partial = partialResult(result);
    for (const [family, oldRules, expressions] of exprSets) {
      for (const oldRule of oldRules) {
        const oldValue = !!oldRule.when(
          answers,
          derived,
          family === "base" ? undefined : partial,
        );
        const expression = expressions[oldRule.id];
        const newValue = evalExpr(
          expression.when,
          expressionContext(answers, flat, family === "base" ? null : partial),
        );
        assert.equal(newValue, oldValue, `${name}: ${family} ${oldRule.id}`);
      }
    }
  }
});

test("source evalDerived table matches the inlined page", async () => {
  const { evalDerived } = await import("../src/expr.mjs");
  for (const { name, answers } of cases.slice(0, 500)) {
    assert.deepEqual(
      evalDerived(DERIVED_DEFS, answers, hostJson(current.FIELD_INDEX)),
      hostJson(current.derive(answers)),
      name,
    );
  }
});
