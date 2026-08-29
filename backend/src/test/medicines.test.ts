import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, and, inArray } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, medicinesTable, requestsTable, notificationsTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
const createdPharmacyEmails: string[] = [];
const createdMedicineIds: number[] = [];
const createdRequestIds: number[] = [];

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

async function addMedicine(agent: request.Agent, overrides: Partial<{ quantity: number; expiryDate: string; name: string }> = {}) {
  const res = await agent.post("/api/medicines/add").send({
    name: overrides.name ?? "Ibuprofen 400mg (INV test)",
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
  if (createdRequestIds.length > 0) {
    await db.delete(requestsTable).where(inArray(requestsTable.id, createdRequestIds));
  }
  if (createdMedicineIds.length > 0) {
    await db.delete(medicinesTable).where(inArray(medicinesTable.id, createdMedicineIds));
  }
  for (const email of createdPharmacyEmails) {
    const [pharmacy] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
    if (pharmacy) {
      await db.delete(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacy.id));
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

    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    expect(ids).toContain(valid.id);
    expect(ids).not.toContain(expired.id);
    expect(ids).not.toContain(empty.id);
  });

  it("hides the viewer's own listings", async () => {
    const owner = await registerPharmacy();
    const medicine = await addMedicine(owner.agent, { quantity: 5 });

    const res = await owner.agent.get("/api/medicines/available");
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
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
      ...{ name: "Valid Name" },
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
      ...{ name: "Valid", quantity: 5, price: 1, expiryDate: "2099-01-01" },
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
      ...{ name: "Valid", quantity: 5, price: 1, expiryDate: "2099-01-01" },
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
      ...{ name: "Valid", quantity: 5, price: 1, expiryDate: "2099-01-01" },
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
      ...{ name: "Valid", quantity: 5, price: 1, expiryDate: "2099-01-01" },
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

describe("INV-005b: marketplace excludes unapproved or inactive providers", () => {
  it.each([
    ["pending", { verificationStatus: "pending" }],
    ["rejected", { verificationStatus: "rejected" }],
    ["inactive", { isActive: false }],
  ])("hides listings whose provider is %s", async (_label, patch) => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const medicine = await addMedicine(owner.agent, { quantity: 5 });

    const [ownerRow] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, owner.email));
    await db.update(pharmaciesTable)
      .set(patch as any)
      .where(eq(pharmaciesTable.id, ownerRow.id));

    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    expect(ids).not.toContain(medicine.id);
  });

  it("lists medicines from an approved, active provider", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const medicine = await addMedicine(owner.agent, { quantity: 5 });

    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    expect(ids).toContain(medicine.id);
  });
});

describe("EXP-002: market expiry boundary — expiring today is still valid", () => {
  const rightNow = new Date();
  const today = rightNow.toISOString().slice(0, 10);
  const yesterday = new Date(rightNow.getTime() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(rightNow.getTime() + 86400000).toISOString().slice(0, 10);

  it("hides a listing that expired yesterday", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const med = await addMedicine(owner.agent, { quantity: 5, expiryDate: yesterday });
    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { id: number }) => m.id)).not.toContain(med.id);
  });

  it("lists a listing expiring today", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const med = await addMedicine(owner.agent, { quantity: 5, expiryDate: today });
    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { id: number }) => m.id)).toContain(med.id);
  });

  it("lists a listing expiring tomorrow", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const med = await addMedicine(owner.agent, { quantity: 5, expiryDate: tomorrow });
    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { id: number }) => m.id)).toContain(med.id);
  });
});

