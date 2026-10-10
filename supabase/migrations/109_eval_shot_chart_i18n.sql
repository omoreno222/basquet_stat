-- Half-court shot chart on the evaluation page. No schema change.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_shot_chart', 'en', 'Shot chart'),
  ('trke_eval_shot_chart', 'es', 'Mapa de tiros'),
  ('trke_eval_shot_chart', 'ca', 'Mapa de tirs'),

  ('trke_eval_shot_made', 'en', 'Make'),
  ('trke_eval_shot_made', 'es', 'Acierto'),
  ('trke_eval_shot_made', 'ca', 'Encert'),

  ('trke_eval_shot_miss', 'en', 'Miss'),
  ('trke_eval_shot_miss', 'es', 'Fallo'),
  ('trke_eval_shot_miss', 'ca', 'Fall')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
