import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createApi } from "../../server/app";
import { hashPassword } from "../../server/shared/crypto";

type JsonBody = {
  ok: boolean;
  data?: any;
  error?: { code: string; message: string };
};

let cookie = "";
let csrfToken = "";

function splitSql(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: JsonBody; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (csrfToken && method !== "GET") headers["x-csrf-token"] = csrfToken;

  const response = await createApi().request(
    `http://localhost${path}`,
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );

  return {
    status: response.status,
    body: (await response.json()) as JsonBody,
    headers: response.headers,
  };
}

beforeAll(async () => {
  await env.DB.exec("PRAGMA foreign_keys = ON");
  await applyD1Migrations(env.DB, [
    { name: "0001_core.sql", queries: splitSql((await import("../../migrations/0001_core.sql?raw")).default) },
    { name: "0002_business.sql", queries: splitSql((await import("../../migrations/0002_business.sql?raw")).default) },
    { name: "0003_workflows.sql", queries: splitSql((await import("../../migrations/0003_workflows.sql?raw")).default) },
    { name: "0004_indexes.sql", queries: splitSql((await import("../../migrations/0004_indexes.sql?raw")).default) },
  ]);

  const now = "2026-06-21T00:00:00.000Z";
  const password = await hashPassword("admin-test-password");
  await env.DB.prepare(
    `INSERT INTO users
      (id, account, normalized_account, display_name, password_hash, password_salt,
       password_iterations, status, is_super_admin, failed_login_count,
       created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, 'seed', ?, 'seed')`,
  )
    .bind(
      "admin-workflows",
      "admin-workflows",
      "admin-workflows",
      "Admin Workflows",
      password.hash,
      password.salt,
      password.iterations,
      now,
      now,
    )
    .run();

  const login = await request("POST", "/api/auth/login", {
    account: "admin-workflows",
    password: "admin-test-password",
  });
  cookie = login.headers.get("set-cookie") || "";
  csrfToken = login.body.data?.csrfToken || "";
});

