-- A game opens only for the team manager assigned to it.
-- One recorder means that person alone. Two recorders means both of them.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS slot_a_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot_b_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS single_recorder boolean NOT NULL DEFAULT false;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_single_recorder_check;
ALTER TABLE games ADD CONSTRAINT games_single_recorder_check CHECK (
  single_recorder = false
  OR (slot_b_user_id IS NULL AND slot_a_user_id IS NOT NULL)
);

COMMENT ON COLUMN games.single_recorder IS 'When true, only the team manager in slot A can open the game.';
COMMENT ON TABLE games IS 'Games table. A live game opens only for the assigned team manager or team managers.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_operator_a', 'en', 'Team manager'),
  ('trke_operator_a', 'es', 'Team manager'),
  ('trke_operator_a', 'ca', 'Team manager'),
  ('trke_operator_b', 'en', 'Second team manager'),
  ('trke_operator_b', 'es', 'Segundo team manager'),
  ('trke_operator_b', 'ca', 'Segon team manager'),
  ('trke_game_single_recorder', 'en', 'One team manager'),
  ('trke_game_single_recorder', 'es', 'Un solo team manager'),
  ('trke_game_single_recorder', 'ca', 'Un sol team manager'),
  ('trke_game_slot_a_help', 'en', 'Only the assigned team manager can open this game. With one team manager, only that person.'),
  ('trke_game_slot_a_help', 'es', 'Solo el team manager asignado puede abrir este partido. Con uno solo, únicamente esa persona.'),
  ('trke_game_slot_a_help', 'ca', 'Només el team manager assignat pot obrir aquest partit. Amb un de sol, només aquesta persona.'),
  ('trke_game_slot_b_help', 'en', 'Both assigned team managers can open this game.'),
  ('trke_game_slot_b_help', 'es', 'Los dos team managers asignados pueden abrir este partido.'),
  ('trke_game_slot_b_help', 'ca', 'Els dos team managers assignats poden obrir aquest partit.'),
  ('trke_game_recorders_required', 'en', 'Choose both team managers, or mark one team manager.'),
  ('trke_game_recorders_required', 'es', 'Elige a los dos team managers o marca un solo team manager.'),
  ('trke_game_recorders_required', 'ca', 'Tria els dos team managers o marca un sol team manager.'),
  ('trke_game_recorders_same', 'en', 'The two team managers must be different people.'),
  ('trke_game_recorders_same', 'es', 'Los dos team managers tienen que ser distintos.'),
  ('trke_game_recorders_same', 'ca', 'Els dos team managers han de ser persones diferents.'),
  ('trke_operator_clock_running', 'en', 'Stop the clock before changing the team manager.'),
  ('trke_operator_clock_running', 'es', 'Para el reloj antes de cambiar de team manager.'),
  ('trke_operator_clock_running', 'ca', 'Atura el rellotge abans de canviar de team manager.'),
  ('trke_operator_final', 'en', 'The team manager cannot be changed after the game has ended.'),
  ('trke_operator_final', 'es', 'No se puede cambiar el team manager con el partido terminado.'),
  ('trke_operator_final', 'ca', 'No es pot canviar el team manager amb el partit acabat.'),
  ('trke_capture_not_allowed', 'en', 'You are not assigned to this game.'),
  ('trke_capture_not_allowed', 'es', 'No estás asignado a este partido.'),
  ('trke_capture_not_allowed', 'ca', 'No estàs assignat a aquest partit.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
