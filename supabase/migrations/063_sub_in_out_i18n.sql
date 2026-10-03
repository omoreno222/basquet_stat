-- Labels for each line of a substitution log pill.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_out', 'en', 'Out'),
  ('trke_out', 'es', 'Sale'),
  ('trke_out', 'ca', 'Surt'),

  ('trke_in', 'en', 'In'),
  ('trke_in', 'es', 'Entra'),
  ('trke_in', 'ca', 'Entra')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
