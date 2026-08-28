import type { NextFunction, Request, Response } from "express";
import { db, pharmaciesTable } from "../db/index.js";
import { eq } from "drizzle-orm";

export async function requireApprovedPharmacy(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pharmacyId = req.session?.pharmacyId;
  if (!pharmacyId) { res.status(401).json({ error: "Authentication required" }); return; }

  const [pharmacy] = await db.select({
    isActive: pharmaciesTable.isActive,
    verificationStatus: pharmaciesTable.verificationStatus,
  }).from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));

  if (!pharmacy) { res.status(401).json({ error: "Authentication required" }); return; }

  if (pharmacy.verificationStatus === "pending") {
    res.status(403).json({ error: "Account pending verification", code: "PHARMACY_NOT_VERIFIED" }); return;
  }
  if (pharmacy.verificationStatus === "rejected") {
    res.status(403).json({ error: "Account not approved", code: "PHARMACY_REJECTED" }); return;
  }
  if (!pharmacy.isActive) {
    res.status(403).json({ error: "Account is inactive", code: "PHARMACY_INACTIVE" }); return;
  }

  next();
}