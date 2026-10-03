-- Log line for the players who take the court at the start of a period.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_sub_in', 'en', 'In'),
  ('trke_sub_in', 'es', 'Entra'),
  ('trke_sub_in', 'ca', 'Entra'),

  ('trke_sub_out', 'en', 'Out'),
  ('trke_sub_out', 'es', 'Sale'),
  ('trke_sub_out', 'ca', 'Surt')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
