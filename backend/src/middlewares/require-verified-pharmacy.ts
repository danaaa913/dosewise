import type { NextFunction, Request, Response } from "express";
import { db, pharmaciesTable } from "../db/index.js";
import { eq } from "drizzle-orm";

export async function requireVerifiedPharmacy(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pharmacyId = req.session?.pharmacyId;
  if (!pharmacyId) { res.status(401).json({ error: "Authentication required" }); return; }

  const [pharmacy] = await db.select({
    isActive: pharmaciesTable.isActive,
    verificationStatus: pharmaciesTable.verificationStatus,
  }).from(pharmaciesTable).where(eq(pharmaciesTable.id, pharmacyId));

  if (!pharmacy) { res.status(401).json({ error: "Authentication required" }); return; }
  if (!pharmacy.isActive) { res.status(403).json({ error: "Account is deactivated" }); return; }
  if (pharmacy.verificationStatus !== "approved") {
    res.status(403).json({
      error: "حسابك قيد المراجعة أو مرفوض — لا يمكن تنفيذ التبادل قبل اعتماد الصيدلية",
      code: "PHARMACY_NOT_VERIFIED",
      verificationStatus: pharmacy.verificationStatus,
    });
    return;
  }

  next();
}
