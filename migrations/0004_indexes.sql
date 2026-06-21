CREATE UNIQUE INDEX companies_normalized_name_active_uq
  ON companies(normalized_name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_account_active_uq
  ON users(normalized_account)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_mobile_active_uq
  ON users(mobile)
  WHERE deleted_at IS NULL AND mobile IS NOT NULL;

CREATE UNIQUE INDEX users_email_active_uq
  ON users(email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX departments_code_active_uq
  ON departments(code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX roles_code_active_uq
  ON roles(code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX permissions_code_active_uq
  ON permissions(code)
  WHERE deleted_at IS NULL;

CREATE INDEX departments_parent_id_idx
  ON departments(parent_id);

CREATE INDEX permissions_parent_id_idx
  ON permissions(parent_id);

CREATE UNIQUE INDEX user_roles_user_id_role_id_uq
  ON user_roles(user_id, role_id);

CREATE INDEX user_roles_user_id_idx
  ON user_roles(user_id);

CREATE INDEX user_roles_role_id_idx
  ON user_roles(role_id);

CREATE UNIQUE INDEX role_permissions_role_id_permission_id_uq
  ON role_permissions(role_id, permission_id);

CREATE INDEX role_permissions_role_id_idx
  ON role_permissions(role_id);

CREATE INDEX role_permissions_permission_id_idx
  ON role_permissions(permission_id);

CREATE INDEX role_data_scopes_role_id_idx
  ON role_data_scopes(role_id);

CREATE UNIQUE INDEX sessions_session_hash_uq
  ON sessions(session_hash);

CREATE INDEX sessions_user_id_idx
  ON sessions(user_id);

CREATE INDEX login_logs_user_id_idx
  ON login_logs(user_id);

CREATE UNIQUE INDEX dictionaries_code_active_uq
  ON dictionaries(code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX dictionary_items_dictionary_id_code_active_uq
  ON dictionary_items(dictionary_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX dictionary_items_dictionary_id_idx
  ON dictionary_items(dictionary_id);

CREATE INDEX dictionary_items_parent_id_idx
  ON dictionary_items(parent_id);

CREATE UNIQUE INDEX system_settings_key_active_uq
  ON system_settings(setting_key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX parks_code_active_uq
  ON parks(code)
  WHERE deleted_at IS NULL;

CREATE INDEX buildings_park_id_idx
  ON buildings(park_id);

CREATE INDEX floors_building_id_idx
  ON floors(building_id);

CREATE INDEX spaces_floor_id_idx
  ON spaces(floor_id);

CREATE INDEX spaces_status_code_idx
  ON spaces(status_code);

CREATE UNIQUE INDEX contacts_mobile_idx
  ON contacts(mobile)
  WHERE deleted_at IS NULL AND mobile IS NOT NULL;

CREATE INDEX contacts_company_id_idx
  ON contacts(company_id);

CREATE INDEX clues_company_id_idx
  ON clues(company_id);

CREATE INDEX clues_owner_id_stage_code_idx
  ON clues(owner_id, stage_code)
  WHERE deleted_at IS NULL;

CREATE INDEX clues_stage_code_active_idx
  ON clues(stage_code)
  WHERE deleted_at IS NULL;

CREATE INDEX clues_source_code_acquired_at_idx
  ON clues(source_code, acquired_at)
  WHERE deleted_at IS NULL;

CREATE INDEX clues_updated_at_idx
  ON clues(updated_at)
  WHERE deleted_at IS NULL;

CREATE INDEX clues_owner_id_next_followup_at_idx
  ON clues(owner_id, next_followup_at)
  WHERE deleted_at IS NULL AND owner_id IS NOT NULL AND next_followup_at IS NOT NULL;

CREATE INDEX clues_department_id_idx
  ON clues(department_id);

CREATE INDEX clue_contacts_clue_id_idx
  ON clue_contacts(clue_id);

CREATE INDEX clue_contacts_contact_id_idx
  ON clue_contacts(contact_id);

CREATE UNIQUE INDEX clue_contacts_clue_id_contact_id_uq
  ON clue_contacts(clue_id, contact_id);

CREATE INDEX followups_clue_id_followup_at_idx
  ON followups(clue_id, followup_at)
  WHERE deleted_at IS NULL;

CREATE INDEX stage_histories_clue_id_idx
  ON stage_histories(clue_id);

CREATE UNIQUE INDEX tags_normalized_name_active_uq
  ON tags(normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX clue_tags_clue_id_idx
  ON clue_tags(clue_id);

CREATE INDEX clue_tags_tag_id_idx
  ON clue_tags(tag_id);

CREATE UNIQUE INDEX clue_tags_clue_id_tag_id_uq
  ON clue_tags(clue_id, tag_id);

CREATE INDEX clue_collaborators_clue_id_idx
  ON clue_collaborators(clue_id);

CREATE INDEX clue_collaborators_user_id_idx
  ON clue_collaborators(user_id);

CREATE UNIQUE INDEX clue_collaborators_clue_id_user_id_uq
  ON clue_collaborators(clue_id, user_id);

CREATE INDEX attachments_clue_id_idx
  ON attachments(clue_id);

CREATE INDEX attachments_followup_id_idx
  ON attachments(followup_id);

CREATE INDEX clue_space_matches_clue_id_idx
  ON clue_space_matches(clue_id);

CREATE INDEX clue_space_matches_space_id_idx
  ON clue_space_matches(space_id);

CREATE UNIQUE INDEX clue_space_matches_clue_id_space_id_uq
  ON clue_space_matches(clue_id, space_id);

CREATE INDEX clue_landings_clue_id_idx
  ON clue_landings(clue_id);

CREATE UNIQUE INDEX clue_landings_clue_id_uq
  ON clue_landings(clue_id);

CREATE INDEX notifications_recipient_id_idx
  ON notifications(recipient_id);

CREATE INDEX notifications_created_at_idx
  ON notifications(created_at);

CREATE INDEX import_jobs_requested_by_idx
  ON import_jobs(requested_by);

CREATE INDEX import_jobs_status_idx
  ON import_jobs(status);

CREATE INDEX import_job_rows_import_job_id_idx
  ON import_job_rows(import_job_id);

CREATE UNIQUE INDEX import_job_rows_import_job_id_row_number_uq
  ON import_job_rows(import_job_id, row_number);

CREATE INDEX export_requests_requested_by_idx
  ON export_requests(requested_by);

CREATE INDEX export_requests_status_idx
  ON export_requests(status);

CREATE INDEX export_files_export_request_id_idx
  ON export_files(export_request_id);

CREATE INDEX export_files_expires_at_idx
  ON export_files(expires_at);

CREATE INDEX audit_logs_created_at_idx
  ON audit_logs(created_at);

CREATE INDEX audit_logs_actor_id_idx
  ON audit_logs(actor_id);

CREATE INDEX backup_records_created_at_idx
  ON backup_records(created_at);
