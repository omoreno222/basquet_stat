-- A rebound can belong to the opponent team when the recorder does not know the jersey.
-- rebound_side is only 'away', and only on a rebound row with no player.
-- Named rebounds keep the side on player_id or opponent_player_id.
-- Existing game_events RLS still gates the row. This column does not add a policy.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS rebound_side TEXT;

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_rebound_side;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_rebound_side
  CHECK (rebound_side IS NULL OR rebound_side = 'away');

COMMENT ON COLUMN game_events.rebound_side IS
  'Opponent team rebound with no player. Null when a player is named.';

CREATE OR REPLACE FUNCTION enforce_rebound_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'rebound' THEN
    IF NEW.rebound_side IS NOT NULL THEN
      RAISE EXCEPTION 'rebound_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_offensive IS NULL OR NEW.play_group_id IS NULL THEN
    RAISE EXCEPTION 'rebound_shape';
  END IF;

  IF NEW.player_id IS NULL AND NEW.opponent_player_id IS NULL THEN
    IF NEW.rebound_side IS DISTINCT FROM 'away' THEN
      RAISE EXCEPTION 'rebound_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.rebound_side IS NOT NULL
    OR (NEW.player_id IS NOT NULL AND NEW.opponent_player_id IS NOT NULL) THEN
    RAISE EXCEPTION 'rebound_shape';
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_unknown_rebound', 'en', 'Rebound by the other team. Player unknown.'),
  ('trke_unknown_rebound', 'es', 'Rebote del otro equipo. Jugador desconocido.'),
  ('trke_unknown_rebound', 'ca', 'Rebot de l''altre equip. Jugador desconegut.'),

  ('trke_unknown_rebound_log', 'en', 'Player unknown'),
  ('trke_unknown_rebound_log', 'es', 'Jugador desconocido'),
  ('trke_unknown_rebound_log', 'ca', 'Jugador desconegut')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
