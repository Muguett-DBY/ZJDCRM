import { queryOne, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";

export interface UserRow {
  id: string;
  account: string;
  normalized_account: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  mobile: string | null;
  email: string | null;
  department_id: string | null;
  status: string;
  is_super_admin: number;
  failed_login_count: number;
  locked_until: string | null;
  password_changed_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_login_user_agent: string | null;
  deleted_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  session_hash: string;
  csrf_hash: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
}

export function findByAccount(db: D1Database, account: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    db,
    `SELECT * FROM users WHERE normalized_account = ? AND deleted_at IS NULL`,
    account.toLowerCase(),
  );
}

export function findById(db: D1Database, id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(db, `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`, id);
}

export async function incrementFailedLoginCount(
  db: D1Database,
  userId: string,
  maxAttempts: number,
  lockoutMinutes: number,
): Promise<void> {
  const now = nowIsoUtc();
  const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();

  await db
    .prepare(
      `UPDATE users SET
        failed_login_count = failed_login_count + 1,
        updated_at = ?,
        updated_by = ?
      WHERE id = ?`,
    )
    .bind(now, userId, userId)
    .run();

  // Check if locked now
  const user = await findById(db, userId);
  if (user && user.failed_login_count >= maxAttempts) {
    await db
      .prepare(
        `UPDATE users SET
          locked_until = ?,
          updated_at = ?,
          updated_by = ?
        WHERE id = ?`,
      )
      .bind(lockUntil, now, userId, userId)
      .run();
  }
}

export async function resetFailedLoginCount(db: D1Database, userId: string): Promise<void> {
  const now = nowIsoUtc();
  await db
    .prepare(
      `UPDATE users SET
        failed_login_count = 0,
        locked_until = NULL,
        last_login_at = ?,
        updated_at = ?,
        updated_by = ?
      WHERE id = ?`,
    )
    .bind(now, now, userId, userId)
    .run();
}

export async function createSession(
  db: D1Database,
  userId: string,
  sessionHash: string,
  csrfHash: string,
  expiresAt: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<SessionRow> {
  const id = createId();
  const now = nowIsoUtc();
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, session_hash, csrf_hash, expires_at, ip_address, user_agent, last_seen_at, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, sessionHash, csrfHash, expiresAt, ipAddress, userAgent, now, now, userId, now, userId)
    .run();
  return {
    id,
    user_id: userId,
    session_hash: sessionHash,
    csrf_hash: csrfHash,
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
    last_seen_at: now,
    revoked_at: null,
  };
}

export function findSessionByHash(
  db: D1Database,
  sessionHash: string,
): Promise<SessionRow | null> {
  return queryOne<SessionRow>(
    db,
    `SELECT * FROM sessions WHERE session_hash = ? AND revoked_at IS NULL AND expires_at > ? AND deleted_at IS NULL`,
    sessionHash,
    nowIsoUtc(),
  );
}

export async function revokeSession(db: D1Database, sessionId: string, userId: string): Promise<void> {
  const now = nowIsoUtc();
  await execute(
    db,
    `UPDATE sessions SET revoked_at = ?, revoked_by = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
    now,
    userId,
    now,
    userId,
    sessionId,
  );
}

export async function revokeAllUserSessions(db: D1Database, userId: string): Promise<void> {
  const now = nowIsoUtc();
  await db
    .prepare(
      `UPDATE sessions SET revoked_at = ?, revoked_by = ?, updated_at = ?, updated_by = ? WHERE user_id = ? AND revoked_at IS NULL`,
    )
    .bind(now, userId, now, userId, userId)
    .run();
}

export async function updatePassword(
  db: D1Database,
  userId: string,
  passwordHash: string,
  passwordSalt: string,
  passwordIterations: number,
): Promise<void> {
  const now = nowIsoUtc();
  await db
    .prepare(
      `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, password_changed_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
    )
    .bind(passwordHash, passwordSalt, passwordIterations, now, now, userId, userId)
    .run();
}

export async function writeLoginLog(
  db: D1Database,
  userId: string | null,
  account: string,
  loginResult: "success" | "failure" | "locked" | "logout",
  failureReason: string | null,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const id = createId();
  const now = nowIsoUtc();
  await db
    .prepare(
      `INSERT INTO login_logs (id, user_id, account, login_result, failure_reason, ip_address, user_agent, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, account, loginResult, failureReason, ipAddress, userAgent, now, userId ?? "system")
    .run();
}
