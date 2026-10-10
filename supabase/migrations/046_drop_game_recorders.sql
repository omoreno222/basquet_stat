-- 045 put the two team-manager slots back. A game has no assigned recorder.
-- Any team manager or club admin of the club can open it.

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_single_recorder_check;

ALTER TABLE games
  DROP COLUMN IF EXISTS slot_a_user_id,
  DROP COLUMN IF EXISTS slot_b_user_id,
  DROP COLUMN IF EXISTS single_recorder;

COMMENT ON TABLE games IS 'Games table. RLS allows a platform admin, or a club admin or team manager of the club, to manage a game.';

DELETE FROM translations WHERE key IN (
  'trke_operator_a',
  'trke_operator_b',
  'trke_game_single_recorder',
  'trke_game_slot_a_help',
  'trke_game_slot_b_help',
  'trke_game_recorders_required',
  'trke_game_recorders_same',
  'trke_operator_clock_running',
  'trke_operator_final'
);

INSERT INTO translations (key, locale, value) VALUES
  ('trke_capture_not_allowed', 'en', 'Only a team manager or club admin of this club can record this game.'),
  ('trke_capture_not_allowed', 'es', 'Solo un director de equipo o un administrador del club puede anotar este partido.'),
  ('trke_capture_not_allowed', 'ca', 'Només un director d''equip o un administrador del club pot anotar aquest partit.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
