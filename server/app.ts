import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware/request-id";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { registerAuthRoutes } from "./modules/auth/auth.routes";

type AppBindings = { DB: D1Database; FILES: R2Bucket };
type AppVariables = {
  user: { id: string; account: string; displayName: string; isSuperAdmin: boolean; departmentId: string | null };
  sessionId: string;
  requestId: string;
};

export function createApi() {
  const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

  // Global middleware
  app.use("*", requestIdMiddleware);

  // Error handling
  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  // Health check
  app.get("/api/health", (c) => c.json({ ok: true, service: "zjdcrm" }));

  // Auth routes (POST /api/auth/login, GET /api/auth/session, etc.)
  registerAuthRoutes(app);

  return app;
}
