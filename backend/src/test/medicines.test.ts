import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, medicinesTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
const createdPharmacyEmails: string[] = [];
const createdMedicineIds: number[] = [];

async function registerPharmacy() {
  counter += 1;
  const email = `inv-${stamp}-${counter}@example.com`;
  createdPharmacyEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `INV Test Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0790000000",
    city: "Amman",
    address: "Test St.",
    password: "password123456",
  });
  expect(res.status).toBe(201);

  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password: "password123456" });
  expect(login.status).toBe(200);
  return { email, agent };
}

async function addMedicine(agent: request.Agent, overrides: Partial<{ quantity: number; expiryDate: string }> = {}) {
  const res = await agent.post("/api/medicines/add").send({
    name: "Ibuprofen 400mg (INV test)",
    quantity: 10,
    price: 3,
    expiryDate: "2099-01-01",
    ...overrides,
  });
  expect(res.status).toBe(201);
  createdMedicineIds.push(res.body.id);
  return res.body as { id: number };
}

afterAll(async () => {
  if (createdMedicineIds.length > 0) {
    await db.delete(medicinesTable).where(inArray(medicinesTable.id, createdMedicineIds));
  }
  for (const email of createdPharmacyEmails) {
    const [pharmacy] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
    if (pharmacy) {
      await db.delete(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacy.id));
    }
  }
});

describe("INV-005: marketplace hides expired and zero-stock listings", () => {
  it("returns only in-stock, unexpired medicines", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();

    const valid = await addMedicine(owner.agent, { quantity: 10 });
    const expired = await addMedicine(owner.agent, { quantity: 10, expiryDate: "2020-01-01" });
    const empty = await addMedicine(owner.agent, { quantity: 0 });

    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);

    const ids: number[] = res.body.map((m: { id: number }) => m.id);
    expect(ids).toContain(valid.id);
    expect(ids).not.toContain(expired.id);
    expect(ids).not.toContain(empty.id);
  });

  it("hides the viewer's own listings", async () => {
    const owner = await registerPharmacy();
    const medicine = await addMedicine(owner.agent, { quantity: 5 });

    const res = await owner.agent.get("/api/medicines/available");
    const ids: number[] = res.body.map((m: { id: number }) => m.id);
    expect(ids).not.toContain(medicine.id);
  });
});
