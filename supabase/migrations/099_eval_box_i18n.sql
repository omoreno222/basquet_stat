-- Box-score labels for the evaluation table.
-- Short headers match the line: TL 3/5 60%, RD 2 (20%), FH, FR.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_ft', 'en', 'FT'),
  ('trke_eval_ft', 'es', 'TL'),
  ('trke_eval_ft', 'ca', 'TL'),
  ('trke_eval_two', 'en', '2P'),
  ('trke_eval_two', 'es', '2P'),
  ('trke_eval_two', 'ca', '2P'),
  ('trke_eval_three', 'en', '3P'),
  ('trke_eval_three', 'es', '3P'),
  ('trke_eval_three', 'ca', '3P'),
  ('trke_eval_fh', 'en', 'FC'),
  ('trke_eval_fh', 'es', 'FH'),
  ('trke_eval_fh', 'ca', 'FH'),
  ('trke_eval_fr', 'en', 'FD'),
  ('trke_eval_fr', 'es', 'FR'),
  ('trke_eval_fr', 'ca', 'FR'),
  ('trke_eval_turnovers', 'en', 'Turnovers'),
  ('trke_eval_turnovers', 'es', 'Pérdidas'),
  ('trke_eval_turnovers', 'ca', 'Pèrdues'),
  ('trke_eval_assists', 'en', 'Assists'),
  ('trke_eval_assists', 'es', 'Asistencias'),
  ('trke_eval_assists', 'ca', 'Assistències'),
  ('trke_eval_points', 'en', 'Points'),
  ('trke_eval_points', 'es', 'Puntos'),
  ('trke_eval_points', 'ca', 'Punts'),
  ('trke_eval_location', 'en', 'Location'),
  ('trke_eval_location', 'es', 'Ubicación'),
  ('trke_eval_location', 'ca', 'Ubicació')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

UPDATE translations SET value = 'RD', updated_at = NOW() WHERE key = 'trke_eval_reb_def';
UPDATE translations SET value = 'RO', updated_at = NOW() WHERE key = 'trke_eval_reb_off';

DELETE FROM translations
WHERE key IN ('trke_eval_field_goals', 'trke_eval_free_throws', 'trke_eval_fouls', 'trke_eval_ball');
