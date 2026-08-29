import { Router, type IRouter } from "express";
import { db, medicinesTable, pharmaciesTable } from "../db/index.js";
import { eq, and, asc, count, gt, gte, ilike, ne } from "drizzle-orm";
import { AddMedicineBody, UpdateMedicineBody, UpdateMedicineParams, DeleteMedicineParams } from "../zod/schemas.js";
import { requireApprovedPharmacy } from "../middlewares/require-approved-pharmacy.js";
import { todayUtc } from "../lib/expiry.js";
import { fail } from "../lib/request-state.js";
import { logAudit } from "../lib/audit.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

router.post("/medicines/add", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const parsed = AddMedicineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, quantity, price, expiryDate, description, isAvailable } = parsed.data;
  const [medicine] = await db.insert(medicinesTable).values({
    pharmacyId: req.session.pharmacyId!,
    name, quantity, price: price.toFixed(2), expiryDate,
    description: description ?? null,
    isAvailable: isAvailable ?? true,
  }).returning();

  await logAudit(db, {
    actorType: "pharmacy",
    actorId: req.session.pharmacyId!,
    action: "medicine.created",
    targetType: "medicine",
    targetId: medicine.id,
    details: JSON.stringify({ name: medicine.name, quantity: medicine.quantity }),
  });

  res.status(201).json({
    id: medicine.id, pharmacyId: medicine.pharmacyId, name: medicine.name,
    quantity: medicine.quantity, price: medicine.price, expiryDate: medicine.expiryDate,
    description: medicine.description ?? null, isAvailable: medicine.isAvailable,
  });
});

router.get("/medicines/my", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const medicines = await db.select().from(medicinesTable)
    .where(eq(medicinesTable.pharmacyId, req.session.pharmacyId!));
  res.json(medicines.map(m => ({
    id: m.id, pharmacyId: m.pharmacyId, name: m.name, quantity: m.quantity,
    price: m.price, expiryDate: m.expiryDate, description: m.description ?? null,
    isAvailable: m.isAvailable,
  })));
});

router.get("/medicines/available", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const page = Number.isFinite(Number(req.query.page)) ? Math.max(1, Math.floor(Number(req.query.page))) : 1;
  const limit = Number.isFinite(Number(req.query.limit))
    ? Math.min(100, Math.max(1, Math.floor(Number(req.query.limit))))
    : 20;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const conditions = [
    eq(medicinesTable.isAvailable, true),
    gt(medicinesTable.quantity, 0),
    gte(medicinesTable.expiryDate, todayUtc()),
    eq(pharmaciesTable.verificationStatus, "approved"),
    eq(pharmaciesTable.isActive, true),
    ne(medicinesTable.pharmacyId, req.session.pharmacyId!),
  ];
  if (search) {
    conditions.push(ilike(medicinesTable.name, `%${escapeLike(search)}%`));
  }

  const [{ count: total }] = await db.select({ count: count() })
    .from(medicinesTable)
    .innerJoin(pharmaciesTable, eq(medicinesTable.pharmacyId, pharmaciesTable.id))
    .where(and(...conditions));

  const medicines = await db
    .select({
      id: medicinesTable.id, pharmacyId: medicinesTable.pharmacyId,
      name: medicinesTable.name, quantity: medicinesTable.quantity,
      price: medicinesTable.price, expiryDate: medicinesTable.expiryDate,
      description: medicinesTable.description, isAvailable: medicinesTable.isAvailable,
      pharmacyName: pharmaciesTable.name, pharmacyCity: pharmaciesTable.city,
    })
    .from(medicinesTable)
    .innerJoin(pharmaciesTable, eq(medicinesTable.pharmacyId, pharmaciesTable.id))
    .where(and(...conditions))
    .orderBy(
      asc(medicinesTable.expiryDate),
      asc(medicinesTable.name),
      asc(medicinesTable.id),
    )
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: medicines.map(m => ({
      id: m.id, pharmacyId: m.pharmacyId, name: m.name, quantity: m.quantity,
      price: m.price, expiryDate: m.expiryDate, description: m.description ?? null,
      isAvailable: m.isAvailable, pharmacyName: m.pharmacyName ?? "", pharmacyCity: m.pharmacyCity ?? "",
    })),
    pagination: { page, limit, total },
  });
});

router.put("/medicines/:medicineId/update", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = UpdateMedicineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateMedicineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, params.data.medicineId));
  if (!existing) { res.status(404).json({ error: "Medicine not found" }); return; }
  if (existing.pharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }

  const updateData: Partial<typeof medicinesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.quantity !== undefined) updateData.quantity = parsed.data.quantity;
  if (parsed.data.price !== undefined) updateData.price = parsed.data.price.toFixed(2);
  if (parsed.data.expiryDate !== undefined) updateData.expiryDate = parsed.data.expiryDate;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.isAvailable !== undefined) updateData.isAvailable = parsed.data.isAvailable;

  const [updated] = await db.update(medicinesTable).set(updateData)
    .where(eq(medicinesTable.id, params.data.medicineId)).returning();

  await logAudit(db, {
    actorType: "pharmacy",
    actorId: req.session.pharmacyId!,
    action: "medicine.updated",
    targetType: "medicine",
    targetId: updated.id,
    details: JSON.stringify({ changedFields: Object.keys(updateData) }),
  });

  res.json({
    id: updated.id, pharmacyId: updated.pharmacyId, name: updated.name,
    quantity: updated.quantity, price: updated.price, expiryDate: updated.expiryDate,
    description: updated.description ?? null, isAvailable: updated.isAvailable,
  });
});

router.delete("/medicines/:medicineId/delete", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = DeleteMedicineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, params.data.medicineId));
  if (!existing) { res.status(404).json({ error: "Medicine not found" }); return; }
  if (existing.pharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }

  try {
    await db.delete(medicinesTable).where(eq(medicinesTable.id, params.data.medicineId));
  } catch (err) {
    const underlying = (err as { cause?: { code?: string; constraint?: string } }).cause ?? err;
    const violation = underlying as { code?: string; constraint?: string };
    if (violation.code === "23503" && violation.constraint === "requests_medicine_id_medicines_id_fk") {
      fail(res, 409, "MEDICINE_HAS_REQUESTS", "This medicine has requests and cannot be deleted");
      return;
    }
    logger.error({ err }, "medicines/delete: unexpected database error");
    fail(res, 500, undefined, "Internal server error");
    return;
  }
  await logAudit(db, {
    actorType: "pharmacy",
    actorId: req.session.pharmacyId!,
    action: "medicine.deleted",
    targetType: "medicine",
    targetId: params.data.medicineId,
    details: JSON.stringify({ name: existing.name }),
  });
  res.json({ message: "Medicine deleted successfully" });
});

export default router;
