import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { eq, and, inArray, sql } from "drizzle-orm";
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
  await approvePharmacy(res.body.pharmacy.id);

  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password: "password123456" });
  expect(login.status).toBe(200);
  return { email, agent };
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

async function pharmacyIdByEmail(email: string): Promise<number> {
  const [p] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  return p!.id;
}

describe("EXC-011: provider status is re-checked when sending", () => {
  it("rejects a request when the provider verification is pending", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    await db.update(pharmaciesTable)
      .set({ verificationStatus: "pending", verifiedAt: null })
      .where(eq(pharmaciesTable.id, await pharmacyIdByEmail(provider.email)));

    const res = await sendRequest(requester.agent, medicine.id, 1);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PROVIDER_UNAVAILABLE");
    expect(res.body.error).not.toContain("verification");
  });

  it("rejects a request when the provider verification is rejected, without leaking the reason", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    await db.update(pharmaciesTable)
      .set({ verificationStatus: "rejected", rejectionReason: "docs unclear" })
      .where(eq(pharmaciesTable.id, await pharmacyIdByEmail(provider.email)));

    const res = await sendRequest(requester.agent, medicine.id, 1);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PROVIDER_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toContain("docs unclear");
    expect(JSON.stringify(res.body)).not.toContain("rejectionReason");
  });

  it("rejects a request when the provider pharmacy is inactive", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    await db.update(pharmaciesTable)
      .set({ isActive: false })
      .where(eq(pharmaciesTable.id, await pharmacyIdByEmail(provider.email)));

    const res = await sendRequest(requester.agent, medicine.id, 1);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PROVIDER_UNAVAILABLE");
  });
});

describe("EXP-003: send expiry boundary — expiring today is acceptable", () => {
  const rightNow = new Date();
  const today = rightNow.toISOString().slice(0, 10);
  const yesterday = new Date(rightNow.getTime() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(rightNow.getTime() + 86400000).toISOString().slice(0, 10);

  it("rejects a request for a medicine that expired yesterday with MEDICINE_EXPIRED", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5, expiryDate: yesterday });

    const res = await sendRequest(requester.agent, medicine.id, 1);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MEDICINE_EXPIRED");
  });

  it("accepts a request for a medicine expiring today", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5, expiryDate: today });

    const res = await sendRequest(requester.agent, medicine.id, 1);
    expect(res.status).toBe(201);
    createdRequestIds.push(res.body.id);
  });

  it("accepts a request for a medicine expiring tomorrow", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5, expiryDate: tomorrow });

    const res = await sendRequest(requester.agent, medicine.id, 1);
    expect(res.status).toBe(201);
    createdRequestIds.push(res.body.id);
  });
});

describe("EXC-012: duplicate pending requests are rejected", () => {
  it("allows the first pending request and rejects a second one", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const first = await sendRequest(requester.agent, medicine.id, 2);
    expect(first.status).toBe(201);
    createdRequestIds.push(first.body.id);

    const second = await sendRequest(requester.agent, medicine.id, 3);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("DUPLICATE_PENDING_REQUEST");

    const rows = await db.select().from(requestsTable).where(and(
      eq(requestsTable.requesterPharmacyId, await pharmacyIdByEmail(requester.email)),
      eq(requestsTable.medicineId, medicine.id),
      eq(requestsTable.status, "pending"),
    ));
    expect(rows).toHaveLength(1);
  });

  it("two concurrent sends with different keys yield exactly one success", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const results = await Promise.all([
      sendRequest(requester.agent, medicine.id, 1),
      sendRequest(requester.agent, medicine.id, 1),
    ]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const success = results.find((r) => r.status === 201);
    const conflict = results.find((r) => r.status === 409);
    expect(success!.body.status).toBe("pending");
    expect(conflict!.body.code).toBe("DUPLICATE_PENDING_REQUEST");
    createdRequestIds.push(success!.body.id);

    const rows = await db.select({ id: requestsTable.id }).from(requestsTable).where(and(
      eq(requestsTable.requesterPharmacyId, await pharmacyIdByEmail(requester.email)),
      eq(requestsTable.medicineId, medicine.id),
      eq(requestsTable.status, "pending"),
    ));
    expect(rows).toHaveLength(1);
  });

  it("allows a new request after the previous one was rejected", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const first = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(first.body.id);
    const reject = await provider.agent.post(`/api/requests/${first.body.id}/reject`);
    expect(reject.status).toBe(200);

    const second = await sendRequest(requester.agent, medicine.id, 2);
    expect(second.status).toBe(201);
    createdRequestIds.push(second.body.id);
  });

  it("allows a new request after the previous one was cancelled", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const first = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(first.body.id);
    const cancel = await requester.agent.post(`/api/requests/${first.body.id}/cancel`);
    expect(cancel.status).toBe(200);

    const second = await sendRequest(requester.agent, medicine.id, 2);
    expect(second.status).toBe(201);
    createdRequestIds.push(second.body.id);
  });

  it("allows a new request after the previous one was completed", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const first = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(first.body.id);
    const accept = await provider.agent.post(`/api/requests/${first.body.id}/accept`);
    expect(accept.status).toBe(200);
    const complete = await requester.agent.post(`/api/requests/${first.body.id}/complete`);
    expect(complete.status).toBe(200);

    const second = await sendRequest(requester.agent, medicine.id, 2);
    expect(second.status).toBe(201);
    createdRequestIds.push(second.body.id);
  });
});

