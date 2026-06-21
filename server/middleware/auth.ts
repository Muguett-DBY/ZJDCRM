import { MiddlewareHandler } from "hono";
import { hashSessionToken } from "../shared/crypto";

const SESSION_COOKIE = "session";

type AppBindings = { DB: D1Database; FILES: R2Bucket };
type AppVariables = {
  user: { id: string; account: string; displayName: string; isSuperAdmin: boolean; departmentId: string | null };
  sessionId: string;
  requestId: string;
};

/**
 * Middleware that authenticates requests via session cookie.
 * Sets c.get("user") on success.
 */
export const requireAuth: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> = async (c, next) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : undefined;

  if (!token) {
    return c.json(
      {
        ok: false,
        error: {
          code: "NOT_AUTHENTICATED" as const,
          message: "未登录",
          requestId: c.get("requestId"),
        },
      },
      401,
    );
  }

  try {
    const sessionHash = await hashSessionToken(token);
    const db: D1Database = c.env.DB;

    const session = await db
      .prepare(
        "SELECT s.id AS session_id, s.csrf_hash, u.id, u.account, u.display_name, u.is_super_admin, u.department_id, u.status FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND s.deleted_at IS NULL AND u.deleted_at IS NULL",
      )
      .bind(sessionHash, new Date().toISOString())
      .first<{ session_id: string; csrf_hash: string; id: string; account: string; display_name: string; is_super_admin: number; department_id: string | null; status: string }>();

    if (!session || session.status !== "active") {
      return c.json(
        {
          ok: false,
          error: {
            code: "SESSION_INVALID" as const,
            message: "会话已过期或无效",
            requestId: c.get("requestId"),
          },
        },
        401,
      );
    }

    c.set("user", {
      id: session.id,
      account: session.account,
      displayName: session.display_name,
      isSuperAdmin: session.is_super_admin === 1,
      departmentId: session.department_id,
    });
    c.set("sessionId", session.session_id);

    // Update last_seen_at asynchronously
    const now = new Date().toISOString();
    await db
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?")
      .bind(now, session.session_id)
      .run();

    await next();
  } catch {
    return c.json(
      {
        ok: false,
        error: {
          code: "AUTH_ERROR" as const,
          message: "认证失败",
          requestId: c.get("requestId"),
        },
      },
      401,
    );
  }
};
