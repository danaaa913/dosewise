import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
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

expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(res.body.error).toContain("Insufficient stock");
  });

  it("rejects requests for expired medicines", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { expiryDate: "2020-01-01" });

const res = await sendRequest(requester.agent, medicine.id, 1);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MEDICINE_EXPIRED");
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
    expect(lateSend.status).toBe(409);
    expect(lateSend.body.code).toBe("INSUFFICIENT_STOCK");
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
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("REQUEST_INVALID_STATE");
    expect(again.body.error).toContain("accepted");

    const rejectAfterAccept = await provider.agent.post(`/api/requests/${requestId}/reject`);
    expect(rejectAfterAccept.status).toBe(409);
    expect(rejectAfterAccept.body.code).toBe("REQUEST_INVALID_STATE");
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
    expect(res.status).toBe(409);
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

  it("a database failure inside the send transaction is not leaked and leaves no request", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    keyCounter += 1;
    const sharedKey = `${stamp}-exc14a-${keyCounter}`;
    vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("boom"));
    const res = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.text).not.toContain("boom");
    expect(res.text).not.toContain("Failed query");

    const rows = await db.select().from(requestsTable).where(eq(requestsTable.idempotencyKey, sharedKey));
    expect(rows).toHaveLength(0);
  });

  it("a unique violation with an unknown constraint stays generic (no constraint name leaked)", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    keyCounter += 1;
    const drizzleLikeError = new Error("Failed query: insert into \"requests\" ...");
    (drizzleLikeError as { cause?: unknown }).cause = { code: "23505", constraint: "some_unknown_constraint" };
    vi.spyOn(db, "transaction").mockRejectedValueOnce(drizzleLikeError);
    const res = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", `${stamp}-exc14b-${keyCounter}`)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.text).not.toContain("some_unknown_constraint");
    expect(res.text).not.toContain("Failed query");
  });
});

describe("D1-SNAP: sent/received expose the stored snapshot and stable ordering", () => {
  it("sent and received keep the snapshot medicineName and unitPrice after the listing changes", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });

    const send = await sendRequest(requester.agent, medicine.id, 2);
    expect(send.status).toBe(201);
    expect(send.body.unitPrice).toBe("1.25");
    createdRequestIds.push(send.body.id);

    await db.update(medicinesTable)
      .set({ name: "Renamed", price: "9.99" })
      .where(eq(medicinesTable.id, medicine.id));

    const sent = await requester.agent.get("/api/requests/sent");
    expect(sent.status).toBe(200);
    const sentRow = sent.body.data.find((r: any) => r.id === send.body.id);
    expect(sentRow.medicineName).toBe("Paracetamol 500mg (EXC test)");
    expect(sentRow.unitPrice).toBe("1.25");

    const received = await provider.agent.get("/api/requests/received");
    expect(received.status).toBe(200);
    const receivedRow = received.body.data.find((r: any) => r.id === send.body.id);
    expect(receivedRow.medicineName).toBe("Paracetamol 500mg (EXC test)");
    expect(receivedRow.unitPrice).toBe("1.25");
  });

  it("orders by requestDate desc with id desc as the tie-break", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medA = await addMedicine(provider.agent, { quantity: 5 });
    const medB = await addMedicine(provider.agent, { quantity: 5 });

    const r1 = await sendRequest(requester.agent, medA.id, 1);
    createdRequestIds.push(r1.body.id);
    const r2 = await sendRequest(requester.agent, medB.id, 1);
    createdRequestIds.push(r2.body.id);

    const shared = new Date("2026-01-01T12:00:00Z");
    await db.execute(sql`UPDATE requests SET request_date = ${shared} WHERE id = ${r1.body.id}`);
    await db.execute(sql`UPDATE requests SET request_date = ${shared} WHERE id = ${r2.body.id}`);

    const entries = await Promise.all([
      requester.agent.get("/api/requests/sent"),
      provider.agent.get("/api/requests/received"),
    ]);
    for (const res of entries) {
      expect(res.status).toBe(200);
      const ids: number[] = res.body.data.map((r: any) => r.id);
      const i1 = ids.indexOf(r1.body.id);
      const i2 = ids.indexOf(r2.body.id);
      expect(i1).toBeGreaterThan(-1);
      expect(i2).toBeGreaterThan(-1);
      expect(i2).toBeLessThan(i1);
    }
  });
});

