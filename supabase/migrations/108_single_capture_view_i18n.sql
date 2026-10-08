-- One capture screen: log actions that used to live only on the deferred route.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_log_delete', 'en', 'Delete this play'),
  ('trke_log_delete', 'es', 'Borrar esta jugada'),
  ('trke_log_delete', 'ca', 'Esborrar aquesta jugada'),

  ('trke_log_delete_confirm', 'en', 'Delete this play? The score will be recalculated.'),
  ('trke_log_delete_confirm', 'es', '¿Borrar esta jugada? El marcador se recalcula.'),
  ('trke_log_delete_confirm', 'ca', 'Esborrar aquesta jugada? El marcador es recalcula.'),

  ('trke_log_delete_error', 'en', 'Could not delete the play'),
  ('trke_log_delete_error', 'es', 'No se ha podido borrar la jugada'),
  ('trke_log_delete_error', 'ca', 'No s''ha pogut esborrar la jugada'),

  ('trke_log_added', 'en', 'Play added to the log'),
  ('trke_log_added', 'es', 'Jugada añadida al acta'),
  ('trke_log_added', 'ca', 'Jugada afegida a l''acta'),

  ('trke_capture_open', 'en', 'Open the court'),
  ('trke_capture_open', 'es', 'Abrir la pista'),
  ('trke_capture_open', 'ca', 'Obrir la pista')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

DELETE FROM translations WHERE key IN ('trke_deferred_open', 'trke_deferred_banner');
