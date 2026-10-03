-- Longer log lines for team 24s, 8s, and inbound 5s.
-- The player 5s reason stays on trke_turnover_five_seconds.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_shot_clock_log', 'en', '24-second possession violation'),
  ('trke_shot_clock_log', 'es', 'Falta de posesión de 24s'),
  ('trke_shot_clock_log', 'ca', 'Falta de possessió de 24s'),

  ('trke_eight_seconds_log', 'en', 'Did not cross half court in 8 seconds'),
  ('trke_eight_seconds_log', 'es', 'No cruzó el campo en 8s'),
  ('trke_eight_seconds_log', 'ca', 'No ha creuat el camp en 8s'),

  ('trke_five_seconds_log', 'en', 'Did not inbound in 5 seconds'),
  ('trke_five_seconds_log', 'es', 'No sacó de banda o de fondo en 5s'),
  ('trke_five_seconds_log', 'ca', 'No ha tret de banda o de fons en 5s')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
