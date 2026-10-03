INSERT INTO translations (key, locale, value) VALUES
  ('trke_scorer_table', 'en', 'Scorer''s table'),
  ('trke_scorer_table', 'es', 'Mesa de anotación'),
  ('trke_scorer_table', 'ca', 'Taula d''anotació')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
