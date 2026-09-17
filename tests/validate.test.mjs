import test from "node:test";
import assert from "node:assert/strict";
import { coverageReport, validatePack } from "../tools/validate.mjs";

function validPack() {
  return {
    schema: 1,
    meta: {
      id: "minimal",
      version: "1.0.0",
      title: "Minimal",
      updated: "2026-09-16",
    },
    settings: {
      fallbackBase: "openspec",
      staleDays: 180,
      statuses: [
        { id: "recommended", label: "Recommended", selectableAsBase: true },
      ],
      enforcementClasses: [
        { id: "advisory", label: "Advisory", description: "Prompt context." },
      ],
      ratings: [],
    },
    frameworks: [{
      id: "openspec",
      name: "OpenSpec",
      repo: "Fission-AI/OpenSpec",
      status: "recommended",
      evidence: { verifiedOn: "2026-09-16" },
      runtimes: [],
      ratings: {},
      install: "openspec init",
      commands: [],
      artifacts: [],
      enforcement: [{ practice: "Verify", class: "advisory", note: "Advisory." }],
    }],
    sections: [{ id: "main", title: "Main" }],
    questions: [{
      id: "q1",
      section: "main",
      legend: "Architecture",
      fields: [{
        id: "architecture",
        kind: "single",
        hashKey: "a",
        options: [
          { value: "monolith", label: "Monolith" },
          { value: "services", label: "Services" },
        ],
      }],
    }, {
      id: "q2",
      section: "main",
      legend: "Bottlenecks",
      fields: [{
        id: "bottlenecks",
        kind: "ranked",
        hashKey: "b",
        ranks: 1,
        options: [{ value: "test_fear", label: "Test fear" }],
      }],
    }],
    derived: [{
      key: "isMonolith",
      expr: { eq: [{ answer: "architecture" }, "monolith"] },
    }],
    baseRules: [{
      id: "base-1",
      label: "Base",
      when: {
        any: [
          { derived: "isMonolith" },
          { rankAtMost: { field: "bottlenecks", of: "test_fear", n: 1 } },
        ],
      },
      adopt: { framework: "openspec", rationale: "Small." },
    }],
    overlays: [],
    cautions: [{
      id: "C1",
      label: "Caution",
      when: { eq: [{ result: "baseFramework" }, "openspec"] },
      caution: {
        severity: "medium",
        kind: "warning",
        finding: "Finding",
        mitigation: "Mitigation",
        source: "Source",
      },
    }],
  };
}

function clone() {
  return structuredClone(validPack());
}

const fixtures = [
  ["E-PACK-002 malformed JSON", "{", "E-PACK-002"],
  ["E-PACK-002 non-object", "[]", "E-PACK-002"],
  ["E-PACK-001 schema", (p) => { p.schema = 2; }, "E-PACK-001"],
  ["E-PACK-003 missing key", (p) => { delete p.questions; }, "E-PACK-003"],
  ["E-META-004 metadata", (p) => { p.meta.id = "Not A Slug"; }, "E-META-004"],
  ["E-FIELD-010 duplicate id", (p) => {
    p.questions[1].fields[0].id = "architecture";
  }, "E-FIELD-010"],
  ["E-FIELD-011 unknown kind", (p) => {
    p.questions[0].fields[0].kind = "toggle";
  }, "E-FIELD-011"],
  ["E-FIELD-012 duplicate option", (p) => {
    p.questions[0].fields[0].options[1].value = "monolith";
  }, "E-FIELD-012"],
  ["E-FIELD-013 too many ranks", (p) => {
    p.questions[1].fields[0].ranks = 2;
  }, "E-FIELD-013"],
  ["E-FIELD-014 nested record", (p) => {
    p.questions[0].fields[0] = {
      id: "record", kind: "record", fields: [{
        id: "nested", kind: "record", fields: [],
      }],
    };
  }, "E-FIELD-014"],
  ["E-FIELD-015 text maxLength", (p) => {
    p.questions[0].fields[0] = { id: "notes", kind: "text" };
  }, "E-FIELD-015"],
  ["E-SECT-020 missing section", (p) => {
    p.questions[0].section = "missing";
  }, "E-SECT-020"],
  ["E-EXPR-030 multiple keys", (p) => {
    p.baseRules[0].when = { eq: [1, 1], ne: [1, 2] };
  }, "E-EXPR-030"],
  ["E-EXPR-031 unknown operator", (p) => {
    p.baseRules[0].when = { execute: "code" };
  }, "E-EXPR-031"],
  ["E-EXPR-032 wrong arity", (p) => {
    p.baseRules[0].when = { eq: [1] };
  }, "E-EXPR-032"],
  ["E-EXPR-033 excessive depth", (p) => {
    let expr = true;
    for (let i = 0; i < 33; i++) expr = { not: expr };
    p.baseRules[0].when = expr;
  }, "E-EXPR-033"],
  ["E-REF-040 unknown answer", (p) => {
    p.baseRules[0].when = { answer: "missing" };
  }, "E-REF-040"],
  ["E-REF-040 unknown subfield", (p) => {
    p.baseRules[0].when = { answer: "architecture.value" };
  }, "E-REF-040"],
  ["E-REF-041 unknown derived", (p) => {
    p.baseRules[0].when = { derived: "missing" };
  }, "E-REF-041"],
  ["E-REF-042 derived cycle", (p) => {
    p.derived = [
      { key: "a", expr: { derived: "b" } },
      { key: "b", expr: { derived: "a" } },
    ];
    p.baseRules[0].when = { derived: "a" };
  }, "E-REF-042"],
  ["E-REF-043 result in base", (p) => {
    p.baseRules[0].when = { result: "baseFramework" };
  }, "E-REF-043"],
  ["E-REF-044 rank on single", (p) => {
    p.baseRules[0].when = { rankAtMost: { field: "architecture", of: "monolith", n: 1 } };
  }, "E-REF-044"],
  ["E-FW-050 unknown framework", (p) => {
    p.baseRules[0].adopt.framework = "missing";
  }, "E-FW-050"],
  ["E-FW-051 non-selectable base", (p) => {
    p.settings.statuses.push({ id: "watch", label: "Watch", selectableAsBase: false });
    p.frameworks[0].status = "watch";
    p.settings.fallbackBase = null;
  }, "E-FW-051"],
  ["E-FW-052 unknown framework vocabulary", (p) => {
    p.frameworks[0].status = "unknown";
  }, "E-FW-052"],
  ["E-FW-053 invalid evidence date", (p) => {
    p.frameworks[0].evidence.verifiedOn = "yesterday";
  }, "E-FW-053"],
  ["E-FW-054 invalid fallback", (p) => {
    p.settings.fallbackBase = "missing";
  }, "E-FW-054"],
  ["E-RULE-060 duplicate rule id", (p) => {
    p.overlays.push({
      id: "base-1", label: "Duplicate", when: true,
      adopt: { framework: "openspec", rationale: "Duplicate." },
    });
  }, "E-RULE-060"],
  ["E-RULE-061 missing adopt", (p) => {
    delete p.baseRules[0].adopt;
  }, "E-RULE-061"],
  ["E-RULE-062 unknown resolve target", (p) => {
    p.baseRules[0].resolves = ["missing"];
  }, "E-RULE-062"],
  ["E-HASH-070 duplicate hash", (p) => {
    p.questions[1].fields[0].hashKey = "a";
  }, "E-HASH-070"],
];

