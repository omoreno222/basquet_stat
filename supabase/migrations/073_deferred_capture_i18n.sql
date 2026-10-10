-- Labels for logging a game from video, after the fact.
-- The capture board and its events stay the same.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_deferred_open', 'en', 'Log from video'),
  ('trke_deferred_open', 'es', 'Apuntar en diferido'),
  ('trke_deferred_open', 'ca', 'Apuntar en diferit'),

  ('trke_deferred_banner', 'en', 'The clock is stopped. Set the period and the time, then add each event.'),
  ('trke_deferred_banner', 'es', 'El reloj está parado. Pon el cuarto y el tiempo, y añade cada evento.'),
  ('trke_deferred_banner', 'ca', 'El rellotge està aturat. Posa el quart i el temps, i afegeix cada esdeveniment.'),

  ('trke_deferred_close', 'en', 'Close game'),
  ('trke_deferred_close', 'es', 'Cerrar partido'),
  ('trke_deferred_close', 'ca', 'Tancar partit'),

  ('trke_deferred_close_confirm', 'en', 'Close this game? You will not be able to add more events.'),
  ('trke_deferred_close_confirm', 'es', '¿Cerrar el partido? No podrás añadir más eventos.'),
  ('trke_deferred_close_confirm', 'ca', 'Tancar el partit? No podràs afegir més esdeveniments.'),

  ('trke_deferred_closed', 'en', 'This game is closed'),
  ('trke_deferred_closed', 'es', 'Este partido está cerrado'),
  ('trke_deferred_closed', 'ca', 'Aquest partit està tancat'),

  ('trke_deferred_add', 'en', 'Add a sequence'),
  ('trke_deferred_add', 'es', 'Añadir una secuencia'),
  ('trke_deferred_add', 'ca', 'Afegir una seqüència'),

  ('trke_deferred_pick', 'en', 'Which sequence?'),
  ('trke_deferred_pick', 'es', '¿Qué secuencia?'),
  ('trke_deferred_pick', 'ca', 'Quina seqüència?'),

  ('trke_deferred_sequence_made', 'en', 'Made basket'),
  ('trke_deferred_sequence_made', 'es', 'Canasta'),
  ('trke_deferred_sequence_made', 'ca', 'Cistella'),

  ('trke_deferred_sequence_miss', 'en', 'Missed shot'),
  ('trke_deferred_sequence_miss', 'es', 'Tiro fallado'),
  ('trke_deferred_sequence_miss', 'ca', 'Tir fallat'),

  ('trke_deferred_need_spot', 'en', 'Tap the spot on the court'),
  ('trke_deferred_need_spot', 'es', 'Toca el punto en el campo'),
  ('trke_deferred_need_spot', 'ca', 'Toca el punt a la pista'),

  ('trke_deferred_need_players', 'en', 'Choose the players'),
  ('trke_deferred_need_players', 'es', 'Elige los jugadores'),
  ('trke_deferred_need_players', 'ca', 'Tria els jugadors')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
