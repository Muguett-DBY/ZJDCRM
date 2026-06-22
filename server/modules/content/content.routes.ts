// @ts-nocheck
import { Hono } from "hono";
import { UI_COPY_ENTRIES, UI_COPY_KEYS } from "../../../shared/ui-copy";
import { queryOne, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { writeAuditLog } from "../../shared/audit";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";

const SETTING_KEY = "ui_copy";
const MAX_BYTES = 64 * 1024;

function error(c: any, status: 400 | 403, code: string, message: string) {
  return c.json({ ok: false, error: { code, message, requestId: c.get("requestId") } }, status);
}

function adminGuard() {
  return async (c: any, next: any) => {
    if (!c.get("user")?.canManageSystem) return error(c, 403, "FORBIDDEN", "没有管理后台访问权限");
    await next();
  };
}

async function readOverrides(db: D1Database): Promise<Record<string, string>> {
  const row = await queryOne<{ setting_value: string }>(db, "SELECT setting_value FROM system_settings WHERE setting_key = ? AND status = 'active' AND deleted_at IS NULL", SETTING_KEY);
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.setting_value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => UI_COPY_KEYS.has(key) && typeof value === "string"));
  } catch { return {}; }
}

async function writeOverrides(db: D1Database, overrides: Record<string, string>, actorId: string) {
  const value = JSON.stringify(overrides);
  const now = nowIsoUtc();
  await execute(
    db,
    "INSERT INTO system_settings (id, setting_key, setting_value, setting_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 'json', 'active', ?, ?, ?, ?) ON CONFLICT(setting_key) WHERE deleted_at IS NULL DO UPDATE SET setting_value = ?, updated_at = ?, updated_by = ?",
    createId(), SETTING_KEY, value, now, actorId, now, actorId, value, now, actorId,
  );
}

export function registerContentRoutes(app: Hono): void {
  app.get("/api/content/public", async (c) => c.json({ ok: true, data: await readOverrides(c.env.DB) }));

  app.get("/api/admin/content", requireAuth, adminGuard(), async (c) => {
    return c.json({ ok: true, data: { entries: UI_COPY_ENTRIES, overrides: await readOverrides(c.env.DB) } });
  });

  app.put("/api/admin/content", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const body = await c.req.json() as { overrides?: Record<string, unknown> };
    const input = body.overrides;
    if (!input || typeof input !== "object" || Array.isArray(input)) return error(c, 400, "VALIDATION_ERROR", "文案数据格式无效");
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!UI_COPY_KEYS.has(key)) return error(c, 400, "INVALID_COPY_KEY", "包含未登记的文案键");
      const text = String(value || "").trim();
      if (!text || text.length > 200) return error(c, 400, "INVALID_COPY_VALUE", "文案必须为 1 至 200 个字符");
      overrides[key] = text;
    }
    if (new TextEncoder().encode(JSON.stringify(overrides)).byteLength > MAX_BYTES) return error(c, 400, "COPY_TOO_LARGE", "文案配置超过 64KB");
    await writeOverrides(c.env.DB, overrides, user.id);
    await writeAuditLog(c.env.DB, { actorId: user.id, action: "admin:content:update", entityType: "system_setting", entityId: SETTING_KEY, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { keys: Object.keys(overrides) } });
    return c.json({ ok: true, data: overrides });
  });

  app.delete("/api/admin/content/:key", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    if (!UI_COPY_KEYS.has(key)) return error(c, 400, "INVALID_COPY_KEY", "未登记的文案键");
    const overrides = await readOverrides(c.env.DB);
    delete overrides[key];
    await writeOverrides(c.env.DB, overrides, user.id);
    await writeAuditLog(c.env.DB, { actorId: user.id, action: "admin:content:reset", entityType: "system_setting", entityId: key, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: {} });
    return c.json({ ok: true, data: overrides });
  });
}