describe("PERF-003: request lists paginate, filter by status, and expose pending counts", () => {
  async function seedThree(provider: Awaited<ReturnType<typeof registerPharmacy>>, requester: Awaited<ReturnType<typeof registerPharmacy>>, setupAfter?: (idsAt: number[]) => Promise<void>) {
    const medA = await addMedicine(provider.agent, { quantity: 5 });
    const medB = await addMedicine(provider.agent, { quantity: 5 });
    const medC = await addMedicine(provider.agent, { quantity: 5 });
    const a = await sendRequest(requester.agent, medA.id, 1);
    const b = await sendRequest(requester.agent, medB.id, 1);
    const c = await sendRequest(requester.agent, medC.id, 1);
    const ids = [a.body.id, b.body.id, c.body.id] as number[];
    createdRequestIds.push(...ids);
    if (setupAfter) await setupAfter(ids);
    return ids;
  }

  async function seededPharmacies() {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    return { provider, requester };
  }

  it("returns the { data, pagination, pending } envelope with joined names", async () => {
    const { requester, provider } = await seededPharmacies();
    const ids = await seedThree(provider, requester);
    expect(ids).toHaveLength(3);
    const sent = await requester.agent.get("/api/requests/sent");
    expect(sent.status).toBe(200);
    expect(Array.isArray(sent.body.data)).toBe(true);
    expect(sent.body.data).toHaveLength(3);
    expect(sent.body.pagination).toEqual({ page: 1, limit: 20, total: 3 });
    expect(sent.body.pending).toBe(3);
    for (const r of sent.body.data) {
      expect(r.requesterName).toEqual(expect.any(String));
      expect(r.providerName).toEqual(expect.any(String));
    }
    const received = await provider.agent.get("/api/requests/received");
    expect(received.body.pagination.total).toBe(3);
    expect(received.body.pending).toBe(3);
    for (const r of received.body.data) {
      expect(r.requesterName).toEqual(expect.any(String));
      expect(r.providerName).toEqual(expect.any(String));
    }
  });

  it("paginates by limit/page in descending order, total preserved on boundary pages", async () => {
    const { requester, provider } = await seededPharmacies();
    const ids = await seedThree(provider, requester);
    const first = await requester.agent.get("/api/requests/sent?limit=1&page=1");
    expect(first.body.data).toHaveLength(1);
    expect(first.body.pagination).toEqual({ page: 1, limit: 1, total: 3 });
    const second = await requester.agent.get("/api/requests/sent?limit=1&page=2");
    expect(second.body.data).toHaveLength(1);
    expect(second.body.pagination).toEqual({ page: 2, limit: 1, total: 3 });
    expect(first.body.data[0].id).not.toBe(second.body.data[0].id);
    expect(first.body.data[0].id).toBe(ids[2]);

    const third = await requester.agent.get("/api/requests/sent?limit=1&page=4");
    expect(third.body.data).toHaveLength(0);
    expect(third.body.pagination).toEqual({ page: 4, limit: 1, total: 3 });
    expect(third.body.pending).toBe(3);
  });

  it("filters by status and keeps pending independent of page and filter", async () => {
    const { requester, provider } = await seededPharmacies();
    const ids = await seedThree(provider, requester, async (created) => {
      const res = await provider.agent.post(`/api/requests/${created[0]}/reject`);
      expect(res.status).toBe(200);
    });
    expect(ids).toHaveLength(3);
    const all = await requester.agent.get("/api/requests/sent?limit=1&page=1");
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.pending).toBe(2);

    const pending = await requester.agent.get("/api/requests/sent?status=pending&limit=10");
    expect(pending.body.data).toHaveLength(2);
    expect(pending.body.pagination.total).toBe(2);
    expect(pending.body.pending).toBe(2);

    const rejected = await requester.agent.get("/api/requests/sent?status=rejected&limit=10");
    expect(rejected.body.data).toHaveLength(1);
    expect(rejected.body.pagination.total).toBe(1);
    expect(rejected.body.pending).toBe(2);

    const bogus = await requester.agent.get("/api/requests/sent?status=bogus&limit=10");
    expect(bogus.body.pagination.total).toBe(3);
    expect(bogus.body.pending).toBe(2);
  });

  it("clamps limit strictly to 1..100 and ignores invalid values", async () => {
    const { requester, provider } = await seededPharmacies();
    await seedThree(provider, requester);
    const zero = await requester.agent.get("/api/requests/sent?limit=0");
    expect(zero.body.data).toHaveLength(1);
    expect(zero.body.pagination.limit).toBe(1);

    const negative = await requester.agent.get("/api/requests/sent?limit=-5");
    expect(negative.body.data).toHaveLength(1);
    expect(negative.body.pagination.limit).toBe(1);

    const huge = await requester.agent.get("/api/requests/sent?limit=500");
    expect(huge.body.data).toHaveLength(3);
    expect(huge.body.pagination.limit).toBe(100);

    const garbage = await requester.agent.get("/api/requests/sent?limit=abc");
    expect(garbage.body.data).toHaveLength(3);
    expect(garbage.body.pagination.limit).toBe(20);

    const noParams = await requester.agent.get("/api/requests/sent");
    expect(noParams.body.pagination).toEqual({ page: 1, limit: 20, total: 3 });
  });

  it("clamps page to >=1", async () => {
    const { requester, provider } = await seededPharmacies();
    const ids = await seedThree(provider, requester);
    const res = await requester.agent.get("/api/requests/sent?page=0&limit=1");
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.data[0].id).toBe(ids[2]);
  });
});

