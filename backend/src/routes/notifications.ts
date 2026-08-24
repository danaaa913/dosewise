import { Router, type IRouter } from "express";
import { db, notificationsTable } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { MarkNotificationReadParams, GetNotificationsQueryParams } from "../zod/schemas.js";

const router: IRouter = Router();

function requirePharmacy(req: any, res: any, next: any) {
  if (!req.session.pharmacyId) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
}

router.get("/notifications/my", requirePharmacy, async (req, res): Promise<void> => {
  const params = GetNotificationsQueryParams.safeParse(req.query);
  const unreadOnly = params.success && params.data.unread_only === true;

  const notifications = unreadOnly
    ? await db.select().from(notificationsTable)
        .where(and(eq(notificationsTable.pharmacyId, req.session.pharmacyId!), eq(notificationsTable.isRead, false)))
        .orderBy(notificationsTable.createdAt)
    : await db.select().from(notificationsTable)
        .where(eq(notificationsTable.pharmacyId, req.session.pharmacyId!))
        .orderBy(notificationsTable.createdAt);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  res.json({
    notifications: notifications.map(n => ({
      id: n.id, pharmacyId: n.pharmacyId, message: n.message,
      isRead: n.isRead, createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
});

router.post("/notifications/:notificationId/mark-read", requirePharmacy, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [notification] = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.id, params.data.notificationId));
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
  if (notification.pharmacyId !== req.session.pharmacyId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(notificationsTable).set({ isRead: true })
    .where(eq(notificationsTable.id, params.data.notificationId));
  res.json({ message: "Marked as read" });
});

export default router;
