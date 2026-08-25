import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, pharmaciesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { RegisterPharmacyBody, LoginPharmacyBody } from "../zod/schemas.js";
import { SESSION_COOKIE_NAME } from "../app.js";
import { loginLimiter } from "../lib/rate-limit.js";

const router: IRouter = Router();

function pharmacyPayload(p: typeof pharmaciesTable.$inferSelect) {
  return {
    id: p.id, name: p.name, managerName: p.managerName,
    email: p.email, phone: p.phone, city: p.city,
    address: p.address, isActive: p.isActive, isSubscribed: p.isSubscribed,
    verificationStatus: p.verificationStatus,
    rejectionReason: p.rejectionReason,
    subscriptionPlan: p.subscriptionPlan ?? null,
    subscriptionEndDate: p.subscriptionEndDate ? p.subscriptionEndDate.toISOString() : null,
  };
}

function startPharmacySession(req: Request, res: Response, pharmacyId: number, statusCode: number, payload: object): void {
  req.session.regenerate((err) => {
    if (err) { res.status(500).json({ error: "Failed to start session" }); return; }
    req.session.pharmacyId = pharmacyId;
    req.session.isAdmin = false;
    res.status(statusCode).json(payload);
  });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterPharmacyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, managerName, email, phone, city, address, password, licenseNumber, licenseDoc } = parsed.data;

  const existing = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  if (existing.length > 0) { res.status(400).json({ error: "Email already registered" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const [pharmacy] = await db.insert(pharmaciesTable).values({
    name, managerName, email, phone, city, address, passwordHash,
    licenseNumber: licenseNumber ?? null,
    licenseDocName: licenseDoc?.name ?? null,
    licenseDocMime: licenseDoc?.mime ?? null,
    licenseDocData: licenseDoc?.data ?? null,
    licenseDocUpdatedAt: licenseDoc ? new Date() : null,
  }).returning();

  startPharmacySession(req, res, pharmacy.id, 201, {
    message: "Registered successfully",
    pharmacy: pharmacyPayload(pharmacy),
  });
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginPharmacyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, password } = parsed.data;
  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  if (!pharmacy) { res.status(401).json({ error: "Invalid email or password" }); return; }

  const valid = await bcrypt.compare(password, pharmacy.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }

  if (!pharmacy.isActive) { res.status(403).json({ error: "Account is deactivated" }); return; }

  startPharmacySession(req, res, pharmacy.id, 200, {
    message: "Logged in successfully",
    pharmacy: pharmacyPayload(pharmacy),
  });
});

router.get("/auth/check", async (req, res): Promise<void> => {
  if (req.session.isAdmin && req.session.adminId) {
    res.json({ loggedIn: true, isAdmin: true }); return;
  }
  if (req.session.pharmacyId) {
    const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId));
    if (pharmacy) {
      res.json({ loggedIn: true, isAdmin: false, pharmacy: pharmacyPayload(pharmacy) }); return;
    }
  }
  res.json({ loggedIn: false, isAdmin: false });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
