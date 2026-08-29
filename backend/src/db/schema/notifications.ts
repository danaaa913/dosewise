import {
  pgTable, pgEnum, text, serial, integer, jsonb, boolean, index, uniqueIndex, timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies.js";
import { requestsTable } from "./requests.js";

export const NOTIFICATION_TYPES = [
  "REQUEST_RECEIVED",
  "REQUEST_ACCEPTED",
  "REQUEST_REJECTED",
  "REQUEST_CANCELLED",
  "REQUEST_COMPLETED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationMetadata {
  medicineName: string;
  requestedQuantity: number;
  counterpartyName: string;
}

export const notificationTypeEnum = pgEnum("notification_type", NOTIFICATION_TYPES);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  type: notificationTypeEnum("type"),
  requestId: integer("request_id").references(() => requestsTable.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<NotificationMetadata>(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notifications_pharmacy_created_idx").on(
    table.pharmacyId,
    table.createdAt.desc(),
    table.id.desc(),
  ),
  uniqueIndex("notifications_pharmacy_request_type_idx")
    .on(table.pharmacyId, table.requestId, table.type)
    .where(sql`${table.requestId} IS NOT NULL AND ${table.type} IS NOT NULL`),
]);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  isRead: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;