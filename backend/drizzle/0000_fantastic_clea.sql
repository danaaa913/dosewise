CREATE TYPE "public"."request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'expired');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "pharmacies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"manager_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_subscribed" boolean DEFAULT false NOT NULL,
	"subscription_plan" text,
	"subscription_start_date" timestamp with time zone,
	"subscription_end_date" timestamp with time zone,
	"last_payment_date" timestamp with time zone,
	"license_number" text,
	"license_doc_name" text,
	"license_doc_mime" text,
	"license_doc_data" text,
	"license_doc_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pharmacies_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" serial PRIMARY KEY NOT NULL,
	"pharmacy_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"expiry_date" date NOT NULL,
	"description" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_pharmacy_id" integer NOT NULL,
	"provider_pharmacy_id" integer NOT NULL,
	"medicine_id" integer NOT NULL,
	"requested_quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"medicine_name" text NOT NULL,
	"idempotency_key" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"request_date" timestamp with time zone DEFAULT now() NOT NULL,
	"response_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"pharmacy_id" integer NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'JOD' NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_status" text DEFAULT 'completed' NOT NULL,
	"subscription_period_start" timestamp with time zone NOT NULL,
	"subscription_period_end" timestamp with time zone NOT NULL,
	"transaction_id" text NOT NULL,
	CONSTRAINT "subscription_payments_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"pharmacy_id" integer NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("requester_pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_provider_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("provider_pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_pharmacy_id_pharmacies_id_fk" FOREIGN KEY ("pharmacy_id") REFERENCES "public"."pharmacies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "requests_requester_idempotency_idx" ON "requests" USING btree ("requester_pharmacy_id","idempotency_key");