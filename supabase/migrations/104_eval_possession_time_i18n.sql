-- Heading for the closed possession-time totals on the evaluation page.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_possession_time', 'en', 'Possession time'),
  ('trke_eval_possession_time', 'es', 'Tiempo de posesión'),
  ('trke_eval_possession_time', 'ca', 'Temps de possessió')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
