import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createApi } from "../../server/app";
import { hashPassword } from "../../server/shared/crypto";

let cookie = "";
let csrfToken = "";

function splitSql(sql: string): string[] {
  return sql.replace(/--.*$/gm, "").split(";").map((part) => part.trim()).filter(Boolean);
}

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (csrfToken && method !== "GET") headers["x-csrf-token"] = csrfToken;
  const response = await createApi().request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);
  return { status: response.status, body: await response.json() as any, headers: response.headers };
}

beforeAll(async () => {
  await env.DB.exec("PRAGMA foreign_keys = ON");
  await applyD1Migrations(env.DB, [
    { name: "0001_core.sql", queries: splitSql((await import("../../migrations/0001_core.sql?raw")).default) },
    { name: "0002_business.sql", queries: splitSql((await import("../../migrations/0002_business.sql?raw")).default) },
    { name: "0003_workflows.sql", queries: splitSql((await import("../../migrations/0003_workflows.sql?raw")).default) },
    { name: "0004_indexes.sql", queries: splitSql((await import("../../migrations/0004_indexes.sql?raw")).default) },
    { name: "0007_park_leasing_workflow.sql", queries: splitSql((await import("../../migrations/0007_park_leasing_workflow.sql?raw")).default) },
  ]);

  const now = "2026-06-23T00:00:00.000Z";
  const password = await hashPassword("leasing-test-password");
  await env.DB.prepare(`INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, status, is_super_admin, failed_login_count, created_at, created_by, updated_at, updated_by)
    VALUES ('leasing-admin', 'leasing-admin', 'leasing-admin', 'Leasing Admin', ?, ?, ?, 'active', 1, 0, ?, 'seed', ?, 'seed')`)
    .bind(password.hash, password.salt, password.iterations, now, now).run();
  await env.DB.exec(`
    INSERT INTO parks (id, code, normalized_name, name, status_code, created_at, created_by, updated_at, updated_by) VALUES ('leasing-park', 'P01', '测试园区', '测试园区', 'active', '${now}', 'seed', '${now}', 'seed');
    INSERT INTO buildings (id, park_id, code, name, status_code, created_at, created_by, updated_at, updated_by) VALUES ('leasing-building', 'leasing-park', 'B01', '1号楼', 'active', '${now}', 'seed', '${now}', 'seed');
    INSERT INTO floors (id, building_id, floor_no, name, status_code, created_at, created_by, updated_at, updated_by) VALUES ('leasing-floor', 'leasing-building', '1', '一层', 'active', '${now}', 'seed', '${now}', 'seed');
    INSERT INTO spaces (id, floor_id, code, name, area, available_area, status_code, created_at, created_by, updated_at, updated_by) VALUES ('leasing-space', 'leasing-floor', 'S01', '101', 100, 100, 'available', '${now}', 'seed', '${now}', 'seed');
    INSERT INTO companies (id, name, normalized_name, main_business, industry_code, status, created_at, created_by, updated_at, updated_by) VALUES ('leasing-company', '签约测试企业', '签约测试企业', '测试', 'other', 'active', '${now}', 'seed', '${now}', 'seed');
    INSERT INTO clues (id, company_id, title, desired_area, stage_code, owner_id, version, created_at, created_by, updated_at, updated_by) VALUES ('leasing-clue', 'leasing-company', '签约测试线索', 60, 'contract_pending', 'leasing-admin', 1, '${now}', 'seed', '${now}', 'seed');
    INSERT INTO companies (id, name, normalized_name, main_business, industry_code, status, created_at, created_by, updated_at, updated_by) VALUES ('leasing-company-2', '另一测试企业', '另一测试企业', '测试', 'other', 'active', '${now}', 'seed', '${now}', 'seed');
    INSERT INTO clues (id, company_id, title, desired_area, stage_code, owner_id, version, created_at, created_by, updated_at, updated_by) VALUES ('leasing-clue-2', 'leasing-company-2', '另一测试线索', 20, 'new', 'leasing-admin', 1, '${now}', 'seed', '${now}', 'seed');
  `);
  const login = await request("POST", "/api/auth/login", { account: "leasing-admin", password: "leasing-test-password" });
  cookie = login.headers.get("set-cookie") || "";
  csrfToken = login.body.data.csrfToken;
});