describe("D1-ACCEPT: accept re-validates current requester and medicine state", () => {
  async function pendingRequest(overMedicine?: Partial<{ quantity: number; expiryDate: string }>) {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, overMedicine ?? { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);
    return {
      provider, requester, medicine,
      requestId: send.body.id as number,
      providerId: await pharmacyIdByEmail(provider.email),
      requesterId: await pharmacyIdByEmail(requester.email),
    };
  }

  async function quantityOf(medicineId: number): Promise<number> {
    const [m] = await db.select({ quantity: medicinesTable.quantity }).from(medicinesTable).where(eq(medicinesTable.id, medicineId));
    return m!.quantity;
  }

  async function notifCount(pharmacyId: number): Promise<number> {
    const rows = await db.select({ id: notificationsTable.id }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacyId));
    return rows.length;
  }

  async function statusOf(requestId: number): Promise<string> {
    const [row] = await db.select({ status: requestsTable.status }).from(requestsTable).where(eq(requestsTable.id, requestId));
    return row!.status;
  }

  it("blocks accept when the medicine became unavailable → 409 MEDICINE_UNAVAILABLE", async () => {
    const ctx = await pendingRequest();
    await db.update(medicinesTable).set({ isAvailable: false }).where(eq(medicinesTable.id, ctx.medicine.id));

    const requesterBefore = await notifCount(ctx.requesterId);
    const res = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/accept`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MEDICINE_UNAVAILABLE");
    expect(await quantityOf(ctx.medicine.id)).toBe(5);
    expect(await statusOf(ctx.requestId)).toBe("pending");
    expect(await notifCount(ctx.requesterId)).toBe(requesterBefore);
  });

  it("allows accept when the medicine expires today (UTC boundary)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const ctx = await pendingRequest({ quantity: 5, expiryDate: today });

    const res = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/accept`);
    expect(res.status).toBe(200);
    expect(res.body.remainingStock).toBe(3);
  });

  it("blocks accept when the medicine expired yesterday → 409 MEDICINE_EXPIRED", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const ctx = await pendingRequest({ quantity: 5 });
    await db.update(medicinesTable).set({ expiryDate: yesterday }).where(eq(medicinesTable.id, ctx.medicine.id));

    const requesterBefore = await notifCount(ctx.requesterId);
    const res = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/accept`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MEDICINE_EXPIRED");
    expect(await quantityOf(ctx.medicine.id)).toBe(5);
    expect(await statusOf(ctx.requestId)).toBe("pending");
    expect(await notifCount(ctx.requesterId)).toBe(requesterBefore);
  });

  it("blocks accept when stock fell below the requested quantity → 409 INSUFFICIENT_STOCK", async () => {
    const ctx = await pendingRequest({ quantity: 5 });
    await db.update(medicinesTable).set({ quantity: 1 }).where(eq(medicinesTable.id, ctx.medicine.id));

    const requesterBefore = await notifCount(ctx.requesterId);
    const res = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/accept`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INSUFFICIENT_STOCK");
    expect(await quantityOf(ctx.medicine.id)).toBe(1);
    expect(await statusOf(ctx.requestId)).toBe("pending");
    expect(await notifCount(ctx.requesterId)).toBe(requesterBefore);
  });

  it.each([
    ["pending", { verificationStatus: "pending", verifiedAt: null }],
    ["rejected", { verificationStatus: "rejected", rejectionReason: "docs unclear" }],
    ["inactive", { isActive: false }],
  ])("blocks accept when the requester is %s → 409 REQUESTER_UNAVAILABLE", async (_label, patch) => {
    const ctx = await pendingRequest();
    await db.update(pharmaciesTable).set(patch as any).where(eq(pharmaciesTable.id, ctx.requesterId));

    const requesterBefore = await notifCount(ctx.requesterId);
    const res = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/accept`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("REQUESTER_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toContain("docs unclear");
    expect(JSON.stringify(res.body)).not.toContain("rejectionReason");
    expect(JSON.stringify(res.body)).not.toContain("verificationStatus");
    expect(await quantityOf(ctx.medicine.id)).toBe(5);
    expect(await statusOf(ctx.requestId)).toBe("pending");
    expect(await notifCount(ctx.requesterId)).toBe(requesterBefore);
  });
});

describe("D1-AUTH: request authorization matrix", () => {
  async function setup() {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const bystander = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    return { provider, requester, bystander, requestId: send.body.id as number };
  }

  it("a third pharmacy cannot accept/reject/cancel/complete (403)", async () => {
    const ctx = await setup();
    const accept = await ctx.bystander.agent.post(`/api/requests/${ctx.requestId}/accept`);
    const reject = await ctx.bystander.agent.post(`/api/requests/${ctx.requestId}/reject`);
    const cancel = await ctx.bystander.agent.post(`/api/requests/${ctx.requestId}/cancel`);
    const complete = await ctx.bystander.agent.post(`/api/requests/${ctx.requestId}/complete`);
    for (const r of [accept, reject, cancel, complete]) {
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("REQUEST_FORBIDDEN");
    }
    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, ctx.requestId));
    expect(row.status).toBe("pending");
  });

  it("requester cannot accept or reject (403)", async () => {
    const ctx = await setup();
    const accept = await ctx.requester.agent.post(`/api/requests/${ctx.requestId}/accept`);
    const reject = await ctx.requester.agent.post(`/api/requests/${ctx.requestId}/reject`);
    expect(accept.status).toBe(403);
    expect(accept.body.code).toBe("REQUEST_FORBIDDEN");
    expect(reject.status).toBe(403);
    expect(reject.body.code).toBe("REQUEST_FORBIDDEN");
  });

  it("provider cannot cancel or complete (403)", async () => {
    const ctx = await setup();
    const cancel = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/cancel`);
    const complete = await ctx.provider.agent.post(`/api/requests/${ctx.requestId}/complete`);
    expect(cancel.status).toBe(403);
    expect(cancel.body.code).toBe("REQUEST_FORBIDDEN");
    expect(complete.status).toBe(403);
    expect(complete.body.code).toBe("REQUEST_FORBIDDEN");
  });

  it("sent lists only the requester's requests and received only the provider's", async () => {
    const ctx = await setup();
    const sent = await ctx.requester.agent.get("/api/requests/sent");
    const received = await ctx.provider.agent.get("/api/requests/received");
    const bystanderSent = await ctx.bystander.agent.get("/api/requests/sent");
    const bystanderReceived = await ctx.bystander.agent.get("/api/requests/received");
    expect(sent.body.data.map((r: any) => r.id)).toContain(ctx.requestId);
    expect(received.body.data.map((r: any) => r.id)).toContain(ctx.requestId);
    expect(bystanderSent.body.data).toHaveLength(0);
    expect(bystanderReceived.body.data).toHaveLength(0);
  });

  it("operating on a foreign request id neither mutates nor leaks details", async () => {
    const ctx = await setup();
    const res = await ctx.bystander.agent.post(`/api/requests/${ctx.requestId}/accept`);
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("requesterName");
    expect(res.body).not.toHaveProperty("providerName");
    expect(res.body).not.toHaveProperty("medicineName");
    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, ctx.requestId));
    expect(row.status).toBe("pending");
  });

  it.each([
    ["pending", { verificationStatus: "pending" }],
    ["rejected", { verificationStatus: "rejected" }],
    ["inactive", { isActive: false }],
  ])("an actor whose pharmacy is %s is blocked by the middleware", async (_label, patch) => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 1);
    createdRequestIds.push(send.body.id);

    await db.update(pharmaciesTable).set(patch as any).where(eq(pharmaciesTable.id, await pharmacyIdByEmail(provider.email)));
    const res = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("code");
  });
});

