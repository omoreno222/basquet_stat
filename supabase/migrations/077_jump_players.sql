-- The two players who jumped. One is on the team sheet, the other is an opponent jersey.
-- game_events already has RLS. This trigger refuses a jump row with the wrong shape.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS jump_home_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jump_away_player_id UUID REFERENCES game_opponent_players(id) ON DELETE SET NULL;

COMMENT ON COLUMN game_events.jump_home_player_id IS 'Dressed player who jumped for the home team. Null until chosen. Only set on a jump.';
COMMENT ON COLUMN game_events.jump_away_player_id IS 'Opponent who jumped. Null until chosen. Only set on a jump.';

CREATE OR REPLACE FUNCTION enforce_jump_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'jump' THEN
    IF NEW.jump_side IS NOT NULL
      OR NEW.jump_won IS NOT NULL
      OR NEW.jump_home_player_id IS NOT NULL
      OR NEW.jump_away_player_id IS NOT NULL
    THEN
      RAISE EXCEPTION 'jump_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.jump_side IS NULL
    OR NEW.jump_side NOT IN ('home', 'away')
    OR NEW.jump_won IS NULL
    OR NEW.player_id IS NOT NULL
    OR NEW.opponent_player_id IS NOT NULL
    OR COALESCE(NEW.points, 0) <> 0
    OR NEW.timeout_side IS NOT NULL
    OR NEW.turnover_type IS NOT NULL
    OR NEW.turnover_side IS NOT NULL
    OR NEW.foul_type IS NOT NULL
    OR NEW.foul_side IS NOT NULL
    OR NEW.period_number < 1
    OR NEW.period_number > 4
    OR NEW.clock_remaining_ms < 0
    OR NEW.clock_remaining_ms > 600000
    OR (NEW.jump_home_player_id IS NULL) <> (NEW.jump_away_player_id IS NULL)
  THEN
    RAISE EXCEPTION 'jump_shape';
  END IF;

  IF NEW.jump_home_player_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM game_squads
      WHERE game_id = NEW.game_id AND player_id = NEW.jump_home_player_id
    ) OR NOT EXISTS (
      SELECT 1 FROM game_opponent_players
      WHERE id = NEW.jump_away_player_id
        AND game_id = NEW.game_id
        AND NOT is_coach
    ) THEN
      RAISE EXCEPTION 'jump_shape';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_jump_edit', 'en', 'Edit jump'),
  ('trke_jump_edit', 'es', 'Editar salto'),
  ('trke_jump_edit', 'ca', 'Editar el salt'),

  ('trke_jump_winner', 'en', 'Player who won'),
  ('trke_jump_winner', 'es', 'Jugador que ganó'),
  ('trke_jump_winner', 'ca', 'Jugador que ha guanyat'),

  ('trke_jump_loser', 'en', 'Player who lost'),
  ('trke_jump_loser', 'es', 'Jugador que perdió'),
  ('trke_jump_loser', 'ca', 'Jugador que ha perdut'),

  ('trke_jump_saved', 'en', 'Jump saved'),
  ('trke_jump_saved', 'es', 'Salto guardado'),
  ('trke_jump_saved', 'ca', 'Salt desat'),

  ('trke_jump_error', 'en', 'Could not save the jump'),
  ('trke_jump_error', 'es', 'No se ha podido guardar el salto'),
  ('trke_jump_error', 'ca', 'No s''ha pogut desar el salt'),

  ('trke_jump_need_both', 'en', 'Choose both players'),
  ('trke_jump_need_both', 'es', 'Elige a los dos jugadores'),
  ('trke_jump_need_both', 'ca', 'Tria els dos jugadors')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
