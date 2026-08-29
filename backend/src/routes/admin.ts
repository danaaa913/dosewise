import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminsTable, pharmaciesTable, medicinesTable, requestsTable, notificationsTable, auditLogsTable } from "../db/index.js";
import { logAudit } from "../lib/audit.js";
import { eq, count, and, desc } from "drizzle-orm";
import { AdminLoginBody, VerificationDecisionBody } from "../zod/schemas.js";
import { loginLimiter } from "../lib/rate-limit.js";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session.isAdmin || !req.session.adminId) {
    res.status(401).json({ error: "Admin access required" }); return;
  }
  next();
}

router.post("/admin/login", loginLimiter, async (req, res): Promise<void> => {
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
    verificationStatus: p.verificationStatus, rejectionReason: p.rejectionReason,
    licenseNumber: p.licenseNumber, hasLicenseDoc: Boolean(p.licenseDocData),
    licenseDocName: p.licenseDocName, licenseDocMime: p.licenseDocMime,
    subscriptionPlan: p.subscriptionPlan ?? null, createdAt: p.createdAt.toISOString(),
  })));
});

router.get("/admin/pharmacies/:pharmacyId/license-document", requireAdmin, async (req, res): Promise<void> => {
  const pharmacyId = Number(req.params.pharmacyId);
  if (!Number.isInteger(pharmacyId) || pharmacyId < 1) { res.status(400).json({ error: "Invalid pharmacy id" }); return; }

  const [pharmacy] = await db.select({
    licenseDocName: pharmaciesTable.licenseDocName,
    licenseDocMime: pharmaciesTable.licenseDocMime,
    licenseDocData: pharmaciesTable.licenseDocData,
  }).from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));

  if (!pharmacy?.licenseDocData) { res.status(404).json({ error: "No license document uploaded" }); return; }

  const buffer = Buffer.from(pharmacy.licenseDocData, "base64");
  res.setHeader("Content-Type", pharmacy.licenseDocMime ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(pharmacy.licenseDocName ?? "license")}"`);
  res.send(buffer);
});

router.post("/admin/pharmacies/:pharmacyId/verification", requireAdmin, async (req, res): Promise<void> => {
  const pharmacyId = Number(req.params.pharmacyId);
  if (!Number.isInteger(pharmacyId) || pharmacyId < 1) { res.status(400).json({ error: "Invalid pharmacy id" }); return; }

  const parsed = VerificationDecisionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { decision, reason } = parsed.data;

  const [pharmacy] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));
  if (!pharmacy) { res.status(404).json({ error: "Pharmacy not found" }); return; }
  if (pharmacy.verificationStatus === "approved" && decision === "approve") {
    res.status(400).json({ error: "Pharmacy is already approved" }); return;
  }

  const adminId = req.session.adminId!;
  const [admin] = await db.select({ email: adminsTable.email }).from(adminsTable).where(eq(adminsTable.id, adminId));

  if (decision === "approve") {
    await db.update(pharmaciesTable).set({
      verificationStatus: "approved", rejectionReason: null, verifiedAt: new Date(), verifiedByAdminId: adminId,
    }).where(eq(pharmaciesTable.id, pharmacyId));
    await db.insert(notificationsTable).values({
      pharmacyId,
      message: `تم اعتماد صيدليتكم "${pharmacy.name}" — يمكنكم الآن إرسال واستقبال طلبات التبادل`,
    });
  } else {
    await db.update(pharmaciesTable).set({
      verificationStatus: "rejected", rejectionReason: reason!, verifiedAt: new Date(), verifiedByAdminId: adminId,
    }).where(eq(pharmaciesTable.id, pharmacyId));
    await db.insert(notificationsTable).values({
      pharmacyId,
      message: `تم رفض اعتماد صيدليتكم "${pharmacy.name}". السبب: ${reason}`,
    });
  }

  await logAudit(db, {
    actorType: "admin",
    actorId: adminId,
    actorLabel: admin?.email ?? null,
    action: decision === "approve" ? "pharmacy.verification.approved" : "pharmacy.verification.rejected",
    targetType: "pharmacy",
    targetId: pharmacyId,
    details: decision === "approve" ? null : reason!,
  });

  res.json({ message: decision === "approve" ? "Pharmacy approved" : "Pharmacy rejected" });
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

function parseAuditDetails(details: string | null): unknown {
  if (details === null) return null;
  try { return JSON.parse(details); } catch { return details; }
}

router.get("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filters = [];
  if (typeof req.query.action === "string" && req.query.action) {
    filters.push(eq(auditLogsTable.action, req.query.action));
  }
  if (typeof req.query.targetType === "string" && req.query.targetType) {
    filters.push(eq(auditLogsTable.targetType, req.query.targetType));
  }
  const targetId = Number(req.query.targetId);
  if (Number.isInteger(targetId) && targetId > 0) {
    filters.push(eq(auditLogsTable.targetId, targetId));
  }

  const rows = await db.select().from(auditLogsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLogsTable.createdAt), desc(auditLogsTable.id))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: rows.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actorId: row.actorId,
      actorLabel: row.actorLabel,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      details: parseAuditDetails(row.details),
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: { page, limit },
  });
});

export default router;
