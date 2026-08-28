import { Router, type IRouter } from "express";
import { db, requestsTable, medicinesTable, pharmaciesTable, notificationsTable } from "../db/index.js";
import { eq, and, gte, sql } from "drizzle-orm";
import { SendRequestBody, AcceptRequestParams, RejectRequestParams, RequestIdParams } from "../zod/schemas.js";
import { canTransition, type RequestStatus } from "../lib/request-state.js";
import { requireApprovedPharmacy } from "../middlewares/require-approved-pharmacy.js";

const router: IRouter = Router();



router.post("/requests/send", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const parsed = SendRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { medicineId, requestedQuantity } = parsed.data;
  const idempotencyKey = typeof req.header("idempotency-key") === "string" ? req.header("idempotency-key")!.trim() : "";
  if (!idempotencyKey || idempotencyKey.length > 255) {
    res.status(400).json({ error: "Idempotency-Key header is required (max 255 chars)" }); return;
  }

  const [existing] = await db.select().from(requestsTable).where(and(
    eq(requestsTable.requesterPharmacyId, req.session.pharmacyId!),
    eq(requestsTable.idempotencyKey, idempotencyKey),
  ));
  if (existing) {
    res.status(200).json({
      id: existing.id, requesterPharmacyId: existing.requesterPharmacyId,
      providerPharmacyId: existing.providerPharmacyId, medicineId: existing.medicineId,
      requestedQuantity: existing.requestedQuantity, unitPrice: existing.unitPrice,
      medicineName: existing.medicineName, status: existing.status,
      requestDate: existing.requestDate.toISOString(),
      responseDate: existing.responseDate ? existing.responseDate.toISOString() : null,
      duplicate: true,
    });
    return;
  }

  const [medicine] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicineId));
  if (!medicine) { res.status(404).json({ error: "Medicine not found" }); return; }
  if (!medicine.isAvailable) { res.status(400).json({ error: "Medicine is not available" }); return; }
  if (medicine.pharmacyId === req.session.pharmacyId) { res.status(400).json({ error: "Cannot request your own medicine" }); return; }
  if (new Date(medicine.expiryDate) < new Date()) { res.status(400).json({ error: "Medicine is expired" }); return; }
  if (requestedQuantity > medicine.quantity) {
    res.status(400).json({ error: `Requested quantity exceeds available stock (${medicine.quantity})` }); return;
  }

  const [request] = await db.insert(requestsTable).values({
    requesterPharmacyId: req.session.pharmacyId!,
    providerPharmacyId: medicine.pharmacyId,
    medicineId, requestedQuantity,
    unitPrice: medicine.price,
    medicineName: medicine.name,
    idempotencyKey,
  }).returning();

  const [requester] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
  await db.insert(notificationsTable).values({
    pharmacyId: medicine.pharmacyId,
    message: `طلب جديد من ${requester?.name ?? "صيدلية"} للدواء: ${medicine.name} (الكمية: ${requestedQuantity})`,
  });

  res.status(201).json({
    id: request.id, requesterPharmacyId: request.requesterPharmacyId,
    providerPharmacyId: request.providerPharmacyId, medicineId: request.medicineId,
    requestedQuantity: request.requestedQuantity, unitPrice: request.unitPrice,
    medicineName: request.medicineName, status: request.status,
    requestDate: request.requestDate.toISOString(),
    responseDate: request.responseDate ? request.responseDate.toISOString() : null,
  });
});

router.get("/requests/sent", requireApprovedPharmacy, async (req, res): Promise<void> => {
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

router.get("/requests/received", requireApprovedPharmacy, async (req, res): Promise<void> => {
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

router.post("/requests/:requestId/accept", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = AcceptRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let status = 200;
  let body: object;

  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(requestsTable)
      .where(eq(requestsTable.id, params.data.requestId))
      .for("update");

    if (!request) { status = 404; body = { error: "Request not found" }; return; }
    if (request.providerPharmacyId !== req.session.pharmacyId) { status = 403; body = { error: "Forbidden" }; return; }
    if (!canTransition(request.status as RequestStatus, "accepted")) {
      status = 400;
      body = { error: `Cannot move request from ${request.status} to accepted` };
      return;
    }

    const deducted = await tx.update(medicinesTable)
      .set({ quantity: sql`${medicinesTable.quantity} - ${request.requestedQuantity}` })
      .where(and(
        eq(medicinesTable.id, request.medicineId),
        gte(medicinesTable.quantity, request.requestedQuantity),
      ))
      .returning({ id: medicinesTable.id, remaining: medicinesTable.quantity });

    if (deducted.length === 0) {
      status = 409;
      body = { error: "Insufficient stock to accept this request" };
      return;
    }

    await tx.update(requestsTable)
      .set({ status: "accepted", responseDate: new Date() })
      .where(eq(requestsTable.id, request.id));

    const [medicine] = await tx.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
    const [provider] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
    await tx.insert(notificationsTable).values({
      pharmacyId: request.requesterPharmacyId,
      message: `تم قبول طلبك للدواء: ${medicine?.name ?? ""} من صيدلية ${provider?.name ?? ""}`,
    });

    body = { message: "Request accepted", remainingStock: deducted[0].remaining };
  });

  res.status(status!).json(body!);
});

router.post("/requests/:requestId/reject", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = RejectRequestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.requestId));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.providerPharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!canTransition(request.status as RequestStatus, "rejected")) { res.status(400).json({ error: `Cannot move request from ${request.status} to rejected` }); return; }

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

router.post("/requests/:requestId/cancel", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = RequestIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.requestId));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.requesterPharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Only the requester may cancel" }); return; }
  if (!canTransition(request.status as RequestStatus, "cancelled")) { res.status(400).json({ error: `Cannot cancel a ${request.status} request` }); return; }

  let status = 200;
  let body: object;

  await db.transaction(async (tx) => {
    const updated = await tx.update(requestsTable)
      .set({ status: "cancelled", responseDate: new Date() })
      .where(and(eq(requestsTable.id, request.id), eq(requestsTable.status, "pending")))
      .returning({ id: requestsTable.id });

    if (updated.length === 0) {
      status = 409;
      body = { error: "Request is no longer pending" };
      return;
    }

    const [medicine] = await tx.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
    const [provider] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, request.providerPharmacyId));
    const [requester] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
    await tx.insert(notificationsTable).values({
      pharmacyId: request.providerPharmacyId,
      message: `ألغى ${requester?.name ?? "الطالب"} طلبه للدواء: ${medicine?.name ?? ""}`,
    });

    body = { message: "Request cancelled" };
  });

  res.status(status!).json(body!);
});

router.post("/requests/:requestId/complete", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = RequestIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.requestId));
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.requesterPharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Only the requester may confirm receipt" }); return; }
  if (!canTransition(request.status as RequestStatus, "completed")) { res.status(400).json({ error: `Cannot complete a ${request.status} request` }); return; }

  await db.update(requestsTable).set({ status: "completed", responseDate: new Date() })
    .where(eq(requestsTable.id, params.data.requestId));

  const [medicine] = await db.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
  await db.insert(notificationsTable).values({
    pharmacyId: request.providerPharmacyId,
    message: `أكدت الصيدلية الطالبة استلام الدواء: ${medicine?.name ?? ""} — اكتمل الطلب`,
  });
  res.json({ message: "Request completed" });
});

export default router;
