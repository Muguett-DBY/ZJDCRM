// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { normalizeCompanyName } from "../../shared/normalize-company";
import { buildClueScopeFilter, assertClueAccess, buildAccessContext, hasPermission } from "../access/access.service";
import type { AccessContext } from "../access/access.types";
import { writeAuditLog } from "../../shared/audit";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";

const STAGES = [
  "new", "filed", "initial_contact", "needs_confirmed", "key_followup",
  "site_visit", "intent_confirmed", "contract_pending", "signed", "landed", "lost",
] as const;

function validateStage(stage: string): boolean {
  return STAGES.includes(stage as any);
}

function requireStage(conditions: string[]): string | null {
  return conditions.find((c) => !STAGES.includes(c as any)) || null;
}

export function registerClueRoutes(app: Hono): void {
  app.get("/api/users/assignable", requireAuth, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    if (!hasPermission(access, "clue:assign")) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有分配权限", requestId: c.get("requestId") } }, 403);
    }
    const users = await queryAll(
      c.env.DB,
      "SELECT id, display_name, department_id FROM users WHERE status = 'active' AND deleted_at IS NULL ORDER BY display_name",
    );
    return c.json({ ok: true, data: users });
  });

  // List clues with pagination, filtering, sorting
  app.get("/api/clues", requireAuth, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const access = await buildAccessContext(db, user.id);
    const filter = buildClueScopeFilter(access);

    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20")));
    const offset = (page - 1) * pageSize;
    const stage = c.req.query("stage");
    const source = c.req.query("source");
    const industry = c.req.query("industry");
    const tag = c.req.query("tag");
    const owner = c.req.query("owner");
    const acquiredFrom = c.req.query("acquiredFrom");
    const acquiredTo = c.req.query("acquiredTo");
    const expectedFrom = c.req.query("expectedFrom");
    const expectedTo = c.req.query("expectedTo");
    const updatedFrom = c.req.query("updatedFrom");
    const updatedTo = c.req.query("updatedTo");
    const areaMin = c.req.query("areaMin");
    const areaMax = c.req.query("areaMax");
    const search = c.req.query("search");
    const unassigned = c.req.query("unassigned") === "true";
    const sortBy = c.req.query("sortBy") || "updated_at";
    const sortOrder = c.req.query("sortOrder") === "asc" ? "ASC" : "DESC";

    const allowedSort = ["updated_at", "created_at", "acquired_at", "expected_landing_at", "title", "stage_code"];
    const sortCol = allowedSort.includes(sortBy) ? sortBy : "updated_at";

    const conditions: string[] = ["c.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filter.sql) {
      conditions.push(filter.sql);
      params.push(...filter.params);
    }
    if (stage) {
      conditions.push("c.stage_code = ?");
      params.push(stage);
    }
    if (source) {
      conditions.push("c.source_code = ?");
      params.push(source);
    }
    if (industry) {
      conditions.push("co.industry_code = ?");
      params.push(industry);
    }
    if (owner) {
      conditions.push("c.owner_id = ?");
      params.push(owner);
    }
    if (tag) {
      conditions.push(`EXISTS (
        SELECT 1 FROM clue_tags fct
        JOIN tags ft ON ft.id = fct.tag_id
        WHERE fct.clue_id = c.id AND ft.deleted_at IS NULL AND ft.status = 'active' AND ft.name = ?
      )`);
      params.push(tag);
    }
    if (acquiredFrom) {
      conditions.push("c.acquired_at >= ?");
      params.push(acquiredFrom);
    }
    if (acquiredTo) {
      conditions.push("c.acquired_at <= ?");
      params.push(acquiredTo);
    }
    if (expectedFrom) {
      conditions.push("c.expected_landing_at >= ?");
      params.push(expectedFrom);
    }
    if (expectedTo) {
      conditions.push("c.expected_landing_at <= ?");
      params.push(expectedTo);
    }
    if (updatedFrom) {
      conditions.push("c.updated_at >= ?");
      params.push(`${updatedFrom}T00:00:00.000Z`);
    }
    if (updatedTo) {
      conditions.push("c.updated_at <= ?");
      params.push(`${updatedTo}T23:59:59.999Z`);
    }
    if (areaMin && Number.isFinite(Number(areaMin))) {
      conditions.push("c.desired_area >= ?");
      params.push(Number(areaMin));
    }
    if (areaMax && Number.isFinite(Number(areaMax))) {
      conditions.push("c.desired_area <= ?");
      params.push(Number(areaMax));
    }
    if (search) {
      conditions.push("(c.title LIKE ? OR co.name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (unassigned) {
      conditions.push("c.owner_id IS NULL");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM clues c LEFT JOIN companies co ON c.company_id = co.id ${where}`,
    ).bind(...params).first<{ total: number }>();

    const total = countResult?.total || 0;

    const rows = await queryAll<Record<string, unknown>>(
      db,
      `SELECT c.*, co.name as company_name, co.industry_code, u.display_name as owner_name,
        (
          SELECT GROUP_CONCAT(t.name, '、')
          FROM clue_tags ct
          JOIN tags t ON t.id = ct.tag_id
          WHERE ct.clue_id = c.id AND t.deleted_at IS NULL AND t.status = 'active'
        ) AS tag_names
       FROM clues c
       LEFT JOIN companies co ON c.company_id = co.id
       LEFT JOIN users u ON c.owner_id = u.id
       ${where}
       ORDER BY c.${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      ...params, pageSize, offset,
    );

    const tagCounts = await queryAll<{ name: string; total: number }>(
      db,
      `SELECT t.name, COUNT(DISTINCT c.id) AS total
       FROM clues c
       LEFT JOIN companies co ON c.company_id = co.id
       LEFT JOIN users u ON c.owner_id = u.id
       JOIN clue_tags ct ON ct.clue_id = c.id
       JOIN tags t ON t.id = ct.tag_id
       ${where}
       AND t.deleted_at IS NULL AND t.status = 'active'
       GROUP BY t.name
       ORDER BY total DESC, t.name ASC
       LIMIT 30`,
      ...params,
    );

    const reserveStatusTags = Object.fromEntries(
      ["近两周新增", "重点在签约", "无跟进价值", "已签约"].map((name) => [
        name,
        tagCounts.find((item) => item.name === name)?.total || 0,
      ]),
    );

    return c.json({
      ok: true,
      data: {
        items: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        summary: {
          total,
          reserveStatusTags,
          tagCounts,
        },
      },
    });
  });

  // Get single clue
  app.get("/api/clues/:id", requireAuth, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("id");

    const access = await buildAccessContext(db, user.id);
    try {
      await assertClueAccess(db, access, clueId, "read");
    } catch {
      return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在", requestId: c.get("requestId") } }, 404);
    }

    const clue = await queryOne<Record<string, unknown>>(
      db,
      `SELECT c.*, co.name as company_name, co.main_business, co.industry_code
       FROM clues c
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      clueId,
    );

    if (!clue) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在", requestId: c.get("requestId") } }, 404);

    // Get contacts
    const contacts = await queryAll<Record<string, unknown>>(
      db,
      `SELECT ct.* FROM clue_contacts cc JOIN contacts ct ON cc.contact_id = ct.id WHERE cc.clue_id = ? AND ct.deleted_at IS NULL`,
      clueId,
    );

    // Get followups
    const followups = await queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM followups WHERE clue_id = ? AND deleted_at IS NULL ORDER BY followup_at DESC LIMIT 10`,
      clueId,
    );

    // Get matched spaces
    const spaces = await queryAll<Record<string, unknown>>(
      db,
      `SELECT s.*, csm.match_rank, csm.match_reason, csm.matched_area, csm.status_code
       FROM clue_space_matches csm
       JOIN spaces s ON csm.space_id = s.id
       WHERE csm.clue_id = ? AND s.deleted_at IS NULL
       ORDER BY csm.match_rank ASC`,
      clueId,
    );

    // Get stage history
    const stageHistory = await queryAll<Record<string, unknown>>(
      db,
      `SELECT * FROM stage_histories WHERE clue_id = ? ORDER BY changed_at DESC`,
      clueId,
    );
    const contractRequests = await queryAll<Record<string, unknown>>(
      db, "SELECT id, status_code, submitted_at, decided_at, decision_reason FROM contract_requests WHERE clue_id = ? AND deleted_at IS NULL ORDER BY submitted_at DESC", clueId,
    );

    return c.json({
      ok: true,
      data: { ...clue, contacts, followups, spaces, stageHistory, contractRequests },
    });
  });

  // Create clue
  app.post("/api/clues", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const body = await c.req.json() as Record<string, unknown>;
    const requestId = c.get("requestId");
    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;

    // Validate required fields
    if (!body.title || !body.companyName) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "线索名称和企业名称为必填项", requestId } }, 400);
    }

    const now = nowIsoUtc();
    const clueId = createId();
    const companyId = createId();
    const normalizedName = normalizeCompanyName(body.companyName as string);

    // Check duplicate
    const existing = await queryOne<{ id: string }>(
      db, "SELECT id FROM companies WHERE normalized_name = ? AND deleted_at IS NULL", normalizedName,
    );

    let finalCompanyId: string;
    if (existing) {
      finalCompanyId = existing.id;
    } else {
      // Create company
      await execute(
        db,
        `INSERT INTO companies (id, name, normalized_name, main_business, industry_code, status, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        companyId, body.companyName, normalizedName, body.mainBusiness || "", body.industryCode || "other", now, user.id, now, user.id,
      );
      finalCompanyId = companyId;
    }

    const ownerId = (body.ownerId as string) || user.id;
    const departmentId = body.departmentId as string || null;
    const stageCode = (body.stageCode as string) || "new";

    if (!validateStage(stageCode)) {
      return c.json({ ok: false, error: { code: "INVALID_STAGE", message: "无效的招商阶段", requestId } }, 400);
    }

    await execute(
      db,
      `INSERT INTO clues (id, company_id, title, description, desired_area, acquired_at, expected_landing_at, stage_code, bottleneck, source_code, internal_referral_flag, financing_flag, prior_location, lost_reason, fiscal_completion, expected_output, expected_tax, owner_id, department_id, version, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      clueId, finalCompanyId, body.title, body.description || null, body.desiredArea || null,
      body.acquiredAt || now, body.expectedLandingAt || null, stageCode,
      body.bottleneck || null, body.sourceCode || null, body.internalReferralFlag ? 1 : 0,
      body.financingFlag ? 1 : 0, body.priorLocation || null, body.lostReason || null,
      body.fiscalCompletion || null, body.expectedOutput || null, body.expectedTax || null,
      ownerId, departmentId, now, user.id, now, user.id,
    );

    // Write audit log
    await writeAuditLog(db, {
      actorId: user.id, action: "clue:create", entityType: "clue", entityId: clueId,
      ipAddress, userAgent, requestId, summary: { title: body.title, companyName: body.companyName },
    });

    return c.json({ ok: true, data: { id: clueId } }, 201);
  });

  // Update clue
  app.put("/api/clues/:id", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("id");
    const body = await c.req.json() as Record<string, unknown>;
    const requestId = c.get("requestId");
    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;

    const access = await buildAccessContext(db, user.id);
    try {
      await assertClueAccess(db, access, clueId, "write");
    } catch {
      return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在或无权编辑", requestId } }, 404);
    }

    const existing = await queryOne<{ version: number; stage_code: string; company_id: string }>(
      db, "SELECT version, stage_code, company_id FROM clues WHERE id = ? AND deleted_at IS NULL", clueId,
    );

    if (!existing) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在", requestId } }, 404);

    // Optimistic locking
    const version = body.version as number;
    if (version && version !== existing.version) {
      return c.json({ ok: false, error: { code: "CONFLICT", message: "数据已被其他用户修改，请刷新后重试", requestId } }, 409);
    }

    const newVersion = existing.version + 1;
    const now = nowIsoUtc();

    const stageCode = (body.stageCode as string) || existing.stage_code;

    // Stage change validation
    if (stageCode !== existing.stage_code) {
      if (!String(body.stageReason || "").trim()) {
        return c.json({ ok: false, error: { code: "STAGE_REASON_REQUIRED", message: "阶段变更必须填写原因", requestId } }, 400);
      }
      if (stageCode === "initial_contact") {
        const contactCount = await queryOne<{ cnt: number }>(
          db, "SELECT COUNT(*) as cnt FROM clue_contacts WHERE clue_id = ?", clueId,
        );
        if (!contactCount || contactCount.cnt === 0) {
          return c.json({ ok: false, error: { code: "CLUE_STAGE_REQUIRE_CONTACT", message: "进入初步接触阶段前至少需要一个联系人", requestId } }, 400);
        }
      }
      if (stageCode === "lost" && !body.lostReason) {
        return c.json({ ok: false, error: { code: "CLOSE_LOST_REQUIRE_REASON", message: "标记流失必须填写流失原因", requestId } }, 400);
      }
      if (stageCode === "landed") {
        if (!body.actualSpaceId || !body.actualArea || !body.actualLandingAt || !body.actualFiscalCompletion) {
          return c.json({ ok: false, error: { code: "LANDING_REQUIRE_FIELDS", message: "落地必须填写实际空间、实际面积、落地日期和财源完成情况", requestId } }, 400);
        }
      }
      if (["signed", "landed"].includes(stageCode) && existing.stage_code === "lost") {
        return c.json({ ok: false, error: { code: "CANNOT_REVERT_LOST", message: "已流失线索不可直接进入签约或落地", requestId } }, 400);
      }

      // Write stage history
      await execute(
        db,
        `INSERT INTO stage_histories (id, clue_id, from_stage_code, to_stage_code, reason, changed_by, changed_at, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createId(), clueId, existing.stage_code, stageCode, body.stageReason || "", user.id, now, now, user.id, now, user.id,
      );
    }

    const updateFields: string[] = [];
    const updateParams: unknown[] = [];

    const updatableFields: Array<[string, string, (value: unknown) => unknown]> = [
      ["title", "title", (value) => value],
      ["description", "description", (value) => value || null],
      ["desiredArea", "desired_area", (value) => value || null],
      ["acquiredAt", "acquired_at", (value) => value || null],
      ["expectedLandingAt", "expected_landing_at", (value) => value || null],
      ["bottleneck", "bottleneck", (value) => value || null],
      ["sourceCode", "source_code", (value) => value || null],
      ["sourceDetail", "source_detail", (value) => value || null],
      ["internalReferralFlag", "internal_referral_flag", (value) => value ? 1 : 0],
      ["financingFlag", "financing_flag", (value) => value ? 1 : 0],
      ["priorLocation", "prior_location", (value) => value || null],
      ["lostReason", "lost_reason", (value) => value || null],
      ["fiscalCompletion", "fiscal_completion", (value) => value || null],
      ["expectedOutput", "expected_output", (value) => value || null],
      ["expectedTax", "expected_tax", (value) => value || null],
      ["nextFollowupAt", "next_followup_at", (value) => value || null],
      ["actualSpaceId", "actual_space_id", (value) => value || null],
      ["actualArea", "actual_area", (value) => value || null],
      ["actualLandingAt", "actual_landing_at", (value) => value || null],
      ["actualFiscalCompletion", "actual_fiscal_completion", (value) => value || null],
      ["actualOutput", "actual_output", (value) => value || null],
      ["actualTax", "actual_tax", (value) => value || null],
    ];

    for (const [bodyKey, column, normalize] of updatableFields) {
      if (body[bodyKey] !== undefined) {
        updateFields.push(`${column} = ?`);
        updateParams.push(normalize(body[bodyKey]));
      }
    }

    if (stageCode !== existing.stage_code) {
      updateFields.push("stage_code = ?");
      updateParams.push(stageCode);
    }

    if (body.ownerId) {
      updateFields.push("owner_id = ?");
      updateParams.push(body.ownerId);
    }

    if (body.departmentId) {
      updateFields.push("department_id = ?");
      updateParams.push(body.departmentId);
    }

    const companyUpdateFields: string[] = [];
    const companyUpdateParams: unknown[] = [];
    if (body.companyName !== undefined && String(body.companyName).trim()) {
      companyUpdateFields.push("name = ?", "normalized_name = ?");
      companyUpdateParams.push(String(body.companyName).trim(), normalizeCompanyName(String(body.companyName)));
    }
    if (body.mainBusiness !== undefined) {
      companyUpdateFields.push("main_business = ?");
      companyUpdateParams.push(body.mainBusiness || "");
    }
    if (body.industryCode !== undefined) {
      companyUpdateFields.push("industry_code = ?");
      companyUpdateParams.push(body.industryCode || "other");
    }

    if (updateFields.length > 0 || companyUpdateFields.length > 0) {
      updateFields.push("version = ?", "updated_at = ?", "updated_by = ?");
      updateParams.push(newVersion, now, user.id);
      updateParams.push(clueId);

      await execute(
        db,
        `UPDATE clues SET ${updateFields.join(", ")} WHERE id = ?`,
        ...updateParams,
      );

      if (companyUpdateFields.length > 0) {
        companyUpdateFields.push("updated_at = ?", "updated_by = ?", "version = version + 1");
        companyUpdateParams.push(now, user.id, existing.company_id);
        await execute(
          db,
          `UPDATE companies SET ${companyUpdateFields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
          ...companyUpdateParams,
        );
      }
    }

    await writeAuditLog(db, {
      actorId: user.id, action: stageCode !== existing.stage_code ? "clue:stage-change" : "clue:edit",
      entityType: "clue", entityId: clueId, ipAddress, userAgent, requestId,
      summary: { fromStage: existing.stage_code, toStage: stageCode, fields: updateFields },
    });

    return c.json({ ok: true, data: { id: clueId, version: newVersion } });
  });

  // Assign/transfer clue ownership
  app.post("/api/clues/:id/assign", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("id");
    const body = await c.req.json() as { ownerId: string };
    const requestId = c.get("requestId");

    if (!body.ownerId) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "请选择负责人", requestId } }, 400);
    }

    const access = await buildAccessContext(db, user.id);
    if (!hasPermission(access, "clue:assign")) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有分配权限", requestId } }, 403);
    }

    const now = nowIsoUtc();
    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;

    await execute(db, "UPDATE clues SET owner_id = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
      body.ownerId, now, user.id, clueId);

    await writeAuditLog(db, {
      actorId: user.id, action: "clue:assign", entityType: "clue", entityId: clueId,
      ipAddress, userAgent, requestId, summary: { newOwner: body.ownerId },
    });

    return c.json({ ok: true, data: null });
  });

  // Soft delete clue
  app.post("/api/clues/:id/delete", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("id");
    const requestId = c.get("requestId");

    const access = await buildAccessContext(db, user.id);
    if (!hasPermission(access, "clue:delete")) {
      return c.json({ ok: false, error: { code: "FORBIDDEN", message: "没有删除权限", requestId } }, 403);
    }

    const clue = await queryOne<{ stage_code: string }>(db, "SELECT stage_code FROM clues WHERE id = ? AND deleted_at IS NULL", clueId);
    if (!clue) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在", requestId } }, 404);

    if (["signed", "landed"].includes(clue.stage_code)) {
      return c.json({ ok: false, error: { code: "CANNOT_DELETE", message: "已签约或已落地的线索不可删除", requestId } }, 400);
    }

    const now = nowIsoUtc();
    await execute(db, "UPDATE clues SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      now, user.id, now, user.id, clueId);

    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;
    await writeAuditLog(db, {
      actorId: user.id, action: "clue:delete", entityType: "clue", entityId: clueId,
      ipAddress, userAgent, requestId, summary: { stage: clue.stage_code },
    });

    return c.json({ ok: true, data: null });
  });
}



