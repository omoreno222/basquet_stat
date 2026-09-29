-- One row per stretch of time a person is operator A or operator B.
-- The trigger is the only writer. A relief while the clock is running is rejected.
-- Swapping the two current operators is allowed, including from the court.

CREATE TABLE IF NOT EXISTS game_operator_stints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('a', 'b')),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  started_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS game_operator_stints_one_open
  ON game_operator_stints (game_id, slot)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS game_operator_stints_game
  ON game_operator_stints (game_id, started_at DESC);

INSERT INTO game_operator_stints (game_id, slot, user_id)
SELECT id, 'a', slot_a_user_id
FROM games
WHERE slot_a_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM game_operator_stints s
    WHERE s.game_id = games.id AND s.slot = 'a' AND s.ended_at IS NULL
  );

INSERT INTO game_operator_stints (game_id, slot, user_id)
SELECT id, 'b', slot_b_user_id
FROM games
WHERE slot_b_user_id IS NOT NULL
  AND single_recorder = false
  AND NOT EXISTS (
    SELECT 1 FROM game_operator_stints s
    WHERE s.game_id = games.id AND s.slot = 'b' AND s.ended_at IS NULL
  );

ALTER TABLE game_operator_stints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view operator stints for their games" ON game_operator_stints;
CREATE POLICY "Users can view operator stints for their games"
  ON game_operator_stints
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON t.id = g.team_id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

CREATE OR REPLACE FUNCTION guard_game_operator_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  slots_changed boolean;
  pure_swap boolean;
BEGIN
  slots_changed := NEW.slot_a_user_id IS DISTINCT FROM OLD.slot_a_user_id
    OR NEW.slot_b_user_id IS DISTINCT FROM OLD.slot_b_user_id
    OR NEW.single_recorder IS DISTINCT FROM OLD.single_recorder;

  IF NOT slots_changed THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'final' OR NEW.status = 'final' THEN
    RAISE EXCEPTION 'OPERATOR_FINAL' USING ERRCODE = 'check_violation';
  END IF;

  pure_swap := OLD.slot_a_user_id IS NOT NULL
    AND OLD.slot_b_user_id IS NOT NULL
    AND NEW.slot_a_user_id = OLD.slot_b_user_id
    AND NEW.slot_b_user_id = OLD.slot_a_user_id
    AND NEW.single_recorder IS NOT DISTINCT FROM OLD.single_recorder;

  IF OLD.status = 'live' AND OLD.clock_running IS TRUE AND NOT pure_swap THEN
    RAISE EXCEPTION 'OPERATOR_CLOCK' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_operator_slot(
  p_game_id UUID,
  p_slot TEXT,
  p_user_id UUID,
  p_actor UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  SELECT user_id INTO current_user_id
  FROM game_operator_stints
  WHERE game_id = p_game_id
    AND slot = p_slot
    AND ended_at IS NULL;

  IF current_user_id IS NOT DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;

  UPDATE game_operator_stints
  SET ended_at = NOW()
  WHERE game_id = p_game_id
    AND slot = p_slot
    AND ended_at IS NULL;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO game_operator_stints (game_id, slot, user_id, started_by)
    VALUES (p_game_id, p_slot, p_user_id, p_actor);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sync_game_operator_stints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM sync_operator_slot(NEW.id, 'a', NEW.slot_a_user_id, auth.uid());
  IF NEW.single_recorder THEN
    PERFORM sync_operator_slot(NEW.id, 'b', NULL, auth.uid());
  ELSE
    PERFORM sync_operator_slot(NEW.id, 'b', NEW.slot_b_user_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_operator_guard ON games;
CREATE TRIGGER games_operator_guard
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION guard_game_operator_change();

DROP TRIGGER IF EXISTS games_operator_stints ON games;
CREATE TRIGGER games_operator_stints
  AFTER INSERT OR UPDATE OF slot_a_user_id, slot_b_user_id, single_recorder ON games
  FOR EACH ROW
  EXECUTE FUNCTION sync_game_operator_stints();

REVOKE ALL ON FUNCTION guard_game_operator_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_operator_slot(UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_game_operator_stints() FROM PUBLIC;

DELETE FROM translations WHERE key IN ('trke_game_slot_a', 'trke_game_slot_b');

INSERT INTO translations (key, locale, value) VALUES
  ('trke_operator_a', 'en', 'Operator A'),
  ('trke_operator_a', 'es', 'Operador A'),
  ('trke_operator_a', 'ca', 'Operador A'),

  ('trke_operator_b', 'en', 'Operator B'),
  ('trke_operator_b', 'es', 'Operador B'),
  ('trke_operator_b', 'ca', 'Operador B'),

  ('trke_operator_log', 'en', 'Operator log'),
  ('trke_operator_log', 'es', 'Registro de operadores'),
  ('trke_operator_log', 'ca', 'Registre d''operadors'),

  ('trke_operator_since', 'en', 'Since'),
  ('trke_operator_since', 'es', 'Desde'),
  ('trke_operator_since', 'ca', 'Des de'),

  ('trke_operator_until', 'en', 'Until'),
  ('trke_operator_until', 'es', 'Hasta'),
  ('trke_operator_until', 'ca', 'Fins a'),

  ('trke_operator_current', 'en', 'Current'),
  ('trke_operator_current', 'es', 'Actual'),
  ('trke_operator_current', 'ca', 'Actual'),

  ('trke_operator_clock_running', 'en', 'Stop the clock before changing operators.'),
  ('trke_operator_clock_running', 'es', 'Para el reloj antes de cambiar de operador.'),
  ('trke_operator_clock_running', 'ca', 'Atura el rellotge abans de canviar d''operador.'),

  ('trke_operator_final', 'en', 'Operators cannot be changed after the game has ended.'),
  ('trke_operator_final', 'es', 'No se pueden cambiar los operadores con el partido terminado.'),
  ('trke_operator_final', 'ca', 'No es poden canviar els operadors amb el partit acabat.'),

  ('trke_game_slot_a_help', 'en', 'Clock (start, stop, next period). Made and missed 1, 2 and 3 point shots on the court; free throws green or red on the free-throw line. Fouls by type, with a player counter that warns at 5. Substitutions, which produce minutes. Starting lineup, synced live to operator B. Opponent score.'),
  ('trke_game_slot_a_help', 'es', 'Reloj (arrancar, parar y cambiar de cuarto). Tiros de 1, 2 y 3 anotados y fallados en la cancha; tiros libres en verde o rojo en la línea de tiros libres. Faltas con su tipo y aviso al llegar a 5. Cambios, de los que salen los minutos. Quinteto inicial, sincronizado en directo con el operador B. Marcador del rival.'),
  ('trke_game_slot_a_help', 'ca', 'Rellotge (engegar, aturar i canviar de quart). Tirs d''1, 2 i 3 encertats i fallats a la pista; tirs lliures en verd o vermell a la línia de tirs lliures. Faltes amb el seu tipus i avís en arribar a 5. Canvis, d''on surten els minuts. Quintet inicial, sincronitzat en directe amb l''operador B. Marcador del rival.'),

  ('trke_swap_slots', 'en', 'Swap operators'),
  ('trke_swap_slots', 'es', 'Intercambiar operadores'),
  ('trke_swap_slots', 'ca', 'Intercanviar operadors')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
