// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { batch, execute, queryAll, queryOne } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { writeAuditLog } from "../../shared/audit";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";
import { assertClueAccess, buildAccessContext, buildClueScopeFilter } from "../access/access.service";
import { createNotification } from "../notifications/notifications.routes";

function failure(c: any, status: 400 | 403 | 404 | 409, code: string, message: string) {
  return c.json({ ok: false, error: { code, message, requestId: c.get("requestId") } }, status);
}

function isValidAllocation(value: any) {
  return value && value.spaceId && Number(value.signedArea) > 0
    && Number(value.rentPerSqmDay) >= 0 && Number(value.propertyFeePerSqmDay) >= 0
    && value.contractStartAt && value.contractEndAt && String(value.contractEndAt) >= String(value.contractStartAt);
}

async function requireAdmin(c: any) {
  if (!c.get("user")?.isSuperAdmin) throw new Error("FORBIDDEN");
}

export function registerLeasingRoutes(app: Hono): void {
  app.post("/api/clues/:clueId/contract-requests", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    const body = await c.req.json() as { allocations?: any[] };
    try { await assertClueAccess(db, await buildAccessContext(db, user.id), clueId, "owner"); }
    catch { return failure(c, 404, "NOT_FOUND", "线索不存在或不是负责人"); }

    const allocations = Array.isArray(body.allocations) ? body.allocations : [];
    if (!allocations.length || allocations.length > 20 || !allocations.every(isValidAllocation)) {
      return failure(c, 400, "VALIDATION_ERROR", "每个空间分配必须填写面积、租金、物业费和合同起止日期");
    }
    if (new Set(allocations.map((item) => item.spaceId)).size !== allocations.length) {
      return failure(c, 400, "DUPLICATE_SPACE", "同一空间只能在一次签约申请中分配一次");
    }
    const active = await queryOne<{ id: string }>(db,
      "SELECT id FROM contract_requests WHERE clue_id = ? AND status_code = 'pending' AND deleted_at IS NULL", clueId);
    if (active) return failure(c, 409, "PENDING_CONTRACT_REQUEST", "该线索已有待审批签约申请");

    const spaceIds = allocations.map((item) => String(item.spaceId));
    const placeholders = spaceIds.map(() => "?").join(",");
    const spaces = await queryAll<any>(db,
      `SELECT id, available_area, locked_area, physical_status_code FROM spaces WHERE id IN (${placeholders}) AND deleted_at IS NULL`, ...spaceIds);
    if (spaces.length !== spaceIds.length) return failure(c, 400, "INVALID_SPACE", "存在不可用的空间");
    const byId = new Map(spaces.map((space) => [space.id, space]));
    for (const item of allocations) {
      const space = byId.get(item.spaceId);
      if (space.physical_status_code !== "active") return failure(c, 409, "SPACE_OFF_MARKET", "空间当前不可招商");
      if (Number(space.locked_area) > 0) return failure(c, 409, "SPACE_SOFT_LOCKED", "空间存在待审批或锁定余量，暂不能发起签约");
      if (Number(item.signedArea) > Number(space.available_area)) return failure(c, 400, "INSUFFICIENT_SPACE_AREA", "签约面积不能超过空间可用面积");
    }

    const now = nowIsoUtc();
    const requestId = createId();
    const statements: any[] = [{
      sql: `INSERT INTO contract_requests (id, clue_id, status_code, submitted_by, submitted_at, created_at, created_by, updated_at, updated_by)
            VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      values: [requestId, clueId, user.id, now, now, user.id, now, user.id],
    }];
    for (const item of allocations) {
      const space = byId.get(item.spaceId);
      const softLockedArea = item.lockEntireSpace ? Number(space.available_area) : Number(item.signedArea);
      statements.push({
        sql: `INSERT INTO contract_request_allocations (id, contract_request_id, space_id, signed_area, rent_per_sqm_day, property_fee_per_sqm_day, contract_start_at, contract_end_at, rent_free_days, contract_attachment_id, lock_entire_space, soft_locked_area, created_at, created_by, updated_at, updated_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [createId(), requestId, item.spaceId, Number(item.signedArea), Number(item.rentPerSqmDay), Number(item.propertyFeePerSqmDay), item.contractStartAt, item.contractEndAt, item.rentFreeDays ?? null, item.contractAttachmentId ?? null, item.lockEntireSpace ? 1 : 0, softLockedArea, now, user.id, now, user.id],
      });
      statements.push({
        sql: "UPDATE spaces SET locked_area = locked_area + ?, updated_at = ?, updated_by = ? WHERE id = ? AND available_area >= ? AND locked_area = 0",
        values: [softLockedArea, now, user.id, item.spaceId, Number(item.signedArea)],
      });
    }
    await batch(db, statements);
    await writeAuditLog(db, { actorId: user.id, action: "contract:submit", entityType: "contract_request", entityId: requestId, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { clueId, allocationCount: allocations.length } });
    return c.json({ ok: true, data: { id: requestId, status: "pending" } }, 201);
  });

  app.get("/api/contract-requests", requireAuth, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const isAdmin = user.isSuperAdmin;
    const access = await buildAccessContext(db, user.id);
    const scope = isAdmin ? { sql: "", params: [] } : buildClueScopeFilter(access);
    const condition = scope.sql ? `AND ${scope.sql}` : "";
    const items = await queryAll(db, `SELECT cr.*, c.title AS clue_title, co.name AS company_name, u.display_name AS submitted_by_name
      FROM contract_requests cr JOIN clues c ON c.id = cr.clue_id JOIN companies co ON co.id = c.company_id JOIN users u ON u.id = cr.submitted_by
      WHERE cr.deleted_at IS NULL ${condition} ORDER BY cr.submitted_at DESC`, ...scope.params);
    return c.json({ ok: true, data: items });
  });

  app.post("/api/contract-requests/:id/approve", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    try { await requireAdmin(c); } catch { return failure(c, 403, "FORBIDDEN", "仅管理员可以审批签约申请"); }
    const request = await queryOne<any>(db, "SELECT * FROM contract_requests WHERE id = ? AND deleted_at IS NULL", c.req.param("id"));
    if (!request) return failure(c, 404, "NOT_FOUND", "签约申请不存在");
    if (request.status_code !== "pending") return failure(c, 409, "CONTRACT_REQUEST_RESOLVED", "该签约申请已经处理");
    const allocations = await queryAll<any>(db, "SELECT * FROM contract_request_allocations WHERE contract_request_id = ?", request.id);
    const spaces = await queryAll<any>(db, `SELECT * FROM spaces WHERE id IN (${allocations.map(() => "?").join(",")})`, ...allocations.map((item) => item.space_id));
    const spaceById = new Map(spaces.map((space) => [space.id, space]));
    for (const item of allocations) {
      const space = spaceById.get(item.space_id);
      if (!space || Number(space.available_area) < Number(item.signed_area) || Number(space.locked_area) < Number(item.soft_locked_area)) {
        return failure(c, 409, "INSUFFICIENT_SPACE_AREA", "库存已变化，不能确认该签约申请");
      }
    }
    const now = nowIsoUtc();
    const statements: any[] = [{
      sql: "UPDATE contract_requests SET status_code = 'approved', decided_by = ?, decided_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND status_code = 'pending'",
      values: [user.id, now, now, user.id, request.id],
    }, {
      sql: "UPDATE clues SET stage_code = 'signed', updated_at = ?, updated_by = ? WHERE id = ?",
      values: [now, user.id, request.clue_id],
    }];
    for (const item of allocations) {
      const remainder = Number(item.lock_entire_space) ? Math.max(0, Number(item.soft_locked_area) - Number(item.signed_area)) : 0;
      statements.push({
        sql: `INSERT INTO space_allocations (id, clue_id, space_id, contract_request_id, signed_area, locked_remainder_area, rent_per_sqm_day, property_fee_per_sqm_day, contract_start_at, contract_end_at, rent_free_days, contract_attachment_id, status_code, confirmed_at, confirmed_by, created_at, created_by, updated_at, updated_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
        values: [createId(), request.clue_id, item.space_id, request.id, item.signed_area, remainder, item.rent_per_sqm_day, item.property_fee_per_sqm_day, item.contract_start_at, item.contract_end_at, item.rent_free_days, item.contract_attachment_id, now, user.id, now, user.id, now, user.id],
      });
      statements.push({
        sql: "UPDATE spaces SET available_area = available_area - ?, locked_area = locked_area - ?, status_code = CASE WHEN available_area - ? <= 0 THEN 'signed' ELSE 'available' END, updated_at = ?, updated_by = ? WHERE id = ?",
        values: [item.signed_area, item.signed_area, item.signed_area, now, user.id, item.space_id],
      });
    }
    await batch(db, statements);
    for (const item of allocations) {
      const space = spaceById.get(item.space_id);
      const remaining = Number(space.available_area) - Number(item.signed_area);
      const candidates = await queryAll<any>(db, `SELECT csm.id, csm.clue_id, c.owner_id, c.desired_area FROM clue_space_matches csm JOIN clues c ON c.id = csm.clue_id
        WHERE csm.space_id = ? AND csm.clue_id != ? AND csm.status_code = 'candidate' AND c.deleted_at IS NULL`, item.space_id, request.clue_id);
      for (const candidate of candidates) {
        if (Number(candidate.desired_area || 0) > remaining) {
          await execute(db, "UPDATE clue_space_matches SET status_code = 'pending_replacement', updated_at = ?, updated_by = ? WHERE id = ?", now, user.id, candidate.id);
          if (candidate.owner_id) await createNotification(db, candidate.owner_id, "space_replacement", "备选空间面积不足", "其他客户已确认签约，请为该线索更换备选空间。", "clue", candidate.clue_id, user.id);
        }
      }
    }
    await writeAuditLog(db, { actorId: user.id, action: "contract:approve", entityType: "contract_request", entityId: request.id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { clueId: request.clue_id, allocationCount: allocations.length } });
    return c.json({ ok: true, data: { id: request.id, status: "approved" } });
  });

  app.post("/api/contract-requests/:id/reject", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user"); const db = c.env.DB; const body = await c.req.json() as any;
    try { await requireAdmin(c); } catch { return failure(c, 403, "FORBIDDEN", "仅管理员可以审批签约申请"); }
    if (!String(body.reason || "").trim()) return failure(c, 400, "VALIDATION_ERROR", "驳回必须填写原因");
    const request = await queryOne<any>(db, "SELECT * FROM contract_requests WHERE id = ? AND status_code = 'pending' AND deleted_at IS NULL", c.req.param("id"));
    if (!request) return failure(c, 404, "NOT_FOUND", "待审批签约申请不存在");
    const allocations = await queryAll<any>(db, "SELECT * FROM contract_request_allocations WHERE contract_request_id = ?", request.id);
    const now = nowIsoUtc();
    await batch(db, [
      { sql: "UPDATE contract_requests SET status_code = 'rejected', decided_by = ?, decided_at = ?, decision_reason = ?, updated_at = ?, updated_by = ? WHERE id = ?", values: [user.id, now, String(body.reason).trim(), now, user.id, request.id] },
      ...allocations.map((item) => ({ sql: "UPDATE spaces SET locked_area = CASE WHEN locked_area >= ? THEN locked_area - ? ELSE 0 END, updated_at = ?, updated_by = ? WHERE id = ?", values: [item.soft_locked_area, item.soft_locked_area, now, user.id, item.space_id] })),
    ]);
    const clue = await queryOne<any>(db, "SELECT owner_id FROM clues WHERE id = ?", request.clue_id);
    if (clue?.owner_id) await createNotification(db, clue.owner_id, "contract_rejected", "签约申请被驳回", String(body.reason).trim(), "contract_request", request.id, user.id);
    await writeAuditLog(db, { actorId: user.id, action: "contract:reject", entityType: "contract_request", entityId: request.id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { reason: String(body.reason).trim() } });
    return c.json({ ok: true, data: { id: request.id, status: "rejected" } });
  });

  app.post("/api/space-allocations/:id/release-lock", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user"); const db = c.env.DB;
    try { await requireAdmin(c); } catch { return failure(c, 403, "FORBIDDEN", "仅管理员可以释放锁定余量"); }
    const allocation = await queryOne<any>(db, "SELECT * FROM space_allocations WHERE id = ? AND status_code = 'active'", c.req.param("id"));
    if (!allocation) return failure(c, 404, "NOT_FOUND", "已确认空间分配不存在");
    const remaining = Number(allocation.locked_remainder_area);
    if (!remaining) return failure(c, 409, "NO_LOCKED_REMAINDER", "该空间分配没有锁定余量");
    const now = nowIsoUtc();
    await batch(db, [
      { sql: "UPDATE space_allocations SET locked_remainder_area = 0, updated_at = ?, updated_by = ? WHERE id = ?", values: [now, user.id, allocation.id] },
      { sql: "UPDATE spaces SET locked_area = CASE WHEN locked_area >= ? THEN locked_area - ? ELSE 0 END, updated_at = ?, updated_by = ? WHERE id = ?", values: [remaining, remaining, now, user.id, allocation.space_id] },
    ]);
    await writeAuditLog(db, { actorId: user.id, action: "space_allocation:release-lock", entityType: "space_allocation", entityId: allocation.id, requestId: c.get("requestId"), ipAddress: c.req.header("cf-connecting-ip") || null, userAgent: c.req.header("user-agent") || null, summary: { releasedArea: remaining } });
    return c.json({ ok: true, data: { id: allocation.id, releasedArea: remaining } });
  });
}
