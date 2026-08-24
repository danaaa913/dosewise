import bcrypt from "bcryptjs";
import { db, adminsTable } from "../db/index.js";
import { logger } from "./logger.js";

export async function ensureDefaultAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD are required so the platform can create its administrator. Set them in your .env file.",
    );
  }

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const inserted = await db
      .insert(adminsTable)
      .values({ email: adminEmail, passwordHash })
      .onConflictDoNothing({ target: adminsTable.email })
      .returning({ id: adminsTable.id });

    if (inserted.length > 0) {
      logger.info({ email: adminEmail }, "Seeded admin from environment");
    } else {
      logger.info({ email: adminEmail }, "Admin already present");
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure default admin");
    throw err;
  }
}
