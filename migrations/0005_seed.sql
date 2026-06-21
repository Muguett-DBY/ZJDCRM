-- ZJDCRM Production Seed Data
-- Admin password: admin123456 (PBKDF2-SHA-256 hashed below)
-- Run with: npx wrangler d1 execute zjdcrm-db --remote --file migrations/0005_seed.sql

-- ===== 1. System User (for FK references) =====
INSERT OR IGNORE INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, status, is_super_admin, failed_login_count, created_at, created_by, updated_at, updated_by)
VALUES ('system', 'system', 'system', '系统', '', '', 1, 'active', 0, 0, '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 2. Admin User =====
INSERT OR IGNORE INTO users (id, account, normalized_account, display_name, password_hash, password_salt, password_iterations, status, is_super_admin, failed_login_count, created_at, created_by, updated_at, updated_by)
VALUES ('admin-001', 'admin', 'admin', '系统管理员', '5iFc2aYLmoLttAFJVl9YmsLkK59Bf2NF/4P09c6ntkQ=', 'QpJee0OYkF5KE84z/bsgYw==', 310000, 'active', 1, 0, '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 2. Default Department =====
INSERT OR IGNORE INTO departments (id, parent_id, code, name, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('dept-admin', NULL, 'admin', '管理部', 0, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO departments (id, parent_id, code, name, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('dept-investment', NULL, 'investment', '招商部', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO departments (id, parent_id, code, name, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('dept-ops', NULL, 'operations', '运营部', 2, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 3. Default Roles =====
INSERT OR IGNORE INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by)
VALUES ('role-super-admin', 'super_admin', '超级管理员', '全部数据与系统配置', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by)
VALUES ('role-management', 'management', '管理层', '全部招商数据、看板、报表和导出审批', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by)
VALUES ('role-supervisor', 'supervisor', '招商主管', '本团队数据、线索分配、转移', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by)
VALUES ('role-sales', 'sales', '招商人员', '本人负责数据、新增线索、跟进', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO roles (id, code, name, description, is_system, status, created_at, created_by, updated_at, updated_by)
VALUES ('role-ops', 'operations', '运营/综合岗', '授权范围数据维护、空间维护、导入、报表', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 4. Data Scopes =====
INSERT OR IGNORE INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by)
VALUES ('rds-super-admin', 'role-super-admin', 'all', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by)
VALUES ('rds-management', 'role-management', 'all', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by)
VALUES ('rds-supervisor', 'role-supervisor', 'team', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by)
VALUES ('rds-sales', 'role-sales', 'self', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO role_data_scopes (id, role_id, scope_type, created_at, created_by, updated_at, updated_by)
VALUES ('rds-ops', 'role-ops', 'all', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 5. Permissions =====
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-clue-read', 'clue:read', '查看线索', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-clue-create', 'clue:create', '新增线索', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-clue-edit', 'clue:edit', '编辑线索', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-clue-delete', 'clue:delete', '删除线索', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-clue-assign', 'clue:assign', '分配线索', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-data-import', 'data:import', '数据导入', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-data-export', 'data:export', '数据导出', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-export-approve', 'export:approve', '导出审批', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO permissions (id, code, name, permission_type, status, created_at, created_by, updated_at, updated_by)
VALUES ('perm-admin-access', 'system:admin:access', '管理后台访问', 'action', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 6. Role-Permission Assignments =====
-- Super admin gets all
INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
SELECT 'rp-super-' || p.id, 'role-super-admin', p.id, 'system', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system' FROM permissions p;
-- Management gets: read, export, approve
INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
SELECT 'rp-mgmt-' || p.id, 'role-management', p.id, 'system', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system' FROM permissions p WHERE p.code IN ('clue:read', 'data:export', 'export:approve');
-- Supervisor gets: read, create, edit, assign
INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
SELECT 'rp-sup-' || p.id, 'role-supervisor', p.id, 'system', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system' FROM permissions p WHERE p.code IN ('clue:read', 'clue:create', 'clue:edit', 'clue:assign');
-- Sales gets: read, create, edit
INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
SELECT 'rp-sls-' || p.id, 'role-sales', p.id, 'system', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system' FROM permissions p WHERE p.code IN ('clue:read', 'clue:create', 'clue:edit');
-- Ops gets: read, create, edit, import, export
INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
SELECT 'rp-ops-' || p.id, 'role-ops', p.id, 'system', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system' FROM permissions p WHERE p.code IN ('clue:read', 'clue:create', 'clue:edit', 'data:import', 'data:export');

-- ===== 7. Admin User Role Assignment =====
INSERT OR IGNORE INTO user_roles (id, user_id, role_id, granted_by, granted_at, created_at, created_by, updated_at, updated_by)
VALUES ('ur-admin-super', 'admin-001', 'role-super-admin', 'system', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 8. Default Dictionary: Stages =====
INSERT OR IGNORE INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by)
VALUES ('dict-stage', 'stage', '招商阶段', 'business', '招商线索阶段定义', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-1', 'dict-stage', 'new', '新线索', 'new', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-2', 'dict-stage', 'filed', '已建档', 'filed', 2, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-3', 'dict-stage', 'initial_contact', '初步接触', 'initial_contact', 3, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-4', 'dict-stage', 'needs_confirmed', '需求确认', 'needs_confirmed', 4, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-5', 'dict-stage', 'key_followup', '重点跟进', 'key_followup', 5, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-6', 'dict-stage', 'site_visit', '考察洽谈', 'site_visit', 6, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-7', 'dict-stage', 'intent_confirmed', '意向确认', 'intent_confirmed', 7, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-8', 'dict-stage', 'contract_pending', '签约推进', 'contract_pending', 8, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-9', 'dict-stage', 'signed', '已签约', 'signed', 9, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-10', 'dict-stage', 'landed', '已注册/已落地', 'landed', 10, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-stage-11', 'dict-stage', 'lost', '暂缓/流失', 'lost', 11, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 9. Default Dictionary: Channels =====
INSERT OR IGNORE INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by)
VALUES ('dict-source', 'source', '渠道来源', 'business', '招商线索来源', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-src-1', 'dict-source', 'activity', '活动', 'activity', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-src-2', 'dict-source', 'referral', '渠道推荐', 'referral', 2, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-src-3', 'dict-source', 'gov', '政府推荐', 'gov', 3, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-src-4', 'dict-source', 'visit', '拜访', 'visit', 4, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-src-5', 'dict-source', 'internal', '内部转介', 'internal', 5, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 10. Default Dictionary: Space Status =====
INSERT OR IGNORE INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by)
VALUES ('dict-space-status', 'space_status', '空间状态', 'business', '空间资源状态', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-ss-1', 'dict-space-status', 'available', '可招商', 'available', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-ss-2', 'dict-space-status', 'negotiating', '洽谈中', 'negotiating', 2, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-ss-3', 'dict-space-status', 'signed', '已签约', 'signed', 3, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-ss-4', 'dict-space-status', 'occupied', '已入驻', 'occupied', 4, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');

-- ===== 11. Default Dictionary: Followup Methods =====
INSERT OR IGNORE INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by)
VALUES ('dict-followup-method', 'followup_method', '跟进方式', 'business', '跟进记录方式', 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-fm-1', 'dict-followup-method', 'phone', '电话', 'phone', 1, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-fm-2', 'dict-followup-method', 'wechat', '微信', 'wechat', 2, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-fm-3', 'dict-followup-method', 'visit', '拜访', 'visit', 3, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-fm-4', 'dict-followup-method', 'meeting', '会议', 'meeting', 4, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES ('di-fm-5', 'dict-followup-method', 'email', '邮件', 'email', 5, 'active', '2026-06-21T00:00:00Z', 'system', '2026-06-21T00:00:00Z', 'system');
