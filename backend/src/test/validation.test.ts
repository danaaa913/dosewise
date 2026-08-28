import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable, subscriptionPaymentsTable } from "../db/index.js";

const stamp = Date.now();
const validBase = {
  name: "Validation Pharmacy",
  managerName: "Tester",
  phone: "0791234567",
  city: "Amman",
  address: "Test Street Building 5",
  password: "strong-password-123",
};

async function registerWith(overrides: Partial<typeof validBase> & { email?: string }) {
  const email = overrides.email ?? `reg-${stamp}-${Math.floor(Math.random() * 100000)}@example.com`;
  const body = { ...validBase, ...overrides, email };
  const res = await request(app).post("/api/auth/register").send(body);
  return { res, email };
}

describe("AUTH-001/AUTH-003: registration validation", () => {
  it("accepts a fully valid registration", async () => {
    const { res, email } = await registerWith({});
    expect(res.status).toBe(201);
    await db.delete(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  });

  it("rejects an invalid email format", async () => {
    const { res } = await registerWith({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("rejects a password shorter than 12 characters", async () => {
    const { res } = await registerWith({ password: "short12" });
    expect(res.status).toBe(400);
  });

  it("rejects a non-Jordanian phone number", async () => {
    const { res } = await registerWith({ phone: "12345" });
    expect(res.status).toBe(400);
  });

  it("accepts +962 international phone format", async () => {
    const { res, email } = await registerWith({ phone: "+962788123456" });
    expect(res.status).toBe(201);
    await db.delete(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  });
});

describe("SUB-004: demo payment guardrails", () => {
  it("plans response declares demo mode explicitly", async () => {
    const res = await request(app).get("/api/subscriptions/plans");
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(true);
    expect(Array.isArray(res.body.plans)).toBe(true);
  });

  it("rejects real card data outright", async () => {
    const email = `pay-demo-${stamp}@example.com`;
    createdPharmacyEmail = email;
    const reg = await request(app).post("/api/auth/register").send({
      ...validBase,
      email,
      address: "Payment Test Street",
    });
    expect(reg.status).toBe(201);
    await db.update(pharmaciesTable)
      .set({ verificationStatus: "approved", verifiedAt: new Date() })
      .where(eq(pharmaciesTable.id, reg.body.pharmacy.id));

    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password: validBase.password }).expect(200);

    const res = await agent.post("/api/subscriptions/payment").send({
      planId: "monthly",
      cardNumber: "4111111111111111",
      cvv: "123",
      expiryMonth: "12",
      expiryYear: "2030",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("تجريبي");
  });
});

let createdPharmacyEmail = "";

afterAll(async () => {
  if (createdPharmacyEmail) {
    const [pharmacy] = await db.select({ id: pharmaciesTable.id }).from(pharmaciesTable).where(eq(pharmaciesTable.email, createdPharmacyEmail));
    if (pharmacy) {
      await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.pharmacyId, pharmacy.id));
      await db.delete(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacy.id));
    }
  }
});
