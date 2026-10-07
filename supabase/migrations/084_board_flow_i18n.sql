-- Names shown before the capture message line while a multi-step play is open.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_flow_made', 'en', 'Made'),
  ('trke_flow_made', 'es', 'Canasta'),
  ('trke_flow_made', 'ca', 'Cistella'),

  ('trke_flow_made_personal', 'en', 'Made and a personal foul'),
  ('trke_flow_made_personal', 'es', 'Canasta y personal'),
  ('trke_flow_made_personal', 'ca', 'Cistella i personal'),

  ('trke_flow_miss', 'en', 'Miss'),
  ('trke_flow_miss', 'es', 'Fallo'),
  ('trke_flow_miss', 'ca', 'Fall'),

  ('trke_flow_miss_personal', 'en', 'Miss and a personal foul'),
  ('trke_flow_miss_personal', 'es', 'Fallo y personal'),
  ('trke_flow_miss_personal', 'ca', 'Fall i personal'),

  ('trke_flow_foul', 'en', 'Foul'),
  ('trke_flow_foul', 'es', 'Falta'),
  ('trke_flow_foul', 'ca', 'Falta'),

  ('trke_flow_turnover', 'en', 'Turnover'),
  ('trke_flow_turnover', 'es', 'Pérdida'),
  ('trke_flow_turnover', 'ca', 'Pèrdua'),

  ('trke_flow_sub', 'en', 'Change'),
  ('trke_flow_sub', 'es', 'Cambio'),
  ('trke_flow_sub', 'ca', 'Canvi')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