describe("SORT-001: deterministic marketplace ordering", () => {
  it("orders by earliest expiry first regardless of name", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();

    const latest = await addMedicine(owner.agent, { name: "Omega", expiryDate: "2031-01-01" });
    const earliest = await addMedicine(owner.agent, { name: "Alpha", expiryDate: "2029-01-01" });
    const middle = await addMedicine(owner.agent, { name: "Beta", expiryDate: "2030-01-01" });

    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    const idx = (id: number) => ids.indexOf(id);
    expect(idx(earliest.id)).toBeLessThan(idx(middle.id));
    expect(idx(middle.id)).toBeLessThan(idx(latest.id));
  });

  it("orders by name ascending when expiry dates are equal", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();

    const zeta = await addMedicine(owner.agent, { name: "Zeta", expiryDate: "2030-06-01" });
    const alpha = await addMedicine(owner.agent, { name: "Alpha", expiryDate: "2030-06-01" });

    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    const idx = (id: number) => ids.indexOf(id);
    expect(idx(alpha.id)).toBeLessThan(idx(zeta.id));
  });

  it("uses medicine id ascending as tie-breaker when expiry and name are equal", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();

    const first = await addMedicine(owner.agent, { name: "Tie Breaker", expiryDate: "2030-06-01" });
    const second = await addMedicine(owner.agent, { name: "Tie Breaker", expiryDate: "2030-06-01" });

    const res = await viewer.agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    const idx = (id: number) => ids.indexOf(id);
    expect(idx(first.id)).toBeLessThan(idx(second.id));
  });

  it.each([
    ["IBUPROFEN", "IBUPROFEN"],
    ["mixed case", "IbUpRoFeN"],
    ["lowercase", "ibuprofen"],
  ])("search by name is case-insensitive (%s)", async (_label, query) => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const med = await addMedicine(owner.agent, { quantity: 5 });

    const res = await viewer.agent.get(`/api/medicines/available?search=${encodeURIComponent(query)}`);
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    expect(ids).toContain(med.id);
  });

  it("trims surrounding whitespace from the search query", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const med = await addMedicine(owner.agent, { quantity: 5 });

    const res = await viewer.agent.get(`/api/medicines/available?search=${encodeURIComponent("   Ibuprofen   ")}`);
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    expect(ids).toContain(med.id);
  });

  it("preserves Commit B rules while searching: expired or 0-quantity or own listings are never returned", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();

    const valid = await addMedicine(owner.agent, { quantity: 5 });
    const expired = await addMedicine(owner.agent, { quantity: 5, expiryDate: "2020-01-01" });
    const empty = await addMedicine(owner.agent, { quantity: 0 });
    const own = await addMedicine(viewer.agent, { quantity: 5 });

    const res = await viewer.agent.get("/api/medicines/available?search=Ibuprofen");
    expect(res.status).toBe(200);
    const ids: number[] = res.body.data.map((m: { id: number }) => m.id);
    expect(ids).toContain(valid.id);
    expect(ids).not.toContain(expired.id);
    expect(ids).not.toContain(empty.id);
    expect(ids).not.toContain(own.id);
  });
});

describe("PERF-003: marketplace pagination", () => {
  it("returns { data, pagination } with a matching total and ordered pages", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const token = `PAG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const a = await addMedicine(owner.agent, { quantity: 5, name: `${token} Alpha` });
    const b = await addMedicine(owner.agent, { quantity: 5, name: `${token} Beta` });

    const pageOne = await viewer.agent.get(
      `/api/medicines/available?search=${encodeURIComponent(token)}&page=1&limit=1`
    );
    expect(pageOne.status).toBe(200);
    expect(Array.isArray(pageOne.body.data)).toBe(true);
    expect(pageOne.body.data).toHaveLength(1);
    expect(pageOne.body.pagination).toEqual({ page: 1, limit: 1, total: 2 });
    expect(pageOne.body.data[0].id).toBe(a.id);

    const pageTwo = await viewer.agent.get(
      `/api/medicines/available?search=${encodeURIComponent(token)}&page=2&limit=1`
    );
    expect(pageTwo.body.data).toHaveLength(1);
    expect(pageTwo.body.data[0].id).toBe(b.id);
  });

  it("applies search before pagination and reports the filtered total", async () => {
    const owner = await registerPharmacy();
    const viewer = await registerPharmacy();
    const token = `SRC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const target = await addMedicine(owner.agent, { quantity: 5, name: `${token} Ibuprofen` });
    await addMedicine(owner.agent, { quantity: 5, name: `${token} Vitamin` });

    const res = await viewer.agent.get(
      `/api/medicines/available?search=${encodeURIComponent(`${token} ibuprofen`)}&page=1&limit=1`
    );
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(target.id);
  });

  it("clamps limit into the 1..100 range", async () => {
    const viewer = await registerPharmacy();
    const hi = await viewer.agent.get("/api/medicines/available?page=1&limit=999");
    expect(hi.status).toBe(200);
    expect(hi.body.pagination.limit).toBe(100);

    const lo = await viewer.agent.get("/api/medicines/available?limit=0");
    expect(lo.status).toBe(200);
    expect(lo.body.pagination.limit).toBe(1);
  });
});

