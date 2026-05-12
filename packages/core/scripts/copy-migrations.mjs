// Copies the SQL migrations into dist/ so the compiled `migrate.js` can
// resolve `./migrations` relative to itself at runtime. tsc on its own only
// emits .js/.d.ts, so this fills the gap.
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/db/migrations");
const dest = resolve(here, "../dist/db/migrations");

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`copied migrations -> ${dest}`);
