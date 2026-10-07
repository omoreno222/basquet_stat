-- Free throws are fixed by the foul. The trigger checks the count.
-- Bonus (the fifth team foul) is enforced in the capture action, which can
-- see the fouls already stored. game_events RLS is unchanged.

CREATE OR REPLACE FUNCTION enforce_foul_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  kind TEXT;
  ctx TEXT;
  ft INTEGER;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'foul'
    OR (NEW.foul_side IS NULL AND NEW.foul_context IS NULL) THEN
    IF NEW.foul_received_player_id IS NOT NULL
      OR NEW.foul_received_opponent_player_id IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
    IF NEW.foul_side IS NULL AND NEW.foul_context IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.event_type IS DISTINCT FROM 'foul'
    OR NEW.foul_side IS NULL
    OR NEW.foul_context IS NULL
    OR NEW.foul_type IS NULL
    OR NEW.free_throws_awarded IS NULL
    OR NEW.play_group_id IS NULL
    OR NEW.possession_before IS NULL THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;

  kind := NEW.foul_type::text;
  ctx := NEW.foul_context;
  ft := NEW.free_throws_awarded;

  IF kind = 'personal' AND ctx = 'offensive' THEN
    IF ft <> 0 OR NEW.shot_value IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'personal' AND ctx = 'no_shot' THEN
    IF ft NOT IN (0, 2) OR NEW.shot_value IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'personal' AND ctx = 'shot_made' THEN
    IF ft <> 1 OR NEW.shot_value NOT IN (2, 3) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'personal' AND ctx = 'shot_missed' THEN
    IF NEW.shot_value NOT IN (2, 3) OR ft <> NEW.shot_value THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind IN ('disruptive', 'flagrant', 'disqualifying') AND ctx = 'no_shot' THEN
    IF ft <> 2 OR NEW.shot_value IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind IN ('disruptive', 'flagrant', 'disqualifying') AND ctx = 'shot_made' THEN
    IF ft <> 1 OR NEW.shot_value NOT IN (2, 3) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind IN ('disruptive', 'flagrant', 'disqualifying') AND ctx = 'shot_missed' THEN
    IF NEW.shot_value NOT IN (2, 3) OR ft <> NEW.shot_value THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'technical' AND ctx = 'technical' THEN
    IF ft <> 1 OR NEW.shot_value IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'double' AND ctx = 'double' THEN
    IF ft <> 0 OR NEW.shot_value IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSE
    RAISE EXCEPTION 'foul_shape';
  END IF;

  IF NEW.coach_technical_side IS NOT NULL THEN
    IF kind <> 'technical'
      OR NEW.coach_technical_side <> NEW.foul_side
      OR NEW.player_id IS NOT NULL
      OR NEW.opponent_player_id IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSE
    IF NEW.foul_side = 'home' AND (NEW.player_id IS NULL OR NEW.opponent_player_id IS NOT NULL) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
    IF NEW.foul_side = 'away' AND (NEW.opponent_player_id IS NULL OR NEW.player_id IS NOT NULL) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  END IF;

  IF NEW.foul_received_player_id IS NOT NULL AND NEW.foul_received_opponent_player_id IS NOT NULL THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;
  IF NEW.foul_side = 'home' AND NEW.foul_received_player_id IS NOT NULL THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;
  IF NEW.foul_side = 'away' AND NEW.foul_received_opponent_player_id IS NOT NULL THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;
  IF NEW.foul_received_opponent_player_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM game_opponent_players
    WHERE id = NEW.foul_received_opponent_player_id
      AND game_id = NEW.game_id
      AND NOT is_coach
  ) THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;
  IF NEW.foul_received_player_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM game_squads
    WHERE game_id = NEW.game_id AND player_id = NEW.foul_received_player_id
  ) THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;

  RETURN NEW;
END;
$$;
