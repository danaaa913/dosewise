import { Router, type IRouter } from "express";
import { db, medicinesTable, pharmaciesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { AddMedicineBody, UpdateMedicineBody, UpdateMedicineParams, DeleteMedicineParams } from "../zod/schemas.js";

const router: IRouter = Router();

function requirePharmacy(req: any, res: any, next: any) {
  if (!req.session.pharmacyId) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

router.post("/medicines/add", requirePharmacy, async (req, res): Promise<void> => {
  const parsed = AddMedicineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, quantity, price, expiryDate, description, isAvailable } = parsed.data;
  const [medicine] = await db.insert(medicinesTable).values({
    pharmacyId: req.session.pharmacyId!,
    name, quantity, price, expiryDate,
    description: description ?? null,
    isAvailable: isAvailable ?? true,
  }).returning();

  res.status(201).json({
    id: medicine.id, pharmacyId: medicine.pharmacyId, name: medicine.name,
    quantity: medicine.quantity, price: medicine.price, expiryDate: medicine.expiryDate,
    description: medicine.description ?? null, isAvailable: medicine.isAvailable,
  });
});

router.get("/medicines/my", requirePharmacy, async (req, res): Promise<void> => {
  const medicines = await db.select().from(medicinesTable)
    .where(eq(medicinesTable.pharmacyId, req.session.pharmacyId!));
  res.json(medicines.map(m => ({
    id: m.id, pharmacyId: m.pharmacyId, name: m.name, quantity: m.quantity,
    price: m.price, expiryDate: m.expiryDate, description: m.description ?? null,
    isAvailable: m.isAvailable,
  })));
});

router.get("/medicines/available", requirePharmacy, async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;
  const medicines = await db
    .select({
      id: medicinesTable.id, pharmacyId: medicinesTable.pharmacyId,
      name: medicinesTable.name, quantity: medicinesTable.quantity,
      price: medicinesTable.price, expiryDate: medicinesTable.expiryDate,
      description: medicinesTable.description, isAvailable: medicinesTable.isAvailable,
      pharmacyName: pharmaciesTable.name, pharmacyCity: pharmaciesTable.city,
    })
    .from(medicinesTable)
    .leftJoin(pharmaciesTable, eq(medicinesTable.pharmacyId, pharmaciesTable.id))
    .where(eq(medicinesTable.isAvailable, true));

  const filtered = medicines.filter(m => m.pharmacyId !== req.session.pharmacyId);
  const searched = search
    ? filtered.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  res.json(searched.map(m => ({
    id: m.id, pharmacyId: m.pharmacyId, name: m.name, quantity: m.quantity,
    price: m.price, expiryDate: m.expiryDate, description: m.description ?? null,
    isAvailable: m.isAvailable, pharmacyName: m.pharmacyName ?? "", pharmacyCity: m.pharmacyCity ?? "",
  })));
});

router.put("/medicines/:medicineId/update", requirePharmacy, async (req, res): Promise<void> => {
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
  if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
  if (parsed.data.expiryDate !== undefined) updateData.expiryDate = parsed.data.expiryDate;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.isAvailable !== undefined) updateData.isAvailable = parsed.data.isAvailable;

  const [updated] = await db.update(medicinesTable).set(updateData)
    .where(eq(medicinesTable.id, params.data.medicineId)).returning();

  res.json({
    id: updated.id, pharmacyId: updated.pharmacyId, name: updated.name,
    quantity: updated.quantity, price: updated.price, expiryDate: updated.expiryDate,
    description: updated.description ?? null, isAvailable: updated.isAvailable,
  });
});

router.delete("/medicines/:medicineId/delete", requirePharmacy, async (req, res): Promise<void> => {
  const params = DeleteMedicineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, params.data.medicineId));
  if (!existing) { res.status(404).json({ error: "Medicine not found" }); return; }
  if (existing.pharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(medicinesTable).where(eq(medicinesTable.id, params.data.medicineId));
  res.json({ message: "Medicine deleted successfully" });
});

export default router;
