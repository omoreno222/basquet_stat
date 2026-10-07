-- Scoreboard labels on the player-evaluation page.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_quarter', 'en', 'Quarter'),
  ('trke_eval_quarter', 'es', 'Cuarto'),
  ('trke_eval_quarter', 'ca', 'Quart'),
  ('trke_eval_in_play', 'en', 'In play'),
  ('trke_eval_in_play', 'es', 'En juego'),
  ('trke_eval_in_play', 'ca', 'En joc'),
  ('trke_eval_stopped', 'en', 'Stopped'),
  ('trke_eval_stopped', 'es', 'Parado'),
  ('trke_eval_stopped', 'ca', 'Aturat'),
  ('trke_eval_timeout_short', 'en', 'TO'),
  ('trke_eval_timeout_short', 'es', 'T.M.'),
  ('trke_eval_timeout_short', 'ca', 'T.M.'),
  ('trke_eval_overtime', 'en', 'OT'),
  ('trke_eval_overtime', 'es', 'PR'),
  ('trke_eval_overtime', 'ca', 'PR')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
