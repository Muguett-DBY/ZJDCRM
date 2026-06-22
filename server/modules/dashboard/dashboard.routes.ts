// @ts-nocheck
/* eslint-disable */
import { Hono } from "hono";
import { queryAll, queryOne } from "../../shared/db";
import { buildAccessContext, buildClueScopeFilter } from "../access/access.service";
import { requireAuth } from "../../middleware/auth";

export function registerDashboardRoutes(app: Hono): void {
  app.get("/api/dashboard", requireAuth, async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    const access = await buildAccessContext(db, user.id);
    const filter = buildClueScopeFilter(access);
    const scopeSql = filter.sql ? `AND ${filter.sql}` : "";
    const scopeParams = filter.params;

    const startDate = c.req.query("startDate") || "2000-01-01";
    const endDate = c.req.query("endDate") || "2099-12-31";
    const ownerId = c.req.query("ownerId");
    const departmentId = c.req.query("departmentId");
    const parkId = c.req.query("parkId");
    const dateFilter = "AND c.created_at >= ? AND c.created_at <= ?";
    const audienceClauses: string[] = [];
    const audienceParams: unknown[] = [];
    if (ownerId) { audienceClauses.push("c.owner_id = ?"); audienceParams.push(ownerId); }
    if (departmentId) { audienceClauses.push("c.department_id = ?"); audienceParams.push(departmentId); }
    if (parkId) { audienceClauses.push("EXISTS (SELECT 1 FROM clue_space_matches dm JOIN spaces ds ON ds.id = dm.space_id JOIN floors df ON df.id = ds.floor_id JOIN buildings db ON db.id = df.building_id WHERE dm.clue_id = c.id AND db.park_id = ?)"); audienceParams.push(parkId); }
    const audienceSql = audienceClauses.length ? `AND ${audienceClauses.join(" AND ")}` : "";
    const allParams = [...scopeParams, ...audienceParams, startDate, endDate];

    // New clues count
    const newClues = await queryOne<{ total: number }>(
      db, `SELECT COUNT(*) as total FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} ${audienceSql} ${dateFilter}`, ...allParams,
    );

    // Stage distribution
    const stageDist = await queryAll<{ stage_code: string; total: number }>(
      db, `SELECT c.stage_code, COUNT(*) as total FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} ${audienceSql} GROUP BY c.stage_code ORDER BY c.stage_code`, ...scopeParams, ...audienceParams,
    );

    // Source distribution
    const sourceDist = await queryAll<{ source_code: string; total: number }>(
      db, `SELECT c.source_code, COUNT(*) as total FROM clues c WHERE c.deleted_at IS NULL AND c.source_code IS NOT NULL ${scopeSql} ${audienceSql} GROUP BY c.source_code`, ...scopeParams, ...audienceParams,
    );

    // Signed + landed count
    const signedLanded = await queryOne<{ signed: number; landed: number }>(
      db, `SELECT SUM(CASE WHEN stage_code = 'signed' THEN 1 ELSE 0 END) as signed, SUM(CASE WHEN stage_code = 'landed' THEN 1 ELSE 0 END) as landed FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} ${audienceSql}`, ...scopeParams, ...audienceParams,
    );

    // Total expected area
    const expectedArea = await queryOne<{ total: number }>(
      db, `SELECT COALESCE(SUM(c.desired_area), 0) as total FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} ${audienceSql} AND c.desired_area IS NOT NULL`, ...scopeParams, ...audienceParams,
    );

    // Total expected output/tax
    const expectedOutput = await queryOne<{ output: number; tax: number }>(
      db, `SELECT COALESCE(SUM(c.expected_output), 0) as output, COALESCE(SUM(c.expected_tax), 0) as tax FROM clues c WHERE c.deleted_at IS NULL ${scopeSql} ${audienceSql}`, ...scopeParams, ...audienceParams,
    );

    const milestones = await queryOne<{ visits: number; tours: number; signed_area: number }>(db,
      `SELECT
        COUNT(DISTINCT CASE WHEN f.counts_as_visit = 1 THEN f.clue_id END) AS visits,
        COUNT(DISTINCT CASE WHEN f.counts_as_tour = 1 THEN f.clue_id END) AS tours,
        (SELECT COALESCE(SUM(sa.signed_area), 0) FROM space_allocations sa JOIN clues sc ON sc.id = sa.clue_id WHERE sa.status_code = 'active' AND sa.confirmed_at >= ? AND sa.confirmed_at <= ? ${scopeSql.replaceAll("c.", "sc.")} ${audienceSql.replaceAll("c.", "sc.")}) AS signed_area
       FROM followups f JOIN clues c ON c.id = f.clue_id
       WHERE f.deleted_at IS NULL AND f.followup_at >= ? AND f.followup_at <= ? ${scopeSql} ${audienceSql}`,
      startDate, endDate, ...scopeParams, ...audienceParams, startDate, endDate, ...scopeParams, ...audienceParams);

    // Space status counts
    const spaceStatus = await queryAll<{ status_code: string; total: number }>(
      db, "SELECT status_code, COUNT(*) as total FROM spaces WHERE deleted_at IS NULL GROUP BY status_code",
    );

    // Upcoming reminders
    const reminders = await queryAll(
      db,
      `SELECT c.id, c.title, c.next_followup_at, u.display_name as owner_name
       FROM clues c LEFT JOIN users u ON c.owner_id = u.id
       WHERE c.deleted_at IS NULL AND c.next_followup_at IS NOT NULL AND c.next_followup_at <= ?
       ORDER BY c.next_followup_at ASC LIMIT 10`,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );

    return c.json({
      ok: true,
      data: {
        newClues: newClues?.total || 0,
        stageDistribution: stageDist,
        sourceDistribution: sourceDist,
        signedCount: signedLanded?.signed || 0,
        visitCount: milestones?.visits || 0,
        tourCount: milestones?.tours || 0,
        signedArea: milestones?.signed_area || 0,
        landedCount: signedLanded?.landed || 0,
        expectedArea: expectedArea?.total || 0,
        expectedOutput: expectedOutput?.output || 0,
        expectedTax: expectedOutput?.tax || 0,
        spaceStatus,
        upcomingReminders: reminders,
      },
    });
  });
}



