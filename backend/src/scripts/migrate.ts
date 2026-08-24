import "../lib/env.js";
import { pool } from "../db/index.js";

async function run(sql: string, label: string) {
  await pool.query(sql);
  console.log(`  ok: ${label}`);
}

async function main() {
  console.log("Running idempotent DoseWise migrations...");

  await run(`
    DO $mig$
    DECLARE has_username boolean; has_email boolean;
    BEGIN
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'username') INTO has_username;
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'email') INTO has_email;
      IF has_username AND NOT has_email THEN EXECUTE 'ALTER TABLE admins RENAME COLUMN username TO email';
      ELSIF has_username AND has_email THEN EXECUTE 'UPDATE admins SET email = username WHERE email IS NULL'; EXECUTE 'ALTER TABLE admins DROP COLUMN username';
      END IF;
    END $mig$;
  `, "admins.username -> admins.email rename");

  await run(`ALTER TABLE admins ALTER COLUMN email SET NOT NULL`, "admins.email NOT NULL");
  console.log("Migrations complete.");
}

main().catch(err => { console.error("Migration failed:", err); process.exit(1); }).finally(() => pool.end());
