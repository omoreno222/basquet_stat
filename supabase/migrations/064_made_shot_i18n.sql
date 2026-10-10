-- Hint copy for a made basket. No schema change: shot, assist, foul and free_throw already exist.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_made_hint_court', 'en', 'Tap the shot on the attacking half'),
  ('trke_made_hint_court', 'es', 'Toca el tiro en el campo de ataque'),
  ('trke_made_hint_court', 'ca', 'Toca el tir al camp d''atac'),

  ('trke_made_hint_half', 'en', 'That point is not on the attacking half'),
  ('trke_made_hint_half', 'es', 'Ese punto no está en el campo de ataque'),
  ('trke_made_hint_half', 'ca', 'Aquest punt no és al camp d''atac'),

  ('trke_made_hint_shooter_2', 'en', '2-point basket. Choose the shooter.'),
  ('trke_made_hint_shooter_2', 'es', 'Canasta de 2. Elige al tirador.'),
  ('trke_made_hint_shooter_2', 'ca', 'Cistella de 2. Tria el tirador.'),

  ('trke_made_hint_shooter_3', 'en', '3-point basket. Choose the shooter.'),
  ('trke_made_hint_shooter_3', 'es', 'Canasta de 3. Elige al tirador.'),
  ('trke_made_hint_shooter_3', 'ca', 'Cistella de 3. Tria el tirador.'),

  ('trke_made_hint_assist', 'en', 'Choose the assist'),
  ('trke_made_hint_assist', 'es', 'Elige la asistencia'),
  ('trke_made_hint_assist', 'ca', 'Tria l''assistència'),

  ('trke_made_assist_title', 'en', 'Assist'),
  ('trke_made_assist_title', 'es', 'Asistencia'),
  ('trke_made_assist_title', 'ca', 'Assistència'),

  ('trke_made_no_assist', 'en', 'No assist'),
  ('trke_made_no_assist', 'es', 'Sin asistencia'),
  ('trke_made_no_assist', 'ca', 'Sense assistència'),

  ('trke_made_hint_foul', 'en', 'Personal foul?'),
  ('trke_made_hint_foul', 'es', '¿Falta personal?'),
  ('trke_made_hint_foul', 'ca', 'Falta personal?'),

  ('trke_made_foul_yes', 'en', 'Yes'),
  ('trke_made_foul_yes', 'es', 'Sí'),
  ('trke_made_foul_yes', 'ca', 'Sí'),

  ('trke_made_foul_no', 'en', 'No'),
  ('trke_made_foul_no', 'es', 'No'),
  ('trke_made_foul_no', 'ca', 'No'),

  ('trke_made_hint_fouler', 'en', 'Choose who committed the foul'),
  ('trke_made_hint_fouler', 'es', 'Elige quién cometió la falta'),
  ('trke_made_hint_fouler', 'ca', 'Tria qui ha comès la falta'),

  ('trke_made_hint_ft', 'en', 'Mark the free throw'),
  ('trke_made_hint_ft', 'es', 'Marca el tiro libre'),
  ('trke_made_hint_ft', 'ca', 'Marca el tir lliure'),

  ('trke_made_hint_saved', 'en', 'Basket. Press start clock.'),
  ('trke_made_hint_saved', 'es', 'Canasta. Pulsa start clock.'),
  ('trke_made_hint_saved', 'ca', 'Cistella. Prem start clock.'),

  ('trke_made_hint_error', 'en', 'Could not save the basket'),
  ('trke_made_hint_error', 'es', 'No se ha podido guardar la canasta'),
  ('trke_made_hint_error', 'ca', 'No s''ha pogut desar la cistella'),

  ('trke_made_hint_roster', 'en', 'Put players on the court before the basket'),
  ('trke_made_hint_roster', 'es', 'Pon jugadores en la pista antes de la canasta'),
  ('trke_made_hint_roster', 'ca', 'Posa jugadors a la pista abans de la cistella'),

  ('trke_made_log_assist', 'en', 'assist'),
  ('trke_made_log_assist', 'es', 'asistencia'),
  ('trke_made_log_assist', 'ca', 'assistència')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