describe("admin safety and account management", () => {
  it("rejects deleted-record table names outside the allowlist", async () => {
    const response = await request("GET", "/api/admin/deleted-records?type=users%20WHERE%201%3D1");
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_ENTITY_TYPE");
  });

  it("requires an explicit strong password when creating a user", async () => {
    const response = await request("POST", "/api/admin/users", {
      account: "new-user",
      displayName: "New User",
      password: "",
    });
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creating or promoting a second super administrator", async () => {
    const created = await request("POST", "/api/admin/users", {
      account: "second-super-admin",
      displayName: "Second Super Admin",
      password: "strong-password-123",
      isSuperAdmin: true,
    });
    if (created.body.data?.id) {
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(created.body.data.id).run();
    }
    expect(created.status).toBe(400);
    expect(created.body.error?.code).toBe("SINGLE_ADMIN_ONLY");

    const employee = await request("POST", "/api/admin/users", {
      account: "no-promotion-user",
      displayName: "No Promotion User",
      password: "strong-password-123",
    });
    const promoted = await request("PUT", `/api/admin/users/${employee.body.data?.id}`, {
      isSuperAdmin: true,
    });
    expect(promoted.status).toBe(400);
    expect(promoted.body.error?.code).toBe("SINGLE_ADMIN_ONLY");
  });

  it("creates a user with assigned roles", async () => {
    const now = "2026-06-21T00:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO roles
        (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by)
       VALUES ('role-created-user', 'created_user_role', 'Created User Role', 0, 'active', ?, 'seed', ?, 'seed')`,
    ).bind(now, now).run();

    const response = await request("POST", "/api/admin/users", {
      account: "created-user",
      displayName: "Created User",
      password: "strong-password-123",
      roleIds: ["role-created-user"],
    });

    expect(response.status).toBe(201);
    const assignment = await env.DB.prepare(
      "SELECT role_id FROM user_roles WHERE user_id = ?",
    ).bind(response.body.data?.id).first<{ role_id: string }>();
    expect(assignment?.role_id).toBe("role-created-user");
  });

  it("edits an employee profile and replaces assigned roles", async () => {
    const now = "2026-06-22T00:00:00.000Z";
    for (const [id, code] of [["role-edit-a", "edit_a"], ["role-edit-b", "edit_b"]]) {
      await env.DB.prepare(
        `INSERT INTO roles
          (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, 0, 'active', ?, 'seed', ?, 'seed')`,
      ).bind(id, code, code, now, now).run();
    }
    const created = await request("POST", "/api/admin/users", {
      account: "editable-user",
      displayName: "Before Edit",
      password: "strong-password-123",
      roleIds: ["role-edit-a"],
    });
    const id = created.body.data?.id;
    const updated = await request("PUT", `/api/admin/users/${id}`, {
      displayName: "After Edit",
      roleIds: ["role-edit-b"],
    });

    expect(updated.status).toBe(200);
    expect(await env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(id).first()).toMatchObject({ display_name: "After Edit" });
    expect(await env.DB.prepare("SELECT role_id FROM user_roles WHERE user_id = ? AND deleted_at IS NULL").bind(id).all()).toMatchObject({ results: [{ role_id: "role-edit-b" }] });
  });

  it("resets an employee password and rejects resetting the administrator", async () => {
    const created = await request("POST", "/api/admin/users", {
      account: "resettable-user",
      displayName: "Resettable User",
      password: "original-password-123",
    });
    const reset = await request("POST", `/api/admin/users/${created.body.data?.id}/reset-password`, {
      newPassword: "replacement-password-123",
    });
    expect(reset.status).toBe(200);

    const oldLogin = await createApi().request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "resettable-user", password: "original-password-123" }),
    }, env);
    const newLogin = await createApi().request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "resettable-user", password: "replacement-password-123" }),
    }, env);
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);

    const adminReset = await request("POST", "/api/admin/users/admin-workflows/reset-password", {
      newPassword: "replacement-password-123",
    });
    expect(adminReset.status).toBe(400);
  });

  it("updates a user status without erasing profile fields", async () => {
    const created = await request("POST", "/api/admin/users", {
      account: "status-user",
      displayName: "Status User",
      password: "strong-password-123",
    });
    const updated = await request("PUT", `/api/admin/users/${created.body.data?.id}`, {
      status: "disabled",
    });
    expect(updated.status).toBe(200);

    const user = await env.DB.prepare(
      "SELECT display_name, status FROM users WHERE id = ?",
    ).bind(created.body.data?.id).first<{ display_name: string; status: string }>();
    expect(user).toEqual({ display_name: "Status User", status: "disabled" });
  });

  it("does not allow disabling the last active super administrator", async () => {
    const response = await request("PUT", "/api/admin/users/admin-workflows", {
      status: "disabled",
      isSuperAdmin: true,
    });
    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe("LAST_SUPER_ADMIN");
  });

  it("does not grant system management through a normal role", async () => {
    const now = "2026-06-22T00:00:00.000Z";
    const password = await hashPassword("legacy-password-123");
    await env.DB.prepare(
      `INSERT INTO users
        (id, account, normalized_account, display_name, password_hash, password_salt,
         password_iterations, status, is_super_admin, failed_login_count,
         created_at, created_by, updated_at, updated_by)
       VALUES ('legacy-user', 'legacy-user', 'legacy-user', 'Legacy User', ?, ?, ?, 'active', 0, 0, ?, 'seed', ?, 'seed')`,
    ).bind(password.hash, password.salt, password.iterations, now, now).run();
    await env.DB.prepare(
      `INSERT INTO roles
        (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by)
       VALUES ('legacy-role', 'legacy_role', 'Legacy Role', 0, 'active', ?, 'seed', ?, 'seed')`,
    ).bind(now, now).run();
    await env.DB.prepare(
      `INSERT INTO permissions
        (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
       VALUES ('legacy-admin-permission', 'system:admin:access', 'Legacy admin access', 'menu', 'active', ?, 'seed', ?, 'seed')`,
    ).bind(now, now).run();
    await env.DB.prepare(
      `INSERT INTO user_roles
        (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
       VALUES ('legacy-user-role', 'legacy-user', 'legacy-role', 'admin-workflows', ?, ?, 'seed', ?, 'seed')`,
    ).bind(now, now, now).run();
    await env.DB.prepare(
      `INSERT INTO role_permissions
        (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
       VALUES ('legacy-role-permission', 'legacy-role', 'legacy-admin-permission', 'admin-workflows', ?, ?, 'seed', ?, 'seed')`,
    ).bind(now, now, now).run();

    const login = await createApi().request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "legacy-user", password: "legacy-password-123" }),
    }, env);
    const legacyCookie = login.headers.get("set-cookie") || "";
    const response = await createApi().request("http://localhost/api/admin/users", {
      headers: { cookie: legacyCookie },
    }, env);

    expect(response.status).toBe(403);
  });

  it("configures role permissions and data scope", async () => {
    const now = "2026-06-21T00:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO permissions
        (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
       VALUES ('permission-role-test', 'role:test', 'Role Test', 'action', 'active', ?, 'seed', ?, 'seed')`,
    ).bind(now, now).run();

    const response = await request("PUT", "/api/admin/roles/role-created-user", {
      name: "Updated Role",
      permissionIds: ["permission-role-test"],
      dataScope: "team",
    });
    expect(response.status).toBe(200);
    expect(await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM role_permissions WHERE role_id = 'role-created-user' AND permission_id = 'permission-role-test'",
    ).first<{ total: number }>()).toMatchObject({ total: 1 });
    expect(await env.DB.prepare(
      "SELECT scope_type FROM role_data_scopes WHERE role_id = 'role-created-user'",
    ).first<{ scope_type: string }>()).toMatchObject({ scope_type: "team" });
  });

  it("creates dictionary items and a complete space hierarchy", async () => {
    const dictionary = await request("POST", "/api/admin/dictionaries", {
      code: "qa_dictionary",
      name: "QA Dictionary",
    });
    const item = await request("POST", `/api/admin/dictionaries/${dictionary.body.data?.id}/items`, {
      code: "qa_item",
      name: "QA Item",
      value: "qa",
    });
    expect(item.status).toBe(201);

    const park = await request("POST", "/api/admin/parks", {
      code: "QA-PARK",
      name: "QA Park",
    });
    const building = await request("POST", "/api/admin/buildings", {
      parkId: park.body.data?.id,
      code: "QA-BUILDING",
      name: "QA Building",
    });
    const floor = await request("POST", "/api/admin/floors", {
      buildingId: building.body.data?.id,
      floorNo: "1",
      name: "QA Floor",
    });
    const space = await request("POST", "/api/spaces", {
      floorId: floor.body.data?.id,
      code: "QA-SPACE",
      name: "QA Space",
      area: 500,
      statusCode: "available",
    });
    expect(space.status).toBe(201);

    const hierarchy = await request("GET", "/api/admin/space-hierarchy");
    expect(hierarchy.status).toBe(200);
    expect(hierarchy.body.data?.floors).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: floor.body.data?.id })]),
    );
  });

  it("publishes active industry items and lets the administrator maintain them", async () => {
    const dictionary = await request("POST", "/api/admin/dictionaries", {
      code: "industry", name: "行业", category: "business",
    });
    const dictionaryId = dictionary.body.data?.id as string;
    const item = await request("POST", `/api/admin/dictionaries/${dictionaryId}/items`, {
      code: "robotics", name: "机器人", value: "robotics", sortOrder: 10,
    });
    const itemId = item.body.data?.id as string;

    const activeItems = await request("GET", "/api/dictionaries/industry/items");
    expect(activeItems.status).toBe(200);
    expect(activeItems.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: itemId, code: "robotics", name: "机器人" }),
    ]));

    const updated = await request("PUT", `/api/admin/dictionaries/${dictionaryId}/items/${itemId}`, {
      name: "智能机器人", value: "robotics", sortOrder: 5, status: "disabled",
    });
    expect(updated.status).toBe(200);
    expect((await request("GET", "/api/dictionaries/industry/items")).body.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: itemId }),
    ]));

    const removed = await request("DELETE", `/api/admin/dictionaries/${dictionaryId}/items/${itemId}`);
    expect(removed.status).toBe(200);
  });

  it("publishes only website-facing system settings", async () => {
    const saved = await request("PUT", "/api/admin/settings", [
      { key: "site_name", value: "Configured CRM" },
      { key: "login_text", value: "Configured login text" },
      { key: "internal_secret", value: "must-not-be-public" },
    ]);
    expect(saved.status).toBe(200);

    const publicSettings = await request("GET", "/api/settings/public");
    expect(publicSettings.status).toBe(200);
    expect(publicSettings.body.data).toMatchObject({
      site_name: "Configured CRM",
      login_text: "Configured login text",
    });
    expect(publicSettings.body.data).not.toHaveProperty("internal_secret");
  });

  it("lets the administrator save, publish, and reset registered UI copy", async () => {
    const saved = await request("PUT", "/api/admin/content", {
      overrides: { "clue.field.title": "项目名称" },
    });
    expect(saved.status).toBe(200);

    const publicCopy = await request("GET", "/api/content/public");
    expect(publicCopy.status).toBe(200);
    expect(publicCopy.body.data).toEqual({ "clue.field.title": "项目名称" });

    const invalid = await request("PUT", "/api/admin/content", {
      overrides: { "unknown.copy.key": "不应保存" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error?.code).toBe("INVALID_COPY_KEY");

    const reset = await request("DELETE", "/api/admin/content/clue.field.title");
    expect(reset.status).toBe(200);
    expect((await request("GET", "/api/content/public")).body.data).toEqual({});
  });
});

