import { MiddlewareHandler } from "hono";
import { hashSessionToken } from "../shared/crypto";

type AppBindings = { DB: D1Database; FILES: R2Bucket };
type AppVariables = {
  user: { id: string; account: string; displayName: string; isSuperAdmin: boolean; departmentId: string | null };
  sessionId: string;
  requestId: string;
};

/**
 * CSRF protection middleware.
 * Requires a valid X-CSRF-Token header that matches the session's CSRF hash.
 * Must be placed after requireAuth middleware.
 */
export const requireCsrf: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> = async (c, next) => {
  const csrfToken = c.req.header("x-csrf-token");
  if (!csrfToken) {
    return c.json(
      {
        ok: false,
        error: {
          code: "CSRF_REQUIRED" as const,
          message: "缺少 CSRF 令牌",
          requestId: c.get("requestId"),
        },
      },
      403,
    );
  }

  const sessionId = c.get("sessionId");
  if (!sessionId) {
    return c.json(
      {
        ok: false,
        error: {
          code: "CSRF_SESSION_INVALID" as const,
          message: "会话无效",
          requestId: c.get("requestId"),
        },
      },
      403,
    );
  }

  try {
    const csrfHash = await hashSessionToken(csrfToken);
    const db: D1Database = c.env.DB;

    const session = await db
      .prepare("SELECT csrf_hash FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ csrf_hash: string }>();

    if (!session || session.csrf_hash !== csrfHash) {
      return c.json(
        {
          ok: false,
          error: {
            code: "CSRF_INVALID" as const,
            message: "CSRF 令牌无效",
            requestId: c.get("requestId"),
          },
        },
        403,
      );
    }

    await next();
  } catch {
    return c.json(
      {
        ok: false,
        error: {
          code: "CSRF_ERROR" as const,
          message: "CSRF 验证失败",
          requestId: c.get("requestId"),
        },
      },
      403,
    );
  }
};
