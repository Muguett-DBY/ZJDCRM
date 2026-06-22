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
import { registerWorkflowRoutes } from "./modules/workflows/workflows.routes";
import { registerAttachmentRoutes } from "./modules/attachments/attachments.routes";
import { registerContentRoutes } from "./modules/content/content.routes";

export function createApi() {
  const app: any = new Hono();

  app.use("*", requestIdMiddleware);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.get("/api/health", (c: any) => c.json({ ok: true, service: "zjdcrm" }));

  registerAuthRoutes(app);
  registerCompanyRoutes(app);
  registerContactRoutes(app);
  registerClueRoutes(app);
  registerSpaceRoutes(app);
  registerFollowupRoutes(app);
  registerNotificationRoutes(app);
  registerDashboardRoutes(app);
  registerWorkflowRoutes(app);
  registerAttachmentRoutes(app);
  registerContentRoutes(app);
  registerAdminRoutes(app);

  return app;
}
