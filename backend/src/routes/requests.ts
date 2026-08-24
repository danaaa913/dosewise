import { Router, type IRouter } from "express";
import { db, requestsTable, medicinesTable, pharmaciesTable, notificationsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { SendRequestBody, AcceptRequestParams, RejectRequestParams } from "../zod/schemas.js";

const router: IRouter = Router();

function requirePharmacy(req: any, res: any, next: any) {
  if (!req.session.pharmacyId) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

router.post("/requests/send", requirePharmacy, async (req, res): Promise<void> => {
  const parsed = SendRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { medicineId, requestedQuantity } = parsed.data;
  const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicineId));
  if (!medicine) { res.status(404).json({ error: "Medicine not found" }); return; }
  if (!medicine.isAvailable) { res.status(400).json({ error: "Medicine is not available" }); return; }
  if (medicine.pharmacyId === req.session.pharmacyId) { res.status(400).json({ error: "Cannot request your own medicine" }); return; }

  const [request] = await db.insert(requestsTable).values({
    requesterPharmacyId: req.session.pharmacyId!,
    providerPharmacyId: medicine.pharmacyId,
    medicineId, requestedQuantity,
  }).returning();

  const [requester] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  await db.insert(notificationsTable).values({
    pharmacyId: medicine.pharmacyId,
    message: `طلب جديد من ${requester?.name ?? "صيدلية"} للدواء: ${medicine.name} (الكمية: ${requestedQuantity})`,
  });

  res.status(201).json({
    id: request.id, requesterPharmacyId: request.requesterPharmacyId,
    providerPharmacyId: request.providerPharmacyId, medicineId: request.medicineId,
    requestedQuantity: request.requestedQuantity, status: request.status,
    requestDate: request.requestDate.toISOString(),
    responseDate: request.responseDate ? request.responseDate.toISOString() : null,
  });
});

router.get("/requests/sent", requirePharmacy, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      id: requestsTable.id, requesterPharmacyId: requestsTable.requesterPharmacyId,
      providerPharmacyId: requestsTable.providerPharmacyId, medicineId: requestsTable.medicineId,
      requestedQuantity: requestsTable.requestedQuantity, status: requestsTable.status,
      requestDate: requestsTable.requestDate, responseDate: requestsTable.responseDate,
      medicineName: medicinesTable.name,
    })
    .from(requestsTable)
    .leftJoin(medicinesTable, eq(requestsTable.medicineId, medicinesTable.id))
    .where(eq(requestsTable.requesterPharmacyId, req.session.pharmacyId!));

  const withNames = await Promise.all(requests.map(async (r) => {
    const [requester] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.requesterPharmacyId));
    const [provider] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.providerPharmacyId));
    return {
      ...r, requestDate: r.requestDate.toISOString(),
      responseDate: r.responseDate ? r.responseDate.toISOString() : null,
      medicineName: r.medicineName ?? "", requesterName: requester?.name ?? "", providerName: provider?.name ?? "",
    };
  }));
  res.json(withNames);
});

router.get("/requests/received", requirePharmacy, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      id: requestsTable.id, requesterPharmacyId: requestsTable.requesterPharmacyId,
      providerPharmacyId: requestsTable.providerPharmacyId, medicineId: requestsTable.medicineId,
      requestedQuantity: requestsTable.requestedQuantity, status: requestsTable.status,
      requestDate: requestsTable.requestDate, responseDate: requestsTable.responseDate,
      medicineName: medicinesTable.name,
    })
    .from(requestsTable)
    .leftJoin(medicinesTable, eq(requestsTable.medicineId, medicinesTable.id))
    .where(eq(requestsTable.providerPharmacyId, req.session.pharmacyId!));

  const withNames = await Promise.all(requests.map(async (r) => {
    const [requester] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.requesterPharmacyId));
    const [provider] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.providerPharmacyId));
    return {
      ...r, requestDate: r.requestDate.toISOString(),
      responseDate: r.responseDate ? r.responseDate.toISOString() : null,
      medicineName: r.medicineName ?? "", requesterName: requester?.name ?? "", providerName: provider?.name ?? "",
    };
  }));
  res.json(withNames);
});

router.post("/requests/:requestId/accept", requirePharmacy, async (req, res): Promise<void> => {
  const params = AcceptRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.requestId));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.providerPharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (request.status !== "pending") { res.status(400).json({ error: "Request is not pending" }); return; }

  await db.update(requestsTable).set({ status: "accepted", responseDate: new Date() })
    .where(eq(requestsTable.id, params.data.requestId));

  const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
  const [provider] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  await db.insert(notificationsTable).values({
    pharmacyId: request.requesterPharmacyId,
    message: `تم قبول طلبك للدواء: ${medicine?.name ?? ""} من صيدلية ${provider?.name ?? ""}`,
  });
  res.json({ message: "Request accepted" });
});

router.post("/requests/:requestId/reject", requirePharmacy, async (req, res): Promise<void> => {
  const params = RejectRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.requestId));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.providerPharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (request.status !== "pending") { res.status(400).json({ error: "Request is not pending" }); return; }

  await db.update(requestsTable).set({ status: "rejected", responseDate: new Date() })
    .where(eq(requestsTable.id, params.data.requestId));

  const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
  const [provider] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  await db.insert(notificationsTable).values({
    pharmacyId: request.requesterPharmacyId,
    message: `تم رفض طلبك للدواء: ${medicine?.name ?? ""} من صيدلية ${provider?.name ?? ""}`,
  });
  res.json({ message: "Request rejected" });
});

export default router;
