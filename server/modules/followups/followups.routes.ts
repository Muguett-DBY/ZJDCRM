// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne, execute } from "../../shared/db";
import { createId } from "../../shared/ids";
import { nowIsoUtc } from "../../shared/time";
import { requireAuth } from "../../middleware/auth";
import { requireCsrf } from "../../middleware/csrf";
import { writeAuditLog } from "../../shared/audit";
import { assertClueAccess, buildAccessContext } from "../access/access.service";

async function requireClueAccess(c: any, clueId: string, mode: "read" | "write") {
  const access = await buildAccessContext(c.env.DB, c.get("user").id);
  await assertClueAccess(c.env.DB, access, clueId, mode);
}

export function registerFollowupRoutes(app: Hono): void {
  // List followups for a clue
  app.get("/api/clues/:clueId/followups", requireAuth, async (c) => {
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    try { await requireClueAccess(c, clueId, "read"); }
    catch { return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在", requestId: c.get("requestId") } }, 404); }
    const followups = await queryAll(
      db,
      `SELECT f.*, u.display_name as owner_name
       FROM followups f
       LEFT JOIN users u ON f.owner_id = u.id
       WHERE f.clue_id = ? AND f.deleted_at IS NULL
       ORDER BY f.followup_at DESC`,
      clueId,
    );
    return c.json({ ok: true, data: followups });
  });

  // Create followup
  app.post("/api/clues/:clueId/followups", requireAuth, requireCsrf, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    const body = await c.req.json() as Record<string, unknown>;
    const requestId = c.get("requestId");
    try { await requireClueAccess(c, clueId, "write"); }
    catch { return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在或无权编辑", requestId } }, 404); }

    if (!body.content) {
      return c.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "跟进内容不能为空", requestId } }, 400);
    }
    const countsAsVisit = Boolean(body.countsAsVisit);
    const countsAsTour = Boolean(body.countsAsTour);
    const attachmentIds = [...new Set((Array.isArray(body.attachmentIds) ? body.attachmentIds : []).map(String).filter(Boolean))];
    if ((countsAsVisit || countsAsTour) && !attachmentIds.length) {
      return c.json({ ok: false, error: { code: "MILESTONE_ATTACHMENT_REQUIRED", message: "计入客户拜访或园区带看时，至少需要上传一个附件", requestId } }, 400);
    }
    if (attachmentIds.length) {
      const placeholders = attachmentIds.map(() => "?").join(",");
      const attachments = await queryAll<any>(db, `SELECT id FROM attachments WHERE id IN (${placeholders}) AND clue_id = ? AND deleted_at IS NULL`, ...attachmentIds, clueId);
      if (attachments.length !== attachmentIds.length) return c.json({ ok: false, error: { code: "INVALID_ATTACHMENT", message: "附件必须属于当前线索", requestId } }, 400);
    }

    const now = nowIsoUtc();
    const id = createId();
    const ipAddress = c.req.header("cf-connecting-ip") || null;
    const userAgent = c.req.header("user-agent") || null;

    await execute(
      db,
      `INSERT INTO followups (id, clue_id, owner_id, method_code, followup_at, content, customer_feedback, bottleneck, next_action, next_followup_at, new_stage_code, stage_reason, customer_need, customer_pain, counts_as_visit, counts_as_tour, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, clueId, user.id, body.methodCode || "phone", body.followupAt || now,
      body.content, body.customerFeedback || null, body.bottleneck || null,
      body.nextAction || null, body.nextFollowupAt || null,
      body.newStageCode || null, body.stageReason || null, body.customerNeed || null, body.customerPain || null,
      countsAsVisit ? 1 : 0, countsAsTour ? 1 : 0, now, user.id, now, user.id,
    );

    for (const attachmentId of attachmentIds) {
      await execute(db, "INSERT OR IGNORE INTO followup_attachment_links (id, followup_id, attachment_id, created_at, created_by) VALUES (?, ?, ?, ?, ?)", createId(), id, attachmentId, now, user.id);
    }
    if (body.customerNeed || body.customerPain) {
      await execute(db, "UPDATE clues SET current_customer_need = COALESCE(?, current_customer_need), current_customer_pain = COALESCE(?, current_customer_pain), updated_at = ?, updated_by = ? WHERE id = ?", body.customerNeed || null, body.customerPain || null, now, user.id, clueId);
    }

    // If stage change included, update clue stage
    if (body.newStageCode) {
      const clue = await queryOne<{ stage_code: string }>(db, "SELECT stage_code FROM clues WHERE id = ? AND deleted_at IS NULL", clueId);
      if (clue && clue.stage_code !== body.newStageCode) {
        // Write stage history
        await execute(
          db,
          `INSERT INTO stage_histories (id, clue_id, from_stage_code, to_stage_code, reason, followup_id, changed_by, changed_at, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createId(), clueId, clue.stage_code, body.newStageCode, body.stageReason || "随跟进变更", id, user.id, now, now, user.id, now, user.id,
        );

        await execute(db, "UPDATE clues SET stage_code = ?, next_followup_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
          body.newStageCode, body.nextFollowupAt || null, now, user.id, clueId);

        await writeAuditLog(db, {
          actorId: user.id, action: "clue:stage-change", entityType: "clue", entityId: clueId,
          ipAddress, userAgent, requestId, summary: { fromStage: clue.stage_code, toStage: body.newStageCode },
        });
      }
    }

    // If next followup time set, update clue
    if (body.nextFollowupAt) {
      await execute(db, "UPDATE clues SET next_followup_at = ?, updated_at = ? WHERE id = ?", body.nextFollowupAt, now, clueId);
    }

    return c.json({ ok: true, data: { id } }, 201);
  });

  // Get timeline for a clue
  app.get("/api/clues/:clueId/timeline", requireAuth, async (c) => {
    const db = c.env.DB;
    const clueId = c.req.param("clueId");
    try { await requireClueAccess(c, clueId, "read"); }
    catch { return c.json({ ok: false, error: { code: "NOT_FOUND", message: "线索不存在", requestId: c.get("requestId") } }, 404); }

    const followups = await queryAll(
      db, `SELECT 'followup' as type, id, followup_at as event_at, content as description, owner_id FROM followups WHERE clue_id = ? AND deleted_at IS NULL`, clueId,
    );
    const stageChanges = await queryAll(
      db, `SELECT 'stage_change' as type, id, changed_at as event_at, from_stage_code || ' → ' || to_stage_code as description, changed_by as owner_id FROM stage_histories WHERE clue_id = ?`, clueId,
    );

    const timeline = [...followups, ...stageChanges].sort((a: any, b: any) =>
      new Date(b.event_at).getTime() - new Date(a.event_at).getTime(),
    );

    return c.json({ ok: true, data: timeline });
  });
}



