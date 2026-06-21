import { MiddlewareHandler } from "hono";
import { buildAccessContext, hasPermission } from "../modules/access/access.service";
import type { AccessContext } from "../modules/access/access.types";

/**
 * Middleware factory that requires a specific permission code.
 */
export function requirePermissionCode(code: string): MiddlewareHandler<{
  Bindings: { DB: D1Database; FILES: R2Bucket };
  Variables: { user: { id: string; [key: string]: unknown }; requestId: string; access: AccessContext };
}> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        ok: false,
        error: { code: "NOT_AUTHENTICATED", message: "未登录", requestId: c.get("requestId") },
      }, 401);
    }

    const access = await buildAccessContext(c.env.DB, user.id);
    if (!hasPermission(access, code)) {
      return c.json({
        ok: false,
        error: { code: "FORBIDDEN", message: "没有操作权限", requestId: c.get("requestId") },
      }, 403);
    }

    // Attach access context for downstream handlers
    c.set("access", access as unknown as AccessContext);
    await next();
  };
}
