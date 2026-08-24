import "../lib/env.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../db/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../../drizzle");

async function main() {
  console.log("Running versioned DoseWise migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
}

main()
  .catch((err) => { console.error("Migration failed:", err); process.exit(1); })
  .finally(() => pool.end());
