-- A reset game stays live so the capture link on the games list still opens it.

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
    status = 'live',
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

COMMENT ON FUNCTION reset_game_for_testing(UUID) IS
  'Platform admin only. Clears one game back to a live kickoff so the capture link still opens it. Does not delete the game, team, or players.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_game_reset_confirm', 'en', 'Reset this game? Score, events, and lineups go back to zero. It stays live so you can open it again.'),
  ('trke_game_reset_confirm', 'es', '¿Reiniciar este partido? Marcador, eventos y alineaciones vuelven a cero. Se queda en directo para volver a entrar.'),
  ('trke_game_reset_confirm', 'ca', 'Reiniciar aquest partit? Marcador, esdeveniments i alineacions tornen a zero. Es queda en directe per tornar a entrar.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
