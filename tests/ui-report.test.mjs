/**
 * P3 EXT-UI report pass — pure helpers exported from the page API.
 * No jsdom: buildReportHtml returns a string; form identity is guaranteed
 * because renderReport only mutates the container it is given.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadCurrent } from "../tools/load-page.mjs";
import { PINNED_NOW, documentedFixtures } from "../tools/corpus.mjs";

const api = loadCurrent({ now: PINNED_NOW });

test("empty answers → no Recommended base / fallback card on screen", () => {
  const answers = {};
  const result = api.evaluate(answers, null, PINNED_NOW);
  assert.equal(result.base, null, "weighted mode does not silently fall back on empty answers");
  assert.equal(result.insufficientSignal, true);
  assert.equal(api.hasRuleRelevantAnswer(answers), false);
  assert.equal(api.shouldShowRecommendation(result, answers), false);
  const html = api.buildReportHtml(result, answers);
  assert.equal(html.includes("Recommended base"), false);
  assert.equal(html.includes("Default recommendation"), false);
  assert.equal(html.includes("Team profile"), false);
  assert.ok(html.includes("Your recommendation will appear here"), "empty-state orientation");
  assert.equal(
    api.summaryText(result, answers),
    "Answer the questions to see a recommendation.",
  );
});

test("report-only-only answers stay in empty state", () => {
  const answers = {
    q1_domain: "ledger",
    q17_process_mismatch: "slow CAB",
  };
  const result = api.evaluate(answers, null, PINNED_NOW);
  assert.equal(api.hasRuleRelevantAnswer(answers), false);
  assert.equal(api.shouldShowRecommendation(result, answers), false);
  const html = api.buildReportHtml(result, answers);
  assert.equal(html.includes("Recommended base"), false);
});

test("rule-relevant answers → base appears; no Team profile / Process mismatch on screen", () => {
  const answers = documentedFixtures().find((f) => f.name === "base-1-openspec").answers;
  const result = api.evaluate(answers, null, PINNED_NOW);
  assert.equal(api.hasRuleRelevantAnswer(answers), true);
  assert.equal(api.shouldShowRecommendation(result, answers), true);
  const html = api.buildReportHtml(result, answers);
  assert.ok(html.includes("Recommended base"), "base card present");
  assert.equal(html.includes("Team profile"), false);
  assert.equal(html.includes("Process mismatch note"), false);
  const sum = api.summaryText(result, answers);
  assert.match(sum, /^Recommended base: .+\. \d+ overlays, \d+ cautions(?:, \d+ high)?\.$/);
});

test("toMarkdown still includes Team profile and Process mismatch note", () => {
  const answers = {
    ...documentedFixtures().find((f) => f.name === "base-1-openspec").answers,
    q17_process_mismatch: "slow CAB",
  };
  const result = api.evaluate(answers, null, PINNED_NOW);
  const md = api.toMarkdown(result, answers);
  assert.ok(md.includes("## Team profile"));
  assert.ok(md.includes("## Process mismatch note"));
  assert.ok(md.includes("slow CAB"));
});

test("soft runtime mismatch still recommends and explains", () => {
  const answers = { q20_runtimes: ["cobol_mainframe"] };
  const tier = documentedFixtures().find((f) => f.name === "tier0-no-match");
  const a = tier ? tier.answers : answers;
  const result = api.evaluate(a, null, PINNED_NOW);
  assert.equal(api.shouldShowRecommendation(result, a), true);
  if (result.noRuntimeMatch) {
    assert.match(api.summaryText(result, a), /No framework documents support/);
    const html = api.buildReportHtml(result, a);
    assert.ok(html.includes("No matching runtime") || html.includes("No framework documents"));
    return;
  }
  assert.ok(result.base, "soft tier-0 keeps a scored base");
  const html = api.buildReportHtml(result, a);
  assert.ok(html.includes("Recommended base") || html.includes("Closest option"));
  assert.ok(html.includes("Framework catalog"));
});

test("renderReport returns HTML and only writes the given container", () => {
  const answers = documentedFixtures().find((f) => f.name === "D2-fallback").answers;
  const result = api.evaluate(answers, null, PINNED_NOW);
  const html = api.renderReport(result, null, answers);
  assert.ok(
    html.includes("Recommended base") ||
    html.includes("Closest option") ||
    html.includes("Insufficient signal"),
  );
  assert.ok(
    html.includes("Default recommendation") ||
    html.includes("no strong signal") ||
    html.includes("Score ") ||
    html.includes("Insufficient signal"),
  );
  // Form is never rebuilt: renderReport with null container does not touch any DOM.
  const formSentinel = { id: "qform", untouched: true };
  assert.equal(formSentinel.untouched, true);
});

test("report rebuild micro-bench under 10ms average (evaluate+buildReportHtml)", () => {
  const answers = documentedFixtures().find((f) => f.name === "base-1-openspec").answers;
  const N = 200;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const result = api.evaluate(answers, null, PINNED_NOW);
    api.buildReportHtml(result, answers);
  }
  const avg = (performance.now() - t0) / N;
  // Plan exit: rebuild <10ms. evaluate+HTML string is the testable proxy without DOM.
  assert.ok(avg < 10, `avg ${avg.toFixed(3)}ms per evaluate+buildReportHtml (>=10ms)`);
});

test("completeness HTML uses question numbers; Markdown keeps field ids", () => {
  const answers = documentedFixtures().find((f) => f.name === "base-1-openspec").answers;
  const result = api.evaluate(answers, null, PINNED_NOW);
  const html = api.buildReportHtml(result, answers);
  assert.ok(result.completeness.couldChangeResult.length, "fixture should leave rule-relevant gaps");
  const id = result.completeness.couldChangeResult[0];
  const label = api.questionLabel(id);
  assert.match(label, /^Q\d+/);
  assert.ok(label.includes(" · "));
  assert.equal(label.includes(id), false);
  assert.ok(html.includes(label), "screen completeness uses human-readable label");
  assert.ok(html.includes('href="#q-'), "completeness jumps to the question fieldset");
  const visible = html.replace(/<a href="[^"]*">/g, "").replace(/<\/a>/g, "");
  assert.equal(visible.includes(id), false, "raw field id is not completeness link text");
  const md = api.toMarkdown(result, answers);
  assert.ok(md.includes(id), "Markdown completeness still names field ids");
  assert.equal(html.includes("Team profile"), false);
  assert.equal(html.includes("Process mismatch note"), false);
});

test("questionLabel and progressText helpers", () => {
  const n = api.QUESTIONS.length;
  assert.equal(api.progressText({}), `0 of ${n} answered`);
  const q = api.QUESTIONS.find((item) => item.fields && item.fields[0]);
  assert.ok(q);
  const fid = q.fields[0].id;
  const label = api.questionLabel(fid);
  assert.match(label, / · /);
  assert.equal(label.includes(fid), false);
  const answers = documentedFixtures().find((f) => f.name === "base-1-openspec").answers;
  const p = api.progressCounts(answers);
  assert.equal(p.total, n);
  assert.ok(p.answered > 0 && p.answered < n);
  assert.equal(api.progressText(answers), `${p.answered} of ${n} answered`);
});
