import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, and, inArray, isNull } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, medicinesTable, requestsTable, notificationsTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;

const createdPharmacyEmails: string[] = [];
const createdMedicineIds: number[] = [];
const createdRequestIds: number[] = [];

async function registerPharmacy(): Promise<{ email: string; id: number; name: string; agent: request.Agent }> {
  counter += 1;
  const email = `ntf-${stamp}-${counter}@example.com`;
  createdPharmacyEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `NTF Test Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0790000000",
    city: "Irbid",
    address: "Test St.",
    password: "password123456",
  });
  expect(res.status).toBe(201);
  await approvePharmacy(res.body.pharmacy.id);
  await db.delete(notificationsTable).where(and(
    eq(notificationsTable.pharmacyId, res.body.pharmacy.id),
    isNull(notificationsTable.type),
  ));

  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password: "password123456" });
  expect(login.status).toBe(200);
  return { email, id: res.body.pharmacy.id, name: res.body.pharmacy.name, agent };
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
    name: "Paracetamol 500mg (NTF test)",
    quantity: 5,
    price: 1.25,
    expiryDate: "2099-01-01",
  });
  expect(res.status).toBe(201);
  createdMedicineIds.push(res.body.id);
  return res.body as { id: number; name: string };
}

let keyCounter = 0;
async function sendRequest(agent: request.Agent, medicineId: number, requestedQuantity: number) {
  keyCounter += 1;
  return agent.post("/api/requests/send")
    .set("Idempotency-Key", `${stamp}-ntf-key-${keyCounter}`)
    .send({ medicineId, requestedQuantity });
}

async function notificationsFor(pharmacyId: number) {
  return db.select().from(notificationsTable)
    .where(eq(notificationsTable.pharmacyId, pharmacyId))
    .orderBy(notificationsTable.id);
}

async function unreadOf(pharmacyId: number): Promise<number> {
  const rows = await db.select({ id: notificationsTable.id }).from(notificationsTable)
    .where(and(eq(notificationsTable.pharmacyId, pharmacyId), eq(notificationsTable.isRead, false)));
  return rows.length;
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

describe("NOTIF-001: five typed notifications with the correct recipient and metadata", () => {
  it("send → REQUEST_RECEIVED to provider; accept → REQUEST_ACCEPTED to requester; complete → REQUEST_COMPLETED to provider", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    let providerNotifs = await notificationsFor(provider.id);
    expect(providerNotifs).toHaveLength(1);
    expect(providerNotifs[0].type).toBe("REQUEST_RECEIVED");
    expect(providerNotifs[0].requestId).toBe(send.body.id);
    expect(providerNotifs[0].metadata?.medicineName).toBe(medicine.name);
    expect(providerNotifs[0].metadata?.requestedQuantity).toBe(2);
    expect(providerNotifs[0].metadata?.counterpartyName).toBe(requester.name);
    expect(await notificationsFor(requester.id)).toHaveLength(0);

    const accept = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(accept.status).toBe(200);

    let requesterNotifs = await notificationsFor(requester.id);
    expect(requesterNotifs).toHaveLength(1);
    expect(requesterNotifs[0].type).toBe("REQUEST_ACCEPTED");
    expect(requesterNotifs[0].requestId).toBe(send.body.id);
    expect(requesterNotifs[0].metadata?.medicineName).toBe(medicine.name);
    expect(requesterNotifs[0].metadata?.requestedQuantity).toBe(2);
    expect(requesterNotifs[0].metadata?.counterpartyName).toBe(provider.name);

    const complete = await requester.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(complete.status).toBe(200);

    providerNotifs = await notificationsFor(provider.id);
    expect(providerNotifs).toHaveLength(2);
    const completed = providerNotifs[providerNotifs.length - 1];
    expect(completed.type).toBe("REQUEST_COMPLETED");
    expect(completed.requestId).toBe(send.body.id);
    expect(completed.metadata?.medicineName).toBe(medicine.name);
    expect(completed.metadata?.requestedQuantity).toBe(2);
    expect(completed.metadata?.counterpartyName).toBe(requester.name);

    requesterNotifs = await notificationsFor(requester.id);
    expect(requesterNotifs).toHaveLength(1);
  });

  it("reject → REQUEST_REJECTED to requester", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 3);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    const reject = await provider.agent.post(`/api/requests/${send.body.id}/reject`);
    expect(reject.status).toBe(200);

    const requesterNotifs = await notificationsFor(requester.id);
    expect(requesterNotifs).toHaveLength(1);
    expect(requesterNotifs[0].type).toBe("REQUEST_REJECTED");
    expect(requesterNotifs[0].requestId).toBe(send.body.id);
    expect(requesterNotifs[0].metadata?.medicineName).toBe(medicine.name);
    expect(requesterNotifs[0].metadata?.requestedQuantity).toBe(3);
    expect(requesterNotifs[0].metadata?.counterpartyName).toBe(provider.name);
  });

  it("cancel → REQUEST_CANCELLED to provider", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 1);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    const cancel = await requester.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(cancel.status).toBe(200);

    const providerNotifs = await notificationsFor(provider.id);
    expect(providerNotifs).toHaveLength(2);
    const cancelled = providerNotifs[providerNotifs.length - 1];
    expect(cancelled.type).toBe("REQUEST_CANCELLED");
    expect(cancelled.requestId).toBe(send.body.id);
    expect(cancelled.metadata?.medicineName).toBe(medicine.name);
    expect(cancelled.metadata?.requestedQuantity).toBe(1);
    expect(cancelled.metadata?.counterpartyName).toBe(requester.name);
    expect(await notificationsFor(requester.id)).toHaveLength(0);
  });
});

describe("NOTIF-002: exactly one notification per transition; retries/concurrency never duplicate", () => {
  it("an idempotent resend returns the original request and creates no notification", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    keyCounter += 1;
    const sharedKey = `${stamp}-ntf-idem-${keyCounter}`;
    const first = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 2 });
    expect(first.status).toBe(201);
    createdRequestIds.push(first.body.id);

    const providerBefore = await notificationsFor(provider.id);

    const second = await requester.agent.post("/api/requests/send")
      .set("Idempotency-Key", sharedKey)
      .send({ medicineId: medicine.id, requestedQuantity: 2 });
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    expect(await notificationsFor(provider.id)).toHaveLength(providerBefore.length);
  });

  it("concurrent sends with different keys create exactly one REQUEST_RECEIVED", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const [a, b] = await Promise.all([
      sendRequest(requester.agent, medicine.id, 1),
      sendRequest(requester.agent, medicine.id, 1),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);
    const success = a.status === 201 ? a : b;
    createdRequestIds.push(success.body.id);

    const providerNotifs = await notificationsFor(provider.id);
    expect(providerNotifs).toHaveLength(1);
    expect(providerNotifs[0].type).toBe("REQUEST_RECEIVED");
    expect(providerNotifs[0].requestId).toBe(success.body.id);
  });

  it("failed transitions create zero notifications", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    const requesterBefore = await notificationsFor(requester.id);
    const providerBefore = await notificationsFor(provider.id);

    const completeOnPending = await requester.agent.post(`/api/requests/${send.body.id}/complete`);
    expect(completeOnPending.status).toBe(409);
    expect(completeOnPending.body.code).toBe("REQUEST_INVALID_STATE");

    const acceptTwice = await provider.agent.post(`/api/requests/${send.body.id}/accept`);
    expect(acceptTwice.status).toBe(200);
    const rejectAfterAccept = await provider.agent.post(`/api/requests/${send.body.id}/reject`);
    expect(rejectAfterAccept.status).toBe(409);

    const cancelOnAccepted = await requester.agent.post(`/api/requests/${send.body.id}/cancel`);
    expect(cancelOnAccepted.status).toBe(409);

    expect(await notificationsFor(requester.id)).toHaveLength(requesterBefore.length + 1);
    expect(await notificationsFor(provider.id)).toHaveLength(providerBefore.length);
  });
});

describe("NOTIF-003: list is newest-first with id tie-break; limit applies", () => {
  it("orders by createdAt DESC then id DESC and honors ?limit=", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medA = await addMedicine(provider.agent);
    const medB = await addMedicine(provider.agent);

    const r1 = await sendRequest(requester.agent, medA.id, 1);
    expect(r1.status).toBe(201);
    createdRequestIds.push(r1.body.id);
    const r2 = await sendRequest(requester.agent, medB.id, 1);
    expect(r2.status).toBe(201);
    createdRequestIds.push(r2.body.id);

    const shared = new Date("2026-01-01T12:00:00Z");
    const rows = await db.select({ id: notificationsTable.id }).from(notificationsTable)
      .where(eq(notificationsTable.pharmacyId, provider.id));
    await db.update(notificationsTable).set({ createdAt: shared })
      .where(inArray(notificationsTable.id, rows.map((r) => r.id)));

    const full = await provider.agent.get("/api/notifications/my");
    expect(full.status).toBe(200);
    const ids: number[] = full.body.notifications.map((n: any) => n.id);
    expect(ids.length).toBe(2);
    const high = Math.max(...rows.map((r) => r.id));
    const low = Math.min(...rows.map((r) => r.id));
    expect(ids[0]).toBe(high);
    expect(ids[1]).toBe(low);

    const limited = await provider.agent.get("/api/notifications/my?limit=1");
    expect(limited.status).toBe(200);
    expect(limited.body.notifications.map((n: any) => n.id)).toEqual([high]);

    const invalidLimit = await provider.agent.get("/api/notifications/my?limit=101");
    expect(invalidLimit.status).toBe(400);
  });
});

describe("NOTIF-004: unread_only, unreadCount and unread-count endpoint", () => {
  it("filters unread, reports unreadCount and reflects mark-read / mark-all-read", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medA = await addMedicine(provider.agent);
    const medB = await addMedicine(provider.agent);

    const r1 = await sendRequest(requester.agent, medA.id, 1);
    createdRequestIds.push(r1.body.id);
    const r2 = await sendRequest(requester.agent, medB.id, 1);
    createdRequestIds.push(r2.body.id);

    const all = await provider.agent.get("/api/notifications/my");
    expect(all.status).toBe(200);
    expect(all.body.unreadCount).toBe(2);
    expect(all.body.notifications).toHaveLength(2);
    for (const n of all.body.notifications) expect(n.isRead).toBe(false);

    const unreadOnly = await provider.agent.get("/api/notifications/my?unread_only=true");
    expect(unreadOnly.status).toBe(200);
    expect(unreadOnly.body.notifications).toHaveLength(2);

    const firstId = all.body.notifications[0].id;

    const mark = await provider.agent.post(`/api/notifications/${firstId}/mark-read`);
    expect(mark.status).toBe(200);

    const afterMark = await provider.agent.get("/api/notifications/my");
    expect(afterMark.body.unreadCount).toBe(1);

    const unreadAfterMark = await provider.agent.get("/api/notifications/my?unread_only=true");
    expect(unreadAfterMark.body.notifications).toHaveLength(1);
    expect(unreadAfterMark.body.notifications[0].id).not.toBe(firstId);

    const countEndpoint = await provider.agent.get("/api/notifications/unread-count");
    expect(countEndpoint.status).toBe(200);
    expect(countEndpoint.body.unreadCount).toBe(1);

    const markAll = await provider.agent.post("/api/notifications/mark-all-read");
    expect(markAll.status).toBe(200);
    expect(markAll.body.updated).toBe(1);

    const finalCount = await provider.agent.get("/api/notifications/unread-count");
    expect(finalCount.body.unreadCount).toBe(0);

    const markAllAgain = await provider.agent.post("/api/notifications/mark-all-read");
    expect(markAllAgain.body.updated).toBe(0);
  });
});

describe("NOTIF-005: ownership isolation and idempotent marking", () => {
  it("side pharmacy cannot see, count, or mark another pharmacy's notifications (404 NOTIFICATION_NOT_FOUND)", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const bystander = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 2);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    const [own] = await db.select({ id: notificationsTable.id }).from(notificationsTable)
      .where(eq(notificationsTable.pharmacyId, provider.id));

    const others = await bystander.agent.get("/api/notifications/my");
    expect(others.status).toBe(200);
    expect(others.body.notifications).toHaveLength(0);
    expect(others.body.unreadCount).toBe(0);

    const foreignMark = await bystander.agent.post(`/api/notifications/${own!.id}/mark-read`);
    expect(foreignMark.status).toBe(404);
    expect(foreignMark.body.code).toBe("NOTIFICATION_NOT_FOUND");
    expect(JSON.stringify(foreignMark.body)).not.toContain(provider.name);

    const stillUnread = await unreadOf(provider.id);
    expect(stillUnread).toBe(1);

    const missing = await bystander.agent.post("/api/notifications/999999999/mark-read");
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("marking the same notification twice is idempotent (both 200)", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 1);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    const [n] = await db.select({ id: notificationsTable.id }).from(notificationsTable)
      .where(eq(notificationsTable.pharmacyId, provider.id));

    const first = await provider.agent.post(`/api/notifications/${n!.id}/mark-read`);
    const second = await provider.agent.post(`/api/notifications/${n!.id}/mark-read`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await unreadOf(provider.id)).toBe(0);
  });
});

describe("NOTIF-006: request deletion preserves the notification and clears request_id to null", () => {
  it("deleting a request keeps message/metadata/type and sets requestId to null", async () => {
    const provider = await registerPharmacy();
    const requester = await registerPharmacy();
    const medicine = await addMedicine(provider.agent);

    const send = await sendRequest(requester.agent, medicine.id, 4);
    expect(send.status).toBe(201);
    createdRequestIds.push(send.body.id);

    await db.delete(requestsTable).where(eq(requestsTable.id, send.body.id));

    const [row] = await db.select().from(notificationsTable)
      .where(and(
        eq(notificationsTable.pharmacyId, provider.id),
        eq(notificationsTable.type, "REQUEST_RECEIVED"),
      ));
    expect(row).toBeDefined();
    expect(row!.requestId).toBeNull();
    expect(row!.type).toBe("REQUEST_RECEIVED");
    expect(row!.metadata?.medicineName).toBe(medicine.name);
    expect(row!.metadata?.requestedQuantity).toBe(4);
    expect(row!.metadata?.counterpartyName).toBe(requester.name);

    const fetched = await provider.agent.get("/api/notifications/my");
    expect(fetched.status).toBe(200);
    const n = fetched.body.notifications.find((x: any) => x.id === row!.id);
    expect(n).toBeDefined();
    expect(n.requestId).toBeNull();
    expect(n.requestStatus).toBeNull();
    expect(n.type).toBe("REQUEST_RECEIVED");
    expect(n.metadata?.medicineName).toBe(medicine.name);
  });
});

describe("NOTIF-007: legacy rows with type/metadata NULL remain returnable", () => {
  it("a raw legacy notification (only pharmacyId + message) is still listed safely", async () => {
    const provider = await registerPharmacy();

    await db.insert(notificationsTable).values({
      pharmacyId: provider.id,
      message: "طلب قديم بدون بيانات منظمة",
    });

    const res = await provider.agent.get("/api/notifications/my");
    expect(res.status).toBe(200);
    const legacy = res.body.notifications.find((n: any) => n.type === null);
    expect(legacy).toBeDefined();
    expect(legacy.message).toBe("طلب قديم بدون بيانات منظمة");
    expect(legacy.type).toBeNull();
    expect(legacy.metadata).toBeNull();
    expect(legacy.requestId).toBeNull();
  });
});