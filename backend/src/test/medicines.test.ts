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
  await db.update(pharmaciesTable)
    .set({ verificationStatus: "approved", verifiedAt: new Date() })
    .where(eq(pharmaciesTable.id, res.body.pharmacy.id));

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

describe("MED-VALIDATION: add/update contracts", () => {
  it("accepts quantity 0 and price 0", async () => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid Zero",
      quantity: 0,
      price: 0,
      expiryDate: "2099-12-31",
    });
    expect(res.status).toBe(201);
    createdMedicineIds.push(res.body.id);
  });

  it("accepts max quantity and max price with 2 decimals", async () => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid Max",
      quantity: 2147483647,
      price: 99999999.99,
      expiryDate: "2099-12-31",
    });
    expect(res.status).toBe(201);
    createdMedicineIds.push(res.body.id);
  });

  it("accepts price 1.25 and leap date 2028-02-29", async () => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Leap Valid",
      quantity: 5,
      price: 1.25,
      expiryDate: "2028-02-29",
    });
    expect(res.status).toBe(201);
    createdMedicineIds.push(res.body.id);
  });

  it("accepts a valid past date", async () => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Past Date Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2020-01-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.expiryDate).toBe("2020-01-01");
    createdMedicineIds.push(res.body.id);
  });

  it("accepts description of exactly 500 chars", async () => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Desc Max Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      description: "A".repeat(500),
    });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe("A".repeat(500));
    createdMedicineIds.push(res.body.id);
  });

  it.each([
    ["empty name", { name: "" }],
    ["name too short", { name: "A" }],
    ["name too long", { name: "A".repeat(101) }],
    ["name whitespace", { name: "   " }],
  ])("rejects add with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid Name",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      ...override,
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ["quantity -1", { quantity: -1 }],
    ["quantity 1.5", { quantity: 1.5 }],
    ["quantity > max", { quantity: 2147483648 }],
    ["quantity whitespace", { quantity: "   " }],
    ["quantity empty string", { quantity: "" }],
  ])("rejects add with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      ...override,
    } as any);
    expect(res.status).toBe(400);
  });

  it.each([
    ["quantity non-numeric string", { quantity: "abc" }],
    ["quantity null", { quantity: null }],
  ])("rejects add with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      ...override,
    } as any);
    expect(res.status).toBe(400);
  });

  it.each([
    ["price -1", { price: -1 }],
    ["price 1.999", { price: 1.999 }],
    ["price > max", { price: 100000000 }],
    ["price whitespace", { price: "   " }],
    ["price empty string", { price: "" }],
  ])("rejects add with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      ...override,
    } as any);
    expect(res.status).toBe(400);
  });

  it.each([
    ["price non-numeric string", { price: "abc" }],
    ["price null", { price: null }],
  ])("rejects add with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      ...override,
    } as any);
    expect(res.status).toBe(400);
  });

  it.each([
    ["expiry bad format", { expiryDate: "01-01-2026" }],
    ["expiry invalid 2026-02-30", { expiryDate: "2026-02-30" }],
    ["expiry invalid 2026-13-01", { expiryDate: "2026-13-01" }],
  ])("rejects add with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid",
      quantity: 5,
      price: 1,
      ...override,
    } as any);
    expect(res.status).toBe(400);
  });

  it("rejects description >500", async () => {
    const owner = await registerPharmacy();
    const res = await owner.agent.post("/api/medicines/add").send({
      name: "Valid",
      quantity: 5,
      price: 1,
      expiryDate: "2099-01-01",
      description: "A".repeat(501),
    });
    expect(res.status).toBe(400);
  });

  it("rejects update with empty body", async () => {
    const owner = await registerPharmacy();
    const med = await addMedicine(owner.agent);
    const res = await owner.agent.put(`/api/medicines/${med.id}/update`).send({});
    expect(res.status).toBe(400);
  });

  it("rejects update with unknown fields only", async () => {
    const owner = await registerPharmacy();
    const med = await addMedicine(owner.agent);
    const res = await owner.agent.put(`/api/medicines/${med.id}/update`).send({ unknownField: 123 } as any);
    expect(res.status).toBe(400);
  });

  it.each([
    ["quantity empty string", { quantity: "" }],
    ["price empty string", { price: "" }],
    ["quantity whitespace", { quantity: "   " }],
    ["price whitespace", { price: "   " }],
  ])("rejects update with %s", async (_label, override) => {
    const owner = await registerPharmacy();
    const med = await addMedicine(owner.agent);
    const res = await owner.agent.put(`/api/medicines/${med.id}/update`).send(override as any);
    expect(res.status).toBe(400);
  });

  it("valid PUT stores all values and clears the description", async () => {
    const owner = await registerPharmacy();
    const created = await owner.agent.post("/api/medicines/add").send({
      name: "Clearing Desc",
      quantity: 3,
      price: 1.5,
      expiryDate: "2099-01-01",
      description: "Take with food",
    });
    expect(created.status).toBe(201);
    expect(created.body.description).toBe("Take with food");
    createdMedicineIds.push(created.body.id);

    const res = await owner.agent.get("/api/medicines/my");
    const before = res.body.find((m: { id: number }) => m.id === created.body.id);
    expect(before.description).toBe("Take with food");

    const upd = await owner.agent.put(`/api/medicines/${created.body.id}/update`).send({
      name: "Clearing Desc v2",
      quantity: 7,
      price: 2.25,
      expiryDate: "2030-06-15",
      description: "",
    });
    expect(upd.status).toBe(200);
    expect(upd.body.description).toBe("");

    const afterRes = await owner.agent.get("/api/medicines/my");
    const after = afterRes.body.find((m: { id: number }) => m.id === created.body.id);
    expect(after).toBeTruthy();
    expect(after.name).toBe("Clearing Desc v2");
    expect(after.quantity).toBe(7);
    expect(after.price).toBe("2.25");
    expect(after.expiryDate).toBe("2030-06-15");
    expect(after.description).toBe("");
  });
});
