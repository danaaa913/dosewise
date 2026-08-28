import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
const createdEmails: string[] = [];

async function registerPharmacy() {
  counter += 1;
  const email = `access-${stamp}-${counter}@example.com`;
  createdEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `Access Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0791234567",
    city: "Amman",
    address: "Access Control Street 7",
    password: "strong-password-123",
  }).expect(201);

  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "strong-password-123" }).expect(200);
  return { agent, email, pharmacyId: res.body.pharmacy.id as number };
}

async function setVerification(pharmacyId: number, status: "pending" | "approved" | "rejected") {
  await db.update(pharmaciesTable).set({
    verificationStatus: status,
    rejectionReason: status === "rejected" ? "بيانات ناقصة" : null,
    verifiedAt: status === "approved" || status === "rejected" ? new Date() : null,
  }).where(eq(pharmaciesTable.id, pharmacyId));
}

async function setActive(pharmacyId: number, isActive: boolean) {
  await db.update(pharmaciesTable).set({ isActive }).where(eq(pharmaciesTable.id, pharmacyId));
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    for (const email of createdEmails) {
      await db.delete(pharmaciesTable).where(eq(pharmaciesTable.email, email));
    }
  }
});

describe("PHM-004: unified operational access gate (requireApprovedPharmacy)", () => {
  it("guest session receives 401 on an operational endpoint", async () => {
    const res = await request(app).get("/api/medicines/available");
    expect(res.status).toBe(401);
    expect(res.body.code).toBeUndefined();
  });

  it("pending session receives 403 PHARMACY_NOT_VERIFIED", async () => {
    const { agent } = await registerPharmacy();
    const res = await agent.get("/api/medicines/available");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PHARMACY_NOT_VERIFIED");
  });

  it("rejected session receives 403 PHARMACY_REJECTED and hides rejectionReason", async () => {
    const { agent, pharmacyId } = await registerPharmacy();
    await setVerification(pharmacyId, "rejected");
    const res = await agent.get("/api/medicines/available");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PHARMACY_REJECTED");
    expect(res.body).not.toHaveProperty("rejectionReason");
    expect(JSON.stringify(res.body)).not.toContain("بيانات ناقصة");
  });

  it("approved but inactive session receives 403 PHARMACY_INACTIVE", async () => {
    const { agent, pharmacyId } = await registerPharmacy();
    await setVerification(pharmacyId, "approved");
    await setActive(pharmacyId, false);
    const res = await agent.get("/api/medicines/available");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PHARMACY_INACTIVE");
  });

  it("approved + active session is allowed", async () => {
    const { agent, pharmacyId } = await registerPharmacy();
    await setVerification(pharmacyId, "approved");
    const res = await agent.get("/api/medicines/available");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("admin session is not treated as a pharmacy", async () => {
    const adminEmail = process.env.ADMIN_EMAIL!;
    const adminPassword = process.env.ADMIN_PASSWORD!;
    const admin = request.agent(app);
    await admin.post("/api/admin/login").send({ email: adminEmail, password: adminPassword }).expect(200);
    const res = await admin.get("/api/medicines/available");
    expect(res.status).toBe(401);
  });

  it("pending is blocked on every operational route group before body validation", async () => {
    const { agent } = await registerPharmacy();

    const cases: Array<[string, string]> = [
      ["POST", "/api/medicines/add"],
      ["GET", "/api/medicines/my"],
      ["GET", "/api/medicines/available"],
      ["PUT", "/api/medicines/1/update"],
      ["DELETE", "/api/medicines/1/delete"],
      ["POST", "/api/requests/send"],
      ["GET", "/api/requests/sent"],
      ["GET", "/api/requests/received"],
      ["POST", "/api/requests/1/accept"],
      ["POST", "/api/requests/1/reject"],
      ["POST", "/api/requests/1/cancel"],
      ["POST", "/api/requests/1/complete"],
      ["GET", "/api/subscriptions/status"],
      ["POST", "/api/subscriptions/payment"],
      ["POST", "/api/subscriptions/cancel"],
      ["GET", "/api/notifications/my"],
      ["POST", "/api/notifications/1/mark-read"],
      ["GET", "/api/ai/medicines"],
      ["GET", "/api/ai/recommendations"],
      ["GET", "/api/ai/medicine-suggestions"],
      ["GET", "/api/ai/price-optimization"],
      ["GET", "/api/ai/demand-forecast"],
      ["POST", "/api/ai/chat"],
      ["GET", "/api/pharmacy/license"],
      ["PUT", "/api/pharmacy/license"],
      ["GET", "/api/pharmacy/license/document"],
    ];

    for (const [method, path] of cases) {
      let req = agent[method.toLowerCase() as "get" | "post" | "put" | "delete"](path);
      if (method === "POST") {
        req = (req as request.Test).set("Idempotency-Key", `${stamp}-coverage`);
      }
      const res = await req;
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(res.body.code, `${method} ${path}`).toBe("PHARMACY_NOT_VERIFIED");
    }
  });
});

describe("PHM-005: auth/check and auth/logout remain available for all pharmacy states", () => {
  it("pending can login, read own status and logout", async () => {
    const { agent } = await registerPharmacy();
    const check = await agent.get("/api/auth/check");
    expect(check.status).toBe(200);
    expect(check.body.loggedIn).toBe(true);
    expect(check.body.pharmacy.verificationStatus).toBe("pending");

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const after = await agent.get("/api/medicines/available");
    expect(after.status).toBe(401);
  });

  it("rejected can login, read own status and logout", async () => {
    const { agent, pharmacyId } = await registerPharmacy();
    await setVerification(pharmacyId, "rejected");
    const check = await agent.get("/api/auth/check");
    expect(check.status).toBe(200);
    expect(check.body.loggedIn).toBe(true);
    expect(check.body.pharmacy.verificationStatus).toBe("rejected");
    expect(check.body.pharmacy.rejectionReason).toBe("بيانات ناقصة");

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
  });

  it("inactive can login, read own status (isActive=false) and logout", async () => {
    const { agent, pharmacyId } = await registerPharmacy();
    await setVerification(pharmacyId, "approved");
    await setActive(pharmacyId, false);

    const check = await agent.get("/api/auth/check");
    expect(check.status).toBe(200);
    expect(check.body.loggedIn).toBe(true);
    expect(check.body.pharmacy.isActive).toBe(false);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
  });
});

describe("PHM-006: public endpoints stay public", () => {
  it("subscription plans remain reachable without a session", async () => {
    const res = await request(app).get("/api/subscriptions/plans");
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeDefined();
  });

  it("healthz remains reachable without a session", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});