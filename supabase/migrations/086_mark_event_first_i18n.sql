-- Shown when the court is tapped while the clock is running and no play is open.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_mark_event_first', 'en', 'Mark an event first!'),
  ('trke_mark_event_first', 'es', '¡Marque evento primero!'),
  ('trke_mark_event_first', 'ca', 'Marqueu primer l''esdeveniment!')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
