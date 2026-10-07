-- Labels for placing the spot of a made field goal from the action log.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_shot_point_edit', 'en', 'Edit shot spot'),
  ('trke_shot_point_edit', 'es', 'Editar punto de tiro'),
  ('trke_shot_point_edit', 'ca', 'Editar el punt de tir'),

  ('trke_shot_point_title', 'en', 'Shot spot'),
  ('trke_shot_point_title', 'es', 'Punto de tiro'),
  ('trke_shot_point_title', 'ca', 'Punt de tir'),

  ('trke_shot_point_hint', 'en', 'Tap where the shot went in'),
  ('trke_shot_point_hint', 'es', 'Toca dónde entró el tiro'),
  ('trke_shot_point_hint', 'ca', 'Toca on ha entrat el tir'),

  ('trke_shot_made_2', 'en', '2-point basket'),
  ('trke_shot_made_2', 'es', 'Canasta de 2'),
  ('trke_shot_made_2', 'ca', 'Cistella de 2'),

  ('trke_shot_made_3', 'en', '3-point basket'),
  ('trke_shot_made_3', 'es', 'Canasta de 3'),
  ('trke_shot_made_3', 'ca', 'Cistella de 3'),

  ('trke_shot_point_saved', 'en', 'Shot spot saved'),
  ('trke_shot_point_saved', 'es', 'Punto de tiro guardado'),
  ('trke_shot_point_saved', 'ca', 'Punt de tir desat'),

  ('trke_shot_point_error', 'en', 'Could not save the shot spot'),
  ('trke_shot_point_error', 'es', 'No se ha podido guardar el punto de tiro'),
  ('trke_shot_point_error', 'ca', 'No s''ha pogut desar el punt de tir')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
