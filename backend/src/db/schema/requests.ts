import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { pharmaciesTable } from "./pharmacies.js";
import { medicinesTable } from "./medicines.js";

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  requesterPharmacyId: integer("requester_pharmacy_id").notNull().references(() => pharmaciesTable.id),
  providerPharmacyId: integer("provider_pharmacy_id").notNull().references(() => pharmaciesTable.id),
  medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
  requestedQuantity: integer("requested_quantity").notNull(),
  status: text("status").notNull().default("pending"),
  requestDate: timestamp("request_date", { withTimezone: true }).notNull().defaultNow(),
  responseDate: timestamp("response_date", { withTimezone: true }),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({
  id: true,
  status: true,
  requestDate: true,
  responseDate: true,
});
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;