describe("D1-DELETE: deleting a medicine that has requests", () => {
  async function sendPendingRequest(provider: { agent: request.Agent }, requester: { agent: request.Agent }, medicineId: number, key: string) {
    const send = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", key)
      .send({ medicineId, requestedQuantity: 1 });
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);
    return send.body.id as number;
  }

  it("deletes a medicine that has never been requested", async () => {
    const owner = await registerPharmacy();
    const medicine = await addMedicine(owner.agent, { quantity: 5 });

    const res = await owner.agent.delete(`/api/medicines/${medicine.id}/delete`);
    expect(res.status).toBe(200);
    const rows = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(rows).toHaveLength(0);
  });

  it("returns 409 MEDICINE_HAS_REQUESTS while a pending request exists, as JSON not HTML", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    await sendPendingRequest(provider, requester, medicine.id, `${stamp}-del-pending`);

    const res = await provider.agent.delete(`/api/medicines/${medicine.id}/delete`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MEDICINE_HAS_REQUESTS");
    expect(res.headers["content-type"]).toContain("application/json");

    const meds = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(meds).toHaveLength(1);
    expect(meds[0].quantity).toBe(5);
    const reqs = await db.select().from(requestsTable).where(and(eq(requestsTable.medicineId, medicine.id), eq(requestsTable.status, "pending")));
    expect(reqs).toHaveLength(1);
  });

  it.each([
    ["accepted"],
    ["rejected"],
    ["cancelled"],
    ["completed"],
  ])("returns 409 MEDICINE_HAS_REQUESTS while a %s request still references the medicine", async (status) => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const requestId = await sendPendingRequest(provider, requester, medicine.id, `${stamp}-del-${status}`);

    if (status === "accepted") {
      const accept = await provider.agent.post(`/api/requests/${requestId}/accept`);
      expect(accept.status).toBe(200);
    } else if (status === "rejected") {
      const reject = await provider.agent.post(`/api/requests/${requestId}/reject`);
      expect(reject.status).toBe(200);
    } else if (status === "cancelled") {
      const cancel = await requester.agent.post(`/api/requests/${requestId}/cancel`);
      expect(cancel.status).toBe(200);
    } else if (status === "completed") {
      const accept = await provider.agent.post(`/api/requests/${requestId}/accept`);
      expect(accept.status).toBe(200);
      const complete = await requester.agent.post(`/api/requests/${requestId}/complete`);
      expect(complete.status).toBe(200);
    }

    const res = await provider.agent.delete(`/api/medicines/${medicine.id}/delete`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MEDICINE_HAS_REQUESTS");
    expect(res.headers["content-type"]).toContain("application/json");

    const meds = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(meds).toHaveLength(1);
    const [row] = await db.select({ status: requestsTable.status }).from(requestsTable).where(eq(requestsTable.id, requestId));
    expect(row.status).toBe(status);
  });
});
