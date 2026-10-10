-- Labels for changing who took a named rebound. The team and
-- offensive or defensive label stay. No schema change.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_rebound_edit', 'en', 'Who took the rebound'),
  ('trke_rebound_edit', 'es', 'Quién cogió el rebote'),
  ('trke_rebound_edit', 'ca', 'Qui ha agafat el rebot'),

  ('trke_rebound_saved', 'en', 'Rebound saved'),
  ('trke_rebound_saved', 'es', 'Rebote guardado'),
  ('trke_rebound_saved', 'ca', 'Rebot desat'),

  ('trke_rebound_error', 'en', 'Could not save the rebound'),
  ('trke_rebound_error', 'es', 'No se ha podido guardar el rebote'),
  ('trke_rebound_error', 'ca', 'No s''ha pogut desar el rebot')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
