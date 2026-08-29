import { Router, type IRouter } from "express";
import { db, requestsTable, medicinesTable, pharmaciesTable, notificationsTable, type Request } from "../db/index.js";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { SendRequestBody, AcceptRequestParams, RejectRequestParams, RequestIdParams } from "../zod/schemas.js";
import { canTransition, fail, type RequestStatus } from "../lib/request-state.js";
import { requireApprovedPharmacy } from "../middlewares/require-approved-pharmacy.js";
import { isExpired } from "../lib/expiry.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

interface ActionOutcome {
  status: number;
  body: object;
}

router.post("/requests/send", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const parsed = SendRequestBody.safeParse(req.body);
  if (!parsed.success) { fail(res, 400, undefined, parsed.error.message); return; }

  const { medicineId, requestedQuantity } = parsed.data;
  const idempotencyKey = typeof req.header("idempotency-key") === "string" ? req.header("idempotency-key")!.trim() : "";
  if (!idempotencyKey || idempotencyKey.length > 255) {
    fail(res, 400, undefined, "Idempotency-Key header is required (max 255 chars)"); return;
  }

  const serializeRequest = (existing: Request) => ({
    id: existing.id, requesterPharmacyId: existing.requesterPharmacyId,
    providerPharmacyId: existing.providerPharmacyId, medicineId: existing.medicineId,
    requestedQuantity: existing.requestedQuantity, unitPrice: existing.unitPrice,
    medicineName: existing.medicineName, status: existing.status,
    requestDate: existing.requestDate.toISOString(),
    responseDate: existing.responseDate ? existing.responseDate.toISOString() : null,
    duplicate: true,
  });

  const resolveIdempotency = async () => {
    const [byKey] = await db.select().from(requestsTable).where(and(
      eq(requestsTable.requesterPharmacyId, req.session.pharmacyId!),
      eq(requestsTable.idempotencyKey, idempotencyKey),
    ));
    if (!byKey) return null;
    if (byKey.medicineId === medicineId && byKey.requestedQuantity === requestedQuantity) {
      return { kind: "duplicate" as const, row: byKey };
    }
    return { kind: "reused" as const, row: byKey };
  };

  const prior = await resolveIdempotency();
  if (prior) {
    if (prior.kind === "duplicate") {
      res.status(200).json(serializeRequest(prior.row)); return;
    }
    fail(res, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used for a different request"); return;
  }

  const [row] = await db
    .select({
      id: medicinesTable.id, pharmacyId: medicinesTable.pharmacyId,
      name: medicinesTable.name, quantity: medicinesTable.quantity,
      price: medicinesTable.price, expiryDate: medicinesTable.expiryDate,
      isAvailable: medicinesTable.isAvailable,
      providerVerificationStatus: pharmaciesTable.verificationStatus,
      providerIsActive: pharmaciesTable.isActive,
    })
    .from(medicinesTable)
    .leftJoin(pharmaciesTable, eq(medicinesTable.pharmacyId, pharmaciesTable.id))
    .where(eq(medicinesTable.id, medicineId));

  if (!row) { fail(res, 404, "MEDICINE_NOT_FOUND", "Medicine not found"); return; }
  if (row.pharmacyId === req.session.pharmacyId) { fail(res, 400, "SELF_REQUEST_NOT_ALLOWED", "Cannot request your own medicine"); return; }
  if (row.providerVerificationStatus !== "approved" || row.providerIsActive !== true) {
    fail(res, 409, "PROVIDER_UNAVAILABLE", "Provider pharmacy is not available"); return;
  }
  if (!row.isAvailable) { fail(res, 409, "MEDICINE_UNAVAILABLE", "Medicine is not available"); return; }
  if (isExpired(row.expiryDate)) {
    fail(res, 409, "MEDICINE_EXPIRED", "Medicine is expired"); return;
  }
  if (requestedQuantity > row.quantity) {
    fail(res, 409, "INSUFFICIENT_STOCK", `Insufficient stock to fulfill this request (${row.quantity} available)`); return;
  }

  const [pendingDuplicate] = await db.select({ id: requestsTable.id }).from(requestsTable).where(and(
    eq(requestsTable.requesterPharmacyId, req.session.pharmacyId!),
    eq(requestsTable.medicineId, medicineId),
    eq(requestsTable.status, "pending"),
  ));
  if (pendingDuplicate) {
    const race = await resolveIdempotency();
    if (race) {
      if (race.kind === "duplicate") { res.status(200).json(serializeRequest(race.row)); return; }
      fail(res, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used for a different request"); return;
    }
    fail(res, 409, "DUPLICATE_PENDING_REQUEST", "A pending request for this medicine already exists"); return;
  }

  let request: Request;
  try {
    const inserted = await db.transaction(async (tx) => {
      const [insertedRow] = await tx.insert(requestsTable).values({
        requesterPharmacyId: req.session.pharmacyId!,
        providerPharmacyId: row.pharmacyId,
        medicineId, requestedQuantity,
        unitPrice: row.price,
        medicineName: row.name,
        idempotencyKey,
      }).returning();
      const [requester] = await tx.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
      await tx.insert(notificationsTable).values({
        pharmacyId: row.pharmacyId,
        message: `طلب جديد من ${requester?.name ?? "صيدلية"} للدواء: ${row.name} (الكمية: ${requestedQuantity})`,
      });
      return insertedRow;
    });
    request = inserted;
  } catch (err) {
    const underlying = (err as { cause?: { code?: string; constraint?: string } }).cause ?? err;
    const violation = underlying as { code?: string; constraint?: string };
    if (violation.code !== "23505") {
      logger.error({ err }, "requests/send: unexpected database error");
      fail(res, 500, undefined, "Internal server error");
      return;
    }

    const race = await resolveIdempotency();
    if (violation.constraint === "requests_requester_medicine_pending_idx") {
      if (race) {
        if (race.kind === "duplicate") { res.status(200).json(serializeRequest(race.row)); return; }
        fail(res, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used for a different request"); return;
      }
      fail(res, 409, "DUPLICATE_PENDING_REQUEST", "A pending request for this medicine already exists"); return;
    }
    if (violation.constraint === "requests_requester_idempotency_idx") {
      if (race && race.kind === "duplicate") { res.status(200).json(serializeRequest(race.row)); return; }
      fail(res, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used for a different request"); return;
    }
    logger.error({ err, constraint: violation.constraint }, "requests/send: unexpected unique violation");
    fail(res, 500, undefined, "Internal server error");
    return;
  }

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
      requestedQuantity: requestsTable.requestedQuantity, unitPrice: requestsTable.unitPrice,
      status: requestsTable.status, requestDate: requestsTable.requestDate, responseDate: requestsTable.responseDate,
      medicineName: requestsTable.medicineName,
    })
    .from(requestsTable)
    .where(eq(requestsTable.requesterPharmacyId, req.session.pharmacyId!))
    .orderBy(desc(requestsTable.requestDate), desc(requestsTable.id));

  const withNames = await Promise.all(requests.map(async (r) => {
    const [requester] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.requesterPharmacyId));
    const [provider] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.providerPharmacyId));
    return {
      ...r, requestDate: r.requestDate.toISOString(),
      responseDate: r.responseDate ? r.responseDate.toISOString() : null,
      requesterName: requester?.name ?? "", providerName: provider?.name ?? "",
    };
  }));
  res.json(withNames);
});

