import { Hono } from "hono";

export function createApi() {
  const app = new Hono();

  app.get("/api/health", (context) =>
    context.json({ ok: true, service: "zjdcrm" }),
  );

  return app;
}
