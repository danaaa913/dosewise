CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" integer,
	"actor_label" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pharmacies" ADD COLUMN "verification_status" "verification_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "pharmacies" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "pharmacies" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pharmacies" ADD COLUMN "verified_by_admin_id" integer;--> statement-breakpoint
-- Backfill: pharmacies that existed before verification was introduced are grandfathered as approved.
UPDATE "pharmacies" SET "verification_status" = 'approved', "verified_at" = now() WHERE "verification_status" = 'approved';--> statement-breakpoint
-- Switch default: new registrations must start as pending verification.
ALTER TABLE "pharmacies" ALTER COLUMN "verification_status" SET DEFAULT 'pending';