-- Left-half foul and turnover chart on the evaluation page. No schema change.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_event_chart', 'en', 'Fouls and turnovers'),
  ('trke_eval_event_chart', 'es', 'Faltas y pérdidas'),
  ('trke_eval_event_chart', 'ca', 'Faltes i pèrdues'),

  ('trke_eval_event_foul', 'en', 'Foul'),
  ('trke_eval_event_foul', 'es', 'Falta'),
  ('trke_eval_event_foul', 'ca', 'Falta'),

  ('trke_eval_event_turnover', 'en', 'Turnover'),
  ('trke_eval_event_turnover', 'es', 'Pérdida'),
  ('trke_eval_event_turnover', 'ca', 'Pèrdua')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