test("minimal pack validates", () => {
  assert.deepEqual(validatePack(validPack()), []);
});

for (const [name, mutate, expected] of fixtures) {
  test(name, () => {
    const input = typeof mutate === "string" ? mutate : clone();
    if (typeof mutate === "function") mutate(input);
    const diagnostics = validatePack(input);
    assert.ok(
      diagnostics.some((item) => item.code === expected),
      `${expected} not found in ${JSON.stringify(diagnostics, null, 2)}`,
    );
    assert.ok(diagnostics.every((item) => typeof item.path === "string"));
  });
}

test("fuzzed packs never throw and always return diagnostics", () => {
  const junk = [
    undefined, null, 0, true, [], "", "{", "null",
    { schema: 1 },
    { ...validPack(), questions: "wrong" },
    { ...validPack(), frameworks: [null, 1, "x"] },
    { ...validPack(), derived: [{ key: "x", expr: { unknownOp: true } }] },
    { ...validPack(), overlays: null },
    { ...validPack(), questions: { not: "an-array" } },
  ];
  for (let i = 0; i < 100; i++) {
    const pack = clone();
    const keys = Object.keys(pack);
    pack[keys[i % keys.length]] = [null, "bad", i, { x: i }][i % 4];
    junk.push(pack);
  }
  for (const value of junk) {
    assert.doesNotThrow(() => validatePack(value));
    const result = validatePack(value);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  }
});

test("W-FIELD-103 when a non-reportOnly field is unread", () => {
  const pack = clone();
  pack.questions.push({
    id: "q3",
    section: "main",
    legend: "Unused",
    fields: [{
      id: "unused_field",
      kind: "single",
      hashKey: "u",
      options: [{ value: "a", label: "A" }],
    }],
  });
  const diagnostics = validatePack(pack);
  assert.ok(diagnostics.some((d) => d.code === "W-FIELD-103" && d.path.includes("unused_field")));
});

test("W-FW-104 when a framework is never selected", () => {
  const pack = clone();
  pack.frameworks.push({
    id: "orphan",
    name: "Orphan",
    repo: "org/orphan",
    status: "recommended",
    evidence: { verifiedOn: "2026-09-16" },
    runtimes: [],
    ratings: {},
    install: "npx orphan",
    commands: [],
    artifacts: [],
    enforcement: [{ practice: "None", class: "advisory", note: "n/a" }],
  });
  const diagnostics = validatePack(pack);
  assert.ok(diagnostics.some((d) => d.code === "W-FW-104" && d.message.includes("orphan")));
});

test("coverageReport lists unread fields and unselected frameworks", () => {
  const pack = clone();
  pack.questions[0].fields[0].options.push({ value: "legacy", label: "Legacy" });
  const cov = coverageReport(pack);
  assert.ok(cov.fieldsRead.includes("architecture"));
  assert.ok(cov.frameworksSelected.includes("openspec"));
  assert.ok(cov.unreadOptions.some((item) => item.includes("legacy")));
});
