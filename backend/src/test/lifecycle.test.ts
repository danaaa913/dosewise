import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, medicinesTable, requestsTable, notificationsTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
let keyCounter = 0;
const createdPharmacyEmails: string[] = [];
const createdMedicineIds: number[] = [];
const createdRequestIds: number[] = [];

async function registerPharmacy(): Promise<{ agent: request.Agent; email: string }> {
  counter += 1;
  const email = `life-${stamp}-${counter}@example.com`;
  createdPharmacyEmails.push(email);
  const reg = await request(app).post("/api/auth/register").send({
    name: `Lifecycle Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0790000000",
    city: "Amman",
    address: "Test St.",
    password: "password123456",
  }).expect(201);
  await approvePharmacy(reg.body.pharmacy.id);

  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "password123456" }).expect(200);
  return { agent, email };
}


async function approvePharmacy(pharmacyId: number) {
  const admin = request.agent(app);
  await admin.post("/api/admin/login").send({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
  }).expect(200);
  await admin.post(`/api/admin/pharmacies/${pharmacyId}/verification`)
    .send({ decision: "approve" }).expect(200);
}

async function addMedicine(agent: request.Agent) {
  const res = await agent.post("/api/medicines/add").send({
    name: "LifeCycle Medicine",
    quantity: 10,
    price: 5.0,
    expiryDate: "2099-01-01",
  }).expect(201);
  createdMedicineIds.push(res.body.id);
  return res.body as { id: number };
}

async function sendRequest(agent: request.Agent, medicineId: number, quantity = 2) {
  keyCounter += 1;
  const res = await agent.post("/api/requests/send")
    .set("Idempotency-Key", `${stamp}-life-${keyCounter}`)
    .send({ medicineId, requestedQuantity: quantity });
  if (res.status === 201) createdRequestIds.push(res.body.id);
  return res;
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

describe("EXC-008: requester cancels a pending request", () => {
  it("requester cancels pending successfully", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    const cancel = await requester.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(cancel.status).toBe(200);

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.status).toBe("cancelled");
  });

  it("provider cannot cancel someone else's request", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    const res = await provider.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(res.status).toBe(403);
  });

  it("an accepted request cannot be cancelled", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);
    const cancel = await requester.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(cancel.status).toBe(400);
    expect(cancel.body.error).toContain("accepted");
  });
});

describe("EXC-014: requester completes an accepted request", () => {
  it("pending request cannot be completed directly", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    const res = await requester.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("pending");
  });

  it("accepted request becomes completed by the requester; provider notified", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);
    const done = await requester.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(done.status).toBe(200);

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.status).toBe("completed");

    const [providerRow] = await db.select({ id: pharmaciesTable.id })
      .from(pharmaciesTable).where(eq(pharmaciesTable.email, provider.email));
    const notes = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.pharmacyId, providerRow.id));
    expect(notes.some((n) => n.message.includes("اكتمل"))).toBe(true);
  });

  it("completing twice fails", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);
    await requester.agent.post(`/api/requests/${send.body.id}/complete`).expect(200);
    const again = await requester.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(again.status).toBe(400);
  });

  it("only the requester may confirm receipt", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const bystander = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);
    const send = await sendRequest(requester.agent, medicine.id);

    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);
    const res = await bystander.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(res.status).toBe(403);
  });
});
