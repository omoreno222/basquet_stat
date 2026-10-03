-- Platform admin can put one game back to a scheduled kickoff.
-- Events go first, then the clock returns to 10:00, then lineups.
-- That order satisfies the "period already started" triggers.

CREATE OR REPLACE FUNCTION reset_game_for_testing(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Only a platform admin can do this';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id) THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  DELETE FROM game_events WHERE game_id = p_game_id;

  UPDATE games SET
    status = 'scheduled',
    team_score = 0,
    opponent_score = 0,
    current_period = 1,
    clock_running = false,
    clock_remaining_ms = 600000,
    possession = NULL,
    attack_right_first = true,
    game_date = now()
  WHERE id = p_game_id;

  DELETE FROM game_period_lineups WHERE game_id = p_game_id;
  DELETE FROM game_squads WHERE game_id = p_game_id;
  DELETE FROM starting_lineups WHERE game_id = p_game_id;
  DELETE FROM game_opponent_lineups WHERE game_id = p_game_id;
  DELETE FROM game_opponent_players WHERE game_id = p_game_id;
  DELETE FROM game_periods WHERE game_id = p_game_id;
  DELETE FROM stints WHERE game_id = p_game_id;
  DELETE FROM game_guest_players WHERE game_id = p_game_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION reset_game_for_testing(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reset_game_for_testing(UUID) TO authenticated;

COMMENT ON FUNCTION reset_game_for_testing(UUID) IS
  'Platform admin only. Clears one game back to a scheduled kickoff without deleting the game, team, or players.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_game_reset', 'en', 'Reset'),
  ('trke_game_reset', 'es', 'Reiniciar'),
  ('trke_game_reset', 'ca', 'Reiniciar'),
  ('trke_game_reset_confirm', 'en', 'Reset this game? Score, events, and lineups go back to zero. The team and players stay.'),
  ('trke_game_reset_confirm', 'es', '¿Reiniciar este partido? Marcador, eventos y alineaciones vuelven a cero. El equipo y los jugadores se quedan.'),
  ('trke_game_reset_confirm', 'ca', 'Reiniciar aquest partit? Marcador, esdeveniments i alineacions tornen a zero. L''equip i els jugadors es queden.'),
  ('trke_game_reset_error', 'en', 'Could not reset the game'),
  ('trke_game_reset_error', 'es', 'No se ha podido reiniciar el partido'),
  ('trke_game_reset_error', 'ca', 'No s''ha pogut reiniciar el partit')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
