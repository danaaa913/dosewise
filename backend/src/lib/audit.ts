import { type PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { auditLogsTable } from "../db/index.js";
import * as schema from "../db/schema/index.js";

export interface AuditLogEntry {
  actorType: string;
  actorId?: number | null;
  actorLabel?: string | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  details?: string | null;
}

export function logAudit(db: PgDatabase<NodePgQueryResultHKT, typeof schema>, entry: AuditLogEntry) {
  return db.insert(auditLogsTable).values(entry);
}