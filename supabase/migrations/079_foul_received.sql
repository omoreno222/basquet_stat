-- Who received the foul. Optional, and always the other team.
-- game_events already has RLS. This trigger refuses a receiver on the wrong side.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS foul_received_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS foul_received_opponent_player_id UUID REFERENCES game_opponent_players(id) ON DELETE SET NULL;

COMMENT ON COLUMN game_events.foul_received_player_id IS 'Dressed home player who received the foul. Null until chosen. Only set when the away side committed it.';
COMMENT ON COLUMN game_events.foul_received_opponent_player_id IS 'Opponent who received the foul. Null until chosen. Only set when the home side committed it.';

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
    IF ft NOT IN (0, 1, 2, 3) OR NEW.shot_value IS NOT NULL THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'personal' AND ctx = 'shot_made' THEN
    IF ft NOT IN (1, 2, 3) OR NEW.shot_value NOT IN (2, 3) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'personal' AND ctx = 'shot_missed' THEN
    IF ft NOT IN (1, 2, 3) OR NEW.shot_value NOT IN (2, 3) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind IN ('disruptive', 'flagrant', 'disqualifying') AND ctx = 'no_shot' THEN
    IF ft NOT IN (1, 2, 3) OR NEW.shot_value IS NOT NULL THEN
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
    IF ft NOT IN (1, 2, 3) OR NEW.shot_value IS NOT NULL THEN
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

INSERT INTO translations (key, locale, value) VALUES
  ('trke_foul_received_by', 'en', 'Received by'),
  ('trke_foul_received_by', 'es', 'Recibida por'),
  ('trke_foul_received_by', 'ca', 'Rebuda per'),

  ('trke_foul_received_edit', 'en', 'Who received the foul'),
  ('trke_foul_received_edit', 'es', 'Quién recibió la falta'),
  ('trke_foul_received_edit', 'ca', 'Qui ha rebut la falta'),

  ('trke_foul_received_saved', 'en', 'Saved'),
  ('trke_foul_received_saved', 'es', 'Guardado'),
  ('trke_foul_received_saved', 'ca', 'Desat'),

  ('trke_foul_received_error', 'en', 'Could not save who received the foul'),
  ('trke_foul_received_error', 'es', 'No se ha podido guardar quién recibió la falta'),
  ('trke_foul_received_error', 'ca', 'No s''ha pogut desar qui ha rebut la falta')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
