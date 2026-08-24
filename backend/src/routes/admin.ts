import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminsTable, pharmaciesTable, medicinesTable, requestsTable } from "../db/index.js";
import { eq, count } from "drizzle-orm";
import { AdminLoginBody } from "../zod/schemas.js";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session.isAdmin || !req.session.adminId) {
    res.status(401).json({ error: "Admin access required" }); return;
  }
  next();
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, password } = parsed.data;
  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, email));
  if (!admin) { res.status(401).json({ error: "بيانات الدخول غير صحيحة" }); return; }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) { res.status(401).json({ error: "بيانات الدخول غير صحيحة" }); return; }

  req.session.adminId = admin.id;
  req.session.isAdmin = true;
  delete req.session.pharmacyId;

  res.json({ message: "Admin logged in", admin: { id: admin.id, email: admin.email } });
});

router.get("/admin/pharmacies", requireAdmin, async (_req, res): Promise<void> => {
  const pharmacies = await db.select().from(pharmaciesTable).orderBy(pharmaciesTable.createdAt);
  res.json(pharmacies.map(p => ({
    id: p.id, name: p.name, managerName: p.managerName, email: p.email,
    phone: p.phone, city: p.city, isActive: p.isActive, isSubscribed: p.isSubscribed,
    subscriptionPlan: p.subscriptionPlan ?? null, createdAt: p.createdAt.toISOString(),
  })));
});

router.get("/admin/medicines", requireAdmin, async (_req, res): Promise<void> => {
  const medicines = await db
    .select({
      id: medicinesTable.id, pharmacyId: medicinesTable.pharmacyId,
      name: medicinesTable.name, quantity: medicinesTable.quantity,
      price: medicinesTable.price, expiryDate: medicinesTable.expiryDate,
      description: medicinesTable.description, isAvailable: medicinesTable.isAvailable,
      pharmacyName: pharmaciesTable.name, pharmacyCity: pharmaciesTable.city,
    })
    .from(medicinesTable)
    .leftJoin(pharmaciesTable, eq(medicinesTable.pharmacyId, pharmaciesTable.id));

  res.json(medicines.map(m => ({
    ...m, pharmacyName: m.pharmacyName ?? "", pharmacyCity: m.pharmacyCity ?? "",
  })));
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [[pharmacyCount], [medicineCount], [requestCount]] = await Promise.all([
    db.select({ count: count() }).from(pharmaciesTable),
    db.select({ count: count() }).from(medicinesTable),
    db.select({ count: count() }).from(requestsTable),
  ]);

  const [activeSubCount] = await db.select({ count: count() }).from(pharmaciesTable)
    .where(eq(pharmaciesTable.isSubscribed, true));
  const [pendingReqs] = await db.select({ count: count() }).from(requestsTable)
    .where(eq(requestsTable.status, "pending"));

  res.json({
    totalPharmacies: pharmacyCount.count, totalMedicines: medicineCount.count,
    totalRequests: requestCount.count, activeSubscriptions: activeSubCount.count,
    pendingRequests: pendingReqs.count,
  });
});

export default router;
