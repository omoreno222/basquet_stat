-- Foul routine: side, context, shot value, and a group id so undo removes the whole play.
-- New enum labels are added here and not cast in this file. PostgreSQL cannot use a
-- label added in the same transaction.

ALTER TYPE foul_type ADD VALUE IF NOT EXISTS 'disruptive';
ALTER TYPE foul_type ADD VALUE IF NOT EXISTS 'flagrant';
ALTER TYPE foul_type ADD VALUE IF NOT EXISTS 'disqualifying';
ALTER TYPE foul_type ADD VALUE IF NOT EXISTS 'double';

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS foul_side TEXT,
  ADD COLUMN IF NOT EXISTS foul_context TEXT,
  ADD COLUMN IF NOT EXISTS shot_value SMALLINT,
  ADD COLUMN IF NOT EXISTS play_group_id UUID,
  ADD COLUMN IF NOT EXISTS possession_before TEXT;

ALTER TABLE game_events DROP CONSTRAINT IF EXISTS game_events_foul_side;
ALTER TABLE game_events
  ADD CONSTRAINT game_events_foul_side
  CHECK (foul_side IS NULL OR foul_side IN ('home', 'away'));

ALTER TABLE game_events DROP CONSTRAINT IF EXISTS game_events_foul_context;
ALTER TABLE game_events
  ADD CONSTRAINT game_events_foul_context
  CHECK (
    foul_context IS NULL
    OR foul_context IN ('offensive', 'no_shot', 'shot_made', 'shot_missed', 'technical', 'double')
  );

ALTER TABLE game_events DROP CONSTRAINT IF EXISTS game_events_shot_value;
ALTER TABLE game_events
  ADD CONSTRAINT game_events_shot_value
  CHECK (shot_value IS NULL OR shot_value IN (2, 3));

ALTER TABLE game_events DROP CONSTRAINT IF EXISTS game_events_possession_before;
ALTER TABLE game_events
  ADD CONSTRAINT game_events_possession_before
  CHECK (possession_before IS NULL OR possession_before IN ('home', 'away'));

CREATE INDEX IF NOT EXISTS idx_game_events_play_group ON game_events (play_group_id);

COMMENT ON COLUMN game_events.foul_side IS 'Team that committed the foul. Null on rows recorded before the foul routine.';
COMMENT ON COLUMN game_events.foul_context IS 'offensive, no_shot, shot_made, shot_missed, technical, or double.';
COMMENT ON COLUMN game_events.shot_value IS '2 or 3 when the foul was on a shot. The court point decides which.';
COMMENT ON COLUMN game_events.play_group_id IS 'Links the foul, the field goal, and its free throws so undo deletes them together.';
COMMENT ON COLUMN game_events.possession_before IS 'Possession to restore if this play is undone.';

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

DROP TRIGGER IF EXISTS game_events_enforce_foul ON game_events;
CREATE TRIGGER game_events_enforce_foul
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_foul_event();

