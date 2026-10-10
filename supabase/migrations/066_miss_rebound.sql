-- A missed shot records a rebound on the existing game_events row.
-- is_offensive already distinguishes an offensive rebound from a defensive one.
-- This trigger only refuses a rebound row that has no player, no side, or no group.
-- A personal foul on a missed shot can award 1, 2, or 3 free throws.
-- The operator chooses the count. The foul wizard still sends 2 or 3.

CREATE OR REPLACE FUNCTION enforce_rebound_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'rebound' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_offensive IS NULL
    OR NEW.play_group_id IS NULL
    OR (NEW.player_id IS NULL AND NEW.opponent_player_id IS NULL)
    OR (NEW.player_id IS NOT NULL AND NEW.opponent_player_id IS NOT NULL) THEN
    RAISE EXCEPTION 'rebound_shape';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_events_enforce_rebound ON game_events;
CREATE TRIGGER game_events_enforce_rebound
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_rebound_event();

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
  IF NEW.foul_side IS NULL AND NEW.foul_context IS NULL THEN
    RETURN NEW;
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
    IF ft NOT IN (1, 2, 3) OR NEW.shot_value NOT IN (2, 3) THEN
      RAISE EXCEPTION 'foul_shape';
    END IF;
  ELSIF kind = 'personal' AND ctx = 'shot_missed' THEN
    IF ft NOT IN (1, 2, 3) OR NEW.shot_value NOT IN (2, 3) THEN
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
    RETURN NEW;
  END IF;

  IF NEW.foul_side = 'home' AND (NEW.player_id IS NULL OR NEW.opponent_player_id IS NOT NULL) THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;
  IF NEW.foul_side = 'away' AND (NEW.opponent_player_id IS NULL OR NEW.player_id IS NOT NULL) THEN
    RAISE EXCEPTION 'foul_shape';
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_miss_and_personal', 'en', 'Miss and a personal foul'),
  ('trke_miss_and_personal', 'es', 'Fallo y personal'),
  ('trke_miss_and_personal', 'ca', 'Fall i personal'),

  ('trke_miss_hint_court', 'en', 'Tap the miss on the attacking half'),
  ('trke_miss_hint_court', 'es', 'Toca el fallo en el campo de ataque'),
  ('trke_miss_hint_court', 'ca', 'Toca el fall a la pista d''atac'),

  ('trke_miss_hint_shooter_2', 'en', 'Missed 2. Choose the shooter.'),
  ('trke_miss_hint_shooter_2', 'es', 'Fallo de 2. Elige al tirador.'),
  ('trke_miss_hint_shooter_2', 'ca', 'Fall de 2. Tria el tirador.'),

  ('trke_miss_hint_shooter_3', 'en', 'Missed 3. Choose the shooter.'),
  ('trke_miss_hint_shooter_3', 'es', 'Fallo de 3. Elige al tirador.'),
  ('trke_miss_hint_shooter_3', 'ca', 'Fall de 3. Tria el tirador.'),

  ('trke_miss_hint_rebound', 'en', 'Choose who took the rebound'),
  ('trke_miss_hint_rebound', 'es', 'Elige quién coge el rebote'),
  ('trke_miss_hint_rebound', 'ca', 'Tria qui agafa el rebot'),

  ('trke_miss_hint_scored', 'en', 'Miss.'),
  ('trke_miss_hint_scored', 'es', 'Fallo.'),
  ('trke_miss_hint_scored', 'ca', 'Fall.'),

  ('trke_miss_hint_roster', 'en', 'Put players on the court before the miss'),
  ('trke_miss_hint_roster', 'es', 'Pon jugadores en pista antes del fallo'),
  ('trke_miss_hint_roster', 'ca', 'Posa jugadors a la pista abans del fall'),

  ('trke_miss_hint_error', 'en', 'Could not save the miss'),
  ('trke_miss_hint_error', 'es', 'No se ha podido guardar el fallo'),
  ('trke_miss_hint_error', 'ca', 'No s''ha pogut desar el fall')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
