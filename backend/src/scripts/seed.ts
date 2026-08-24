import "../lib/env.js";
import bcrypt from "bcryptjs";
import { db, pool, adminsTable, pharmaciesTable, medicinesTable } from "../db/index.js";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env to seed the administrator.");
  process.exit(1);
}

const PHARMACIES = [
  {
    email: "user1@test.com", password: "user123",
    name: "ØµÙŠØ¯Ù„ÙŠØ© Ø§Ù„Ø´ÙØ§Ø¡", managerName: "Ø£Ø­Ù…Ø¯ Ø§Ù„Ø¹Ù…Ø±ÙŠ",
    phone: "+962 79 555 1010", city: "Ø¹Ù…Ø§Ù†", address: "Ø´Ø§Ø±Ø¹ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ù…Ù†ÙˆØ±Ø©ØŒ Ø§Ù„Ø±Ø§Ø¨ÙŠØ©ØŒ Ø¹Ù…Ø§Ù†",
    medicines: [
      { name: "Ø¨Ø§Ø±Ø§Ø³ÙŠØªØ§Ù…ÙˆÙ„ 500 Ù…Ø¬Ù…", quantity: 120, price: 1.25, expiryDate: "2027-06-30", description: "Ø¹Ù„Ø¨Ø© 20 Ù‚Ø±ØµØ§Ù‹ â€” Ù…Ø³ÙƒÙ† Ù„Ù„Ø£Ù„Ù… ÙˆØ®Ø§ÙØ¶ Ù„Ù„Ø­Ø±Ø§Ø±Ø©" },
      { name: "Ø£Ù…ÙˆÙƒØ³ÙŠØ³ÙŠÙ„ÙŠÙ† 500 Ù…Ø¬Ù…", quantity: 60, price: 4.5, expiryDate: "2026-11-15", description: "Ù…Ø¶Ø§Ø¯ Ø­ÙŠÙˆÙŠ â€” Ø¹Ù„Ø¨Ø© 21 ÙƒØ¨Ø³ÙˆÙ„Ø©" },
      { name: "Ø£ÙˆÙ…ÙŠØ¨Ø±Ø§Ø²ÙˆÙ„ 20 Ù…Ø¬Ù…", quantity: 45, price: 6.25, expiryDate: "2027-03-20", description: "Ø¹Ù„Ø§Ø¬ Ù‚Ø±Ø­Ø© Ø§Ù„Ù…Ø¹Ø¯Ø© â€” Ø¹Ù„Ø¨Ø© 14 ÙƒØ¨Ø³ÙˆÙ„Ø©" },
      { name: "Ø³ÙŠØªØ±Ø§Ø²ÙŠÙ† 10 Ù…Ø¬Ù…", quantity: 80, price: 2.0, expiryDate: "2027-09-10", description: "Ù…Ø¶Ø§Ø¯ Ù„Ù„Ø­Ø³Ø§Ø³ÙŠØ© â€” Ø¹Ù„Ø¨Ø© 30 Ù‚Ø±ØµØ§Ù‹" },
    ],
  },
  {
    email: "user2@test.com", password: "user123",
    name: "ØµÙŠØ¯Ù„ÙŠØ© Ø§Ù„Ø£Ù…Ù„", managerName: "Ù„ÙŠÙ„Ù‰ Ø§Ù„Ø²Ø¹Ø¨ÙŠ",
    phone: "+962 78 444 2020", city: "Ø¥Ø±Ø¨Ø¯", address: "Ø´Ø§Ø±Ø¹ Ø§Ù„Ø¬Ø§Ù…Ø¹Ø© Ø§Ù„Ø£Ø±Ø¯Ù†ÙŠØ©ØŒ Ø¥Ø±Ø¨Ø¯",
    medicines: [
      { name: "Ø¥ÙŠØ¨ÙˆØ¨Ø±ÙˆÙÙŠÙ† 400 Ù…Ø¬Ù…", quantity: 90, price: 3.0, expiryDate: "2027-01-25", description: "Ù…Ø¶Ø§Ø¯ Ù„Ù„Ø§Ù„ØªÙ‡Ø§Ø¨ â€” Ø¹Ù„Ø¨Ø© 30 Ù‚Ø±ØµØ§Ù‹" },
      { name: "Ù…ÙŠØªÙÙˆØ±Ù…ÙŠÙ† 500 Ù…Ø¬Ù…", quantity: 70, price: 5.75, expiryDate: "2026-10-05", description: "Ø¹Ù„Ø§Ø¬ Ø§Ù„Ø³ÙƒØ±ÙŠ Ø§Ù„Ù†ÙˆØ¹ Ø§Ù„Ø«Ø§Ù†ÙŠ â€” Ø¹Ù„Ø¨Ø© 60 Ù‚Ø±ØµØ§Ù‹" },
      { name: "Ø£ØªÙˆØ±ÙØ§Ø³ØªØ§ØªÙŠÙ† 20 Ù…Ø¬Ù…", quantity: 50, price: 8.9, expiryDate: "2027-04-18", description: "Ø®Ø§ÙØ¶ Ù„Ù„ÙƒÙˆÙ„Ø³ØªØ±ÙˆÙ„ â€” Ø¹Ù„Ø¨Ø© 30 Ù‚Ø±ØµØ§Ù‹" },
      { name: "Ø£Ù…Ù„ÙˆØ¯ÙŠØ¨ÙŠÙ† 5 Ù…Ø¬Ù…", quantity: 65, price: 4.2, expiryDate: "2027-08-22", description: "Ø¹Ù„Ø§Ø¬ Ø¶ØºØ· Ø§Ù„Ø¯Ù… â€” Ø¹Ù„Ø¨Ø© 30 Ù‚Ø±ØµØ§Ù‹" },
    ],
  },
  {
    email: "user3@test.com", password: "user123",
    name: "ØµÙŠØ¯Ù„ÙŠØ© Ø§Ù„Ø²Ø±Ù‚Ø§Ø¡ Ø§Ù„Ù…Ø±ÙƒØ²ÙŠØ©", managerName: "Ù…Ø­Ù…Ø¯ Ø§Ù„Ù‚ÙŠØ³ÙŠ",
    phone: "+962 77 333 3030", city: "Ø§Ù„Ø²Ø±Ù‚Ø§Ø¡", address: "Ø´Ø§Ø±Ø¹ Ø§Ù„Ù…Ù„Ùƒ Ø¹Ø¨Ø¯Ø§Ù„Ù„Ù‡ Ø§Ù„Ø«Ø§Ù†ÙŠØŒ Ø§Ù„Ø²Ø±Ù‚Ø§Ø¡",
    medicines: [
      { name: "Ø£Ø²ÙŠØ«Ø±ÙˆÙ…ÙŠØ³ÙŠÙ† 500 Ù…Ø¬Ù…", quantity: 40, price: 9.5, expiryDate: "2026-12-12", description: "Ù…Ø¶Ø§Ø¯ Ø­ÙŠÙˆÙŠ â€” Ø¹Ù„Ø¨Ø© 6 Ø£Ù‚Ø±Ø§Øµ" },
      { name: "Ù„ÙˆØ±Ø§ØªØ§Ø¯ÙŠÙ† 10 Ù…Ø¬Ù…", quantity: 100, price: 2.4, expiryDate: "2027-07-09", description: "Ù…Ø¶Ø§Ø¯ Ù„Ù„Ø­Ø³Ø§Ø³ÙŠØ© â€” Ø¹Ù„Ø¨Ø© 30 Ù‚Ø±ØµØ§Ù‹" },
    ],
  },
];

