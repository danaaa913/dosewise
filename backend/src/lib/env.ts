import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const candidates = [
  resolve(here, "../../.env"),
  resolve(here, "../../../.env"),
];

let loaded = false;
for (const candidate of candidates) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    loaded = true;
    break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL is missing. Looked for .env in:\n${candidates.join("\n")}\nCopy .env.example to .env and fill it in.`,
  );
}

export const envLoaded = loaded;
