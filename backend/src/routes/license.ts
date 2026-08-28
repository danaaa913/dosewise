import { Router, type IRouter } from "express";
import { db, pharmaciesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { UpdateLicenseBody } from "../zod/schemas.js";
import { requireApprovedPharmacy } from "../middlewares/require-approved-pharmacy.js";

const router: IRouter = Router();

router.get("/pharmacy/license", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const [pharmacy] = await db.select({
    licenseNumber: pharmaciesTable.licenseNumber,
    licenseDocName: pharmaciesTable.licenseDocName,
    licenseDocMime: pharmaciesTable.licenseDocMime,
    licenseDocUpdatedAt: pharmaciesTable.licenseDocUpdatedAt,
  }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));

  if (!pharmacy) { res.status(404).json({ error: "Pharmacy not found" }); return; }

  res.json({
    licenseNumber: pharmacy.licenseNumber,
    document: pharmacy.licenseDocName
      ? { name: pharmacy.licenseDocName, mime: pharmacy.licenseDocMime, updatedAt: pharmacy.licenseDocUpdatedAt?.toISOString() ?? null }
      : null,
  });
});

router.put("/pharmacy/license", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const parsed = UpdateLicenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { licenseNumber, licenseDoc } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
  if (licenseDoc) {
    updates.licenseDocName = licenseDoc.name;
    updates.licenseDocMime = licenseDoc.mime;
    updates.licenseDocData = licenseDoc.data;
    updates.licenseDocUpdatedAt = new Date();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }

  await db.update(pharmaciesTable).set(updates).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  res.json({ message: "License information updated" });
});

router.get("/pharmacy/license/document", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const [pharmacy] = await db.select({
    licenseDocName: pharmaciesTable.licenseDocName,
    licenseDocMime: pharmaciesTable.licenseDocMime,
    licenseDocData: pharmaciesTable.licenseDocData,
  }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));

  if (!pharmacy?.licenseDocData) { res.status(404).json({ error: "No license document uploaded" }); return; }

  const buffer = Buffer.from(pharmacy.licenseDocData, "base64");
  res.setHeader("Content-Type", pharmacy.licenseDocMime ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(pharmacy.licenseDocName ?? "license")}"`);
  res.send(buffer);
});

export default router;