describe("D1-STATE: guarded transitions and terminal statuses", () => {
  async function countNotifications(pharmacyId: number): Promise<number> {
    const rows = await db.select({ id: notificationsTable.id }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacyId));
    return rows.length;
  }

  it("complete on a pending request → 409 REQUEST_INVALID_STATE, no notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    const providerBefore = await countNotifications(await pharmacyIdByEmail(provider.email));
    const res = await requester.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("REQUEST_INVALID_STATE");
    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.status).toBe("pending");
    expect(await countNotifications(await pharmacyIdByEmail(provider.email))).toBe(providerBefore);
  });

  it("cancel on an accepted request → 409, no stock restore, no notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    const accept = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(accept.status).toBe(200);
    const providerBefore = await countNotifications(await pharmacyIdByEmail(provider.email));

    const cancel = await requester.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(cancel.status).toBe(409);
    expect(cancel.body.code).toBe("REQUEST_INVALID_STATE");

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.status).toBe("accepted");
    const [after] = await db.select({ quantity: medicinesTable.quantity }).from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(after.quantity).toBe(3);
    expect(await countNotifications(await pharmacyIdByEmail(provider.email))).toBe(providerBefore);
  });

  it("accept on a rejected request → 409, no deduction, no notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    const reject = await provider.agent.post(`/api/requests/${send.body.id}/reject`);
    expect(reject.status).toBe(200);

    const res = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("REQUEST_INVALID_STATE");
    const [after] = await db.select({ quantity: medicinesTable.quantity }).from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(after.quantity).toBe(5);
  });

  it("reject on a completed request → 409, no notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);
    await requester.agent.post(`/api/requests/${send.body.id}/complete`).expect(200);

    const requesterBefore = await countNotifications(await pharmacyIdByEmail(requester.email));
    const res = await provider.agent.post(`/api/requests/${send.body.id}/reject`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("REQUEST_INVALID_STATE");
    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.status).toBe("completed");
    expect(await countNotifications(await pharmacyIdByEmail(requester.email))).toBe(requesterBefore);
  });
});