describe("EXC-013: idempotency key reuse with a different payload is rejected", () => {
  it("409 when the same key is reused with a different medicine", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medA = await addMedicine(provider.agent, { quantity: 5 });
    const medB = await addMedicine(provider.agent, { quantity: 5 });

    keyCounter += 1;
    const sharedKey = `${stamp}-reuse-med-${keyCounter}`;
    const first = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medA.id, requestedQuantity: 1 });
    expect(first.status).toBe(201);
    createdRequestIds.push(first.body.id);

    const second = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medB.id, requestedQuantity: 1 });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("409 when the same key is reused with a different quantity", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    keyCounter += 1;
    const sharedKey = `${stamp}-reuse-qty-${keyCounter}`;
    const first = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });
    expect(first.status).toBe(201);
    createdRequestIds.push(first.body.id);

    const second = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 2 });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("concurrent identical sends with the same key create one request and return one duplicate", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    keyCounter += 1;
    const sharedKey = `${stamp}-race-key-${keyCounter}`;
    const results = await Promise.all([
      requester.agent.post("/api/requests/send")
        .set("Idempotency-Key", sharedKey)
        .send({ medicineId: medicine.id, requestedQuantity: 1 }),
      requester.agent.post("/api/requests/send")
        .set("Idempotency-Key", sharedKey)
        .send({ medicineId: medicine.id, requestedQuantity: 1 }),
    ]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 201]);

    const duplicate = results.find((r) => r.status === 200);
    expect(duplicate!.body.duplicate).toBe(true);

    const rows = await db.select().from(requestsTable).where(eq(requestsTable.idempotencyKey, sharedKey));
    expect(rows).toHaveLength(1);
    createdRequestIds.push(rows[0].id);
  });

  it("a different key is still blocked while a pending request exists", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const first = await sendRequest(requester.agent, medicine.id, 1);
    expect(first.status).toBe(201);
    createdRequestIds.push(first.body.id);

    const second = await sendRequest(requester.agent, medicine.id, 1);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("DUPLICATE_PENDING_REQUEST");
  });
});

describe("EXC-014: unexpected database errors return a generic 500 without leaking details", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a non-unique database error is not leaked to the client", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    keyCounter += 1;
    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", `${stamp}-exc14a-${keyCounter}`)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.text).not.toContain("boom");
    expect(res.text).not.toContain("Failed query");
  });

  it("a unique violation with an unknown constraint stays generic (no constraint name leaked)", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    keyCounter += 1;
    const drizzleLikeError = new Error("Failed query: insert into \"requests\" ...");
    (drizzleLikeError as { cause?: unknown }).cause = { code: "23505", constraint: "some_unknown_constraint" };
    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw drizzleLikeError;
    });
    const res = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", `${stamp}-exc14b-${keyCounter}`)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.text).not.toContain("some_unknown_constraint");
    expect(res.text).not.toContain("Failed query");
  });
});
