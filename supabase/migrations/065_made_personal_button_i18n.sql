-- A personal foul on a made basket can award 1, 2, or 3 free throws.
-- The operator chooses the count. The foul wizard still sends exactly 1.

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

DELETE FROM translations
WHERE key IN (
  'trke_made_hint_foul',
  'trke_made_foul_yes',
  'trke_made_foul_no',
  'trke_made_hint_saved'
);

INSERT INTO translations (key, locale, value) VALUES
  ('trke_made_and_personal', 'en', 'Made and a personal foul'),
  ('trke_made_and_personal', 'es', 'Canasta y personal'),
  ('trke_made_and_personal', 'ca', 'Cistella i personal'),

  ('trke_made_hint_scored', 'en', 'Basket.'),
  ('trke_made_hint_scored', 'es', 'Canasta.'),
  ('trke_made_hint_scored', 'ca', 'Cistella.'),

  ('trke_made_ft_count', 'en', 'How many free throws?'),
  ('trke_made_ft_count', 'es', '¿Cuántos tiros libres?'),
  ('trke_made_ft_count', 'ca', 'Quants tirs lliures?')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