async function main() {
  console.log("Seeding DoseWise databaseâ€¦");

  // Admin
  const [existingAdmin] = await db.select().from(adminsTable).where(eq(adminsTable.email, ADMIN_EMAIL));
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  if (!existingAdmin) {
    await db.insert(adminsTable).values({ email: ADMIN_EMAIL, passwordHash: adminHash });
    console.log(`âœ“ Created admin: ${ADMIN_EMAIL}`);
  } else {
    await db.update(adminsTable).set({ passwordHash: adminHash }).where(eq(adminsTable.id, existingAdmin.id));
    console.log(`âœ“ Updated admin password: ${ADMIN_EMAIL}`);
  }

  // Pharmacies
  for (const seed of PHARMACIES) {
    const [existing] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.email, seed.email));
    const hash = await bcrypt.hash(seed.password, 10);
    let pharmacyId: number;

    if (!existing) {
      const [created] = await db.insert(pharmaciesTable).values({
        name: seed.name, managerName: seed.managerName, email: seed.email,
        phone: seed.phone, city: seed.city, address: seed.address, passwordHash: hash,
      }).returning();
      pharmacyId = created.id;
      console.log(`âœ“ Created pharmacy: ${seed.email} (${seed.name})`);
    } else {
      await db.update(pharmaciesTable).set({ name: seed.name, managerName: seed.managerName, phone: seed.phone, city: seed.city, address: seed.address, passwordHash: hash }).where(eq(pharmaciesTable.id, existing.id));
      pharmacyId = existing.id;
      console.log(`âœ“ Updated pharmacy: ${seed.email} (${seed.name})`);
    }

    const existingMeds = await db.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.pharmacyId, pharmacyId));
    const existingNames = new Set(existingMeds.map(m => m.name));
    let added = 0;
    for (const med of seed.medicines) {
      if (existingNames.has(med.name)) continue;
      await db.insert(medicinesTable).values({ pharmacyId, ...med, isAvailable: true });
      added++;
    }
    console.log(`   â†’ ${added} new medicines added`);
  }

  console.log("âœ… Seed complete.");
}

main().catch(err => { console.error("Seed failed:", err); process.exitCode = 1; }).finally(() => pool.end());
