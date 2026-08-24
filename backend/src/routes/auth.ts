import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, pharmaciesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { RegisterPharmacyBody, LoginPharmacyBody } from "../zod/schemas.js";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterPharmacyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, managerName, email, phone, city, address, password } = parsed.data;

  const existing = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  if (existing.length > 0) { res.status(400).json({ error: "Email already registered" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const [pharmacy] = await db.insert(pharmaciesTable).values({
    name, managerName, email, phone, city, address, passwordHash,
  }).returning();

  req.session.pharmacyId = pharmacy.id;
  req.session.isAdmin = false;

  res.status(201).json({
    message: "Registered successfully",
    pharmacy: {
      id: pharmacy.id, name: pharmacy.name, managerName: pharmacy.managerName,
      email: pharmacy.email, phone: pharmacy.phone, city: pharmacy.city,
      address: pharmacy.address, isActive: pharmacy.isActive, isSubscribed: pharmacy.isSubscribed,
      subscriptionPlan: pharmacy.subscriptionPlan ?? null,
      subscriptionEndDate: pharmacy.subscriptionEndDate ? pharmacy.subscriptionEndDate.toISOString() : null,
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginPharmacyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, password } = parsed.data;
  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.email, email));
  if (!pharmacy) { res.status(401).json({ error: "Invalid email or password" }); return; }

  const valid = await bcrypt.compare(password, pharmacy.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }

  req.session.pharmacyId = pharmacy.id;
  req.session.isAdmin = false;

  res.json({
    message: "Logged in successfully",
    pharmacy: {
      id: pharmacy.id, name: pharmacy.name, managerName: pharmacy.managerName,
      email: pharmacy.email, phone: pharmacy.phone, city: pharmacy.city,
      address: pharmacy.address, isActive: pharmacy.isActive, isSubscribed: pharmacy.isSubscribed,
      subscriptionPlan: pharmacy.subscriptionPlan ?? null,
      subscriptionEndDate: pharmacy.subscriptionEndDate ? pharmacy.subscriptionEndDate.toISOString() : null,
    },
  });
});

router.get("/auth/check", async (req, res): Promise<void> => {
  if (req.session.isAdmin && req.session.adminId) {
    res.json({ loggedIn: true, isAdmin: true }); return;
  }
  if (req.session.pharmacyId) {
    const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId));
    if (pharmacy) {
      res.json({
        loggedIn: true, isAdmin: false,
        pharmacy: {
          id: pharmacy.id, name: pharmacy.name, managerName: pharmacy.managerName,
          email: pharmacy.email, phone: pharmacy.phone, city: pharmacy.city,
          address: pharmacy.address, isActive: pharmacy.isActive, isSubscribed: pharmacy.isSubscribed,
          subscriptionPlan: pharmacy.subscriptionPlan ?? null,
          subscriptionEndDate: pharmacy.subscriptionEndDate ? pharmacy.subscriptionEndDate.toISOString() : null,
        },
      }); return;
    }
  }
  res.json({ loggedIn: false, isAdmin: false });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => { res.json({ message: "Logged out successfully" }); });
});

export default router;
