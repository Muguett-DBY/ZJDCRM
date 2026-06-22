// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";
import { assertClueAccess, buildAccessContext, hasPermission } from "../access/access.service";

export function registerSpaceRoutes(app: Hono): void {
  // List spaces with filtering
  app.get("/api/spaces", requireAuth, async (c) => {
    const db = c.env.DB;
    const parkId = c.req.query("parkId");
    const status = c.req.query("status");
    const search = c.req.query("search");
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;

    const conditions = ["s.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (parkId) { conditions.push("s.floor_id IN (SELECT id FROM floors WHERE building_id IN (SELECT id FROM buildings WHERE park_id = ?))"); params.push(parkId); }
    if (status) { conditions.push("s.status_code = ?"); params.push(status); }
    if (search) { conditions.push("(s.name LIKE ? OR s.code LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await db.prepare(`SELECT COUNT(*) as total FROM spaces s ${where}`).bind(...params).first<{ total: number }>();
    const total = countResult?.total || 0;

    const items = await queryAll(
      db,
      `SELECT s.*, f.floor_no, f.name as floor_name, b.name as building_name, b.id as building_id, p.name as park_name, p.id as park_id,
        (SELECT COUNT(*) FROM clue_space_matches csm WHERE csm.space_id = s.id AND csm.status_code = 'candidate') AS candidate_count,
        CASE
          WHEN s.physical_status_code != 'active' THEN s.physical_status_code
          WHEN EXISTS (SELECT 1 FROM contract_request_allocations cra JOIN contract_requests cr ON cr.id = cra.contract_request_id WHERE cra.space_id = s.id AND cr.status_code = 'pending' AND cr.deleted_at IS NULL) THEN 'pending_soft_lock'
          WHEN s.available_area <= 0 THEN 'fully_signed'
          WHEN s.available_area < s.area THEN 'partially_signed'
          ELSE 'available'
        END AS derived_status_code
       FROM spaces s
       JOIN floors f ON s.floor_id = f.id
       JOIN buildings b ON f.building_id = b.id
       JOIN parks p ON b.park_id = p.id
       ${where}
       ORDER BY p.name, b.name, f.floor_no, s.name
       LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );

    return c.json({ ok: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  });

  // Get single space
  app.get("/api/spaces/:id", requireAuth, async (c) => {
    const db = c.env.DB;
    const spaceId = c.req.param("id");
    const space = await queryOne(
      db,
      `SELECT s.*, f.floor_no, f.name as floor_name, b.name as building_name, p.name as park_name,
        (SELECT COUNT(*) FROM clue_space_matches csm WHERE csm.space_id = s.id AND csm.status_code = 'candidate') AS candidate_count,
        CASE
          WHEN s.physical_status_code != 'active' THEN s.physical_status_code
          WHEN EXISTS (SELECT 1 FROM contract_request_allocations cra JOIN contract_requests cr ON cr.id = cra.contract_request_id WHERE cra.space_id = s.id AND cr.status_code = 'pending' AND cr.deleted_at IS NULL) THEN 'pending_soft_lock'
          WHEN s.available_area <= 0 THEN 'fully_signed'
          WHEN s.available_area < s.area THEN 'partially_signed'
          ELSE 'available'
        END AS derived_status_code
       FROM spaces s
       JOIN floors f ON s.floor_id = f.id
       JOIN buildings b ON f.building_id = b.id
       JOIN parks p ON b.park_id = p.id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      spaceId,
    );
    if (!space) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "空间不存在" } }, 404);
    return c.json({ ok: true, data: space });
  });

  // Create space
  app.post("/api/spaces", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const id = createId();
    const access = await buildAccessContext(db, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "data:import")) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有空间维护权限", requestId: c.get("requestId") } }, 403);
    }

    await execute(
      db,
      `INSERT INTO spaces (id, floor_id, code, name, area, available_area, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, body.floorId, body.code, body.name, body.area, body.availableArea || body.area,
      body.statusCode || "available", body.notes || null, now, user.id, now, user.id,
    );

    return c.json({ ok: true, data: { id } }, 201);
  });

  // Update space
  app.put("/api/spaces/:id", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const spaceId = c.req.param("id");
    const body = await c.req.json() as Record<string, unknown>;
    const now = nowIsoUtc();
    const access = await buildAccessContext(db, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "data:import")) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有空间维护权限", requestId: c.get("requestId") } }, 403);
    }

    await execute(
      db,
      `UPDATE spaces SET name = ?, area = ?, available_area = ?, status_code = ?, notes = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`,
      body.name, body.area, body.availableArea, body.statusCode, body.notes || null, now, user.id, spaceId,
    );

    return c.json({ ok: true, data: null });
  });

  // Get parks list (for dropdowns)
  app.get("/api/parks", requireAuth, async (c) => {
    const db = c.env.DB;
    const parks = await queryAll(db, "SELECT id, name, code FROM parks WHERE deleted_at IS NULL ORDER BY name");
    return c.json({ ok: true, data: parks });
  });

  // Get buildings by park
  app.get("/api/parks/:parkId/buildings", requireAuth, async (c) => {
    const db = c.env.DB;
    const buildings = await queryAll(
      db, "SELECT id, name FROM buildings WHERE park_id = ? AND deleted_at IS NULL ORDER BY name",
      c.req.param("parkId"),
    );
    return c.json({ ok: true, data: buildings });
  });

  // Match clue with space
  app.post("/api/clues/:clueId/spaces", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    const body = await c.req.json() as { spaceId: string; matchRank?: number; matchReason?: string; matchedArea?: number };
    const now = nowIsoUtc();
    const access = await buildAccessContext(db, user.id);
    try { await assertClueAccess(db, access, clueId, "write"); }
    catch { return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在或无权编辑", requestId: c.get("requestId") } }, 404); }

    const space = await queryOne<any>(db, "SELECT available_area, locked_area, physical_status_code FROM spaces WHERE id = ? AND deleted_at IS NULL", body.spaceId);
    if (!space) return c.json({ ok: false, error: { code: "INVALID_SPACE", message: "空间不存在", requestId: c.get("requestId") } }, 400);
    if (space.physical_status_code !== "active") return c.json({ ok: false, error: { code: "SPACE_OFF_MARKET", message: "空间当前不可招商", requestId: c.get("requestId") } }, 409);
    if (Number(space.locked_area) > 0) return c.json({ ok: false, error: { code: "SPACE_SOFT_LOCKED", message: "空间存在待审批或锁定余量，暂不能新增备选", requestId: c.get("requestId") } }, 409);
    const clue = await queryOne<any>(db, "SELECT desired_area FROM clues WHERE id = ?", clueId);
    const matchedArea = Number(body.matchedArea || clue?.desired_area || 0);
    if (matchedArea > Number(space.available_area)) return c.json({ ok: false, error: { code: "INSUFFICIENT_SPACE_AREA", message: "空间可用面积不足，可在组合方案中保留不足面积空间", requestId: c.get("requestId") } }, 400);

    await execute(
      db,
      `INSERT INTO clue_space_matches (id, clue_id, space_id, match_rank, match_reason, matched_area, status_code, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?)`,
      createId(), clueId, body.spaceId, body.matchRank || 1, body.matchReason || null, matchedArea || null, now, user.id, now, user.id,
    );

    return c.json({ ok: true, data: null }, 201);
  });
}



