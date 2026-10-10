-- One club manager records a game. Two tablets are two sessions of a user
-- who is a team manager or club admin of that club.

DROP TRIGGER IF EXISTS games_operator_guard ON games;
DROP TRIGGER IF EXISTS games_operator_stints ON games;

DROP FUNCTION IF EXISTS guard_game_operator_change();
DROP FUNCTION IF EXISTS sync_game_operator_stints();
DROP FUNCTION IF EXISTS sync_operator_slot(UUID, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS commit_capture_play(TEXT, UUID, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID);

DROP TABLE IF EXISTS game_operator_stints;

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_single_recorder_check;

ALTER TABLE games
  DROP COLUMN IF EXISTS slot_a_user_id,
  DROP COLUMN IF EXISTS slot_b_user_id,
  DROP COLUMN IF EXISTS single_recorder;

COMMENT ON TABLE games IS 'Games table. RLS allows a platform admin, or a club admin or team manager of the club, to manage a game.';
COMMENT ON TABLE game_events IS 'Game events recorded during live capture. RLS allows a platform admin, or a club admin or team manager of the club, to write.';

DELETE FROM translations WHERE key IN (
  'trke_operator_a',
  'trke_operator_b',
  'trke_operator_log',
  'trke_operator_since',
  'trke_operator_until',
  'trke_operator_current',
  'trke_operator_clock_running',
  'trke_operator_final',
  'trke_game_slot_a',
  'trke_game_slot_a_help',
  'trke_game_slot_b',
  'trke_game_slot_b_help',
  'trke_game_single_recorder',
  'trke_game_recorders_required',
  'trke_game_recorders_same',
  'trke_swap_slots',
  'trke_clock_leave_confirm'
);

INSERT INTO translations (key, locale, value) VALUES
  ('trke_capture_not_allowed', 'en', 'Only a team manager or club admin of this club can record this game.'),
  ('trke_capture_not_allowed', 'es', 'Solo un director de equipo o un administrador del club puede anotar este partido.'),
  ('trke_capture_not_allowed', 'ca', 'Només un director d''equip o un administrador del club pot anotar aquest partit.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
