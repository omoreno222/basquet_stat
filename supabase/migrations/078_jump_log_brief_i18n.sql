-- Short labels for the jump row in the action log.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_ganado', 'en', 'Won'),
  ('trke_ganado', 'es', 'Ganado'),
  ('trke_ganado', 'ca', 'Guanyat'),

  ('trke_perdido', 'en', 'Lost'),
  ('trke_perdido', 'es', 'Perdido'),
  ('trke_perdido', 'ca', 'Perdut')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
