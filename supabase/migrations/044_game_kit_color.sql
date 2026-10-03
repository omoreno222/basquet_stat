-- Which of the club's two colors the team wears in this game.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS kit_color TEXT NOT NULL DEFAULT 'primary';

ALTER TABLE games
  DROP CONSTRAINT IF EXISTS games_kit_color_check;

ALTER TABLE games
  ADD CONSTRAINT games_kit_color_check CHECK (kit_color IN ('primary', 'secondary'));

COMMENT ON COLUMN games.kit_color IS 'Club color worn in this game: primary or secondary.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_game_kit_color', 'en', 'Jersey color'),
  ('trke_game_kit_color', 'es', 'Color de la camiseta'),
  ('trke_game_kit_color', 'ca', 'Color de la samarreta'),

  ('trke_game_kit_color_hint', 'en', 'Select a team to choose one of its club colors'),
  ('trke_game_kit_color_hint', 'es', 'Elige un equipo para seleccionar uno de los colores del club'),
  ('trke_game_kit_color_hint', 'ca', 'Tria un equip per seleccionar un dels colors del club')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
