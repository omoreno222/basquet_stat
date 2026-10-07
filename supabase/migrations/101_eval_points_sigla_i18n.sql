-- Points column shows TP. The full name is the hover title.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_points', 'en', 'TP'),
  ('trke_eval_points', 'es', 'TP'),
  ('trke_eval_points', 'ca', 'TP'),
  ('trke_eval_points_name', 'en', 'Points'),
  ('trke_eval_points_name', 'es', 'Puntos'),
  ('trke_eval_points_name', 'ca', 'Punts')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
