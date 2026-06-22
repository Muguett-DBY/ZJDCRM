-- Park leasing workflow: inventory remains authoritative and contracts are approved before stock changes.

ALTER TABLE spaces ADD COLUMN locked_area REAL NOT NULL DEFAULT 0 CHECK (locked_area >= 0);
ALTER TABLE spaces ADD COLUMN effective_reserve_target INTEGER NOT NULL DEFAULT 0 CHECK (effective_reserve_target >= 0);
ALTER TABLE spaces ADD COLUMN physical_status_code TEXT NOT NULL DEFAULT 'active';

ALTER TABLE clues ADD COLUMN source_status TEXT NOT NULL DEFAULT 'pending_completion';
ALTER TABLE clues ADD COLUMN current_customer_need TEXT;
ALTER TABLE clues ADD COLUMN current_customer_pain TEXT;

ALTER TABLE followups ADD COLUMN customer_need TEXT;
ALTER TABLE followups ADD COLUMN customer_pain TEXT;
ALTER TABLE followups ADD COLUMN counts_as_visit INTEGER NOT NULL DEFAULT 0 CHECK (counts_as_visit IN (0, 1));
ALTER TABLE followups ADD COLUMN counts_as_tour INTEGER NOT NULL DEFAULT 0 CHECK (counts_as_tour IN (0, 1));

ALTER TABLE clue_space_matches ADD COLUMN status_code TEXT NOT NULL DEFAULT 'candidate';

CREATE TABLE space_target_histories (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  effective_reserve_target INTEGER NOT NULL CHECK (effective_reserve_target >= 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE park_operator_assignments (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES parks(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(park_id, user_id)
);

CREATE TABLE contract_requests (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status_code TEXT NOT NULL CHECK (status_code IN ('pending', 'approved', 'rejected', 'cancelled')),
  submitted_by TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  submitted_at TEXT NOT NULL,
  decided_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  decided_at TEXT,
  decision_reason TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE contract_request_allocations (
  id TEXT PRIMARY KEY,
  contract_request_id TEXT NOT NULL REFERENCES contract_requests(id) ON UPDATE CASCADE ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  signed_area REAL NOT NULL CHECK (signed_area > 0),
  rent_per_sqm_day REAL NOT NULL CHECK (rent_per_sqm_day >= 0),
  property_fee_per_sqm_day REAL NOT NULL CHECK (property_fee_per_sqm_day >= 0),
  contract_start_at TEXT NOT NULL,
  contract_end_at TEXT NOT NULL,
  rent_free_days INTEGER,
  contract_attachment_id TEXT REFERENCES attachments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  lock_entire_space INTEGER NOT NULL DEFAULT 0 CHECK (lock_entire_space IN (0, 1)),
  soft_locked_area REAL NOT NULL CHECK (soft_locked_area >= 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE space_allocations (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  contract_request_id TEXT REFERENCES contract_requests(id) ON UPDATE CASCADE ON DELETE SET NULL,
  signed_area REAL NOT NULL CHECK (signed_area > 0),
  locked_remainder_area REAL NOT NULL DEFAULT 0 CHECK (locked_remainder_area >= 0),
  rent_per_sqm_day REAL NOT NULL CHECK (rent_per_sqm_day >= 0),
  property_fee_per_sqm_day REAL NOT NULL CHECK (property_fee_per_sqm_day >= 0),
  contract_start_at TEXT NOT NULL,
  contract_end_at TEXT NOT NULL,
  rent_free_days INTEGER,
  contract_attachment_id TEXT REFERENCES attachments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status_code TEXT NOT NULL DEFAULT 'active' CHECK (status_code IN ('active', 'released', 'terminated')),
  confirmed_at TEXT NOT NULL,
  confirmed_by TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  released_at TEXT,
  release_reason TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE team_kpi_targets (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  metric_code TEXT NOT NULL,
  target_value REAL NOT NULL CHECK (target_value >= 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE(department_id, start_date, end_date, metric_code)
);

CREATE TABLE followup_attachment_links (
  id TEXT PRIMARY KEY,
  followup_id TEXT NOT NULL REFERENCES followups(id) ON UPDATE CASCADE ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE(followup_id, attachment_id)
);

CREATE INDEX idx_contract_requests_clue_status ON contract_requests(clue_id, status_code);
CREATE INDEX idx_contract_request_allocations_request ON contract_request_allocations(contract_request_id);
CREATE INDEX idx_space_allocations_space_status ON space_allocations(space_id, status_code);
CREATE INDEX idx_followups_milestones ON followups(clue_id, counts_as_visit, counts_as_tour, followup_at);
CREATE INDEX idx_clue_space_matches_status ON clue_space_matches(space_id, status_code);

-- Existing source values remain visible but must be reclassified before KPI inclusion.
UPDATE clues
SET source_status = CASE
  WHEN source_code IN ('crm_stock', 'company_new_entity', 'government_task', 'kejinf_referral', 'other_referral', 'self_developed') THEN 'complete'
  WHEN source_code IS NULL OR source_code = '' THEN 'pending_completion'
  ELSE 'pending_completion'
END;

INSERT OR IGNORE INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by)
VALUES ('dict-source-v2', 'lead_source', '招商渠道', 'business', '用于招商KPI归类的必填渠道', 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system');

INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES
  ('di-lead-source-1', 'dict-source-v2', 'crm_stock', 'CRM存量', 'crm_stock', 1, 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system'),
  ('di-lead-source-2', 'dict-source-v2', 'company_new_entity', '公司自有资源（新主体）', 'company_new_entity', 2, 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system'),
  ('di-lead-source-3', 'dict-source-v2', 'government_task', '政府领导任务', 'government_task', 3, 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system'),
  ('di-lead-source-4', 'dict-source-v2', 'kejinf_referral', '科金转介', 'kejinf_referral', 4, 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system'),
  ('di-lead-source-5', 'dict-source-v2', 'other_referral', '其他转介', 'other_referral', 5, 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system'),
  ('di-lead-source-6', 'dict-source-v2', 'self_developed', '自拓', 'self_developed', 6, 'active', '2026-06-23T00:00:00Z', 'system', '2026-06-23T00:00:00Z', 'system');
