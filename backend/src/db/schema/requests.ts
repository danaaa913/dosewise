import { pgTable, pgEnum, text, serial, integer, numeric, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies.js";
import { medicinesTable } from "./medicines.js";

export const REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "completed",
  "expired",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const requestStatusEnum = pgEnum("request_status", REQUEST_STATUSES);

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  requesterPharmacyId: integer("requester_pharmacy_id").notNull().references(() => pharmaciesTable.id),
  providerPharmacyId: integer("provider_pharmacy_id").notNull().references(() => pharmaciesTable.id),
  medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
  requestedQuantity: integer("requested_quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  medicineName: text("medicine_name").notNull(),
  idempotencyKey: text("idempotency_key"),
  status: requestStatusEnum("status").notNull().default("pending"),
  requestDate: timestamp("request_date", { withTimezone: true }).notNull().defaultNow(),
  responseDate: timestamp("response_date", { withTimezone: true }),
}, (table) => [
  uniqueIndex("requests_requester_idempotency_idx").on(table.requesterPharmacyId, table.idempotencyKey),
  uniqueIndex("requests_requester_medicine_pending_idx")
    .on(table.requesterPharmacyId, table.medicineId)
    .where(sql`${table.status} = 'pending'`),
]);

export const insertRequestSchema = createInsertSchema(requestsTable).omit({
  id: true,
  status: true,
  requestDate: true,
  responseDate: true,
});
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;
