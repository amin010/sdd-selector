/**
 * Load an SDD Selector HTML page in a Node vm and return the exported API.
 * Provides module.exports so the IIFE assigns the engine; does not provide
 * document, so bootUi does not run.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
/** Frozen P5 finance-tech page — G-PARITY baseline for v0.4.0. */
export const GOLDEN_V040 = path.join(ROOT, "tests/golden/index-v040.html");
/** @deprecated alias kept for a few call sites during P6 cutover */
export const GOLDEN_PAGE = GOLDEN_V040;
export const CURRENT_PAGE = path.join(ROOT, "index.html");

export function extractScript(html) {
  const m = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
  if (!m) throw new Error("no <script> IIFE found in page");
  return m[1];
}

export function loadPage(htmlPath, { now } = {}) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const source = extractScript(html);
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    globalThis: {},
    console,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    undefined,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    unescape,
    escape,
  };
  // Pin Date.now when requested so evidenceAge.stale is stable.
  if (now != null) {
    const pinned = Number(now);
    sandbox.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) super(pinned);
        else super(...args);
      }
      static now() {
        return pinned;
      }
      static parse(...a) {
        return Date.parse(...a);
      }
      static UTC(...a) {
        return Date.UTC(...a);
      }
    };
    Object.setPrototypeOf(sandbox.Date, Date);
  }
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, {
    filename: path.basename(htmlPath),
    timeout: 10_000,
  });
  const api = module.exports && Object.keys(module.exports).length
    ? module.exports
    : sandbox.globalThis.SDDSelector;
  if (!api || typeof api.evaluate !== "function") {
    throw new Error("page did not export SDDSelector / module.exports API");
  }
  return api;
}

export function loadGolden(opts) {
  return loadPage(GOLDEN_V040, opts);
}

export function loadCurrent(opts) {
  return loadPage(CURRENT_PAGE, opts);
}
