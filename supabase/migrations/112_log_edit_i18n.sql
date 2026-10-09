-- Labels for editing a missed shot, a foul, a free-throw block, and a substitution.
-- No schema change. Existing game_events policies still gate the update.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_miss_point_edit', 'en', 'Edit missed shot'),
  ('trke_miss_point_edit', 'es', 'Editar tiro fallado'),
  ('trke_miss_point_edit', 'ca', 'Editar el tir fallat'),

  ('trke_miss_point_saved', 'en', 'Missed shot saved'),
  ('trke_miss_point_saved', 'es', 'Tiro fallado guardado'),
  ('trke_miss_point_saved', 'ca', 'Tir fallat desat'),

  ('trke_miss_point_error', 'en', 'Could not save the missed shot'),
  ('trke_miss_point_error', 'es', 'No se ha podido guardar el tiro fallado'),
  ('trke_miss_point_error', 'ca', 'No s''ha pogut desar el tir fallat'),

  ('trke_miss_point_value', 'en', 'That spot changes the shot value, and the free throws would no longer match'),
  ('trke_miss_point_value', 'es', 'Ese punto cambia el valor del tiro y los tiros libres dejarían de coincidir'),
  ('trke_miss_point_value', 'ca', 'Aquest punt canvia el valor del tir i els tirs lliures deixarien de coincidir'),

  ('trke_foul_edit', 'en', 'Edit foul'),
  ('trke_foul_edit', 'es', 'Editar falta'),
  ('trke_foul_edit', 'ca', 'Editar la falta'),

  ('trke_foul_player', 'en', 'Who fouled'),
  ('trke_foul_player', 'es', 'Quién hizo la falta'),
  ('trke_foul_player', 'ca', 'Qui ha fet la falta'),

  ('trke_ft_edit', 'en', 'Edit free throws'),
  ('trke_ft_edit', 'es', 'Editar tiros libres'),
  ('trke_ft_edit', 'ca', 'Editar tirs lliures'),

  ('trke_ft_edit_saved', 'en', 'Free throws saved'),
  ('trke_ft_edit_saved', 'es', 'Tiros libres guardados'),
  ('trke_ft_edit_saved', 'ca', 'Tirs lliures desats'),

  ('trke_ft_edit_error', 'en', 'Could not save the free throws'),
  ('trke_ft_edit_error', 'es', 'No se han podido guardar los tiros libres'),
  ('trke_ft_edit_error', 'ca', 'No s''han pogut desar els tirs lliures'),

  ('trke_ft_edit_rebound', 'en', 'The last miss needs a rebound, and none was recorded'),
  ('trke_ft_edit_rebound', 'es', 'El último fallo necesita un rebote y no hay ninguno apuntado'),
  ('trke_ft_edit_rebound', 'ca', 'L''últim error necessita un rebot i no n''hi ha cap d''apuntat'),

  ('trke_sub_edit', 'en', 'Edit substitution'),
  ('trke_sub_edit', 'es', 'Editar cambio'),
  ('trke_sub_edit', 'ca', 'Editar el canvi'),

  ('trke_sub_edit_saved', 'en', 'Substitution saved'),
  ('trke_sub_edit_saved', 'es', 'Cambio guardado'),
  ('trke_sub_edit_saved', 'ca', 'Canvi desat'),

  ('trke_sub_edit_error', 'en', 'Could not save the substitution'),
  ('trke_sub_edit_error', 'es', 'No se ha podido guardar el cambio'),
  ('trke_sub_edit_error', 'ca', 'No s''ha pogut desar el canvi'),

  ('trke_sub_edit_players', 'en', 'Choose who was on the court and who came in from the bench'),
  ('trke_sub_edit_players', 'es', 'Elige quién estaba en pista y quién entró desde el banquillo'),
  ('trke_sub_edit_players', 'ca', 'Tria qui era a la pista i qui ha entrat des de la banqueta')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
