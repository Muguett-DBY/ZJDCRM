// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware/request-id";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { registerCompanyRoutes } from "./modules/companies/companies.routes";
import { registerContactRoutes } from "./modules/contacts/contacts.routes";
import { registerClueRoutes } from "./modules/clues/clues.routes";
import { registerSpaceRoutes } from "./modules/spaces/spaces.routes";
import { registerFollowupRoutes } from "./modules/followups/followups.routes";
import { registerNotificationRoutes } from "./modules/notifications/notifications.routes";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { registerAdminRoutes } from "./modules/admin/admin.routes";
import { hashPassword, verifyPassword } from "./shared/crypto";
import { queryOne } from "./shared/db";

export function createApi() {
  const app: any = new Hono();

  app.use("*", requestIdMiddleware);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.get("/api/health", (c: any) => c.json({ ok: true, service: "zjdcrm" }));

  // Debug endpoint: test crypto and D1
  app.get("/api/debug/login-test", async (c: any) => {
    try {
      const user = await c.env.DB.prepare("SELECT id, account, password_hash, password_salt, password_iterations, status, locked_until FROM users WHERE account = ?")
        .bind("admin").first();
      
      if (!user) return c.json({ ok: false, error: "USER_NOT_FOUND" });
      
      // Try to verify
      try {
        const { hash, salt, iterations } = await hashPassword("admin123456");
        const valid = await verifyPassword("admin123456", user.password_hash, user.password_salt, user.password_iterations);
        return c.json({ 
          ok: true, 
          userFound: true,
          userStatus: user.status,
          lockedUntil: user.locked_until,
          hashMatch: valid,
          debug: { computedHash: hash.slice(0, 10) + "..." }
        });
      } catch (verifyErr: any) {
        return c.json({ ok: false, error: "VERIFY_FAILED", message: verifyErr.message, stack: verifyErr.stack?.split("\n")?.slice(0, 3) });
      }
    } catch (err: any) {
      return c.json({ ok: false, error: "DB_ERROR", message: err.message, stack: err.stack?.split("\n")?.slice(0, 3) });
    }
  });

  registerAuthRoutes(app);
  registerCompanyRoutes(app);
  registerContactRoutes(app);
  registerClueRoutes(app);
  registerSpaceRoutes(app);
  registerFollowupRoutes(app);
  registerNotificationRoutes(app);
  registerDashboardRoutes(app);
  registerAdminRoutes(app);

  return app;
}
