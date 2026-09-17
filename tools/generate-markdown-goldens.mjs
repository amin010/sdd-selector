/**
 * G-MARKDOWN — generate golden Markdown snapshots for documented fixtures.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCurrent } from "./load-page.mjs";
import { documentedFixtures, PINNED_NOW } from "./corpus.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../tests/markdown");

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const api = loadCurrent({ now: PINNED_NOW });
  const fixtures = documentedFixtures();
  const index = [];
  for (const { name, answers } of fixtures) {
    const result = api.evaluate(answers, null, PINNED_NOW);
    const md = api.toMarkdown(result, answers);
    const file = `${name}.md`;
    fs.writeFileSync(path.join(OUT, file), md);
    index.push(file);
  }
  fs.writeFileSync(
    path.join(OUT, "INDEX.json"),
    JSON.stringify(index, null, 2) + "\n",
  );
  console.log(`wrote ${index.length} golden markdown files to ${OUT}`);
}

main();
