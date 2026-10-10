-- Label above the players on the evaluation scoreboard.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_players', 'en', 'Players'),
  ('trke_players', 'es', 'Jugadores'),
  ('trke_players', 'ca', 'Jugadors')
ON CONFLICT (key, locale) DO NOTHING;