describe("D1-NOTIF: exactly one notification to the counterparty per transition", () => {
  async function notificationsFor(pharmacyId: number) {
    return db.select({ message: notificationsTable.message }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacyId)).orderBy(asc(notificationsTable.id));
  }

  async function countNow(pharmacyId: number): Promise<number> {
    return (await notificationsFor(pharmacyId)).length;
  }

  it("send notifies only the provider with a single message", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const providerBefore = await countNow(providerId);
    const requesterBefore = await countNow(requesterId);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);

    const providerNotifs = await notificationsFor(providerId);
    const requesterNotifs = await notificationsFor(requesterId);
    expect(providerNotifs).toHaveLength(providerBefore + 1);
    expect(providerNotifs[providerBefore].message).toContain("طلب جديد");
    expect(requesterNotifs).toHaveLength(requesterBefore);
  });

  it("accept notifies only the requester", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const providerBefore = await countNow(providerId);
    const requesterBefore = await countNow(requesterId);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    const accept = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(accept.status).toBe(200);

    const requesterNotifs = await notificationsFor(requesterId);
    expect(requesterNotifs).toHaveLength(requesterBefore + 1);
    expect(requesterNotifs[requesterBefore].message).toContain("تم قبول");
    const providerNotifs = await notificationsFor(providerId);
    expect(providerNotifs).toHaveLength(providerBefore + 1);
    expect(providerNotifs[providerBefore].message).toContain("طلب جديد");
  });

  it("reject notifies only the requester", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const providerBefore = await countNow(providerId);
    const requesterBefore = await countNow(requesterId);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    const reject = await provider.agent.post(`/api/requests/${send.body.id}/reject`);
    expect(reject.status).toBe(200);

    const requesterNotifs = await notificationsFor(requesterId);
    expect(requesterNotifs).toHaveLength(requesterBefore + 1);
    expect(requesterNotifs[requesterBefore].message).toContain("تم رفض");
    const providerNotifs = await notificationsFor(providerId);
    expect(providerNotifs).toHaveLength(providerBefore + 1);
  });

  it("cancel notifies only the provider", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const providerBefore = await countNow(providerId);
    const requesterBefore = await countNow(requesterId);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    const cancel = await requester.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(cancel.status).toBe(200);

    const providerNotifs = await notificationsFor(providerId);
    expect(providerNotifs).toHaveLength(providerBefore + 2);
    expect(providerNotifs[providerBefore + 1].message).toContain("ألغى");
    const requesterNotifs = await notificationsFor(requesterId);
    expect(requesterNotifs).toHaveLength(requesterBefore);
  });

  it("complete notifies only the provider", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const providerBefore = await countNow(providerId);
    const requesterBefore = await countNow(requesterId);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);
    await requester.agent.post(`/api/requests/${send.body.id}/complete`).expect(200);

    const providerNotifs = await notificationsFor(providerId);
    expect(providerNotifs).toHaveLength(providerBefore + 2);
    expect(providerNotifs[providerBefore + 1].message).toContain("أكدت الصيدلية الطالبة");
    const requesterNotifs = await notificationsFor(requesterId);
    expect(requesterNotifs).toHaveLength(requesterBefore + 1);
    expect(requesterNotifs[requesterBefore].message).toContain("تم قبول");
  });
});

