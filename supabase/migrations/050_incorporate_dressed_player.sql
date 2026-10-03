-- A team of 12 or fewer dresses in full. After the game starts, one more
-- player from the team can still be added while the squad stays at 12 or under.
-- Removing a dressed player after the start stays blocked.

CREATE OR REPLACE FUNCTION enforce_game_squad()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM games g
    JOIN players p ON p.team_id = g.team_id AND p.id = NEW.player_id
    WHERE g.id = NEW.game_id
  ) THEN
    RAISE EXCEPTION 'Player is not on this team';
  END IF;

  PERFORM 1 FROM games WHERE id = NEW.game_id FOR UPDATE;

  SELECT COUNT(*) INTO v_count
  FROM game_squads
  WHERE game_id = NEW.game_id
    AND player_id IS DISTINCT FROM NEW.player_id;

  IF v_count >= 12 THEN
    RAISE EXCEPTION 'A game can dress at most 12 players';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT check_game_not_started(NEW.game_id) THEN
    RAISE EXCEPTION 'Cannot change the dressed players after the game has started';
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_squad_incorporate', 'en', 'Add a player'),
  ('trke_squad_incorporate', 'es', 'Incorporar jugador'),
  ('trke_squad_incorporate', 'ca', 'Incorpora un jugador'),
  ('trke_squad_incorporate_hint', 'en', 'Choose a player from the team who is not dressed. At most 12.'),
  ('trke_squad_incorporate_hint', 'es', 'Elige un jugador del equipo que no viste. Máximo 12.'),
  ('trke_squad_incorporate_hint', 'ca', 'Tria un jugador de l''equip que no vesteix. Màxim 12.'),
  ('trke_squad_incorporate_full', 'en', 'This game already has 12 dressed players'),
  ('trke_squad_incorporate_full', 'es', 'Este partido ya tiene 12 jugadores vestidos'),
  ('trke_squad_incorporate_full', 'ca', 'Aquest partit ja té 12 jugadors vestits'),
  ('trke_squad_incorporate_none', 'en', 'Every player on the team is already dressed'),
  ('trke_squad_incorporate_none', 'es', 'Todos los del equipo ya visten'),
  ('trke_squad_incorporate_none', 'ca', 'Tots els de l''equip ja vesteixen'),
  ('trke_squad_incorporate_duplicate', 'en', 'That player is already dressed'),
  ('trke_squad_incorporate_duplicate', 'es', 'Ese jugador ya viste'),
  ('trke_squad_incorporate_duplicate', 'ca', 'Aquest jugador ja vesteix'),
  ('trke_period_lineup_not_dressed', 'en', 'Only a dressed player can start a period'),
  ('trke_period_lineup_not_dressed', 'es', 'Solo un jugador vestido puede iniciar el periodo'),
  ('trke_period_lineup_not_dressed', 'ca', 'Només un jugador vestit pot iniciar el període')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
