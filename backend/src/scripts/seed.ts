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

const adminEmail: string = ADMIN_EMAIL;
const adminPassword: string = ADMIN_PASSWORD;

const PHARMACIES = [
  {
    email: "user1@test.com", password: "user123",
    name: "صيدلية الشفاء", managerName: "أحمد العمري",
    phone: "+962 79 555 1010", city: "عمان", address: "شارع المدينة المنورة، الرابية، عمان",
    medicines: [
      { name: "باراسيتامول 500 مجم", quantity: 120, price: "1.25", expiryDate: "2027-06-30", description: "علبة 20 قرصاً — مسكن للألم وخافض للحرارة" },
      { name: "أموكسيسيلين 500 مجم", quantity: 60, price: "4.5", expiryDate: "2026-11-15", description: "مضاد حيوي — علبة 21 كبسولة" },
      { name: "أوميبرازول 20 مجم", quantity: 45, price: "6.25", expiryDate: "2027-03-20", description: "علاج قرحة المعدة — علبة 14 كبسولة" },
      { name: "سيترازين 10 مجم", quantity: 80, price: "2.0", expiryDate: "2027-09-10", description: "مضاد للحساسية — علبة 30 قرصاً" },
    ],
  },
  {
    email: "user2@test.com", password: "user123",
    name: "صيدلية الأمل", managerName: "ليلى الزعبي",
    phone: "+962 78 444 2020", city: "إربد", address: "شارع الجامعة الأردنية، إربد",
    medicines: [
      { name: "إيبوبروفين 400 مجم", quantity: 90, price: "3.0", expiryDate: "2027-01-25", description: "مضاد للالتهاب — علبة 30 قرصاً" },
      { name: "ميتفورمين 500 مجم", quantity: 70, price: "5.75", expiryDate: "2026-10-05", description: "علاج السكري النوع الثاني — علبة 60 قرصاً" },
      { name: "أتورفاستاتين 20 مجم", quantity: 50, price: "8.9", expiryDate: "2027-04-18", description: "خافض للكولسترول — علبة 30 قرصاً" },
      { name: "أملوديبين 5 مجم", quantity: 65, price: "4.2", expiryDate: "2027-08-22", description: "علاج ضغط الدم — علبة 30 قرصاً" },
    ],
  },
  {
    email: "user3@test.com", password: "user123",
    name: "صيدلية الزرقاء المركزية", managerName: "محمد القيسي",
    phone: "+962 77 333 3030", city: "الزرقاء", address: "شارع الملك عبدالله الثاني، الزرقاء",
    medicines: [
      { name: "أزيثروميسين 500 مجم", quantity: 40, price: "9.5", expiryDate: "2026-12-12", description: "مضاد حيوي — علبة 6 أقراص" },
      { name: "لوراتادين 10 مجم", quantity: 100, price: "2.4", expiryDate: "2027-07-09", description: "مضاد للحساسية — علبة 30 قرصاً" },
    ],
  },
];

async function main() {
  console.log("Seeding DoseWise database…");

  // Admin
  const [existingAdmin] = await db.select().from(adminsTable).where(eq(adminsTable.email, adminEmail));
  const adminHash = await bcrypt.hash(adminPassword, 10);
  if (!existingAdmin) {
    await db.insert(adminsTable).values({ email: adminEmail, passwordHash: adminHash });
    console.log(`✓ Created admin: ${ADMIN_EMAIL}`);
  } else {
    await db.update(adminsTable).set({ passwordHash: adminHash }).where(eq(adminsTable.id, existingAdmin.id));
    console.log(`✓ Updated admin password: ${ADMIN_EMAIL}`);
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
      console.log(`✓ Created pharmacy: ${seed.email} (${seed.name})`);
    } else {
      await db.update(pharmaciesTable).set({ name: seed.name, managerName: seed.managerName, phone: seed.phone, city: seed.city, address: seed.address, passwordHash: hash }).where(eq(pharmaciesTable.id, existing.id));
      pharmacyId = existing.id;
      console.log(`✓ Updated pharmacy: ${seed.email} (${seed.name})`);
    }

    const existingMeds = await db.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.pharmacyId, pharmacyId));
    const existingNames = new Set(existingMeds.map(m => m.name));
    let added = 0;
    for (const med of seed.medicines) {
      if (existingNames.has(med.name)) continue;
      await db.insert(medicinesTable).values({ pharmacyId, ...med, isAvailable: true });
      added++;
    }
    console.log(`   → ${added} new medicines added`);
  }

  console.log("✅ Seed complete.");
}

main().catch(err => { console.error("Seed failed:", err); process.exitCode = 1; }).finally(() => pool.end());
