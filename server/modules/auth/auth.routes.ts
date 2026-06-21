import { Hono, Context, MiddlewareHandler } from "hono";
import { loginSchema, changePasswordSchema, formatZodErrors } from "./auth.schemas";
import * as authService from "./auth.service";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";

const SESSION_COOKIE = "session";

// Extend Hono context type
type AppContext = Context<{
  Bindings: { DB: D1Database; FILES: R2Bucket };
  Variables: { user: { id: string; account: string; displayName: string; isSuperAdmin: boolean; departmentId: string | null }; sessionId: string; requestId: string };
}>;

function setSessionCookie(c: AppContext, token: string): void {
  const maxAge = authService.SESSION_DURATION_HOURS * 60 * 60;
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
  );
}

function clearSessionCookie(c: AppContext): void {
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

export function registerAuthRoutes(app: Hono<{
  Bindings: { DB: D1Database; FILES: R2Bucket };
  Variables: { user: { id: string; account: string; displayName: string; isSuperAdmin: boolean; departmentId: string | null }; sessionId: string; requestId: string };
}>): void {
  // POST /api/auth/login — no auth required
  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR" as const,
            message: formatZodErrors(parsed.error),
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const { account, password } = parsed.data;
    const ipAddress = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null;
    const userAgent = c.req.header("user-agent") || null;

    const result = await authService.login(
      c.env.DB,
      account,
      password,
      ipAddress,
      userAgent,
    );

    if (!result.success) {
      const errorCode = result.lockout ? "ACCOUNT_LOCKED" : "AUTH_FAILED";
      return c.json(
        {
          ok: false,
          error: {
            code: errorCode,
            message: result.error || "认证失败",
            requestId: c.get("requestId"),
          },
        },
        (result.status || 401) as 401 | 403 | 423,
      );
    }

    if (result.sessionToken) {
      setSessionCookie(c, result.sessionToken);
    }

    return c.json(
      {
        ok: true,
        data: {
          user: result.user,
          csrfToken: result.csrfToken,
        },
      },
      200,
    );
  });

  // GET /api/auth/session — no auth required (returns 401 if not authenticated)
  app.get("/api/auth/session", async (c) => {
    const token = await getSessionToken(c);
    const session = await authService.getSession(c.env.DB, token);

    if (!session) {
      return c.json(
        {
          ok: false,
          error: {
            code: "NOT_AUTHENTICATED" as const,
            message: "未登录或会话已过期",
            requestId: c.get("requestId"),
          },
        },
        401,
      );
    }

    return c.json(
      {
        ok: true,
        data: {
          user: session.user,
          csrfToken: session.csrfToken,
        },
      },
      200,
    );
  });

  // POST /api/auth/logout — requires auth + CSRF
  app.post("/api/auth/logout", requireAuth as MiddlewareHandler, requireCsrf as MiddlewareHandler, async (c) => {
    const token = await getSessionToken(c);
    const user = c.get("user");
    const ipAddress = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null;
    const userAgent = c.req.header("user-agent") || null;

    if (token) {
      await authService.logout(c.env.DB, token, user.id, ipAddress, userAgent);
    }
    clearSessionCookie(c);

    return c.json({ ok: true, data: null }, 200);
  });

  // POST /api/auth/change-password — requires auth + CSRF
  app.post("/api/auth/change-password", requireAuth as MiddlewareHandler, requireCsrf as MiddlewareHandler, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR" as const,
            message: formatZodErrors(parsed.error),
            requestId: c.get("requestId"),
          },
        },
        400,
      );
    }

    const user = c.get("user");
    const ipAddress = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null;
    const userAgent = c.req.header("user-agent") || null;

    const result = await authService.changePassword(
      c.env.DB,
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      ipAddress,
      userAgent,
    );

    if (!result.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: "PASSWORD_CHANGE_FAILED" as const,
            message: result.error || "密码修改失败",
            requestId: c.get("requestId"),
          },
        },
        result.status as 400 | 401 | 404,
      );
    }

    clearSessionCookie(c);
    return c.json({ ok: true, data: null }, 200);
  });
}

async function getSessionToken(c: AppContext): Promise<string | undefined> {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
