import { createId } from "./ids";
import { nowIsoUtc } from "./time";
import { execute } from "./db";

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
  summary: Record<string, unknown> | null;
}

/**
 * Write an audit log entry.
 * For security-critical operations, this should be awaited before returning success.
 * For non-critical operations, use ctx.waitUntil().
 */
export async function writeAuditLog(db: D1Database, entry: AuditEntry): Promise<void> {
  const id = createId();
  const now = nowIsoUtc();
  await execute(
    db,
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, request_id, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    entry.actorId,
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.ipAddress,
    entry.userAgent,
    entry.requestId,
    entry.summary ? JSON.stringify(entry.summary) : null,
    now,
  );
}
