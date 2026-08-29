import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, auditLogsTable, notificationsTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
const createdEmails: string[] = [];

const PDF = Buffer.from("%PDF-1.4 verification test").toString("base64");

async function registerPendingPharmacy(withLicense = true) {
  counter += 1;
  const email = `ver-${stamp}-${counter}@example.com`;
  createdEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `Verification Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0791234567",
    city: "Amman",
    address: "Verification Street 7",
    password: "strong-password-123",
    ...(withLicense
      ? { licenseNumber: `REG-${counter}`, licenseDoc: { name: "registry.pdf", mime: "application/pdf", data: PDF } }
      : {}),
  }).expect(201);

  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "strong-password-123" }).expect(200);
  return { agent, email, pharmacyId: res.body.pharmacy.id as number };
}

async function loginAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL!;
  const adminPassword = process.env.ADMIN_PASSWORD!;
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ email: adminEmail, password: adminPassword }).expect(200);
  return agent;
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    for (const email of createdEmails) {
      const [p] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
      if (p) {
        await db.delete(notificationsTable).where(eq(notificationsTable.pharmacyId, p.id));
        await db.delete(auditLogsTable).where(eq(auditLogsTable.targetId, p.id));
        await db.delete(pharmaciesTable).where(eq(pharmaciesTable.id, p.id));
      }
    }
  }
});

describe("AUTH-002/PHM-003: pharmacy verification flow", () => {
  it("new registrations start as pending and cannot exchange", async () => {
    const { agent } = await registerPendingPharmacy();

    const check = await agent.get("/api/auth/check");
    expect(check.body.pharmacy.verificationStatus).toBe("pending");

    const blocked = await agent.post("/api/requests/send")
      .set("Idempotency-Key", `${stamp}-blocked`)
      .send({ medicineId: 1, requestedQuantity: 1 });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PHARMACY_NOT_VERIFIED");
  });

  it("admin sees pending pharmacies with license info and can download the document", async () => {
    const { email } = await registerPendingPharmacy();
    const admin = await loginAdmin();

    const list = await admin.get("/api/admin/pharmacies");
    const total = list.body.pagination.total;
    const lastPage = await admin.get(`/api/admin/pharmacies?page=${Math.ceil(total / 20)}&limit=20`);
    const row = lastPage.body.data.find((p: { email: string }) => p.email === email);
    expect(row.verificationStatus).toBe("pending");
    expect(row.licenseNumber).toBe(`REG-${counter}`);
    expect(row.hasLicenseDoc).toBe(true);

    const doc = await admin.get(`/api/admin/pharmacies/${row.id}/license-document`);
    expect(doc.status).toBe(200);
    expect(doc.headers["content-type"]).toContain("application/pdf");
  });

  it("non-admin cannot decide verification", async () => {
    const { agent } = await registerPendingPharmacy();

    const res = await agent.post(`/api/admin/pharmacies/1/verification`)
      .send({ decision: "approve" });
    expect(res.status).toBe(401);
  });

  it("rejection requires a reason", async () => {
    const { pharmacyId } = await registerPendingPharmacy();
    const admin = await loginAdmin();

    const noReason = await admin.post(`/api/admin/pharmacies/${pharmacyId}/verification`)
      .send({ decision: "reject" });
    expect(noReason.status).toBe(400);
  });

  it("approval unlocks exchange, writes notification and audit log", async () => {
    const { agent, pharmacyId, email } = await registerPendingPharmacy();
    const admin = await loginAdmin();

    const approve = await admin.post(`/api/admin/pharmacies/${pharmacyId}/verification`)
      .send({ decision: "approve" });
    expect(approve.status).toBe(200);

    const check = await agent.get("/api/auth/check");
    expect(check.body.pharmacy.verificationStatus).toBe("approved");

    const notes = await db.select().from(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacyId));
    expect(notes.some((n) => n.message.includes("اعتماد"))).toBe(true);

    const audits = await db.select().from(auditLogsTable).where(eq(auditLogsTable.targetId, pharmacyId));
    expect(audits.some((a) => a.action === "pharmacy.verification.approved")).toBe(true);

    const [row] = await db.select({ verificationStatus: pharmaciesTable.verificationStatus })
      .from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
    expect(row.verificationStatus).toBe("approved");
  });

  it("rejection stores the reason, notifies, and audits", async () => {
    const { pharmacyId } = await registerPendingPharmacy();
    const admin = await loginAdmin();

    const reject = await admin.post(`/api/admin/pharmacies/${pharmacyId}/verification`)
      .send({ decision: "reject", reason: "السجل التجاري غير واضح" });
    expect(reject.status).toBe(200);

    const [row] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
    expect(row.verificationStatus).toBe("rejected");
    expect(row.rejectionReason).toBe("السجل التجاري غير واضح");

    const notes = await db.select().from(notificationsTable).where(eq(notificationsTable.pharmacyId, pharmacyId));
    expect(notes.some((n) => n.message.includes("غير واضح"))).toBe(true);

    const audits = await db.select().from(auditLogsTable).where(eq(auditLogsTable.targetId, pharmacyId));
    expect(audits.some((a) => a.action === "pharmacy.verification.rejected")).toBe(true);
  });

  it("rejected pharmacy stays blocked from exchange", async () => {
    const { agent, pharmacyId } = await registerPendingPharmacy();
    const admin = await loginAdmin();
    await admin.post(`/api/admin/pharmacies/${pharmacyId}/verification`)
      .send({ decision: "reject", reason: "بيانات ناقصة" }).expect(200);

    const blocked = await agent.post("/api/requests/send")
      .set("Idempotency-Key", `${stamp}-rejected`)
      .send({ medicineId: 1, requestedQuantity: 1 });
    expect(blocked.status).toBe(403);
  });
});
