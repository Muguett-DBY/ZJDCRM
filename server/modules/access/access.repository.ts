import { queryAll, queryOne } from "../../shared/db";

export interface UserRoleRow {
  role_code: string;
}

export interface PermissionRow {
  code: string;
}

export interface DataScopeRow {
  scope_type: string;
  department_id: string | null;
  scope_value: string | null;
}

export async function getUserRoles(db: D1Database, userId: string): Promise<UserRoleRow[]> {
  return queryAll<UserRoleRow>(
    db,
    `SELECT r.code AS role_code
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ? AND ur.deleted_at IS NULL AND r.status = 'active' AND r.deleted_at IS NULL`,
    userId,
  );
}

export async function getUserPermissions(db: D1Database, userId: string): Promise<PermissionRow[]> {
  return queryAll<PermissionRow>(
    db,
    `SELECT DISTINCT p.code
     FROM user_roles ur
     JOIN role_permissions rp ON ur.role_id = rp.role_id
     JOIN permissions p ON rp.permission_id = p.id
     WHERE ur.user_id = ? AND ur.deleted_at IS NULL
       AND rp.deleted_at IS NULL AND p.status = 'active' AND p.deleted_at IS NULL`,
    userId,
  );
}

export async function getUserDataScopes(db: D1Database, userId: string): Promise<DataScopeRow[]> {
  return queryAll<DataScopeRow>(
    db,
    `SELECT DISTINCT rds.scope_type, rds.department_id, rds.scope_value
     FROM user_roles ur
     JOIN role_data_scopes rds ON ur.role_id = rds.role_id
     WHERE ur.user_id = ? AND ur.deleted_at IS NULL`,
    userId,
  );
}

export async function getUserDepartmentId(db: D1Database, userId: string): Promise<string | null> {
  const user = await queryOne<{ department_id: string | null }>(
    db,
    `SELECT department_id FROM users WHERE id = ? AND deleted_at IS NULL`,
    userId,
  );
  return user?.department_id ?? null;
}

export async function isSuperAdmin(db: D1Database, userId: string): Promise<boolean> {
  const user = await queryOne<{ is_super_admin: number }>(
    db,
    `SELECT is_super_admin FROM users WHERE id = ? AND deleted_at IS NULL`,
    userId,
  );
  return user?.is_super_admin === 1;
}

export async function getTeamUserIds(db: D1Database, departmentId: string): Promise<string[]> {
  const users = await queryAll<{ id: string }>(
    db,
    `SELECT id FROM users WHERE department_id = ? AND status = 'active' AND deleted_at IS NULL`,
    departmentId,
  );
  return users.map((u) => u.id);
}
