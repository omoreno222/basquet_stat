INSERT INTO translations (key, locale, value) VALUES
  ('trke_cambio', 'en', 'Change'),
  ('trke_cambio', 'es', 'Cambio'),
  ('trke_cambio', 'ca', 'Canvi'),

  ('trke_step_back', 'en', 'Step back'),
  ('trke_step_back', 'es', 'Paso atrás'),
  ('trke_step_back', 'ca', 'Pas enrere'),

  ('trke_cancel_delete', 'en', 'Cancel and delete'),
  ('trke_cancel_delete', 'es', 'Cancelar y borrar'),
  ('trke_cancel_delete', 'ca', 'Cancel·la i esborra'),

  ('trke_timeout_short', 'en', 'TO'),
  ('trke_timeout_short', 'es', 'TO'),
  ('trke_timeout_short', 'ca', 'TO'),

  ('trke_period_fouls', 'en', 'Fouls'),
  ('trke_period_fouls', 'es', 'Faltas'),
  ('trke_period_fouls', 'ca', 'Faltes')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
