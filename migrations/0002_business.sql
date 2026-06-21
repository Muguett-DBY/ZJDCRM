CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  main_business TEXT NOT NULL,
  industry_code TEXT NOT NULL,
  unified_social_credit_code TEXT,
  legal_representative TEXT,
  registered_capital TEXT,
  registered_address TEXT,
  contact_name TEXT,
  contact_mobile TEXT,
  website TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE parks (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  status_code TEXT NOT NULL,
  notes TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE buildings (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES parks(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  total_area REAL,
  total_floors INTEGER NOT NULL DEFAULT 0 CHECK (total_floors >= 0),
  status_code TEXT NOT NULL,
  notes TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  floor_no TEXT NOT NULL,
  name TEXT NOT NULL,
  area REAL,
  status_code TEXT NOT NULL,
  notes TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  area REAL NOT NULL CHECK (area >= 0),
  available_area REAL NOT NULL DEFAULT 0 CHECK (available_area >= 0),
  status_code TEXT NOT NULL,
  expected_release_at TEXT,
  notes TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE clues (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  desired_area REAL,
  acquired_at TEXT,
  expected_landing_at TEXT,
  stage_code TEXT NOT NULL,
  bottleneck TEXT,
  source_code TEXT,
  source_detail TEXT,
  internal_referral_flag INTEGER NOT NULL DEFAULT 0 CHECK (internal_referral_flag IN (0, 1)),
  financing_flag INTEGER NOT NULL DEFAULT 0 CHECK (financing_flag IN (0, 1)),
  prior_location TEXT,
  lost_reason TEXT,
  fiscal_completion TEXT,
  expected_output NUMERIC,
  expected_tax NUMERIC,
  owner_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  department_id TEXT REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  actual_space_id TEXT REFERENCES spaces(id) ON UPDATE CASCADE ON DELETE SET NULL,
  actual_area REAL,
  actual_landing_at TEXT,
  actual_fiscal_completion TEXT,
  actual_output NUMERIC,
  actual_tax NUMERIC,
  next_followup_at TEXT,
  last_followup_at TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  landline TEXT,
  email TEXT,
  title TEXT,
  department_name TEXT,
  is_primary_decision_maker INTEGER NOT NULL DEFAULT 0 CHECK (is_primary_decision_maker IN (0, 1)),
  notes TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE clue_contacts (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  relation_type TEXT NOT NULL DEFAULT 'contact',
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE followups (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  contact_id TEXT REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE SET NULL,
  owner_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  method_code TEXT NOT NULL,
  followup_at TEXT NOT NULL,
  content TEXT NOT NULL,
  customer_feedback TEXT,
  bottleneck TEXT,
  next_action TEXT,
  next_followup_at TEXT,
  new_stage_code TEXT,
  stage_reason TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE stage_histories (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  from_stage_code TEXT NOT NULL,
  to_stage_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  followup_id TEXT REFERENCES followups(id) ON UPDATE CASCADE ON DELETE SET NULL,
  changed_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  changed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  color TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE clue_tags (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE clue_collaborators (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('read', 'write')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  clue_id TEXT REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  followup_id TEXT REFERENCES followups(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  storage_key TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  sha256 TEXT,
  uploaded_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  CHECK (
    (CASE WHEN clue_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN followup_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE clue_space_matches (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  match_rank INTEGER NOT NULL DEFAULT 1 CHECK (match_rank >= 1),
  match_reason TEXT,
  matched_area REAL,
  score NUMERIC,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE TABLE clue_landings (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  landed_area REAL NOT NULL CHECK (landed_area >= 0),
  landed_at TEXT NOT NULL,
  fiscal_completion TEXT NOT NULL,
  landed_output NUMERIC,
  landed_tax NUMERIC,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