describe("leasing approval workflow", () => {
  it("soft-locks a submitted allocation, blocks new candidates, and only deducts stock after approval", async () => {
    const overAllocation = await request("POST", "/api/clues/leasing-clue-2/contract-requests", {
      allocations: [{
        spaceId: "leasing-space", signedArea: 101, rentPerSqmDay: 5, propertyFeePerSqmDay: 0.3,
        contractStartAt: "2026-07-01", contractEndAt: "2027-06-30",
      }],
    });
    expect(overAllocation.status).toBe(400);
    expect(overAllocation.body.error.code).toBe("INSUFFICIENT_SPACE_AREA");

    const submitted = await request("POST", "/api/clues/leasing-clue/contract-requests", {
      allocations: [{
        spaceId: "leasing-space", signedArea: 60, lockEntireSpace: true,
        rentPerSqmDay: 5.2, propertyFeePerSqmDay: 0.35,
        contractStartAt: "2026-07-01", contractEndAt: "2027-06-30",
      }],
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.status).toBe("pending");

    const spaceWhilePending = await request("GET", "/api/spaces/leasing-space");
    expect(spaceWhilePending.body.data).toMatchObject({ available_area: 100, locked_area: 100, derived_status_code: "pending_soft_lock" });

    const candidate = await request("POST", "/api/clues/leasing-clue-2/spaces", { spaceId: "leasing-space" });
    expect(candidate.status).toBe(409);
    expect(candidate.body.error.code).toBe("SPACE_SOFT_LOCKED");

    const approved = await request("POST", `/api/contract-requests/${submitted.body.data.id}/approve`, {});
    expect(approved.status).toBe(200);
    const approvedSpace = await request("GET", "/api/spaces/leasing-space");
    expect(approvedSpace.body.data).toMatchObject({ available_area: 40, locked_area: 40, derived_status_code: "partially_signed" });
    expect(await env.DB.prepare("SELECT stage_code FROM clues WHERE id = 'leasing-clue'").first()).toMatchObject({ stage_code: "signed" });
  });

  it("requires evidence before a followup can count as a visit or tour", async () => {
    const missingEvidence = await request("POST", "/api/clues/leasing-clue/followups", {
      content: "已与客户现场沟通", countsAsVisit: true,
    });
    expect(missingEvidence.status).toBe(400);
    expect(missingEvidence.body.error.code).toBe("MILESTONE_ATTACHMENT_REQUIRED");

    const now = "2026-06-23T00:00:00.000Z";
    await env.DB.prepare(`INSERT INTO attachments (id, clue_id, storage_key, original_file_name, content_type, file_size, uploaded_by, uploaded_at, created_at, created_by, updated_at, updated_by)
      VALUES ('leasing-evidence', 'leasing-clue', 'attachments/leasing-evidence', '现场照片.jpg', 'image/jpeg', 10, 'leasing-admin', ?, ?, 'leasing-admin', ?, 'leasing-admin')`)
      .bind(now, now, now).run();
    const recorded = await request("POST", "/api/clues/leasing-clue/followups", {
      content: "已与客户现场沟通", customerNeed: "需要60平方米", customerPain: "预算需要审批",
      countsAsVisit: true, countsAsTour: true, attachmentIds: ["leasing-evidence"],
    });
    expect(recorded.status).toBe(201);
    expect(await env.DB.prepare("SELECT counts_as_visit, counts_as_tour, customer_need, customer_pain FROM followups WHERE id = ?").bind(recorded.body.data.id).first()).toMatchObject({ counts_as_visit: 1, counts_as_tour: 1, customer_need: "需要60平方米", customer_pain: "预算需要审批" });
    expect(await env.DB.prepare("SELECT current_customer_need, current_customer_pain FROM clues WHERE id = 'leasing-clue'").first()).toMatchObject({ current_customer_need: "需要60平方米", current_customer_pain: "预算需要审批" });
  });
});
