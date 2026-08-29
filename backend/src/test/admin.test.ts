import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { count, eq, inArray } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, medicinesTable, notificationsTable, auditLogsTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
const createdPharmacyEmails: string[] = [];
const createdMedicineIds: number[] = [];
const approvedPharmacyIds: number[] = [];

async function registerPendablePharmacy() {
  counter += 1;
  const email = `adm-${stamp}-${counter}@example.com`;
  createdPharmacyEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `Admin Test Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0793217654",
    city: "Zarqa",
    address: "Admin Test St.",
    password: "password123456",
  }).expect(201);
  return { email, pharmacyId: res.body.pharmacy.id as number };
}

async function adminSession() {
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
  }).expect(200);
  return agent;
}

async function approvePharmacy(pharmacyId: number) {
  const admin = await adminSession();
  await admin.post(`/api/admin/pharmacies/${pharmacyId}/verification`)
    .send({ decision: "approve" }).expect(200);
  approvedPharmacyIds.push(pharmacyId);
}

async function registerApprovedPharmacy() {
  const { email, pharmacyId } = await registerPendablePharmacy();
  await approvePharmacy(pharmacyId);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "password123456" }).expect(200);
  return { email, agent, pharmacyId };
}

async function addMedicine(agent: request.Agent) {
  counter += 1;
  const res = await agent.post("/api/medicines/add").send({
    name: `Admin Test Med ${stamp}-${counter}`,
    quantity: 7,
    price: 3.5,
    expiryDate: "2099-01-01",
  }).expect(201);
  createdMedicineIds.push(res.body.id);
  return res.body as { id: number };
}

async function countPharmacies(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(pharmaciesTable);
  return row.count;
}

async function countMedicines(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(medicinesTable);
  return row.count;
}

afterAll(async () => {
  if (createdMedicineIds.length > 0) {
    await db.delete(medicinesTable).where(inArray(medicinesTable.id, createdMedicineIds));
  }
  if (approvedPharmacyIds.length > 0) {
    await db.delete(auditLogsTable).where(inArray(auditLogsTable.targetId, approvedPharmacyIds));
    await db.delete(notificationsTable).where(inArray(notificationsTable.pharmacyId, approvedPharmacyIds));
  }
  for (const email of createdPharmacyEmails) {
    const [p] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
    if (p) {
      await db.delete(notificationsTable).where(eq(notificationsTable.pharmacyId, p.id));
      await db.delete(pharmaciesTable).where(eq(pharmaciesTable.id, p.id));
    }
  }
});

describe("PERF-003: admin lists paginate with an envelope and exact totals", () => {
  it("pharmacies: no params default to page 1 / limit 20, total matches the database, fixtures visible on their page", async () => {
    const emails = [await registerPendablePharmacy(), await registerPendablePharmacy(), await registerPendablePharmacy()]
      .map((p) => p.email);

    const admin = await adminSession();
    const res = await admin.get("/api/admin/pharmacies");
    expect(res.status).toBe(200);

    const total = await countPharmacies();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total });

    const rows = res.body.data;
    const createdAts = rows.map((p: { createdAt: string }) => p.createdAt);
    expect(createdAts).toEqual([...createdAts].sort());

    const lastPage = await admin.get(`/api/admin/pharmacies?page=${Math.ceil(total / 20)}&limit=20`);
    expect(lastPage.body.pagination.total).toBe(total);
    for (const email of emails) {
      expect(lastPage.body.data.some((p: { email: string }) => p.email === email)).toBe(true);
    }
  });

  it("medicines: envelope shape, default page/limit, exact total, joined pharmacy name", async () => {
    const { agent } = await registerApprovedPharmacy();
    const medicine = await addMedicine(agent);

    const admin = await adminSession();
    const res = await admin.get("/api/admin/medicines");
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: await countMedicines() });

    let row: { id: number; name: string; pharmacyName: string; pharmacyCity: string } | undefined;
    for (let page = 1; page <= 100; page += 1) {
      const pageRes = await admin.get(`/api/admin/medicines?limit=100&page=${page}`);
      row = pageRes.body.data.find((m: { id: number }) => m.id === medicine.id);
      if (row || pageRes.body.data.length === 0) break;
    }
    expect(row).toBeTruthy();
    expect(row!.name.startsWith("Admin Test Med")).toBe(true);
    expect(row!.pharmacyName).toEqual(expect.any(String));
    expect(row!.pharmacyCity).toEqual(expect.any(String));
  });

  it("paginates by limit/page in ascending creation order with disjoint pages", async () => {
    for (let i = 0; i < 3; i += 1) {
      await registerPendablePharmacy();
    }

    const admin = await adminSession();
    const page1 = await admin.get("/api/admin/pharmacies?limit=2&page=1");
    const page2 = await admin.get("/api/admin/pharmacies?limit=2&page=2");

    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(page1.body.pagination.total).toBeGreaterThanOrEqual(3);
    expect(page2.body.pagination.total).toBe(page1.body.pagination.total);
    expect(page2.body.data.length).toBeGreaterThan(0);

    const ids1 = new Set(page1.body.data.map((p: { id: number }) => p.id));
    for (const row of page2.body.data) {
      expect(ids1.has(row.id)).toBe(false);
    }
  });

  it("clamps limit to 1..100, ignores invalid values, and clamps page to >=1", async () => {
    await registerPendablePharmacy();

    const admin = await adminSession();
    const zero = await admin.get("/api/admin/pharmacies?limit=0");
    expect(zero.body.data).toHaveLength(1);
    expect(zero.body.pagination.limit).toBe(1);

    const negative = await admin.get("/api/admin/pharmacies?limit=-4");
    expect(negative.body.data).toHaveLength(1);
    expect(negative.body.pagination.limit).toBe(1);

    const huge = await admin.get("/api/admin/pharmacies?limit=500&page=1");
    expect(huge.body.pagination.limit).toBe(100);

    const garbage = await admin.get("/api/admin/pharmacies?limit=abc");
    expect(garbage.body.pagination.limit).toBe(20);
    expect(garbage.body.pagination.page).toBe(1);

    const badPage = await admin.get("/api/admin/pharmacies?page=0&limit=1");
    expect(badPage.body.pagination.page).toBe(1);
    expect(badPage.body.data).toHaveLength(1);
  });

  it("authorization is still enforced for both lists", async () => {
    const anonPharmacy = await request(app).get("/api/admin/pharmacies");
    expect(anonPharmacy.status).toBe(401);
    const anonMedicines = await request(app).get("/api/admin/medicines");
    expect(anonMedicines.status).toBe(401);

    const { agent } = await registerApprovedPharmacy();
    const asPharmacy = await agent.get("/api/admin/pharmacies");
    expect(asPharmacy.status).toBe(401);
    const medAsPharmacy = await agent.get("/api/admin/medicines");
    expect(medAsPharmacy.status).toBe(401);
  });
});