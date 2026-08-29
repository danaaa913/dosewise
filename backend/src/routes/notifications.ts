import { Router, type IRouter } from "express";
import { db, notificationsTable, requestsTable } from "../db/index.js";
import { eq, and, desc, count } from "drizzle-orm";
import { GetNotificationsQueryParams, MarkNotificationReadParams } from "../zod/schemas.js";
import { requireApprovedPharmacy } from "../middlewares/require-approved-pharmacy.js";

const router: IRouter = Router();

const DEFAULT_LIMIT = 50;

async function unreadCountFor(pharmacyId: number): Promise<number> {
  const [row] = await db.select({ value: count() }).from(notificationsTable)
    .where(and(eq(notificationsTable.pharmacyId, pharmacyId), eq(notificationsTable.isRead, false)));
  return row?.value ?? 0;
}

router.get("/notifications/my", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = GetNotificationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const unreadOnly = params.data.unread_only === true;
  const limit = params.data.limit ?? DEFAULT_LIMIT;

  const where = unreadOnly
    ? and(eq(notificationsTable.pharmacyId, req.session.pharmacyId!), eq(notificationsTable.isRead, false))
    : eq(notificationsTable.pharmacyId, req.session.pharmacyId!);

  const rows = await db
    .select({
      id: notificationsTable.id,
      pharmacyId: notificationsTable.pharmacyId,
      type: notificationsTable.type,
      requestId: notificationsTable.requestId,
      metadata: notificationsTable.metadata,
      message: notificationsTable.message,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
      requestStatus: requestsTable.status,
    })
    .from(notificationsTable)
    .leftJoin(requestsTable, eq(notificationsTable.requestId, requestsTable.id))
    .where(where)
    .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
    .limit(limit);

  const unreadCount = await unreadCountFor(req.session.pharmacyId!);

  res.json({
    notifications: rows.map((n) => ({
      id: n.id, pharmacyId: n.pharmacyId, type: n.type, requestId: n.requestId,
      metadata: n.metadata, message: n.message, isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      requestStatus: n.requestStatus ?? null,
    })),
    unreadCount,
  });
});

router.get("/notifications/unread-count", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const unreadCount = await unreadCountFor(req.session.pharmacyId!);
  res.json({ unreadCount });
});

router.post("/notifications/:notificationId/mark-read", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const updated = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(
      eq(notificationsTable.id, params.data.notificationId),
      eq(notificationsTable.pharmacyId, req.session.pharmacyId!),
    ))
    .returning({ id: notificationsTable.id });

  if (updated.length === 0) {
    res.status(404).json({ error: "Notification not found", code: "NOTIFICATION_NOT_FOUND" });
    return;
  }

  res.json({ message: "Marked as read" });
});

router.post("/notifications/mark-all-read", requireApprovedPharmacy, async (req, res): Promise<void> => {
  const updated = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(
      eq(notificationsTable.pharmacyId, req.session.pharmacyId!),
      eq(notificationsTable.isRead, false),
    ))
    .returning({ id: notificationsTable.id });

  res.json({ updated: updated.length });
});

export default router;