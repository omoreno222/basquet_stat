-- Short column labels. The full name is the hover title.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_reb_def_name', 'en', 'Defensive rebounds'),
  ('trke_eval_reb_def_name', 'es', 'Rebote defensivo'),
  ('trke_eval_reb_def_name', 'ca', 'Rebot defensiu'),
  ('trke_eval_reb_off_name', 'en', 'Offensive rebounds'),
  ('trke_eval_reb_off_name', 'es', 'Rebote ofensivo'),
  ('trke_eval_reb_off_name', 'ca', 'Rebot ofensiu'),
  ('trke_eval_turnovers_name', 'en', 'Turnovers'),
  ('trke_eval_turnovers_name', 'es', 'Pérdidas'),
  ('trke_eval_turnovers_name', 'ca', 'Pèrdues'),
  ('trke_eval_assists_name', 'en', 'Assists'),
  ('trke_eval_assists_name', 'es', 'Asistencias'),
  ('trke_eval_assists_name', 'ca', 'Assistències'),
  ('trke_eval_turnovers', 'en', 'TO'),
  ('trke_eval_turnovers', 'es', 'PERD'),
  ('trke_eval_turnovers', 'ca', 'PERD'),
  ('trke_eval_assists', 'en', 'AST'),
  ('trke_eval_assists', 'es', 'ASIS'),
  ('trke_eval_assists', 'ca', 'ASIS')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
