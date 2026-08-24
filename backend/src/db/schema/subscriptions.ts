import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pharmaciesTable } from "./pharmacies.js";

export const subscriptionPaymentsTable = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("JOD"),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  paymentStatus: text("payment_status").notNull().default("completed"),
  subscriptionPeriodStart: timestamp("subscription_period_start", { withTimezone: true }).notNull(),
  subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }).notNull(),
  transactionId: text("transaction_id").notNull().unique(),
});

export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPaymentsTable).omit({
  id: true,
  paymentDate: true,
});
export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
export type SubscriptionPayment = typeof subscriptionPaymentsTable.$inferSelect;
