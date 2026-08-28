import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, like } from "drizzle-orm";
import app, { SESSION_COOKIE_NAME } from "../app.js";
import { db, pharmaciesTable } from "../db/index.js";

const stamp = Date.now();
const emailPrefix = `test-${stamp}-`;
const basePharmacy = {
  name: "Test Pharmacy",
  managerName: "Tester",
  phone: "0790000000",
  city: "Irbid",
  address: "Test St.",
  password: "password123456",
};

let counter = 0;
const createdEmails: string[] = [];

function setCookiesOf(res: request.Response): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function createPharmacy() {
  counter += 1;
  const pharmacy = { ...basePharmacy, email: `${emailPrefix}${counter}@example.com` };
  createdEmails.push(pharmacy.email);
  const res = await request(app).post("/api/auth/register").send(pharmacy);
  expect(res.status).toBe(201);
  return res;
}

afterAll(async () => {
  for (const email of createdEmails) {
    await db.delete(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  }
});

describe("AUTH-004: inactive pharmacy can log in but cannot operate", () => {
  it("creates a session, reports isActive=false, and blocks operational access with PHARMACY_INACTIVE", async () => {
    await createPharmacy();
    await db.update(pharmaciesTable)
      .set({ verificationStatus: "approved", verifiedAt: new Date(), isActive: false })
      .where(eq(pharmaciesTable.email, createdEmails[0]));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: createdEmails[0], password: basePharmacy.password });

    expect(res.status).toBe(200);
    const cookies = setCookiesOf(res);
    expect(cookies.some((c) => c.startsWith(SESSION_COOKIE_NAME))).toBe(true);
    const sid = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(";")[0];

    const check = await request(app).get("/api/auth/check").set("Cookie", sid);
    expect(check.status).toBe(200);
    expect(check.body.loggedIn).toBe(true);
    expect(check.body.pharmacy.isActive).toBe(false);

    const blocked = await request(app).get("/api/medicines/available").set("Cookie", sid);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PHARMACY_INACTIVE");

    const logout = await request(app).post("/api/auth/logout").set("Cookie", sid);
    expect(logout.status).toBe(200);

    const checkAfter = await request(app).get("/api/auth/check").set("Cookie", sid);
    expect(checkAfter.body.loggedIn).toBe(false);

    await db.update(pharmaciesTable)
      .set({ isActive: true })
      .where(eq(pharmaciesTable.email, createdEmails[0]));
  });
});

describe("AUTH-005: session id rotates after login", () => {
  it("issues a fresh session id instead of the attacker-supplied one", async () => {
    await createPharmacy();
    const attackerSid = `${SESSION_COOKIE_NAME}=attacker-known-value`;

    const res = await request(app)
      .post("/api/auth/login")
      .set("Cookie", attackerSid)
      .send({ email: createdEmails[createdEmails.length - 1], password: basePharmacy.password });

    expect(res.status).toBe(200);
    const sessionCookie = setCookiesOf(res).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    const newSid = sessionCookie!.split(";")[0];
    expect(newSid).not.toBe(attackerSid);
    expect(newSid).not.toContain("attacker-known-value");
  });
});

describe("AUTH-006: logout destroys session and clears cookie", () => {
  it("check returns logged-out after logout with same cookie", async () => {
    await createPharmacy();
    const email = createdEmails[createdEmails.length - 1];
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: basePharmacy.password });
    const sid = setCookiesOf(login)
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!
      .split(";")[0];

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", sid);
    expect(logout.status).toBe(200);

    const expiredCookie = setCookiesOf(logout)
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(expiredCookie).toBeDefined();
    expect(expiredCookie).toMatch(/Expires=Thu, 01 Jan 1970/);

    const check = await request(app).get("/api/auth/check").set("Cookie", sid);
    expect(check.body.loggedIn).toBe(false);
  });
});
