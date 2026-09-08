import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "artifacts/amazonscope/dist/public");
const dest = path.join(root, "artifacts/api-server/dist/public");

if (!fs.existsSync(path.join(source, "index.html"))) {
  console.error(
    `[copy-frontend-for-render] Frontend build missing at ${source}. ` +
      "Did the Vite build succeed? Ensure PORT and BASE_PATH are set.",
  );
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(source, dest, { recursive: true });

console.log(`[copy-frontend-for-render] Copied frontend → ${dest}`);