router.get("/requests/received", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      id: requestsTable.id, requesterPharmacyId: requestsTable.requesterPharmacyId,
      providerPharmacyId: requestsTable.providerPharmacyId, medicineId: requestsTable.medicineId,
      requestedQuantity: requestsTable.requestedQuantity, unitPrice: requestsTable.unitPrice,
      status: requestsTable.status, requestDate: requestsTable.requestDate, responseDate: requestsTable.responseDate,
      medicineName: requestsTable.medicineName,
    })
    .from(requestsTable)
    .where(eq(requestsTable.providerPharmacyId, req.session.pharmacyId!))
    .orderBy(desc(requestsTable.requestDate), desc(requestsTable.id));

  const withNames = await Promise.all(requests.map(async (r) => {
    const [requester] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.requesterPharmacyId));
    const [provider] = await db.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, r.providerPharmacyId));
    return {
      ...r, requestDate: r.requestDate.toISOString(),
      responseDate: r.responseDate ? r.responseDate.toISOString() : null,
      requesterName: requester?.name ?? "", providerName: provider?.name ?? "",
    };
  }));
  res.json(withNames);
});

router.post("/requests/:requestId/accept", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = AcceptRequestParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, undefined, params.error.message); return; }

  let outcome: ActionOutcome | null = null;

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx.select().from(requestsTable)
        .where(eq(requestsTable.id, params.data.requestId))
        .for("update");

      if (!request) { outcome = { status: 404, body: { error: "Request not found", code: "REQUEST_NOT_FOUND" } }; return; }
      if (request.providerPharmacyId !== req.session.pharmacyId) { outcome = { status: 403, body: { error: "Forbidden", code: "REQUEST_FORBIDDEN" } }; return; }
      if (!canTransition(request.status as RequestStatus, "accepted")) {
        outcome = { status: 409, body: { error: `Cannot move request from ${request.status} to accepted`, code: "REQUEST_INVALID_STATE" } }; return;
      }

      const [requester] = await tx.select({
        isActive: pharmaciesTable.isActive,
        verificationStatus: pharmaciesTable.verificationStatus,
      }).from(pharmaciesTable).where(eq(pharmaciesTable.id, request.requesterPharmacyId));
      if (!requester || requester.verificationStatus !== "approved" || requester.isActive !== true) {
        outcome = { status: 409, body: { error: "Requester pharmacy is not available", code: "REQUESTER_UNAVAILABLE" } }; return;
      }

      const [medicine] = await tx.select({
        name: medicinesTable.name,
        isAvailable: medicinesTable.isAvailable,
        expiryDate: medicinesTable.expiryDate,
      }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
      if (!medicine) { outcome = { status: 404, body: { error: "Medicine not found", code: "MEDICINE_NOT_FOUND" } }; return; }
      if (!medicine.isAvailable) { outcome = { status: 409, body: { error: "Medicine is not available", code: "MEDICINE_UNAVAILABLE" } }; return; }
      if (isExpired(medicine.expiryDate)) { outcome = { status: 409, body: { error: "Medicine is expired", code: "MEDICINE_EXPIRED" } }; return; }

      const deducted = await tx.update(medicinesTable)
        .set({ quantity: sql`${medicinesTable.quantity} - ${request.requestedQuantity}` })
        .where(and(
          eq(medicinesTable.id, request.medicineId),
          gte(medicinesTable.quantity, request.requestedQuantity),
        ))
        .returning({ id: medicinesTable.id, remaining: medicinesTable.quantity });

      if (deducted.length === 0) {
        outcome = { status: 409, body: { error: "Insufficient stock to accept this request", code: "INSUFFICIENT_STOCK" } }; return;
      }

      const updated = await tx.update(requestsTable)
        .set({ status: "accepted", responseDate: new Date() })
        .where(and(
          eq(requestsTable.id, request.id),
          eq(requestsTable.status, "pending"),
        ))
        .returning({ id: requestsTable.id });

      if (updated.length === 0) {
        outcome = { status: 409, body: { error: "Request status changed concurrently", code: "REQUEST_INVALID_STATE" } };
        throw outcome;
      }

      const [provider] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
      await tx.insert(notificationsTable).values({
        pharmacyId: request.requesterPharmacyId,
        message: `تم قبول طلبك للدواء: ${medicine.name} من صيدلية ${provider?.name ?? ""}`,
      });

      outcome = { status: 200, body: { message: "Request accepted", remainingStock: deducted[0].remaining } };
    });
  } catch (err) {
    if (err !== outcome) {
      logger.error({ err }, "requests/accept: unexpected error");
      fail(res, 500, undefined, "Internal server error");
      return;
    }
  }

  res.status(outcome!.status).json(outcome!.body);
});

