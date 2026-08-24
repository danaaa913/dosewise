import "../lib/env.js";
import { Client } from "pg";

const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/postgres";

async function main() {
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS dosewise WITH (FORCE)`);
  await admin.query(`CREATE DATABASE dosewise`);
  console.log("Database dosewise recreated.");
  await admin.end();
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
