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
});

describe("operational workflows", () => {
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
    expect(await download.text()).toContain("线索名称");
  });
});