INSERT INTO translations (key, locale, value) VALUES
  ('trke_foul_hint_court', 'en', 'Tap where the foul happened'),
  ('trke_foul_hint_court', 'es', 'Toca donde fue la falta'),
  ('trke_foul_hint_court', 'ca', 'Toca on ha estat la falta'),
  ('trke_foul_hint_player', 'en', 'Choose who committed the foul'),
  ('trke_foul_hint_player', 'es', 'Elige quién cometió la falta'),
  ('trke_foul_hint_player', 'ca', 'Tria qui ha comès la falta'),
  ('trke_foul_hint_type', 'en', 'Choose the foul'),
  ('trke_foul_hint_type', 'es', 'Elige la falta'),
  ('trke_foul_hint_type', 'ca', 'Tria la falta'),
  ('trke_foul_hint_situation', 'en', 'Was there a shot?'),
  ('trke_foul_hint_situation', 'es', '¿Había tiro?'),
  ('trke_foul_hint_situation', 'ca', 'Hi havia tir?'),
  ('trke_foul_hint_victim', 'en', 'Choose who was fouled'),
  ('trke_foul_hint_victim', 'es', 'Elige quién recibió la falta'),
  ('trke_foul_hint_victim', 'ca', 'Tria qui ha rebut la falta'),
  ('trke_foul_hint_shooter', 'en', 'Choose the free-throw shooter'),
  ('trke_foul_hint_shooter', 'es', 'Elige el tirador de los tiros libres'),
  ('trke_foul_hint_shooter', 'ca', 'Tria el tirador dels tirs lliures'),
  ('trke_foul_hint_other', 'en', 'Choose the other player'),
  ('trke_foul_hint_other', 'es', 'Elige al otro jugador'),
  ('trke_foul_hint_other', 'ca', 'Tria l''altre jugador'),
  ('trke_foul_personal', 'en', 'Personal'),
  ('trke_foul_personal', 'es', 'Personal'),
  ('trke_foul_personal', 'ca', 'Personal'),
  ('trke_foul_disruptive', 'en', 'Disruptive'),
  ('trke_foul_disruptive', 'es', 'Disruptive'),
  ('trke_foul_disruptive', 'ca', 'Disruptive'),
  ('trke_foul_flagrant', 'en', 'Flagrant'),
  ('trke_foul_flagrant', 'es', 'Flagrant'),
  ('trke_foul_flagrant', 'ca', 'Flagrant'),
  ('trke_foul_disqualifying', 'en', 'Disqualifying'),
  ('trke_foul_disqualifying', 'es', 'Descalificante'),
  ('trke_foul_disqualifying', 'ca', 'Desqualificant'),
  ('trke_foul_technical', 'en', 'Technical'),
  ('trke_foul_technical', 'es', 'Técnica'),
  ('trke_foul_technical', 'ca', 'Tècnica'),
  ('trke_foul_double', 'en', 'Double foul'),
  ('trke_foul_double', 'es', 'Doble falta'),
  ('trke_foul_double', 'ca', 'Doble falta'),
  ('trke_foul_no_shot', 'en', 'No shot'),
  ('trke_foul_no_shot', 'es', 'Sin tiro'),
  ('trke_foul_no_shot', 'ca', 'Sense tir'),
  ('trke_foul_shot_made', 'en', 'Basket made'),
  ('trke_foul_shot_made', 'es', 'Canasta convertida'),
  ('trke_foul_shot_made', 'ca', 'Cistella anotada'),
  ('trke_foul_shot_missed', 'en', 'Shot missed'),
  ('trke_foul_shot_missed', 'es', 'Tiro fallado'),
  ('trke_foul_shot_missed', 'ca', 'Tir fallat'),
  ('trke_foul_cancel', 'en', 'Cancel'),
  ('trke_foul_cancel', 'es', 'Cancelar'),
  ('trke_foul_cancel', 'ca', 'Cancel·la'),
  ('trke_foul_hint_inbound', 'en', 'Inbound. Press start clock.'),
  ('trke_foul_hint_inbound', 'es', 'Saque. Pulsa start clock.'),
  ('trke_foul_hint_inbound', 'ca', 'Servei. Prem start clock.'),
  ('trke_foul_hint_live', 'en', 'Live ball. Set possession, then press start clock.'),
  ('trke_foul_hint_live', 'es', 'Balón vivo. Asigna la posesión y pulsa start clock.'),
  ('trke_foul_hint_live', 'ca', 'Pilota viva. Assigna la possessió i prem start clock.'),
  ('trke_foul_hint_resume', 'en', 'Possession unchanged. Press start clock.'),
  ('trke_foul_hint_resume', 'es', 'La posesión no cambia. Pulsa start clock.'),
  ('trke_foul_hint_resume', 'ca', 'La possessió no canvia. Prem start clock.'),
  ('trke_foul_hint_ejected', 'en', 'That player is out of the game.'),
  ('trke_foul_hint_ejected', 'es', 'Ese jugador queda fuera del partido.'),
  ('trke_foul_hint_ejected', 'ca', 'Aquest jugador queda fora del partit.'),
  ('trke_foul_hint_eliminated', 'en', 'That player is already eliminated'),
  ('trke_foul_hint_eliminated', 'es', 'Ese jugador ya está eliminado'),
  ('trke_foul_hint_eliminated', 'ca', 'Aquest jugador ja està eliminat'),
  ('trke_foul_hint_possession', 'en', 'Set possession before the foul'),
  ('trke_foul_hint_possession', 'es', 'Asigna la posesión antes de la falta'),
  ('trke_foul_hint_possession', 'ca', 'Assigna la possessió abans de la falta'),
  ('trke_foul_hint_error', 'en', 'Could not save the foul'),
  ('trke_foul_hint_error', 'es', 'No se pudo guardar la falta'),
  ('trke_foul_hint_error', 'ca', 'No s''ha pogut desar la falta'),
  ('trke_ft_sequence_mark', 'en', 'Mark each free throw'),
  ('trke_ft_sequence_mark', 'es', 'Marca cada tiro libre'),
  ('trke_ft_sequence_mark', 'ca', 'Marca cada tir lliure')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
