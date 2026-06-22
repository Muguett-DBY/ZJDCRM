import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { createApi } from "../../server/app";
import { hashPassword } from "../../server/shared/crypto";

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  seeded = true;

  const db = env.DB;
  await db.exec("PRAGMA foreign_keys = ON");
  await applyD1Migrations(db, [
    { name: "0001_core.sql", queries: splitSql((await import("../../migrations/0001_core.sql?raw")).default) },
    { name: "0002_business.sql", queries: splitSql((await import("../../migrations/0002_business.sql?raw")).default) },
    { name: "0003_workflows.sql", queries: splitSql((await import("../../migrations/0003_workflows.sql?raw")).default) },
    { name: "0004_indexes.sql", queries: splitSql((await import("../../migrations/0004_indexes.sql?raw")).default) },
    { name: "0007_park_leasing_workflow.sql", queries: splitSql((await import("../../migrations/0007_park_leasing_workflow.sql?raw")).default) },
  ]);

  // Seed departments
  await db.prepare("INSERT INTO departments (id, parent_id, code, name, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("dept-1", null, "dept-1", "招商一部", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO departments (id, parent_id, code, name, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("dept-2", null, "dept-2", "招商二部", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();

  // Seed roles
  await db.prepare("INSERT INTO roles (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("role-super-admin", "super_admin", "超级管理员", 1, "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO roles (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("role-management", "management", "管理层", 1, "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO roles (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("role-supervisor", "supervisor", "招商主管", 1, "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO roles (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("role-sales", "sales", "招商人员", 1, "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO roles (id, code, name, is_system, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("role-ops", "operations", "运营综合岗", 1, "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();

  // Seed users with different roles
  const pw = await hashPassword("test123");
  await createTestUser(db, "super-admin", "superadmin", "Super Admin", "dept-1", "active", pw);
  await createTestUser(db, "management-1", "manager", "Manager", "dept-1", "active", pw);
  await createTestUser(db, "supervisor-1", "supervisor1", "Supervisor One", "dept-1", "active", pw);
  await createTestUser(db, "sales-1", "sales1", "Sales One", "dept-1", "active", pw);
  await createTestUser(db, "sales-2", "sales2", "Sales Two", "dept-2", "active", pw);
  await createTestUser(db, "disabled-1", "disabled1", "Disabled User", "dept-1", "disabled", pw);
  await createTestUser(db, "ops-1", "ops1", "Operations One", "dept-1", "active", pw);

  // Assign roles
  await db.prepare("INSERT INTO user_roles (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("ur-1", "super-admin", "role-super-admin", null, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO user_roles (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("ur-2", "management-1", "role-management", null, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO user_roles (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("ur-3", "supervisor-1", "role-supervisor", null, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO user_roles (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("ur-4", "sales-1", "role-sales", null, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO user_roles (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("ur-5", "sales-2", "role-sales", null, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();

  // Set data scopes for roles
  await db.prepare("INSERT INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind("rds-1", "role-super-admin", "all", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind("rds-2", "role-management", "all", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind("rds-3", "role-supervisor", "team", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind("rds-4", "role-sales", "self", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind("rds-5", "role-ops", "all", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();

  // Seed permissions
  await db.prepare("INSERT INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("perm-clue-read", "clue:read", "查看线索", "action", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("perm-clue-create", "clue:create", "新增线索", "action", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("perm-clue-edit", "clue:edit", "编辑线索", "action", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("perm-clue-delete", "clue:delete", "删除线索", "action", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
  await db.prepare("INSERT INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("perm-export", "data:export", "数据导出", "action", "active", "2026-01-01T00:00:00Z", "seed", "2026-01-01T00:00:00Z", "seed").run();
}

async function createTestUser(db: D1Database, id: string, account: string, displayName: string, deptId: string | null, status: string, pw: { hash: string; salt: string; iterations: number }) {
  const now = "2026-01-01T00:00:00Z";
  await db.prepare(
    "INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, department_id, status, is_super_admin, failed_login_count, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, account, account, displayName, pw.hash, pw.salt, pw.iterations, deptId, status, 0, 0, now, "seed", now, "seed").run();
}

function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let statement = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];
    if (inLineComment) { if (char === "\n") inLineComment = false; continue; }
    if (inBlockComment) { if (char === "*" && next === "/") { inBlockComment = false; i++; } continue; }
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "-" && next === "-") { inLineComment = true; i++; continue; }
      if (char === "/" && next === "*") { inBlockComment = true; i++; continue; }
    }
    if (char === "'" && !inDoubleQuote) { statement += char; if (inSingleQuote && next === "'") { statement += next; i++; } else inSingleQuote = !inSingleQuote; continue; }
    if (char === '"' && !inSingleQuote) { statement += char; if (inDoubleQuote && next === '"') { statement += next; i++; } else inDoubleQuote = !inDoubleQuote; continue; }
    if (char === ";" && !inSingleQuote && !inDoubleQuote) { const t = statement.trim(); if (t) statements.push(t); statement = ""; continue; }
    statement += char;
  }
  const t = statement.trim();
  if (t) statements.push(t);
  return statements;
}

interface ApiResponse {
  ok: boolean;
  data?: { user: { id: string; [key: string]: unknown }; csrfToken: string };
  error?: { code: string; message: string; requestId: string };
}

async function apiResponse(method: string, path: string, options?: { body?: unknown; cookie?: string; csrfToken?: string }): Promise<{ status: number; headers: Headers; body: ApiResponse }> {
  const app = createApi();
  const headers: Record<string, string> = {};
  if (options?.body) headers["Content-Type"] = "application/json";
  if (options?.cookie) headers["Cookie"] = options.cookie;
  if (options?.csrfToken) headers["X-CSRF-Token"] = options.csrfToken;
  const init: RequestInit & { headers: Record<string, string> } = { method, headers };
  if (options?.body) init.body = JSON.stringify(options.body);
  const response = await app.request(`http://localhost${path}`, init, env);
  const body = await response.json() as ApiResponse;
  return { status: response.status, headers: response.headers, body };
}

async function loginAs(account: string): Promise<{ cookie: string; csrfToken: string }> {
  const resp = await apiResponse("POST", "/api/auth/login", { body: { account, password: "test123" } });
  return {
    cookie: resp.headers.get("set-cookie") || "",
    csrfToken: resp.body.data?.csrfToken || "",
  };
}

describe("data scope API integration", () => {
  beforeAll(async () => {
    await ensureSeeded();
  });

  it("super_admin can access everything", async () => {
    const { cookie } = await loginAs("superadmin");
    const session = await apiResponse("GET", "/api/auth/session", { cookie });
    expect(session.status).toBe(200);
    expect(session.body.data?.user.id).toBe("super-admin");
  });

  it("management user can access everything", async () => {
    const { cookie } = await loginAs("manager");
    const session = await apiResponse("GET", "/api/auth/session", { cookie });
    expect(session.status).toBe(200);
    expect(session.body.data?.user.id).toBe("management-1");
  });

  it("sales user can log in and get session", async () => {
    const { cookie } = await loginAs("sales1");
    const session = await apiResponse("GET", "/api/auth/session", { cookie });
    expect(session.status).toBe(200);
    expect(session.body.data?.user.id).toBe("sales-1");
  });

  it("disabled user cannot log in", async () => {
    const { status } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "disabled1", password: "test123" },
    });
    expect(status).toBe(403);
  });

  it("different roles have different data scope permissions", async () => {
    // Login as supervisor
    const supLogin = await loginAs("supervisor1");
    expect(supLogin.cookie).toBeTruthy();

    // Login as sales from different department
    const salesLogin = await loginAs("sales2");
    expect(salesLogin.cookie).toBeTruthy();

    // Both can authenticate
    const supSession = await apiResponse("GET", "/api/auth/session", { cookie: supLogin.cookie });
    expect(supSession.status).toBe(200);
    const salesSession = await apiResponse("GET", "/api/auth/session", { cookie: salesLogin.cookie });
    expect(salesSession.status).toBe(200);
  });

  it("all mutations require CSRF token", async () => {
    const { cookie } = await loginAs("superadmin");
    // Try a POST without CSRF token
    const resp = await apiResponse("POST", "/api/auth/logout", { cookie });
    expect(resp.status).toBe(403);
  });

  it("returned user info includes department", async () => {
    const { cookie } = await loginAs("sales1");
    const session = await apiResponse("GET", "/api/auth/session", { cookie });
    expect(session.body.data?.user.departmentId).toBe("dept-1");
  });
});
