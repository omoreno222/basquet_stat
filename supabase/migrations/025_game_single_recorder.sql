-- One recorder means tablet A only. Two recorders need both slots.
-- Existing games stay incomplete (both slots null) until the game form saves them.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS single_recorder boolean NOT NULL DEFAULT false;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_single_recorder_check;
ALTER TABLE games ADD CONSTRAINT games_single_recorder_check CHECK (
  single_recorder = false
  OR (slot_b_user_id IS NULL AND slot_a_user_id IS NOT NULL)
);

COMMENT ON COLUMN games.single_recorder IS 'When true, only tablet A records the game and slot B stays empty.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_game_slot_a', 'en', 'Tablet A'),
  ('trke_game_slot_a', 'es', 'Tablet A'),
  ('trke_game_slot_a', 'ca', 'Tauleta A'),

  ('trke_game_slot_a_help', 'en', 'Clock (start, stop, next period). Made and missed 1, 2 and 3 point shots on the court; free throws green or red on the free-throw line. Fouls by type, with a player counter that warns at 5. Substitutions, which produce minutes. Starting lineup, synced live to tablet B. Opponent score.'),
  ('trke_game_slot_a_help', 'es', 'Reloj (arrancar, parar y cambiar de cuarto). Tiros de 1, 2 y 3 anotados y fallados en la cancha; tiros libres en verde o rojo en la línea de tiros libres. Faltas con su tipo y aviso al llegar a 5. Cambios, de los que salen los minutos. Quinteto inicial, sincronizado en directo con la tablet B. Marcador del rival.'),
  ('trke_game_slot_a_help', 'ca', 'Rellotge (engegar, aturar i canviar de quart). Tirs d''1, 2 i 3 encertats i fallats a la pista; tirs lliures en verd o vermell a la línia de tirs lliures. Faltes amb el seu tipus i avís en arribar a 5. Canvis, d''on surten els minuts. Quintet inicial, sincronitzat en directe amb la tauleta B. Marcador del rival.'),

  ('trke_game_slot_b', 'en', 'Tablet B'),
  ('trke_game_slot_b', 'es', 'Tablet B'),
  ('trke_game_slot_b', 'ca', 'Tauleta B'),

  ('trke_game_slot_b_help', 'en', 'Rebounds, assists, turnovers and steals.'),
  ('trke_game_slot_b_help', 'es', 'Rebotes, asistencias, pérdidas y recuperaciones.'),
  ('trke_game_slot_b_help', 'ca', 'Rebots, assistències, pèrdues i recuperacions.'),

  ('trke_game_possession_auto', 'en', 'The app calculates possession.'),
  ('trke_game_possession_auto', 'es', 'La posesión la calcula la app.'),
  ('trke_game_possession_auto', 'ca', 'La possessió la calcula l''app.'),

  ('trke_game_single_recorder', 'en', 'One recorder'),
  ('trke_game_single_recorder', 'es', 'Un solo registrador'),
  ('trke_game_single_recorder', 'ca', 'Un sol registrador'),

  ('trke_game_recorders_required', 'en', 'Choose both team managers, or mark one recorder.'),
  ('trke_game_recorders_required', 'es', 'Elige a los dos team managers o marca un solo registrador.'),
  ('trke_game_recorders_required', 'ca', 'Tria els dos team managers o marca un sol registrador.'),

  ('trke_game_recorders_same', 'en', 'The two team managers must be different people.'),
  ('trke_game_recorders_same', 'es', 'Los dos team managers tienen que ser distintos.'),
  ('trke_game_recorders_same', 'ca', 'Els dos team managers han de ser persones diferents.'),

  ('trke_swap_slots', 'en', 'Swap tablets'),
  ('trke_swap_slots', 'es', 'Intercambiar tablets'),
  ('trke_swap_slots', 'ca', 'Intercanviar tauletes'),

  ('trke_clock_plus_10', 'en', 'Add 10 seconds'),
  ('trke_clock_plus_10', 'es', 'Sumar 10 segundos'),
  ('trke_clock_plus_10', 'ca', 'Sumar 10 segons'),

  ('trke_clock_leave_confirm', 'en', 'The clock will stop when you leave. Continue?'),
  ('trke_clock_leave_confirm', 'es', 'Al salir se parará el reloj. ¿Seguir?'),
  ('trke_clock_leave_confirm', 'ca', 'En sortir s''aturarà el rellotge. Continuar?')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