router.post("/requests/:requestId/reject", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = RejectRequestParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, undefined, params.error.message); return; }

  let outcome: ActionOutcome | null = null;

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx.select().from(requestsTable)
        .where(eq(requestsTable.id, params.data.requestId))
        .for("update");

      if (!request) { outcome = { status: 404, body: { error: "Request not found", code: "REQUEST_NOT_FOUND" } }; return; }
      if (request.providerPharmacyId !== req.session.pharmacyId) { outcome = { status: 403, body: { error: "Forbidden", code: "REQUEST_FORBIDDEN" } }; return; }
      if (!canTransition(request.status as RequestStatus, "rejected")) {
        outcome = { status: 409, body: { error: `Cannot move request from ${request.status} to rejected`, code: "REQUEST_INVALID_STATE" } }; return;
      }

      const updated = await tx.update(requestsTable)
        .set({ status: "rejected", responseDate: new Date() })
        .where(and(
          eq(requestsTable.id, request.id),
          eq(requestsTable.status, "pending"),
        ))
        .returning({ id: requestsTable.id });

      if (updated.length === 0) {
        outcome = { status: 409, body: { error: "Request status changed concurrently", code: "REQUEST_INVALID_STATE" } }; return;
      }

      const [medicine] = await tx.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
      const [provider] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
      await tx.insert(notificationsTable).values({
        pharmacyId: request.requesterPharmacyId,
        message: `تم رفض طلبك للدواء: ${medicine?.name ?? ""} من صيدلية ${provider?.name ?? ""}`,
      });

      outcome = { status: 200, body: { message: "Request rejected" } };
    });
  } catch (err) {
    logger.error({ err }, "requests/reject: unexpected error");
    fail(res, 500, undefined, "Internal server error");
    return;
  }

  res.status(outcome!.status).json(outcome!.body);
});

