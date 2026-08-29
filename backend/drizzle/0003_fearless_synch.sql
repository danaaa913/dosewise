CREATE TYPE "public"."notification_type" AS ENUM('REQUEST_RECEIVED', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'REQUEST_CANCELLED', 'REQUEST_COMPLETED');--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "type" "notification_type";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "request_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_pharmacy_created_idx" ON "notifications" USING btree ("pharmacy_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_pharmacy_request_type_idx" ON "notifications" USING btree ("pharmacy_id","request_id","type") WHERE "notifications"."request_id" IS NOT NULL AND "notifications"."type" IS NOT NULL;