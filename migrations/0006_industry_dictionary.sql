-- Default dictionary for the industry selector on clue forms.
INSERT OR IGNORE INTO dictionaries (id, code, name, category, description, status, created_at, created_by, updated_at, updated_by)
VALUES ('dict-industry', 'industry', '行业', 'business', '招商企业所属行业', 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system');

INSERT OR IGNORE INTO dictionary_items (id, dictionary_id, code, name, value, sort_order, status, created_at, created_by, updated_at, updated_by)
VALUES
  ('di-industry-1', 'dict-industry', 'medical_devices', '医疗器械', 'medical_devices', 1, 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system'),
  ('di-industry-2', 'dict-industry', 'pharma', '医药健康', 'pharma', 2, 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system'),
  ('di-industry-3', 'dict-industry', 'ai', 'AI/人工智能', 'ai', 3, 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system'),
  ('di-industry-4', 'dict-industry', 'integrated_circuit', '集成电路', 'integrated_circuit', 4, 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system'),
  ('di-industry-5', 'dict-industry', 'smart_manufacturing', '智能制造', 'smart_manufacturing', 5, 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system'),
  ('di-industry-6', 'dict-industry', 'other', '其他', 'other', 99, 'active', '2026-06-22T00:00:00Z', 'system', '2026-06-22T00:00:00Z', 'system');
