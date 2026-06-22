// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";
import { writeAuditLog } from "../../shared/audit";
import { execute, queryAll, queryOne } from "../../shared/db";
import { createId } from "../../shared/ids";
import { normalizeCompanyName } from "../../shared/normalize-company";
import { nowIsoUtc } from "../../shared/time";
import { buildWorkbookImportPreview } from "../../../shared/xlsx-import-preview";
import { normalizeImportKey } from "../../../shared/import-normalization";
import {
  buildAccessContext,
  buildClueScopeFilter,
  hasPermission,
} from "../access/access.service";

function error(c: any, status: number, code: string, message: string) {
  return c.json({
    ok: false,
    error: { code, message, requestId: c.get("requestId") },
  }, status);
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

async function ensureTag(db: D1Database, name: string, userId: string, now: string): Promise<string> {
  const normalized = normalizeTagName(name);
  const existing = await queryOne<{ id: string }>(db, "SELECT id FROM tags WHERE normalized_name = ? AND deleted_at IS NULL", normalized);
  if (existing) return existing.id;
  const id = createId();
  await execute(
    db,
    `INSERT INTO tags (id, name, normalized_name, color, status, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    id, name, normalized, "#2563eb", now, userId, now, userId,
  );
  return id;
}

async function findUserIdByDisplayName(db: D1Database, displayName: string | undefined): Promise<string | null> {
  if (!displayName) return null;
  const user = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM users WHERE (display_name = ? OR account = ?) AND status = 'active' AND deleted_at IS NULL",
    displayName,
    displayName,
  );
  return user?.id || null;
}

async function ensureSpaceHierarchy(db: D1Database, projectName: string, userId: string, now: string): Promise<{ parkId: string; buildingId: string; floorId: string }> {
  const safeProject = projectName || "未命名园区";
  const parkCode = `import-${normalizeImportKey(safeProject) || "park"}`;
  let park = await queryOne<{ id: string }>(db, "SELECT id FROM parks WHERE code = ? AND deleted_at IS NULL", parkCode);
  if (!park) {
    park = { id: createId() };
    await execute(
      db,
      `INSERT INTO parks (id, code, normalized_name, name, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, 'active', 'AI/XLSX导入自动创建', ?, ?, ?, ?)`,
      park.id, parkCode, normalizeCompanyName(safeProject), safeProject, now, userId, now, userId,
    );
  }

  let building = await queryOne<{ id: string }>(db, "SELECT id FROM buildings WHERE park_id = ? AND name = ? AND deleted_at IS NULL", park.id, safeProject);
  if (!building) {
    building = { id: createId() };
    await execute(
      db,
      `INSERT INTO buildings (id, park_id, code, name, total_floors, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, 1, 'active', 'AI/XLSX导入自动创建', ?, ?, ?, ?)`,
      building.id, park.id, `${parkCode}-building`, safeProject, now, userId, now, userId,
    );
  }

  let floor = await queryOne<{ id: string }>(db, "SELECT id FROM floors WHERE building_id = ? AND floor_no = '默认' AND deleted_at IS NULL", building.id);
  if (!floor) {
    floor = { id: createId() };
    await execute(
      db,
      `INSERT INTO floors (id, building_id, floor_no, name, area, status_code, notes, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, '默认', '默认楼层', 0, 'active', 'AI/XLSX导入自动创建', ?, ?, ?, ?)`,
      floor.id, building.id, now, userId, now, userId,
    );
  }

  return { parkId: park.id, buildingId: building.id, floorId: floor.id };
}

async function ensureImportedSpace(db: D1Database, row: Record<string, any>, userId: string, now: string): Promise<string> {
  const projectName = String(row.projectName || "导入空间").trim();
  const roomName = String(row.roomName || "").trim();
  if (!roomName) throw new Error("空间房间号为必填项");
  const existing = await queryOne<{ id: string }>(db, "SELECT id FROM spaces WHERE name = ? AND deleted_at IS NULL", roomName);
  if (existing) return existing.id;

  const hierarchy = await ensureSpaceHierarchy(db, projectName, userId, now);
  const area = Number(row.area || 0);
  const notes = [
    row.height ? `层高：${row.height}` : "",
    row.loadBearing ? `承重：${row.loadBearing}` : "",
    row.deliveryStatus ? `交付状态：${row.deliveryStatus}` : "",
    row.propertyFee ? `物业费：${row.propertyFee}` : "",
    row.negotiatingCustomer ? `在谈客户：${row.negotiatingCustomer}` : "",
  ].filter(Boolean).join("\n");
  const id = createId();
  await execute(
    db,
    `INSERT INTO spaces
      (id, floor_id, code, name, area, available_area, status_code, notes, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    hierarchy.floorId,
    `import-${normalizeImportKey(projectName)}-${normalizeImportKey(roomName) || id}`,
    roomName,
    Number.isFinite(area) ? area : 0,
    Number.isFinite(area) ? area : 0,
    row.negotiatingCustomer ? "negotiating" : "available",
    notes || null,
    now,
    userId,
    now,
    userId,
  );
  return id;
}

async function requestAiImportReview(env: any, preview: any): Promise<any | null> {
  const apiKey = String(env.OPENCODE_GO_API_KEY || "").trim();
  if (!apiKey) return null;
  const compactRows = preview.leadRows.slice(0, 20).map((row: any, index: number) => ({
    index,
    companyName: row.companyName,
    mainBusiness: row.mainBusiness,
    sourceSheet: row.sourceSheet,
    sourceCode: row.sourceCode,
    industryCode: row.industryCode,
    stageCode: row.stageCode,
    tags: row.tags,
    bottleneck: row.bottleneck,
    followupSummary: String(row.followupContent || "").slice(0, 180),
  }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70_000);
  try {
    const response = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        model: "mimo-v2.5",
        reasoning_effort: "high",
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              "你是 CFZZS 招商台账导入校验器。只返回 JSON。",
              "下面 rows 已由规则解析。请只指出需要修正的字段，不要原样返回全部 rows。",
              "patches 最多 10 条；没有明确错误就返回空数组。",
              "允许修正字段：industryCode、sourceCode、stageCode、tags。不要新增不存在的客户，不要改 title/companyName。",
              "合法行业：medical_devices, pharma, ai, integrated_circuit, smart_manufacturing, other。",
              "合法渠道：activity, referral, gov, visit, null。",
              "合法阶段：new, initial_contact, site_visit, signed, landed, lost。",
              "返回格式严格为：{\"patches\":[{\"index\":0,\"industryCode\":\"...\",\"sourceCode\":\"...\",\"stageCode\":\"...\",\"tags\":[\"...\"]}],\"warnings\":[]}",
              JSON.stringify({ rows: compactRows, warnings: preview.warnings }),
            ].join("\n"),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenCode Go 调用失败：${response.status}`);
    const body = await response.json() as any;
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return null;
    const text = String(content).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("AI 校验没有返回完整 JSON，已使用规则解析结果");
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new Error("AI 校验超时，已使用规则解析结果");
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export function registerWorkflowRoutes(app: Hono): void {
  app.get("/api/reports", requireAuth, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    const filter = buildClueScopeFilter(access);
    const scopeSql = filter.sql ? `AND ${filter.sql}` : "";
    const params = filter.params;

    const [stageDistribution, sourceDistribution, ownerPerformance, spaceStatus] = await Promise.all([
      queryAll(c.env.DB,
        `SELECT c.stage_code, COUNT(*) AS total
         FROM clues c WHERE c.deleted_at IS NULL ${scopeSql}
         GROUP BY c.stage_code ORDER BY total DESC`, ...params),
      queryAll(c.env.DB,
        `SELECT COALESCE(c.source_code, 'unknown') AS source_code, COUNT(*) AS total
         FROM clues c WHERE c.deleted_at IS NULL ${scopeSql}
         GROUP BY COALESCE(c.source_code, 'unknown') ORDER BY total DESC`, ...params),
      queryAll(c.env.DB,
        `SELECT COALESCE(u.display_name, '未分配') AS owner_name, COUNT(*) AS clue_count
         FROM clues c LEFT JOIN users u ON c.owner_id = u.id
         WHERE c.deleted_at IS NULL ${scopeSql}
         GROUP BY c.owner_id, u.display_name ORDER BY clue_count DESC`, ...params),
      queryAll(c.env.DB,
        `SELECT status_code, COUNT(*) AS total, COALESCE(SUM(area), 0) AS area
         FROM spaces WHERE deleted_at IS NULL GROUP BY status_code ORDER BY total DESC`),
    ]);

    return c.json({ ok: true, data: { stageDistribution, sourceDistribution, ownerPerformance, spaceStatus } });
  });

  app.get("/api/imports", requireAuth, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    const canManage = hasPermission(access, "system:admin:access") || user.isSuperAdmin;
    const where = canManage ? "" : "WHERE requested_by = ?";
    const params = canManage ? [] : [user.id];
    const items = await queryAll(
      c.env.DB,
      `SELECT * FROM import_jobs ${where} ORDER BY created_at DESC LIMIT 100`,
      ...params,
    );
    return c.json({ ok: true, data: { items } });
  });

  app.post("/api/imports/ai-preview", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "data:import")) {
      return error(c, 403, "FORBIDDEN", "没有导入权限");
    }
    const body = await c.req.json();
    const workbook = body.workbook;
    if (!workbook || !Array.isArray(workbook.sheets)) {
      return error(c, 400, "VALIDATION_ERROR", "请上传可识别的 XLSX 工作簿");
    }
    const preview = buildWorkbookImportPreview(workbook);
    try {
      const ai = await requestAiImportReview(c.env, preview);
      if (ai?.patches && Array.isArray(ai.patches)) {
        for (const patch of ai.patches) {
          const index = Number(patch?.index);
          const row = Number.isInteger(index) ? preview.leadRows[index] : null;
          if (!row) continue;
          if (patch.industryCode) row.industryCode = String(patch.industryCode);
          if (Object.prototype.hasOwnProperty.call(patch, "sourceCode")) row.sourceCode = patch.sourceCode ? String(patch.sourceCode) : null;
          if (patch.stageCode) row.stageCode = String(patch.stageCode);
          if (Array.isArray(patch.tags)) row.tags = [...new Set([...row.tags, ...patch.tags.map(String).filter(Boolean)])];
        }
      } else if (ai?.leadRows && Array.isArray(ai.leadRows)) {
        preview.leadRows = ai.leadRows.map((row: any, index: number) => ({
          ...preview.leadRows[index],
          ...row,
          title: String(row.title || preview.leadRows[index]?.title || row.companyName || "").slice(0, 120),
          tags: Array.isArray(row.tags) ? row.tags : preview.leadRows[index]?.tags || [],
        })).filter((row: any) => row.companyName);
      }
      if (Array.isArray(ai?.warnings)) preview.warnings.push(...ai.warnings.map(String));
    } catch (cause) {
      preview.warnings.push(cause instanceof Error ? cause.message : "AI 预览失败，已使用规则解析结果");
    }
    preview.stats = { leads: preview.leadRows.length, spaces: preview.spaceRows.length, warnings: preview.warnings.length };
    return c.json({ ok: true, data: preview });
  });

  app.post("/api/imports", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "data:import")) {
      return error(c, 403, "FORBIDDEN", "没有导入权限");
    }

    const body = await c.req.json();
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
    const spaces = Array.isArray(body.spaces) ? body.spaces.slice(0, 1000) : [];
    if (!["clues", "ai-xlsx"].includes(body.jobType) || (rows.length === 0 && spaces.length === 0)) {
      return error(c, 400, "VALIDATION_ERROR", "请选择招商线索模板并提供数据");
    }

    const now = nowIsoUtc();
    const jobId = createId();
    await execute(
      c.env.DB,
      `INSERT INTO import_jobs
        (id, requested_by, job_type, source_file_name, template_version, status,
         total_rows, success_rows, failed_rows, started_at, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, 'clues', ?, '1.0', 'running', ?, 0, 0, ?, ?, ?, ?, ?)`,
      jobId, user.id, body.sourceFileName || "import.csv", rows.length + spaces.length,
      now, now, user.id, now, user.id,
    );

    let successRows = 0;
    let failedRows = 0;
    const spaceByCustomerKey = new Map<string, string>();

    for (let index = 0; index < spaces.length; index++) {
      const row = spaces[index] || {};
      let rowStatus = "success";
      let rowError: string | null = null;
      try {
        const spaceId = await ensureImportedSpace(c.env.DB, row, user.id, now);
        const negotiatingCustomer = String(row.negotiatingCustomer || "").trim();
        if (negotiatingCustomer) spaceByCustomerKey.set(normalizeImportKey(negotiatingCustomer), spaceId);
        successRows++;
      } catch (cause) {
        rowStatus = "failed";
        rowError = cause instanceof Error ? cause.message : "空间导入失败";
        failedRows++;
      }
      await execute(
        c.env.DB,
        `INSERT INTO import_job_rows
          (id, import_job_id, row_number, status, error_message, source_payload_json,
           created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createId(), jobId, index + 1, rowStatus, rowError, JSON.stringify({ type: "space", ...row }),
        now, user.id, now, user.id,
      );
    }

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      const title = String(row.title || "").trim();
      const companyName = String(row.companyName || "").trim();
      let rowStatus = "success";
      let rowError: string | null = null;

      try {
        if (!title || !companyName) throw new Error("线索名称和企业名称为必填项");
        const normalizedName = normalizeCompanyName(companyName);
        const clueId = createId();
        const ownerId = row.ownerId || await findUserIdByDisplayName(c.env.DB, row.ownerName) || null;
        let company = await queryOne<{ id: string }>(
          c.env.DB,
          "SELECT id FROM companies WHERE normalized_name = ? AND deleted_at IS NULL",
          normalizedName,
        );
        if (!company) {
          company = { id: createId() };
          await execute(
            c.env.DB,
            `INSERT INTO companies
              (id, name, normalized_name, main_business, industry_code, status,
               created_at, created_by, updated_at, updated_by)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
            company.id, companyName, normalizedName, row.mainBusiness || "",
            row.industryCode || "other", now, user.id, now, user.id,
          );
        }

        await execute(
          c.env.DB,
          `INSERT INTO clues
            (id, company_id, title, desired_area, acquired_at, expected_landing_at,
             stage_code, bottleneck, source_code, internal_referral_flag, financing_flag,
             prior_location, owner_id, department_id,
             created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          clueId, company.id, title, row.desiredArea || null,
          row.acquiredAt || now, row.expectedLandingAt || null,
          row.stageCode || "new", row.bottleneck || null, row.sourceCode || null,
          row.internalReferralFlag ? 1 : 0, row.financingFlag ? 1 : 0,
          row.priorLocation || null, ownerId, row.departmentId || user.departmentId || null,
          now, user.id, now, user.id,
        );
        const tagNames = Array.isArray(row.tags) ? row.tags.map(String).filter(Boolean) : [];
        for (const tagName of tagNames) {
          const tagId = await ensureTag(c.env.DB, tagName, user.id, now);
          await execute(
            c.env.DB,
            `INSERT OR IGNORE INTO clue_tags (id, clue_id, tag_id, created_at, created_by, updated_at, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            createId(), clueId, tagId, now, user.id, now, user.id,
          );
        }
        const followupContent = String(row.followupContent || "").trim();
        if (followupContent) {
          await execute(
            c.env.DB,
            `INSERT INTO followups
              (id, clue_id, owner_id, method_code, followup_at, content, bottleneck, new_stage_code,
               created_at, created_by, updated_at, updated_by)
             VALUES (?, ?, ?, 'visit', ?, ?, ?, ?, ?, ?, ?, ?)`,
            createId(), clueId, ownerId || user.id, now, followupContent, row.bottleneck || null,
            row.stageCode || "new", now, user.id, now, user.id,
          );
        }
        const matchKey = normalizeImportKey(row.matchedSpaceText || row.companyName);
        const matchedSpaceId = spaceByCustomerKey.get(matchKey);
        if (matchedSpaceId) {
          await execute(
            c.env.DB,
            `INSERT OR IGNORE INTO clue_space_matches
              (id, clue_id, space_id, match_rank, match_reason, matched_area, score,
               created_at, created_by, updated_at, updated_by)
             VALUES (?, ?, ?, 1, 'AI/XLSX导入：在谈客户匹配', ?, 90, ?, ?, ?, ?)`,
            createId(), clueId, matchedSpaceId, row.desiredArea || null, now, user.id, now, user.id,
          );
        }
        successRows++;
      } catch (cause) {
        rowStatus = "failed";
        rowError = cause instanceof Error ? cause.message : "导入失败";
        failedRows++;
      }

      await execute(
        c.env.DB,
        `INSERT INTO import_job_rows
          (id, import_job_id, row_number, status, error_message, source_payload_json,
           created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createId(), jobId, spaces.length + index + 1, rowStatus, rowError, JSON.stringify(row),
        now, user.id, now, user.id,
      );
    }

    await execute(
      c.env.DB,
      `UPDATE import_jobs
       SET status = 'completed', success_rows = ?, failed_rows = ?, finished_at = ?,
           updated_at = ?, updated_by = ?
       WHERE id = ?`,
      successRows, failedRows, now, now, user.id, jobId,
    );
    await writeAuditLog(c.env.DB, {
      actorId: user.id,
      action: "import:complete",
      entityType: "import_job",
      entityId: jobId,
      ipAddress: c.req.header("cf-connecting-ip") || null,
      userAgent: c.req.header("user-agent") || null,
      requestId: c.get("requestId"),
      summary: { totalRows: rows.length + spaces.length, successRows, failedRows },
    });

    return c.json({
      ok: true,
      data: { id: jobId, totalRows: rows.length + spaces.length, successRows, failedRows },
    }, 201);
  });

  app.get("/api/export-requests", requireAuth, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    const canApprove = user.isSuperAdmin || hasPermission(access, "export:approve");
    const where = canApprove ? "" : "WHERE er.requested_by = ?";
    const params = canApprove ? [] : [user.id];
    const requests = await queryAll(
      c.env.DB,
      `SELECT er.*, u.display_name AS requester_name, ef.file_name, ef.expires_at
       FROM export_requests er
       LEFT JOIN users u ON er.requested_by = u.id
       LEFT JOIN export_files ef ON ef.export_request_id = er.id
       ${where}
       ORDER BY er.created_at DESC`,
      ...params,
    );
    return c.json({ ok: true, data: requests });
  });

  app.post("/api/export-requests", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "data:export")) {
      return error(c, 403, "FORBIDDEN", "没有导出申请权限");
    }
    const body = await c.req.json();
    const reason = String(body.reason || "").trim();
    if (!reason) return error(c, 400, "VALIDATION_ERROR", "请填写导出原因");
    const now = nowIsoUtc();
    const id = createId();
    await execute(
      c.env.DB,
      `INSERT INTO export_requests
        (id, requested_by, reason, scope_json, status, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      id, user.id, reason, JSON.stringify(body.scope || { entity: "clues" }),
      now, user.id, now, user.id,
    );
    return c.json({ ok: true, data: { id, status: "pending" } }, 201);
  });

  app.post("/api/export-requests/:id/approve", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "export:approve")) {
      return error(c, 403, "FORBIDDEN", "没有导出审批权限");
    }
    const request = await queryOne<any>(
      c.env.DB,
      "SELECT * FROM export_requests WHERE id = ? AND deleted_at IS NULL",
      c.req.param("id"),
    );
    if (!request) return error(c, 404, "NOT_FOUND", "导出申请不存在");
    if (request.status !== "pending") return error(c, 409, "INVALID_STATUS", "该申请已处理");

    const requesterAccess = await buildAccessContext(c.env.DB, request.requested_by);
    const filter = buildClueScopeFilter(requesterAccess);
    const where = filter.sql ? `AND ${filter.sql}` : "";
    const rows = await queryAll<any>(
      c.env.DB,
      `SELECT c.title, co.name AS company_name, c.stage_code, c.source_code,
              c.desired_area, c.expected_landing_at, c.expected_output, c.expected_tax
       FROM clues c JOIN companies co ON c.company_id = co.id
       WHERE c.deleted_at IS NULL ${where}
       ORDER BY c.updated_at DESC`,
      ...filter.params,
    );
    const header = ["线索名称", "企业名称", "阶段", "渠道", "需求面积", "预计落位", "预计产值", "预计税收"];
    const csv = "\uFEFF" + [
      header.map(csvCell).join(","),
      ...rows.map((row) => [
        row.title, row.company_name, row.stage_code, row.source_code,
        row.desired_area, row.expected_landing_at, row.expected_output, row.expected_tax,
      ].map(csvCell).join(",")),
    ].join("\r\n");
    const now = nowIsoUtc();
    const fileId = createId();
    const storageKey = `exports/${request.id}/${fileId}.csv`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await c.env.FILES.put(storageKey, csv, {
      httpMetadata: { contentType: "text/csv; charset=utf-8" },
    });
    await execute(
      c.env.DB,
      `INSERT INTO export_files
        (id, export_request_id, storage_key, file_name, content_type, file_size,
         file_hash, expires_at, status, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, 'text/csv; charset=utf-8', ?, ?, ?, 'ready', ?, ?, ?, ?)`,
      fileId, request.id, storageKey, `cfzzs-clues-${now.slice(0, 10)}.csv`,
      new TextEncoder().encode(csv).byteLength, await sha256Hex(csv), expiresAt,
      now, user.id, now, user.id,
    );
    await execute(
      c.env.DB,
      `UPDATE export_requests SET status = 'ready', approved_by = ?, approved_at = ?,
       updated_at = ?, updated_by = ? WHERE id = ?`,
      user.id, now, now, user.id, request.id,
    );
    return c.json({ ok: true, data: { status: "ready", expiresAt } });
  });

  app.post("/api/export-requests/:id/reject", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    if (!user.isSuperAdmin && !hasPermission(access, "export:approve")) {
      return error(c, 403, "FORBIDDEN", "没有导出审批权限");
    }
    const body = await c.req.json();
    const reason = String(body.reason || "").trim();
    if (!reason) return error(c, 400, "VALIDATION_ERROR", "请填写驳回原因");
    const now = nowIsoUtc();
    await execute(
      c.env.DB,
      `UPDATE export_requests SET status = 'rejected', rejected_by = ?, rejected_at = ?,
       rejection_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND status = 'pending'`,
      user.id, now, reason, now, user.id, c.req.param("id"),
    );
    return c.json({ ok: true, data: { status: "rejected" } });
  });

  app.get("/api/export-requests/:id/download", requireAuth, async (c) => {
    const user = c.get("user");
    const access = await buildAccessContext(c.env.DB, user.id);
    const file = await queryOne<any>(
      c.env.DB,
      `SELECT ef.*, er.requested_by FROM export_files ef
       JOIN export_requests er ON er.id = ef.export_request_id
       WHERE ef.export_request_id = ? AND ef.status IN ('ready', 'downloaded')`,
      c.req.param("id"),
    );
    if (!file) return error(c, 404, "NOT_FOUND", "导出文件不存在");
    if (file.requested_by !== user.id && !user.isSuperAdmin && !hasPermission(access, "export:approve")) {
      return error(c, 403, "FORBIDDEN", "无权下载该文件");
    }
    if (file.expires_at <= nowIsoUtc()) return error(c, 410, "EXPORT_EXPIRED", "下载链接已过期");
    const object = await c.env.FILES.get(file.storage_key);
    if (!object) return error(c, 404, "NOT_FOUND", "导出文件不存在");
    const now = nowIsoUtc();
    await execute(
      c.env.DB,
      `UPDATE export_files SET status = 'downloaded', downloaded_at = ?,
       downloaded_by = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      now, user.id, now, user.id, file.id,
    );
    return new Response(object.body, {
      headers: {
        "content-type": file.content_type,
        "content-disposition": `attachment; filename="${file.file_name}"`,
      },
    });
  });
}
