-- The opponent coach is a bench row, not a jersey.
-- Players still need a unique shirt number. The coach does not.

ALTER TABLE game_opponent_players
  DROP CONSTRAINT IF EXISTS game_opponent_players_jersey_number_check;

ALTER TABLE game_opponent_players
  ALTER COLUMN jersey_number DROP NOT NULL;

UPDATE game_opponent_players
SET jersey_number = NULL
WHERE is_coach;

ALTER TABLE game_opponent_players
  ADD CONSTRAINT game_opponent_players_jersey_number_check
  CHECK (
    (is_coach AND jersey_number IS NULL)
    OR (NOT is_coach AND jersey_number BETWEEN 0 AND 99)
  );

COMMENT ON COLUMN game_opponent_players.jersey_number IS 'Shirt number seen during this game. Unique within the game. Null only for the opponent coach.';
COMMENT ON COLUMN game_opponent_players.is_coach IS 'Opponent coach. No jersey, does not count toward the 12, and cannot start a period.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_opponent_roster_hint', 'en', 'Enter up to 12 jerseys. Add the coach with the button. The coach has no jersey.'),
  ('trke_opponent_roster_hint', 'es', 'Introduce hasta 12 dorsales. Añade el entrenador con el botón. El entrenador no tiene dorsal.'),
  ('trke_opponent_roster_hint', 'ca', 'Introdueix fins a 12 dorsals. Afegeix l''entrenador amb el botó. L''entrenador no té dorsal.'),

  ('trke_opponent_roster_add_coach', 'en', 'Add coach'),
  ('trke_opponent_roster_add_coach', 'es', 'Añadir entrenador'),
  ('trke_opponent_roster_add_coach', 'ca', 'Afegir entrenador'),

  ('trke_opponent_roster_coach_name', 'en', 'Coach name'),
  ('trke_opponent_roster_coach_name', 'es', 'Nombre del entrenador'),
  ('trke_opponent_roster_coach_name', 'ca', 'Nom de l''entrenador')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
