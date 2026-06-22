import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { createApi } from "../../server/app";
import { hashPassword } from "../../server/shared/crypto";

// Module-level seed tracking
let seeded = false;
let lockoutUserAdded = false;

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

  const { hash, salt, iterations } = await hashPassword("test-password");
  await db
    .prepare(
      "INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, department_id, status, is_super_admin, failed_login_count, password_changed_at, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind("test-user-id", "testuser", "testuser", "Test User", hash, salt, iterations, null, "active", 0, 0, "2026-06-21T00:00:00Z", "2026-06-21T00:00:00Z", "seed", "2026-06-21T00:00:00Z", "seed")
    .run();

  const { hash: dh, salt: ds, iterations: di } = await hashPassword("disabled-password");
  await db
    .prepare(
      "INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, department_id, status, is_super_admin, failed_login_count, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind("disabled-user-id", "disableduser", "disableduser", "Disabled User", dh, ds, di, null, "disabled", 0, 0, "2026-06-21T00:00:00Z", "seed", "2026-06-21T00:00:00Z", "seed")
    .run();
}

async function ensureLockoutUser() {
  if (lockoutUserAdded) return;
  lockoutUserAdded = true;
  const db = env.DB;
  const { hash, salt, iterations } = await hashPassword("lockout-test-pw");
  await db
    .prepare(
      "INSERT INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, department_id, status, is_super_admin, failed_login_count, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind("lockout-user-id", "lockoutuser", "lockoutuser", "Lockout User", hash, salt, iterations, null, "active", 0, 0, "2026-06-21T00:00:00Z", "seed", "2026-06-21T00:00:00Z", "seed")
    .run();
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

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await ensureSeeded();
  });

  it("returns a session cookie and CSRF token on successful login", async () => {
    const { status, headers, body } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "test-password" },
    });

    expect(status).toBe(200);
    expect(body).toHaveProperty("ok", true);
    expect(body.data).toHaveProperty("user.id", "test-user-id");
    expect(body.data).toHaveProperty("user.displayName", "Test User");
    expect(body.data).toHaveProperty("csrfToken");

    const setCookie = headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("returns a generic error for unknown user", async () => {
    const { status, body } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "nonexistent", password: "anything" },
    });

    expect(status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error!.message).toMatch(/账号|密码|account|password/i);
  });

  it("returns a generic error for wrong password", async () => {
    const { status, body } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "wrong-password" },
    });

    expect(status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error!.message).toMatch(/账号|密码|account|password/i);
  });

  it("rejects login for disabled accounts", async () => {
    const { status, body } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "disableduser", password: "disabled-password" },
    });

    expect(status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });

  it("locks the account after 5 failed attempts", async () => {
    await ensureLockoutUser();

    for (let i = 0; i < 5; i++) {
      await apiResponse("POST", "/api/auth/login", {
        body: { account: "lockoutuser", password: "wrong-attempt" },
      });
    }

    const { status, body } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "lockoutuser", password: "wrong-attempt" },
    });
    expect(status).toBe(423);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });

  it("does not include a stack trace in error responses", async () => {
    const { body } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "wrong" },
    });

    expect(body.error).not.toHaveProperty("stack");
  });

  it("returns 400 for missing fields", async () => {
    const { status, body } = await apiResponse("POST", "/api/auth/login", {
      body: {},
    });

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });
});

describe("GET /api/auth/session", () => {
  beforeAll(async () => {
    await ensureSeeded();
  });

  it("returns the current user session when authenticated", async () => {
    const loginResp = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "test-password" },
    });
    const cookie = loginResp.headers.get("set-cookie") || "";

    const { status, body } = await apiResponse("GET", "/api/auth/session", { cookie });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data!.user.id).toBe("test-user-id");
  });

  it("returns a usable CSRF token after session refresh", async () => {
    const loginResp = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "test-password" },
    });
    const refreshed = await apiResponse("GET", "/api/auth/session", {
      cookie: loginResp.headers.get("set-cookie") || "",
    });
    const logout = await apiResponse("POST", "/api/auth/logout", {
      cookie: loginResp.headers.get("set-cookie") || "",
      csrfToken: refreshed.body.data?.csrfToken,
    });
    expect(logout.status).toBe(200);
  });

  it("returns 401 when no session cookie is provided", async () => {
    const { status } = await apiResponse("GET", "/api/auth/session");
    expect(status).toBe(401);
  });

  it("returns 401 for an invalid session cookie", async () => {
    const { status } = await apiResponse("GET", "/api/auth/session", {
      cookie: "session=invalid-token-value",
    });
    expect(status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    await ensureSeeded();
    const response = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "test-password" },
    });
    sessionCookie = response.headers.get("set-cookie") || "";
    csrfToken = response.body.data!.csrfToken!;
  });

  it("invalidates the session on logout", async () => {
    const { status, body } = await apiResponse("POST", "/api/auth/logout", {
      cookie: sessionCookie,
      csrfToken,
    });

    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    // After logout, session should be invalid
    const sessionResp = await apiResponse("GET", "/api/auth/session", { cookie: sessionCookie });
    expect(sessionResp.status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  let sessionCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    await ensureSeeded();
    const response = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "test-password" },
    });
    sessionCookie = response.headers.get("set-cookie") || "";
    csrfToken = response.body.data!.csrfToken!;
  });

  it("changes password successfully", async () => {
    const { status, body } = await apiResponse("POST", "/api/auth/change-password", {
      cookie: sessionCookie,
      csrfToken,
      body: { currentPassword: "test-password", newPassword: "new-strong-password!" },
    });

    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    // Old password should no longer work
    const { status: oldStatus } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "test-password" },
    });
    expect(oldStatus).toBe(401);

    // New password works
    const { status: newStatus } = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "new-strong-password!" },
    });
    expect(newStatus).toBe(200);
  });

  it("rejects change with wrong current password", async () => {
    const loginResp = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "new-strong-password!" },
    });
    const cookie = loginResp.headers.get("set-cookie") || "";
    const token = loginResp.body.data?.csrfToken;

    const { status } = await apiResponse("POST", "/api/auth/change-password", {
      cookie,
      csrfToken: token,
      body: { currentPassword: "wrong-password", newPassword: "another-password" },
    });
    expect(status).toBe(401);
  });

  it("rejects change without CSRF token", async () => {
    // Login fresh to get a valid session
    const freshLogin = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "new-strong-password!" },
    });
    const freshCookie = freshLogin.headers.get("set-cookie") || "";

    const { status } = await apiResponse("POST", "/api/auth/change-password", {
      cookie: freshCookie,
      body: { currentPassword: "new-strong-password!", newPassword: "yet-another-password" },
    });
    expect(status).toBe(403);
  });
});

describe("CSRF protection on mutations", () => {
  beforeAll(async () => {
    await ensureSeeded();
  });

  it("rejects mutation with wrong CSRF token", async () => {
    const response = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "new-strong-password!" },
    });
    const cookie = response.headers.get("set-cookie") || "";

    const { status } = await apiResponse("POST", "/api/auth/logout", {
      cookie,
      csrfToken: "invalid-token",
    });
    expect(status).toBe(403);
  });

  it("rejects mutation without X-CSRF-Token header", async () => {
    const response = await apiResponse("POST", "/api/auth/login", {
      body: { account: "testuser", password: "new-strong-password!" },
    });
    const cookie = response.headers.get("set-cookie") || "";

    const { status } = await apiResponse("POST", "/api/auth/logout", {
      cookie,
    });
    expect(status).toBe(403);
  });
});
