import test from "node:test";
import assert from "node:assert/strict";
import { loadCurrent } from "../tools/load-page.mjs";

const api = loadCurrent();

function host(value) {
  return JSON.parse(JSON.stringify(value));
}

test("PACK_DIGEST is stable 8-hex and equals LEGACY_V3_DIGEST", () => {
  assert.match(api.PACK_DIGEST, /^[0-9a-f]{8}$/);
  assert.equal(api.PACK_DIGEST, api.LEGACY_V3_DIGEST);
  assert.equal(api.ALL_FIELD_IDS.length, 23);
});

test("label-only change does not affect answer surface digest", () => {
  const surface = api.buildAnswerSurface(api.QUESTIONS);
  const questions2 = JSON.parse(JSON.stringify(api.QUESTIONS));
  const q16 = questions2.find((q) => q.id === "q16_bottlenecks");
  const q16opts = q16.fields[0].options || (q16.fields[0].fields && q16.fields[0].fields[0].options);
  q16opts[0].label = "CHANGED LABEL ONLY";
  const surface2 = api.buildAnswerSurface(questions2);
  assert.equal(surface, surface2);
  const compiled = api.compileFields(questions2);
  assert.equal(compiled.PACK_DIGEST, api.PACK_DIGEST);
});

test("option-value change does affect digest", () => {
  const questions2 = JSON.parse(JSON.stringify(api.QUESTIONS));
  const q1 = questions2.find((q) => q.id === "q1_domain");
  q1.fields[0].options[0].value = "ledger_renamed";
  const compiled = api.compileFields(questions2);
  assert.notEqual(compiled.PACK_DIGEST, api.PACK_DIGEST);
});

test("round-trip encode/decode for each kind", () => {
  const samples = {
    q1_domain: "ledger",
    q2_team: {
      total: 8, swe: 5, data_engineers: 1, qa_sdet: 1,
      product_owner: "dedicated", scrum_master: "shared",
    },
    q3_distribution: "more_than_6",
    q4_tenure: "over_1_year",
    q4_domain_familiarity: "medium",
    q5_work_breakdown: { roadmap: 60, ops: 10, bugs: 10, regulatory: 10, tech_debt: 10 },
    q6_volatility: "moderate",
    q12_quality_gates: ["e2e", "unit_coverage", "mostly_manual"],
    q16_bottlenecks: {
      test_fear: "blocking", flaky_cicd: "major", legacy_tech_debt: "minor",
      ambiguous_or_shifting: "none", cross_team_approvals: "none",
      interruptive_support: "none", compliance_overhead: "none",
    },
    q17_process_mismatch: "slow CAB & reviews",
    q20_runtimes: ["cursor", "claude_code"],
  };
  const enc = api.encodeHash(samples);
  assert.ok(enc.hash.startsWith("v=" + api.PACK_DIGEST));
  assert.equal(enc.hash.indexOf("NaN"), -1);
  const dec = api.decodeHash(enc.hash);
  assert.equal(dec.notice, null);
  assert.equal(dec.answers.q1_domain, "ledger");
  assert.deepEqual(host(dec.answers.q2_team), samples.q2_team);
  assert.deepEqual(host(dec.answers.q5_work_breakdown), samples.q5_work_breakdown);
  // multi restored in pack option order
  assert.deepEqual(host(dec.answers.q12_quality_gates), ["unit_coverage", "e2e", "mostly_manual"]);
  assert.deepEqual(host(dec.answers.q16_bottlenecks), samples.q16_bottlenecks);
  assert.equal(dec.answers.q17_process_mismatch, samples.q17_process_mismatch);
  assert.deepEqual(host(dec.answers.q20_runtimes), ["claude_code", "cursor"]);
});

test("garbage decode never throws and yields only valid answers", () => {
  const garbage = [
    "%%%",
    "v=deadbeef&q1=nope&q5=1,2",
    "v=" + api.PACK_DIGEST + "&q1=not_an_option&q12=unit_coverage,bogus,e2e&q5=a,b,c,d,e&q2=1",
    "v=" + api.PACK_DIGEST + "&q16=test_fear,not_real,flaky_cicd",
    "#v=" + api.PACK_DIGEST + "&q17=%E0%A4%A",
  ];
  for (const g of garbage) {
    const dec = api.decodeHash(g);
    assert.equal(typeof dec.answers, "object");
    for (const [id, val] of Object.entries(dec.answers)) {
      const meta = api.FIELD_INDEX[id];
      assert.ok(meta, `unexpected field ${id}`);
      if (meta.kind === "single" || meta.kind === "text") {
        if (meta.options) assert.ok(meta.options.some((o) => o.value === val));
      }
      if (meta.kind === "multi" || meta.kind === "ranked") {
        assert.ok(Array.isArray(val));
        for (const item of val) {
          assert.ok(meta.options.some((o) => o.value === item));
        }
      }
    }
  }
});

test("legacy v=3 restores when digest matches", () => {
  const dec = api.decodeHash("v=3&q1=ledger&q3=more_than_6");
  assert.equal(dec.notice, null);
  assert.equal(dec.answers.q1_domain, "ledger");
  assert.equal(dec.answers.q3_distribution, "more_than_6");
});

test("v=2 is refused with notice mentioning digest/version", () => {
  const dec = api.decodeHash("v=2&q3=global_timezones");
  assert.deepEqual(host(dec.answers), {});
  assert.ok(dec.notice);
  assert.match(dec.notice, /digest|version|questionnaire/i);
});

test("optionLabel looks up ranked bottleneck labels", () => {
  assert.equal(
    api.optionLabel("q16_bottlenecks", "ambiguous_or_shifting"),
    "Ambiguous or shifting requirements",
  );
  assert.equal(api.optionLabel("q16_bottlenecks", "unknown"), "unknown");
});
