import * as repo from "./access.repository";
import type { AccessContext, ClueAccessFilter, DataScope, DataScopeType } from "./access.types";

/**
 * Build the full access context for a user by loading roles, permissions, and data scopes.
 */
export async function buildAccessContext(db: D1Database, userId: string): Promise<AccessContext> {
  const isSuperAdmin = await repo.isSuperAdmin(db, userId);
  const departmentId = await repo.getUserDepartmentId(db, userId);
  const roleRows = await repo.getUserRoles(db, userId);
  const permRows = await repo.getUserPermissions(db, userId);
  const scopeRows = await repo.getUserDataScopes(db, userId);

  const roleCodes = roleRows.map((r) => r.role_code);
  const permissions = new Set(permRows.map((p) => p.code));

  // Super admin gets wildcard
  if (isSuperAdmin) {
    permissions.add("*");
  }

  const dataScopes: DataScope[] = scopeRows.map((s) => ({
    type: s.scope_type as DataScopeType,
    departmentIds: s.department_id ? [s.department_id] : (s.scope_value ? s.scope_value.split(",") : []),
  }));

  return {
    userId,
    departmentId,
    roleCodes,
    permissions,
    dataScopes,
  };
}

/**
 * Check if the access context has a specific permission code.
 */
export function hasPermission(access: AccessContext, code: string): boolean {
  return access.permissions.has("*") || access.permissions.has(code);
}

/**
 * Require a specific permission code.
 * Throws a structured error object if not granted.
 */
export function requirePermission(access: AccessContext, code: string): void {
  if (!hasPermission(access, code)) {
    throw { status: 403, code: "FORBIDDEN", message: "没有操作权限" };
  }
}

/**
 * Build a SQL WHERE fragment for filtering clues by data scope.
 * Returns { sql: string, params: unknown[] } for use in parameterized queries.
 */
export function buildClueScopeFilter(access: AccessContext, ownerAlias = "c.owner_id", deptAlias = "c.department_id"): ClueAccessFilter {
  // Super admin / ALL scope: no filter
  if (access.permissions.has("*") || access.dataScopes.some((s) => s.type === "all")) {
    return { sql: "", params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const scope of access.dataScopes) {
    switch (scope.type) {
      case "self":
        conditions.push(`${ownerAlias} = ?`);
        params.push(access.userId);
        break;
      case "team":
        if (access.departmentId) {
          conditions.push(`${deptAlias} = ?`);
          params.push(access.departmentId);
        }
        break;
      case "department":
      case "custom":
        for (const deptId of scope.departmentIds) {
          if (deptId) {
            conditions.push(`${deptAlias} = ?`);
            params.push(deptId);
          }
        }
        break;
    }
  }

  if (conditions.length === 0) {
    // No access — return impossible condition
    return { sql: "1 = 0", params: [] };
  }

  return {
    sql: `(${conditions.join(" OR ")})`,
    params,
  };
}

/**
 * Assert that the user has access to a specific clue record.
 * Checks data scope AND collaboration permissions.
 * Throws structured error if denied.
 */
export async function assertClueAccess(
  db: D1Database,
  access: AccessContext,
  clueId: string,
  mode: "read" | "write" | "owner",
): Promise<void> {
  // Super admin: always allowed
  if (access.permissions.has("*")) return;

  // Load the clue
  const clue = await db
    .prepare("SELECT id, owner_id, department_id, deleted_at FROM clues WHERE id = ?")
    .bind(clueId)
    .first<{ id: string; owner_id: string; department_id: string | null; deleted_at: string | null }>();

  if (!clue || clue.deleted_at) {
    throw { status: 404, code: "NOT_FOUND", message: "线索不存在" };
  }

  // Check data scope
  const filter = buildClueScopeFilter(access, "owner_id", "department_id");
  if (filter.sql) {
    const checkSql = `SELECT id FROM clues WHERE id = ? AND ${filter.sql}`;
    const result = await db.prepare(checkSql).bind(clueId, ...filter.params).first<{ id: string }>();
    if (!result) {
      throw { status: 404, code: "NOT_FOUND", message: "线索不存在" };
    }
  }

  // For write/owner mode, check if user is the owner or a collaborator with write permission
  if (mode === "write" || mode === "owner") {
    if (clue.owner_id === access.userId) return;

    // Check collaboration permissions
    const collab = await db
      .prepare("SELECT id, permission_level FROM clue_collaborators WHERE clue_id = ? AND user_id = ?")
      .bind(clueId, access.userId)
      .first<{ id: string; permission_level: string }>();

    if (collab?.permission_level === "write") return;

    if (mode === "owner") {
      throw { status: 403, code: "FORBIDDEN", message: "不是线索负责人" };
    }
    throw { status: 403, code: "FORBIDDEN", message: "没有编辑权限" };
  }
}

/**
 * Get accessible clue IDs for a user (efficient bulk check).
 */
export async function getAccessibleClueIds(
  db: D1Database,
  access: AccessContext,
): Promise<string[]> {
  const filter = buildClueScopeFilter(access);
  if (!filter.sql) {
    // All access
    const rows = await db.prepare("SELECT id FROM clues WHERE deleted_at IS NULL").all<{ id: string }>();
    return rows.results.map((r) => r.id);
  }

  const query = `SELECT id FROM clues WHERE deleted_at IS NULL AND ${filter.sql}`;
  const rows = await db.prepare(query).bind(...filter.params).all<{ id: string }>();
  return rows.results.map((r) => r.id);
}
