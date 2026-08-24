import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pharmaciesTable = pgTable("pharmacies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  managerName: text("manager_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isSubscribed: boolean("is_subscribed").notNull().default(false),
  subscriptionPlan: text("subscription_plan"),
  subscriptionStartDate: timestamp("subscription_start_date", { withTimezone: true }),
  subscriptionEndDate: timestamp("subscription_end_date", { withTimezone: true }),
  lastPaymentDate: timestamp("last_payment_date", { withTimezone: true }),
  licenseNumber: text("license_number"),
  licenseDocName: text("license_doc_name"),
  licenseDocMime: text("license_doc_mime"),
  licenseDocData: text("license_doc_data"),
  licenseDocUpdatedAt: timestamp("license_doc_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPharmacySchema = createInsertSchema(pharmaciesTable).omit({
  id: true,
  isActive: true,
  isSubscribed: true,
  subscriptionPlan: true,
  subscriptionStartDate: true,
  subscriptionEndDate: true,
  lastPaymentDate: true,
  createdAt: true,
});
export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;
export type Pharmacy = typeof pharmaciesTable.$inferSelect;