describe("operational workflows", () => {
  it("stores, downloads, and deletes a clue attachment", async () => {
    const now = "2026-06-22T00:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO companies (id, name, normalized_name, main_business, industry_code, status, created_at, created_by, updated_at, updated_by)
       VALUES ('attachment-company', 'Attachment Company', 'attachment company', 'Attachment', 'other', 'active', ?, 'admin-workflows', ?, 'admin-workflows')`,
    ).bind(now, now).run();
    await env.DB.prepare(
      `INSERT INTO clues (id, company_id, title, stage_code, owner_id, version, created_at, created_by, updated_at, updated_by)
       VALUES ('attachment-clue', 'attachment-company', 'Attachment clue', 'new', 'admin-workflows', 1, ?, 'admin-workflows', ?, 'admin-workflows')`,
    ).bind(now, now).run();
    const form = new FormData();
    form.set("file", new File(["attachment contents"], "note.txt", { type: "text/plain" }));
    const upload = await createApi().request("http://localhost/api/clues/attachment-clue/attachments", {
      method: "POST", headers: { cookie, "x-csrf-token": csrfToken }, body: form,
    }, env);
    expect(upload.status).toBe(201);
    const attachment = (await upload.json() as any).data;
    const download = await createApi().request(`http://localhost/api/attachments/${attachment.id}/download`, { headers: { cookie } }, env);
    expect(download.status).toBe(200);
    expect(await download.text()).toBe("attachment contents");
    const deleted = await request("DELETE", `/api/attachments/${attachment.id}`);
    expect(deleted.status).toBe(200);
    expect(await env.DB.prepare("SELECT deleted_at FROM attachments WHERE id = ?").bind(attachment.id).first()).toMatchObject({ deleted_at: expect.any(String) });
  });

  it("audits restoration of a supported deleted record", async () => {
    const now = "2026-06-22T00:00:00.000Z";
    await env.DB.prepare("UPDATE clues SET deleted_at = ?, deleted_by = ? WHERE id = 'attachment-clue'").bind(now, "admin-workflows").run();
    const restored = await request("POST", "/api/admin/deleted-records/clues/attachment-clue/restore", {});
    expect(restored.status).toBe(200);
    expect(await env.DB.prepare("SELECT action FROM audit_logs WHERE entity_id = 'attachment-clue' ORDER BY created_at DESC LIMIT 1").first()).toMatchObject({ action: "admin:record:restore" });
  });

  it("serves reports and import job lists", async () => {
    const reports = await request("GET", "/api/reports");
    expect(reports.status).toBe(200);
    expect(reports.body.data).toHaveProperty("stageDistribution");
    expect(reports.body.data).toHaveProperty("sourceDistribution");

    const imports = await request("GET", "/api/imports");
    expect(imports.status).toBe(200);
    expect(imports.body.data).toHaveProperty("items");
  });

  it("imports valid clue rows and records failed rows", async () => {
    const response = await request("POST", "/api/imports", {
      jobType: "clues",
      sourceFileName: "clues.csv",
      rows: [
        { title: "Imported clue", companyName: "Imported Company", sourceCode: "activity" },
        { title: "", companyName: "Missing title" },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      totalRows: 2,
      successRows: 1,
      failedRows: 1,
    });

    const imported = await env.DB.prepare(
      "SELECT title FROM clues WHERE title = 'Imported clue'",
    ).first<{ title: string }>();
    expect(imported?.title).toBe("Imported clue");
  });

  it("imports AI-normalized workbook leads with tags, followups, spaces, and matches", async () => {
    const response = await request("POST", "/api/imports", {
      jobType: "ai-xlsx",
      sourceFileName: "招商共享信息.xlsx",
      rows: [
        {
          title: "铜芯科技",
          companyName: "铜芯科技",
          mainBusiness: "芯片加工",
          industryCode: "integrated_circuit",
          sourceCode: "visit",
          desiredArea: 14500,
          stageCode: "site_visit",
          bottleneck: "用电",
          financingFlag: false,
          priorLocation: "昌平",
          tags: ["客户储备", "重点客户", "短期督办"],
          followupContent: "落实签约商务条件，环评能评用电设备等合规性，尽快推进签约。",
          matchedSpaceText: "铜芯科技",
        },
      ],
      spaces: [
        {
          projectName: "器械城一期",
          roomName: "5号楼A座-整栋",
          area: 3161.75,
          height: "首层4.5 标准层3.7",
          loadBearing: "首层400标准层200",
          deliveryStatus: "毛坯",
          propertyFee: "0.17元/平/天",
          negotiatingCustomer: "铜芯科技",
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      totalRows: 2,
      successRows: 2,
      failedRows: 0,
    });

    const clue = await env.DB.prepare(
      `SELECT c.id, c.title, c.stage_code, c.bottleneck, co.name AS company_name, co.industry_code
       FROM clues c JOIN companies co ON co.id = c.company_id
       WHERE co.name = '铜芯科技'`,
    ).first<any>();
    expect(clue).toMatchObject({
      title: "铜芯科技",
      stage_code: "site_visit",
      bottleneck: "用电",
      company_name: "铜芯科技",
      industry_code: "integrated_circuit",
    });

    const tags = await env.DB.prepare(
      `SELECT t.name FROM tags t JOIN clue_tags ct ON ct.tag_id = t.id WHERE ct.clue_id = ? ORDER BY t.name`,
    ).bind(clue?.id).all<{ name: string }>();
    expect(tags.results.map((tag) => tag.name)).toEqual(["客户储备", "短期督办", "重点客户"]);

    const followup = await env.DB.prepare(
      "SELECT content, bottleneck FROM followups WHERE clue_id = ? ORDER BY created_at DESC LIMIT 1",
    ).bind(clue?.id).first<{ content: string; bottleneck: string }>();
    expect(followup?.content).toContain("落实签约商务条件");
    expect(followup?.bottleneck).toBe("用电");

    const match = await env.DB.prepare(
      `SELECT s.name AS space_name, csm.match_reason
       FROM clue_space_matches csm JOIN spaces s ON s.id = csm.space_id
       WHERE csm.clue_id = ?`,
    ).bind(clue?.id).first<{ space_name: string; match_reason: string }>();
    expect(match).toMatchObject({
      space_name: "5号楼A座-整栋",
      match_reason: "AI/XLSX导入：在谈客户匹配",
    });
  });

  it("updates camelCase clue fields and requires a stage-change reason", async () => {
    const clue = await env.DB.prepare(
      "SELECT id, version FROM clues WHERE title = 'Imported clue'",
    ).first<{ id: string; version: number }>();

    const missingReason = await request("PUT", `/api/clues/${clue?.id}`, {
      version: clue?.version,
      stageCode: "filed",
    });
    expect(missingReason.status).toBe(400);
    expect(missingReason.body.error?.code).toBe("STAGE_REASON_REQUIRED");

    const updated = await request("PUT", `/api/clues/${clue?.id}`, {
      version: clue?.version,
      title: "Updated imported clue",
      desiredArea: 555,
      expectedTax: 42,
    });
    expect(updated.status).toBe(200);

    const stored = await env.DB.prepare(
      "SELECT title, desired_area, expected_tax FROM clues WHERE id = ?",
    ).bind(clue?.id).first<{ title: string; desired_area: number; expected_tax: number }>();
    expect(stored).toEqual({
      title: "Updated imported clue",
      desired_area: 555,
      expected_tax: 42,
    });
  });

  it("creates, approves, and downloads an export file", async () => {
    const created = await request("POST", "/api/export-requests", {
      reason: "Quarterly review",
      scope: { entity: "clues" },
    });
    expect(created.status).toBe(201);

    const approved = await request(
      "POST",
      `/api/export-requests/${created.body.data?.id}/approve`,
      {},
    );
    expect(approved.status).toBe(200);
    expect(approved.body.data?.status).toBe("ready");

    const download = await createApi().request(
      `http://localhost/api/export-requests/${created.body.data?.id}/download`,
      { headers: { cookie } },
      env,
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("text/csv");
    expect(download.headers.get("content-disposition")).toContain("cfzzs-clues-");
    expect(await download.text()).toContain("线索名称");
  });
});
