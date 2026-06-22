// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne, execute, batch } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { hashPassword } from "../../shared/crypto";
import { buildAccessContext } from "../access/access.service";
import { writeAuditLog } from "../../shared/audit";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";
import { normalizeCompanyName } from "../../shared/normalize-company";

function adminGuard() {
  return async (c: any, next: any) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: { code: "NOT_AUTHENTICATED", message: "未登录" } }, 401);

    if (!user.canManageSystem) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有管理后台访问权限" } }, 403);
    }
    const access = await buildAccessContext(c.env.DB, user.id);
    c.set("access", access);
    await next();
  };
}

async function resolveActiveRoleIds(db: D1Database, value: unknown): Promise<string[] | null> {
  const roleIds = [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))];
  if (!roleIds.length) return roleIds;
  const placeholders = roleIds.map(() => "?").join(", ");
  const rows = await queryAll<{ id: string }>(
    db,
    `SELECT id FROM roles WHERE id IN (${placeholders}) AND status = 'active' AND deleted_at IS NULL`,
    ...roleIds,
  );
  return rows.length === roleIds.length ? roleIds : null;
}

export function registerAdminRoutes(app: Hono): void {
  app.get("/api/settings/public", async (c) => {
    const allowedKeys = ["site_name", "login_text", "announcement", "logo_url"];
    const placeholders = allowedKeys.map(() => "?").join(", ");
    const rows = await queryAll<{ setting_key: string; setting_value: string }>(
      c.env.DB,
      `SELECT setting_key, setting_value FROM system_settings
       WHERE setting_key IN (${placeholders}) AND status = 'active' AND deleted_at IS NULL`,
      ...allowedKeys,
    );
    return c.json({
      ok: true,
      data: Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value])),
    });
  });

  // ==================== USERS ====================
  app.get("/api/admin/users", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;

    const total = (await db.prepare("SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL").first<{ total: number }>())?.total || 0;
    const users = await queryAll(
      db,
      `SELECT u.id, u.account, u.display_name, u.mobile, u.email, u.department_id, u.status, u.is_super_admin, u.last_login_at, d.name as department_name,
              GROUP_CONCAT(ur.role_id) AS role_ids
       FROM users u LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.deleted_at IS NULL
       WHERE u.deleted_at IS NULL
       GROUP BY u.id
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      pageSize, offset,
    );
    return c.json({ ok: true, data: { items: users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  app.post("/api/admin/users", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, any>;
    const account = String(body.account || "").trim();
    const displayName = String(body.displayName || "").trim();
    const password = String(body.password || "");
    if (body.isSuperAdmin === true) {
      return c.json({ ok: false, error: { code: "SINGLE_ADMIN_ONLY", message: "系统只允许一个后台管理员", requestId: c.get("requestId") } }, 400);
    }
    if (!account || !displayName || password.length < 8) {
      return c.json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "账号、姓名和至少 8 位的初始密码为必填项",
          requestId: c.get("requestId"),
        },
      }, 400);
    }
    const now = nowIsoUtc();
    const id = createId();
    const { hash, salt, iterations } = await hashPassword(password);

    await execute(
      db,
      `INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, mobile, email, department_id, status, is_super_admin, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, account, account.toLowerCase(), displayName,
      hash, salt, iterations, body.mobile || null, body.email || null,
      body.departmentId || null, body.status || "active", 0,
      now, user.id, now, user.id,
    );
    const roleIds = await resolveActiveRoleIds(db, body.roleIds);
    if (!roleIds) {
      return c.json({ ok: false, error: { code: "INVALID_ROLE_IDS", message: "包含无效或已停用角色", requestId: c.get("requestId") } }, 400);
    }
    if (roleIds.length > 0) {
      await batch(db, roleIds.map((roleId: string) => ({
        sql: `INSERT INTO user_roles
          (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [createId(), id, roleId, user.id, now, now, user.id, now, user.id],
      })));
    }

    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;
    await writeAuditLog(db, {
      actorId: user.id, action: "admin:user:create", entityType: "user", entityId: id,
      ipAddress, userAgent, requestId: c.get("requestId"), summary: { account, roleIds },
    });
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.put("/api/admin/users/:id", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const userId = c.req.param("id");
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const existing = await queryOne<{ is_super_admin: number; status: string }>(
      db,
      "SELECT is_super_admin, status FROM users WHERE id = ? AND deleted_at IS NULL",
      userId,
    );
    if (!existing) {
      return c.json({ ok: false, error: { code: "NOT_FOUND", message: "用户不存在", requestId: c.get("requestId") } }, 404);
    }
    if (existing.is_super_admin === 0 && body.isSuperAdmin === true) {
      return c.json({ ok: false, error: { code: "SINGLE_ADMIN_ONLY", message: "系统只允许一个后台管理员", requestId: c.get("requestId") } }, 400);
    }
    const nextStatus = body.status === undefined ? existing.status : String(body.status);
    const nextSuper = body.isSuperAdmin === undefined ? existing.is_super_admin : (body.isSuperAdmin ? 1 : 0);
    if (existing.is_super_admin === 1 && (nextStatus !== "active" || nextSuper === 0)) {
      const otherAdmins = await queryOne<{ total: number }>(
        db,
        "SELECT COUNT(*) AS total FROM users WHERE is_super_admin = 1 AND status = 'active' AND deleted_at IS NULL AND id <> ?",
        userId,
      );
      if (!otherAdmins?.total) {
        return c.json({
          ok: false,
          error: {
            code: "LAST_SUPER_ADMIN",
            message: "不能禁用或降级最后一个有效超级管理员",
            requestId: c.get("requestId"),
          },
        }, 409);
      }
    }
    const requestedRoleIds = body.roleIds === undefined ? undefined : await resolveActiveRoleIds(db, body.roleIds);
    if (body.roleIds !== undefined && !requestedRoleIds) {
      return c.json({ ok: false, error: { code: "INVALID_ROLE_IDS", message: "包含无效或已停用角色", requestId: c.get("requestId") } }, 400);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    const mappings: Array<[string, string, (value: unknown) => unknown]> = [
      ["displayName", "display_name", (value) => String(value).trim()],
      ["mobile", "mobile", (value) => value || null],
      ["email", "email", (value) => value || null],
      ["departmentId", "department_id", (value) => value || null],
      ["status", "status", (value) => value],
    ];
    for (const [bodyKey, column, normalize] of mappings) {
      if (body[bodyKey] !== undefined) {
        fields.push(`${column} = ?`);
        values.push(normalize(body[bodyKey]));
      }
    }
    fields.push("updated_at = ?", "updated_by = ?");
    values.push(now, user.id, userId);
    await execute(db, `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`, ...values);
    if (requestedRoleIds !== undefined) {
      await execute(db, "DELETE FROM user_roles WHERE user_id = ?", userId);
      if (requestedRoleIds.length > 0) {
        await batch(db, requestedRoleIds.map((roleId) => ({
          sql: `INSERT INTO user_roles
            (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [createId(), userId, roleId, user.id, now, now, user.id, now, user.id],
        })));
      }
    }
    if (nextStatus !== "active") {
      await execute(
        db,
        "UPDATE sessions SET revoked_at = ?, revoked_by = ?, updated_at = ?, updated_by = ? WHERE user_id = ? AND revoked_at IS NULL",
        now, user.id, now, user.id, userId,
      );
    }
    return c.json({ ok: true, data: null });
  });

  app.post("/api/admin/users/:id/reset-password", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const userId = c.req.param("id");
    const body = await c.req.json() as Record<string, unknown>;
    const password = String(body.newPassword || "");
    const target = await queryOne<{ id: string; is_super_admin: number }>(
      db,
      "SELECT id, is_super_admin FROM users WHERE id = ? AND deleted_at IS NULL",
      userId,
    );
    if (!target) {
      return c.json({ ok: false, error: { code: "NOT_FOUND", message: "用户不存在", requestId: c.get("requestId") } }, 404);
    }
    if (target.is_super_admin || password.length < 8) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "仅可重置普通员工的至少 8 位密码", requestId: c.get("requestId") } }, 400);
    }
    const now = nowIsoUtc();
    const { hash, salt, iterations } = await hashPassword(password);
    await execute(
      db,
      "UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      hash, salt, iterations, now, user.id, userId,
    );
    await execute(
      db,
      "UPDATE sessions SET revoked_at = ?, revoked_by = ?, updated_at = ?, updated_by = ? WHERE user_id = ? AND revoked_at IS NULL",
      now, user.id, now, user.id, userId,
    );
    await writeAuditLog(db, {
      actorId: user.id, action: "admin:user:reset-password", entityType: "user", entityId: userId,
      requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null,
      userAgent: c.req.header("user-agent") || null, summary: {},
    });
    return c.json({ ok: true, data: null });
  });

  // ==================== DEPARTMENTS ====================
  app.get("/api/admin/departments", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const depts = await queryAll(db, "SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY sort_order, name");
    return c.json({ ok: true, data: depts });
  });

  app.post("/api/admin/departments", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      db,
      "INSERT INTO departments (id, parent_id, code, name, sort_order, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, body.parentId || null, body.code, body.name, body.sortOrder || 0, body.status || "active", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  // ==================== ROLES ====================
  app.get("/api/admin/roles", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const roles = await queryAll(db, "SELECT * FROM roles WHERE deleted_at IS NULL ORDER BY name");
    return c.json({ ok: true, data: roles });
  });

  app.post("/api/admin/roles", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      db,
      "INSERT INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, body.code, body.name, body.description || null, 0, body.status || "active", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.get("/api/admin/permissions", requireAuth, adminGuard(), async (c) => {
    const permissions = await queryAll(
      c.env.DB,
      "SELECT id, code, name, permission_type FROM permissions WHERE deleted_at IS NULL AND status = 'active' AND code <> 'system:admin:access' ORDER BY sort_order, name",
    );
    return c.json({ ok: true, data: permissions });
  });

  app.get("/api/admin/roles/:id/config", requireAuth, adminGuard(), async (c) => {
    const permissionRows = await queryAll<{ permission_id: string }>(
      c.env.DB,
      "SELECT permission_id FROM role_permissions WHERE role_id = ? AND deleted_at IS NULL",
      c.req.param("id"),
    );
    const scope = await queryOne<{ scope_type: string }>(
      c.env.DB,
      "SELECT scope_type FROM role_data_scopes WHERE role_id = ? ORDER BY created_at LIMIT 1",
      c.req.param("id"),
    );
    return c.json({
      ok: true,
      data: {
        permissionIds: permissionRows.map((row) => row.permission_id),
        dataScope: scope?.scope_type || "self",
      },
    });
  });

  app.put("/api/admin/roles/:id", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const roleId = c.req.param("id");
    const body = await c.req.json() as Record<string, any>;
    const now = nowIsoUtc();
    const role = await queryOne<{ id: string }>(
      c.env.DB,
      "SELECT id FROM roles WHERE id = ? AND deleted_at IS NULL",
      roleId,
    );
    if (!role) {
      return c.json({ ok: false, error: { code: "NOT_FOUND", message: "角色不存在", requestId: c.get("requestId") } }, 404);
    }
    await execute(
      c.env.DB,
      `UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description),
       status = COALESCE(?, status), updated_at = ?, updated_by = ? WHERE id = ?`,
      body.name || null, body.description ?? null, body.status || null, now, user.id, roleId,
    );
    await execute(c.env.DB, "DELETE FROM role_permissions WHERE role_id = ?", roleId);
    const permissionIds = Array.isArray(body.permissionIds) ? body.permissionIds.filter(Boolean) : [];
    if (permissionIds.length) {
      await batch(c.env.DB, permissionIds.map((permissionId: string) => ({
        sql: `INSERT INTO role_permissions
          (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [createId(), roleId, permissionId, user.id, now, now, user.id, now, user.id],
      })));
    }
    await execute(c.env.DB, "DELETE FROM role_data_scopes WHERE role_id = ?", roleId);
    await execute(
      c.env.DB,
      `INSERT INTO role_data_scopes
        (id, role_id, scope_type, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      createId(), roleId, body.dataScope || "self", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: null });
  });

  // ==================== DICTIONARIES ====================
  app.get("/api/admin/dictionaries", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const dicts = await queryAll(db, "SELECT * FROM dictionaries WHERE deleted_at IS NULL ORDER BY code");
    const items = await queryAll(db, "SELECT * FROM dictionary_items WHERE deleted_at IS NULL ORDER BY dictionary_id, sort_order");
    return c.json({ ok: true, data: { dictionaries: dicts, items } });
  });

  app.post("/api/admin/dictionaries", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      db,
      "INSERT INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, body.code, body.name, body.category || null, body.description || null, body.status || "active", now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.get("/api/dictionaries/:code/items", requireAuth, async (c) => {
    const dictionary = await queryOne<{ id: string }>(c.env.DB,
      "SELECT id FROM dictionaries WHERE code = ? AND status = 'active' AND deleted_at IS NULL", c.req.param("code"));
    if (!dictionary) return c.json({ ok: true, data: [] });
    const items = await queryAll(c.env.DB,
      "SELECT id, code, name, value, sort_order FROM dictionary_items WHERE dictionary_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY sort_order, name",
      dictionary.id);
    return c.json({ ok: true, data: items });
  });

  app.post("/api/admin/dictionaries/:id/items", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const body = await c.req.json() as Record<string, any>;
    if (!String(body.code || "").trim() || !String(body.name || "").trim()) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "编码和名称为必填项", requestId: c.get("requestId") } }, 400);
    }
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      c.env.DB,
      `INSERT INTO dictionary_items
        (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, c.req.param("id"), String(body.code).trim(), String(body.name).trim(),
      body.value || body.code, Number(body.sortOrder || 0), body.status || "active",
      now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.put("/api/admin/dictionaries/:dictionaryId/items/:itemId", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const body = await c.req.json() as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const status = String(body.status || "active");
    if (!name || !["active", "disabled"].includes(status)) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "名称不能为空，状态必须为启用或停用", requestId: c.get("requestId") } }, 400);
    }
    const item = await queryOne<{ id: string }>(c.env.DB,
      "SELECT id FROM dictionary_items WHERE id = ? AND dictionary_id = ? AND deleted_at IS NULL", c.req.param("itemId"), c.req.param("dictionaryId"));
    if (!item) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "字典项不存在", requestId: c.get("requestId") } }, 404);
    const now = nowIsoUtc();
    await execute(c.env.DB,
      "UPDATE dictionary_items SET name = ?, value = ?, sort_order = ?, status = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      name, String(body.value || "").trim() || null, Number(body.sortOrder || 0), status, now, user.id, item.id);
    await writeAuditLog(c.env.DB, { actorId: user.id, action: "admin:dictionary-item:update", entityType: "dictionary_item", entityId: item.id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { status } });
    return c.json({ ok: true, data: { id: item.id } });
  });

  app.delete("/api/admin/dictionaries/:dictionaryId/items/:itemId", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const item = await queryOne<{ id: string }>(c.env.DB,
      "SELECT id FROM dictionary_items WHERE id = ? AND dictionary_id = ? AND deleted_at IS NULL", c.req.param("itemId"), c.req.param("dictionaryId"));
    if (!item) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "字典项不存在", requestId: c.get("requestId") } }, 404);
    const now = nowIsoUtc();
    await execute(c.env.DB, "UPDATE dictionary_items SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?", now, user.id, now, user.id, item.id);
    await writeAuditLog(c.env.DB, { actorId: user.id, action: "admin:dictionary-item:delete", entityType: "dictionary_item", entityId: item.id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: {} });
    return c.json({ ok: true, data: null });
  });

  app.get("/api/admin/space-hierarchy", requireAuth, adminGuard(), async (c) => {
    const [parks, buildings, floors] = await Promise.all([
      queryAll(c.env.DB, "SELECT * FROM parks WHERE deleted_at IS NULL ORDER BY name"),
      queryAll(c.env.DB, "SELECT * FROM buildings WHERE deleted_at IS NULL ORDER BY name"),
      queryAll(c.env.DB, "SELECT * FROM floors WHERE deleted_at IS NULL ORDER BY building_id, floor_no"),
    ]);
    return c.json({ ok: true, data: { parks, buildings, floors } });
  });

  app.post("/api/admin/parks", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const body = await c.req.json() as Record<string, any>;
    if (!body.code || !body.name) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "园区编码和名称为必填项", requestId: c.get("requestId") } }, 400);
    }
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      c.env.DB,
      `INSERT INTO parks
        (id, code, normalized_name, name, address, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, body.code, normalizeCompanyName(body.name), body.name, body.address || null,
      body.statusCode || "active", body.notes || null, now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.post("/api/admin/buildings", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const body = await c.req.json() as Record<string, any>;
    if (!body.parkId || !body.code || !body.name) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "园区、编码和名称为必填项", requestId: c.get("requestId") } }, 400);
    }
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      c.env.DB,
      `INSERT INTO buildings
        (id, park_id, code, name, total_area, total_floors, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, body.parkId, body.code, body.name, body.totalArea || null,
      Number(body.totalFloors || 0), body.statusCode || "active", body.notes || null,
      now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  app.post("/api/admin/floors", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const body = await c.req.json() as Record<string, any>;
    if (!body.buildingId || !body.floorNo || !body.name) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "楼宇、楼层号和名称为必填项", requestId: c.get("requestId") } }, 400);
    }
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      c.env.DB,
      `INSERT INTO floors
        (id, building_id, floor_no, name, area, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, body.buildingId, body.floorNo, body.name, body.area || null,
      body.statusCode || "active", body.notes || null, now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id } }, 201);
  });

  // ==================== AUDIT LOGS ====================
  app.get("/api/admin/audit-logs", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;
    const actorId = c.req.query("actorId");
    const action = c.req.query("action");

    const conditions = ["1=1"];
    const params: unknown[] = [];
    if (actorId) { conditions.push("actor_id = ?"); params.push(actorId); }
    if (action) { conditions.push("action = ?"); params.push(action); }

    const where = conditions.join(" AND ");
    const total = (await db.prepare(`SELECT COUNT(*) as total FROM audit_logs WHERE ${where}`).bind(...params).first<{ total: number }>())?.total || 0;
    const logs = await queryAll(
      db,
      `SELECT al.*, u.display_name as actor_name FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.id WHERE ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );
    return c.json({ ok: true, data: { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  // ==================== SETTINGS ====================
  app.get("/api/admin/settings", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const settings = await queryAll(db, "SELECT * FROM system_settings WHERE deleted_at IS NULL");
    return c.json({ ok: true, data: settings });
  });

  app.put("/api/admin/settings", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Array<{ key: string; value: string }>;
    const now = nowIsoUtc();

    const stmts = body.map((s) => ({
      sql: "INSERT INTO system_settings (id, setting_key, setting_value, setting_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, 'text', 'active', ?, ?, ?, ?) ON CONFLICT(setting_key) WHERE deleted_at IS NULL DO UPDATE SET setting_value = ?, updated_at = ?, updated_by = ?",
      values: [createId(), s.key, s.value, now, user.id, now, user.id, s.value, now, user.id],
    }));
    await batch(db, stmts);
    return c.json({ ok: true, data: null });
  });

  // ==================== DELETED RECORDS ====================
  app.get("/api/admin/deleted-records", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const entityType = c.req.query("type") || "clues";
    const allowedTypes = new Set(["clues", "companies", "contacts"]);
    if (!allowedTypes.has(entityType)) {
      return c.json({
        ok: false,
        error: {
          code: "INVALID_ENTITY_TYPE",
          message: "不支持的数据类型",
          requestId: c.get("requestId"),
        },
      }, 400);
    }
    const rows = await queryAll(
      db,
      `SELECT * FROM ${entityType} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100`,
    );
    return c.json({ ok: true, data: rows });
  });

  app.post("/api/admin/deleted-records/:type/:id/restore", requireAuth, requireCsrf, adminGuard(), async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const entityType = c.req.param("type");
    const entityId = c.req.param("id");
    const allowedTypes = new Set(["clues", "companies", "contacts"]);
    if (!allowedTypes.has(entityType)) {
      return c.json({
        ok: false,
        error: {
          code: "INVALID_ENTITY_TYPE",
          message: "不支持的数据类型",
          requestId: c.get("requestId"),
        },
      }, 400);
    }
    const now = nowIsoUtc();

    const restored = await execute(
      db,
      `UPDATE ${entityType} SET deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NOT NULL`,
      now, user.id, entityId,
    );
    if (!restored.meta.changes) {
      return c.json({ ok: false, error: { code: "NOT_FOUND", message: "已删除记录不存在", requestId: c.get("requestId") } }, 404);
    }
    await writeAuditLog(db, {
      actorId: user.id, action: "admin:record:restore", entityType, entityId,
      requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null,
      userAgent: c.req.header("user-agent") || null, summary: {},
    });
    return c.json({ ok: true, data: null });
  });

  // ==================== LOGIN LOGS ====================
  app.get("/api/admin/login-logs", requireAuth, adminGuard(), async (c) => {
    const db = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "50")));
    const offset = (page - 1) * pageSize;
    const total = (await db.prepare("SELECT COUNT(*) as total FROM login_logs").first<{ total: number }>())?.total || 0;
    const logs = await queryAll(db, "SELECT * FROM login_logs ORDER BY created_at DESC LIMIT ? OFFSET ?", pageSize, offset);
    return c.json({ ok: true, data: { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });
}



