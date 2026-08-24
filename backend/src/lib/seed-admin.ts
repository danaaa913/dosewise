import bcrypt from "bcryptjs";
import { db, adminsTable } from "../db/index.js";
import { logger } from "./logger.js";

const ADMIN_EMAIL = "admin@dosewise.com";
const ADMIN_PASSWORD = "admin123";

export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const inserted = await db
      .insert(adminsTable)
      .values({ email: ADMIN_EMAIL, passwordHash })
      .onConflictDoNothing({ target: adminsTable.email })
      .returning({ id: adminsTable.id });

    if (inserted.length > 0) {
      logger.info({ email: ADMIN_EMAIL }, "Seeded default admin");
    } else {
      logger.info({ email: ADMIN_EMAIL }, "Default admin already present");
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure default admin");
  }
}