describe("D1-CONC: concurrency invariants on real rows", () => {
  async function notifCount(pharmacyId: number): Promise<number> {
    const rows = await db.select({ id: notificationsTable.id }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacyId));
    return rows.length;
  }

  it("A. accept || accept on the last unit: one 200, one 409, single deduction, one notification", async () => {
    const provider = await registerPharmacy();
    const reqA = await registerPharmacy();
    const reqB = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 1 });

    const sendA = await sendRequest(reqA.agent, medicine.id, 1);
    const sendB = await sendRequest(reqB.agent, medicine.id, 1);
    createdRequestIds.push(sendA.body.id, sendB.body.id);

    const reqAId = await pharmacyIdByEmail(reqA.email);
    const reqBId = await pharmacyIdByEmail(reqB.email);
    const combinedBefore = (await notifCount(reqAId)) + (await notifCount(reqBId));

    const results = await Promise.all([
      provider.agent.post(`/api/requests/${sendA.body.id}/accept`),
      provider.agent.post(`/api/requests/${sendB.body.id}/accept`),
    ]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.code).toBe("INSUFFICIENT_STOCK");

    const rows = await db.select().from(requestsTable).where(inArray(requestsTable.id, [sendA.body.id, sendB.body.id]));
    expect(rows.filter((r) => r.status === "accepted")).toHaveLength(1);
    const [after] = await db.select({ quantity: medicinesTable.quantity }).from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    expect(after.quantity).toBe(0);

    expect((await notifCount(reqAId)) + (await notifCount(reqBId)) - combinedBefore).toBe(1);
  });

  it("B. accept || reject: exactly one 200, no rejected-with-deduction, one notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const before = await notifCount(requesterId);
    const results = await Promise.all([
      provider.agent.post(`/api/requests/${send.body.id}/accept`),
      provider.agent.post(`/api/requests/${send.body.id}/reject`),
    ]);
    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].body.code).toBe("REQUEST_INVALID_STATE");

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    const [after] = await db.select({ quantity: medicinesTable.quantity }).from(medicinesTable).where(eq(medicinesTable.id, medicine.id));
    const delta = await notifCount(requesterId) - before;
    expect(delta).toBe(1);
    if (row.status === "accepted") {
      expect(after.quantity).toBe(3);
    } else {
      expect(row.status).toBe("rejected");
      expect(after.quantity).toBe(5);
    }
    const [notif] = await db.select({ message: notificationsTable.message }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, requesterId)).orderBy(desc(notificationsTable.id));
    if (row.status === "accepted") {
      expect(notif.message).toContain("تم قبول");
    } else {
      expect(notif.message).toContain("تم رفض");
    }
  });

  it("C. reject || cancel: exactly one 200, one 409, single final state, one notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    const providerId = await pharmacyIdByEmail(provider.email);
    const requesterId = await pharmacyIdByEmail(requester.email);

    const totalBefore = (await notifCount(providerId)) + (await notifCount(requesterId));
    const results = await Promise.all([
      provider.agent.post(`/api/requests/${send.body.id}/reject`),
      requester.agent.post(`/api/requests/${send.body.id}/cancel`),
    ]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.code).toBe("REQUEST_INVALID_STATE");

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(["rejected", "cancelled"]).toContain(row.status);

    const providerDelta = (await notifCount(providerId)) + (await notifCount(requesterId)) - totalBefore;
    expect(providerDelta).toBe(1);
  });

  it("D. complete || complete: exactly one 200, one 409, one notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const send = await sendRequest(requester.agent, medicine.id, 2);
    createdRequestIds.push(send.body.id);
    await provider.agent.post(`/api/requests/${send.body.id}/accept`).expect(200);

    const providerId = await pharmacyIdByEmail(provider.email);
    const before = await notifCount(providerId);
    const results = await Promise.all([
      requester.agent.post(`/api/requests/${send.body.id}/complete`),
      requester.agent.post(`/api/requests/${send.body.id}/complete`),
    ]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.code).toBe("REQUEST_INVALID_STATE");

    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, send.body.id));
    expect(row.status).toBe("completed");
    expect(await notifCount(providerId) - before).toBe(1);
  });

  it("E. concurrent sends with the same idempotency key: one request, one notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);

    keyCounter += 1;
    const sharedKey = `${stamp}-d1e-${keyCounter}`;
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

    const rows = await db.select().from(requestsTable).where(eq(requestsTable.idempotencyKey, sharedKey));
    expect(rows).toHaveLength(1);
    createdRequestIds.push(rows[0].id);

    const notifs = await db.select({ message: notificationsTable.message }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, providerId));
    expect(notifs.filter((n) => n.message.includes("طلب جديد"))).toHaveLength(1);
  });
});

describe("D1-IDEM-RETRY: sequential same-key retry creates no second notification", () => {
  it("a repeated send with the same idempotency key returns the duplicate without notifying again", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent, { quantity: 5 });
    const providerId = await pharmacyIdByEmail(provider.email);

    keyCounter += 1;
    const sharedKey = `${stamp}-d1retry-${keyCounter}`;
    const first = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });
    expect(first.status).toBe(201);
    createdRequestIds.push(first.body.id);

    const second = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 1 });
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const notifs = await db.select({ message: notificationsTable.message }).from(notificationsTable).where(eq(notificationsTable.pharmacyId, providerId));
    expect(notifs.filter((n) => n.message.includes("طلب جديد"))).toHaveLength(1);
  });
});
