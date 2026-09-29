INSERT INTO translations (key, locale, value) VALUES
  ('trke_possession_badge', 'en', 'possession'),
  ('trke_possession_badge', 'es', 'posesión'),
  ('trke_possession_badge', 'ca', 'possessió')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
