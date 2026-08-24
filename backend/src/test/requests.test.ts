import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray, sql } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, medicinesTable, requestsTable, notificationsTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;

const createdPharmacyEmails: string[] = [];
const createdMedicineIds: number[] = [];
const createdRequestIds: number[] = [];

async function registerPharmacy(): Promise<{ email: string; agent: request.Agent }> {
  counter += 1;
  const email = `exc-${stamp}-${counter}@example.com`;
  createdPharmacyEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `EXC Test Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0790000000",
    city: "Irbid",
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
    name: "Paracetamol 500mg (EXC test)",
    quantity: 5,
    price: 1.25,
    expiryDate: "2099-01-01",
    ...overrides,
  });
  expect(res.status).toBe(201);
  createdMedicineIds.push(res.body.id);
  return res.body as { id: number };
}

let keyCounter = 0;
async function sendRequest(agent: request.Agent, medicineId: number, requestedQuantity: number) {
  keyCounter += 1;
  return agent.post("/api/requests/send")
    .set("Idempotency-Key", `${stamp}-key-${keyCounter}`)
    .send({ medicineId, requestedQuantity });
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

describe("EXC-001: requested quantity must be >=1 and within stock", () => {
  it("rejects zero", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const res = await sendRequest(requester.agent, medicine.id, 0);

    expect(res.status).toBe(400);
  });

  it("rejects negative values", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const res = await sendRequest(requester.agent, medicine.id, -3);

    expect(res.status).toBe(400);
  });

  it("rejects non-integer values", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const res = await sendRequest(requester.agent, medicine.id, 1.5);

    expect(res.status).toBe(400);
  });

  it("rejects quantities exceeding available stock", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const res = await sendRequest(requester.agent, medicine.id, 6);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("exceeds");
  });

  it("rejects requests for expired medicines", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { expiryDate: "2020-01-01" });

    const res = await sendRequest(requester.agent, medicine.id, 1);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("expired");
  });

  it("accepts a valid request and stores it as pending", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const res = await sendRequest(requester.agent, medicine.id, 3);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    createdRequestIds.push(res.body.id);
  });
});

describe("EXC-006/EXC-007: atomic acceptance with stock deduction", () => {
  it("accepting a request deducts stock atomically", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    const accept = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(accept.status).toBe(200);
    expect(accept.body.remainingStock).toBe(3);

    const [after] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(after.quantity).toBe(3);
  });

  it("failing acceptance leaves no partial changes", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 2 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect((await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicine.id)))[0].quantity).toBe(0);

    const lateSend = await sendRequest(requester.agent, medicine.id, 5);
    expect(lateSend.status).toBe(400);
  });

  it("EXC-007: concurrent accepts on the last unit â€” exactly one succeeds", async () => {
    const provider = await registerPharmacy();
    const requesterA = await registerPharmacy();
    const requesterB = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 1 });

    const sendA = await sendRequest(requesterA.agent, medicine.id, 1);
    const sendB = await sendRequest(requesterB.agent, medicine.id, 1);
    createdRequestIds.push(sendA.body.id, sendB.body.id);

    const results = await Promise.all([
      provider.agent.post(`/api/requests/${sendA.body.id}/accept`),
      provider.agent.post(`/api/requests/${sendB.body.id}/accept`),
    ]);

    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const [after] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(after.quantity).toBe(0);

    const rows = await db.select().from(requestsTable).where(inArray(requestsTable.id, [sendA.body.id, sendB.body.id]));
    const acceptedCount = rows.filter((r) => r.status === "accepted").length;
    expect(acceptedCount).toBe(1);
  });
});

describe("EXC-004: status transitions follow the state machine", () => {
  it("provider accepts a pending request exactly once", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    const requestId = send.body.id as number;
    createdRequestIds.push(requestId);

    const accept = await provider.agent.post(`/api/requests/${requestId}/accept`);
    expect(accept.status).toBe(200);

    const again = await provider.agent.post(`/api/requests/${requestId}/accept`);
    expect(again.status).toBe(400);
    expect(again.body.error).toContain("accepted");

    const rejectAfterAccept = await provider.agent.post(`/api/requests/${requestId}/reject`);
    expect(rejectAfterAccept.status).toBe(400);
  });

  it("only the provider may accept", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const bystander = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    const requestId = send.body.id as number;
    createdRequestIds.push(requestId);

    const forbidden = await bystander.agent.post(`/api/requests/${requestId}/accept`);
    expect(forbidden.status).toBe(403);
  });

  it("database rejects status values outside the enum", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    const requestId = send.body.id as number;
    createdRequestIds.push(requestId);

    let violated = false;
    try {
      await db.execute(
        sql`UPDATE requests SET status = 'banana' WHERE id = ${requestId}`,
      );
    } catch {
      violated = true;
    }
    expect(violated).toBe(true);
  });
});

describe("EXC-003: request snapshots price and name at creation", () => {
  it("snapshot survives later edits to the medicine listing", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    expect(send.status).toBe(201);
    expect(send.body.unitPrice).toBe("1.25");
    createdRequestIds.push(send.body.id);

    await db.update(medicinesTable)
      .set({ name: "Renamed Medicine", price: "9.99" })
      .where(eq(medicinesTable.id, medicine.id));

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.unitPrice).toBe("1.25");
    expect(row.medicineName).toBe("Paracetamol 500mg (EXC test)");
  });
});

describe("EXC-010: idempotency prevents duplicate requests", () => {
  it("same key returns the original request and creates no duplicate", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    keyCounter += 1;
    const sharedKey = `${stamp}-idem-${keyCounter}`;
    const first = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 2 });
    expect(first.status).toBe(201);

    const second = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 2 });
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const rows = await db.select().from(requestsTable).where(eq(requestsTable.idempotencyKey, sharedKey));
    expect(rows).toHaveLength(1);
    createdRequestIds.push(first.body.id);
  });

  it("missing idempotency key is rejected", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const res = await requester.agent.post("/api/requests/send")
      .send({ medicineId: medicine.id, requestedQuantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Idempotency");
  });
});
