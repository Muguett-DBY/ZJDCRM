import { hashPassword, verifyPassword, createSecureToken, hashSessionToken } from "../../shared/crypto";
import * as repo from "./auth.repository";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 30;
export const SESSION_DURATION_HOURS = 24;

export interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    account: string;
    displayName: string;
    isSuperAdmin: boolean;
    canManageSystem: boolean;
    departmentId: string | null;
  };
  csrfToken?: string;
  sessionToken?: string;
  lockout?: boolean;
  status?: number;
  error?: string;
}

export interface SessionUser {
  id: string;
  account: string;
  displayName: string;
  isSuperAdmin: boolean;
  canManageSystem: boolean;
  departmentId: string | null;
}

export async function login(
  db: D1Database,
  account: string,
  password: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<LoginResult> {
  const user = await repo.findByAccount(db, account);
  if (!user) {
    // Write login log for non-existent account
    await repo.writeLoginLog(db, null, account, "failure", "account_not_found", ipAddress, userAgent);
    return { success: false, status: 401, error: "账号或密码错误" };
  }

  // Check if account is disabled
  if (user.status !== "active") {
    await repo.writeLoginLog(db, user.id, account, "failure", "account_disabled", ipAddress, userAgent);
    return { success: false, status: 403, error: "账号已被禁用" };
  }

  // Check lockout
  if (user.locked_until) {
    const lockedUntil = new Date(user.locked_until).getTime();
    if (lockedUntil > Date.now()) {
      await repo.writeLoginLog(db, user.id, account, "locked", "account_locked", ipAddress, userAgent);
      return { success: false, status: 423, error: "账号已被锁定，请30分钟后重试", lockout: true };
    }
    // Lockout expired, reset
    await repo.resetFailedLoginCount(db, user.id);
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash, user.password_salt, user.password_iterations);
  if (!valid) {
    await repo.incrementFailedLoginCount(db, user.id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES);
    await repo.writeLoginLog(db, user.id, account, "failure", "wrong_password", ipAddress, userAgent);

    // Check if this attempt caused lockout
    const updatedUser = await repo.findByAccount(db, account);
    if (updatedUser && updatedUser.locked_until) {
      return { success: false, status: 423, error: "账号已被锁定，请30分钟后重试", lockout: true };
    }
    return { success: false, status: 401, error: "账号或密码错误" };
  }

  // Success
  await repo.resetFailedLoginCount(db, user.id);

  // Create session
  const sessionToken = createSecureToken();
  const csrfToken = await hashSessionToken(`${sessionToken}:csrf`);
  const sessionHash = await hashSessionToken(sessionToken);
  const csrfHash = await hashSessionToken(csrfToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString();

  await repo.createSession(db, user.id, sessionHash, csrfHash, expiresAt, ipAddress, userAgent);
  await repo.writeLoginLog(db, user.id, account, "success", null, ipAddress, userAgent);

  return {
    success: true,
    user: {
      id: user.id,
      account: user.account,
      displayName: user.display_name,
      isSuperAdmin: user.is_super_admin === 1,
      canManageSystem: user.is_super_admin === 1,
      departmentId: user.department_id,
    },
    csrfToken,
    sessionToken,
  };
}

export async function getSession(
  db: D1Database,
  sessionToken: string | undefined,
): Promise<{ user: SessionUser; csrfToken: string } | null> {
  if (!sessionToken) return null;

  const sessionHash = await hashSessionToken(sessionToken);
  const session = await repo.findSessionByHash(db, sessionHash);
  if (!session) return null;

  const user = await repo.findById(db, session.user_id);
  if (!user || user.status !== "active") return null;
  const csrfToken = await hashSessionToken(`${sessionToken}:csrf`);
  const csrfHash = await hashSessionToken(csrfToken);
  await db.prepare(
    "UPDATE sessions SET csrf_hash = ?, updated_at = ?, updated_by = ? WHERE id = ?",
  ).bind(csrfHash, new Date().toISOString(), user.id, session.id).run();

  return {
    user: {
      id: user.id,
      account: user.account,
      displayName: user.display_name,
      isSuperAdmin: user.is_super_admin === 1,
      canManageSystem: user.is_super_admin === 1,
      departmentId: user.department_id,
    },
    csrfToken,
  };
}

export async function logout(
  db: D1Database,
  sessionToken: string,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const sessionHash = await hashSessionToken(sessionToken);
  const session = await repo.findSessionByHash(db, sessionHash);
  if (session) {
    await repo.revokeSession(db, session.id, userId);
  }
  await repo.writeLoginLog(db, userId, "", "logout", null, ipAddress, userAgent);
}

export async function changePassword(
  db: D1Database,
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<{ success: boolean; status?: number; error?: string }> {
  const user = await repo.findById(db, userId);
  if (!user) {
    return { success: false, status: 404, error: "用户不存在" };
  }

  const valid = await verifyPassword(currentPassword, user.password_hash, user.password_salt, user.password_iterations);
  if (!valid) {
    await repo.writeLoginLog(db, userId, user.account, "failure", "wrong_current_password", ipAddress, userAgent);
    return { success: false, status: 401, error: "当前密码错误" };
  }

  const { hash, salt, iterations } = await hashPassword(newPassword);
  await repo.updatePassword(db, userId, hash, salt, iterations);

  // Revoke all sessions so user must re-login
  await repo.revokeAllUserSessions(db, userId);

  await repo.writeLoginLog(db, userId, user.account, "logout", "password_changed", ipAddress, userAgent);
  return { success: true };
}