router.post("/requests/:requestId/cancel", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = RequestIdParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, undefined, params.error.message); return; }

  let outcome: ActionOutcome | null = null;

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx.select().from(requestsTable)
        .where(eq(requestsTable.id, params.data.requestId))
        .for("update");

      if (!request) { outcome = { status: 404, body: { error: "Request not found", code: "REQUEST_NOT_FOUND" } }; return; }
      if (request.requesterPharmacyId !== req.session.pharmacyId) { outcome = { status: 403, body: { error: "Only the requester may cancel", code: "REQUEST_FORBIDDEN" } }; return; }
      if (!canTransition(request.status as RequestStatus, "cancelled")) {
        outcome = { status: 409, body: { error: `Cannot cancel a ${request.status} request`, code: "REQUEST_INVALID_STATE" } }; return;
      }

      const updated = await tx.update(requestsTable)
        .set({ status: "cancelled", responseDate: new Date() })
        .where(and(
          eq(requestsTable.id, request.id),
          eq(requestsTable.status, "pending"),
        ))
        .returning({ id: requestsTable.id });

      if (updated.length === 0) {
        outcome = { status: 409, body: { error: "Request is no longer pending", code: "REQUEST_INVALID_STATE" } }; return;
      }

      const [medicine] = await tx.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
      const [provider] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, request.providerPharmacyId));
      const [requester] = await tx.select({ name: pharmaciesTable.name }).from(pharmaciesTable).where(eq(pharmaciesTable.id, req.session.pharmacyId!));
      await tx.insert(notificationsTable).values({
        pharmacyId: request.providerPharmacyId,
        message: `ألغى ${requester?.name ?? "الطالب"} طلبه للدواء: ${medicine?.name ?? ""}`,
      });

      outcome = { status: 200, body: { message: "Request cancelled" } };
    });
  } catch (err) {
    logger.error({ err }, "requests/cancel: unexpected error");
    fail(res, 500, undefined, "Internal server error");
    return;
  }

  res.status(outcome!.status).json(outcome!.body);
});

router.post("/requests/:requestId/complete", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = RequestIdParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, undefined, params.error.message); return; }

  let outcome: ActionOutcome | null = null;

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx.select().from(requestsTable)
        .where(eq(requestsTable.id, params.data.requestId))
        .for("update");

      if (!request) { outcome = { status: 404, body: { error: "Request not found", code: "REQUEST_NOT_FOUND" } }; return; }
      if (request.requesterPharmacyId !== req.session.pharmacyId) { outcome = { status: 403, body: { error: "Only the requester may confirm receipt", code: "REQUEST_FORBIDDEN" } }; return; }
      if (!canTransition(request.status as RequestStatus, "completed")) {
        outcome = { status: 409, body: { error: `Cannot complete a ${request.status} request`, code: "REQUEST_INVALID_STATE" } }; return;
      }

      const updated = await tx.update(requestsTable)
        .set({ status: "completed", responseDate: new Date() })
        .where(and(
          eq(requestsTable.id, request.id),
          eq(requestsTable.status, "accepted"),
        ))
        .returning({ id: requestsTable.id });

      if (updated.length === 0) {
        outcome = { status: 409, body: { error: "Request status changed concurrently", code: "REQUEST_INVALID_STATE" } }; return;
      }

      const [medicine] = await tx.select({ name: medicinesTable.name }).from(medicinesTable).where(eq(medicinesTable.id, request.medicineId));
      await tx.insert(notificationsTable).values({
        pharmacyId: request.providerPharmacyId,
        message: `أكدت الصيدلية الطالبة استلام الدواء: ${medicine?.name ?? ""} — اكتمل الطلب`,
      });

      outcome = { status: 200, body: { message: "Request completed" } };
    });
  } catch (err) {
    logger.error({ err }, "requests/complete: unexpected error");
    fail(res, 500, undefined, "Internal server error");
    return;
  }

  res.status(outcome!.status).json(outcome!.body);
});

export default router;