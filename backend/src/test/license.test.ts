import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import app from "../app.js";
import { db, pharmaciesTable } from "../db/index.js";

const stamp = Date.now();
let counter = 0;
const createdEmails: string[] = [];

const SMALL_PDF = Buffer.from("%PDF-1.4 test license document").toString("base64");
const BIG_DOC = "A".repeat(6_500_000);

async function registerPharmacy(withLicense = false) {
  counter += 1;
  const email = `lic-${stamp}-${counter}@example.com`;
  createdEmails.push(email);
  const res = await request(app).post("/api/auth/register").send({
    name: `License Pharmacy ${counter}`,
    managerName: "Tester",
    email,
    phone: "0791234567",
    city: "Amman",
    address: "License Test Street 10",
    password: "strong-password-123",
    ...(withLicense
      ? { licenseNumber: "2025678", licenseDoc: { name: "registry.pdf", mime: "application/pdf", data: SMALL_PDF } }
      : {}),
  });
  expect(res.status).toBe(201);

  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "strong-password-123" }).expect(200);
  return { agent, email };
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.delete(pharmaciesTable).where(inArray(pharmaciesTable.email, createdEmails));
  }
});

describe("PHM-002: commercial registry upload", () => {
  it("stores license number and document at registration", async () => {
    const { agent } = await registerPharmacy(true);

    const res = await agent.get("/api/pharmacy/license");
    expect(res.status).toBe(200);
    expect(res.body.licenseNumber).toBe("2025678");
    expect(res.body.document.name).toBe("registry.pdf");
    expect(res.body.document.mime).toBe("application/pdf");
    expect(res.body.document).not.toHaveProperty("data");
  });

  it("serves the document to its owner with the right content type", async () => {
    const { agent } = await registerPharmacy(true);

    const res = await agent.get("/api/pharmacy/license/document");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(res.body).toString("utf8")).toContain("%PDF-1.4");
  });

  it("another pharmacy cannot download someone else's document", async () => {
    await registerPharmacy(true);
    const outsider = await registerPharmacy(false);

    const res = await outsider.agent.get("/api/pharmacy/license/document");
    expect(res.status).toBe(404);
  });

  it("allows updating license info later", async () => {
    const { agent } = await registerPharmacy(false);

    const update = await agent.put("/api/pharmacy/license").send({
      licenseNumber: "999888",
      licenseDoc: { name: "updated.png", mime: "image/png", data: SMALL_PDF },
    });
    expect(update.status).toBe(200);

    const res = await agent.get("/api/pharmacy/license");
    expect(res.body.licenseNumber).toBe("999888");
    expect(res.body.document.name).toBe("updated.png");
  });

  it("rejects documents exceeding the size limit", async () => {
    const { agent } = await registerPharmacy(false);

    const res = await agent.put("/api/pharmacy/license").send({
      licenseDoc: { name: "huge.pdf", mime: "application/pdf", data: BIG_DOC },
    });
    expect(res.status).toBe(400);
  });

  it("rejects unsupported file types", async () => {
    const { agent } = await registerPharmacy(false);

    const res = await agent.put("/api/pharmacy/license").send({
      licenseDoc: { name: "script.exe", mime: "application/x-msdownload", data: SMALL_PDF },
    });
    expect(res.status).toBe(400);
  });
});
