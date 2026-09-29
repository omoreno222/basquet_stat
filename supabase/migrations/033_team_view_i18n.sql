INSERT INTO translations (key, locale, value) VALUES
  ('trke_view', 'en', 'View'),
  ('trke_view', 'es', 'Ver'),
  ('trke_view', 'ca', 'Veure')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
