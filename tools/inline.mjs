/**
 * @deprecated Prefer `node tools/build.mjs` which inlines both the pack and expr.
 * Kept as a thin alias so older docs/scripts keep working.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const build = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "build.mjs");
const result = spawnSync(process.execPath, [build, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status == null ? 1 : result.status);
