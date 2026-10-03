-- Jersey color of the visiting team, chosen when the game is created.
-- The opponent is not a club, so this is a free hex color for this game only.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS opponent_color TEXT NOT NULL DEFAULT '#737373';

ALTER TABLE games
  DROP CONSTRAINT IF EXISTS games_opponent_color_hex;

ALTER TABLE games
  ADD CONSTRAINT games_opponent_color_hex CHECK (opponent_color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN games.opponent_color IS 'Hex jersey color of the opposing team for this game.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_opponent_color', 'en', 'Opponent color'),
  ('trke_opponent_color', 'es', 'Color del rival'),
  ('trke_opponent_color', 'ca', 'Color del rival'),

  ('trke_game_away_color', 'en', 'Visitor color'),
  ('trke_game_away_color', 'es', 'Color del visitante'),
  ('trke_game_away_color', 'ca', 'Color del visitant')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
