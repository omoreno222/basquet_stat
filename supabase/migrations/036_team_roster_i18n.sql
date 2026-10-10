INSERT INTO translations (key, locale, value) VALUES
  ('trke_view_players', 'en', 'View players'),
  ('trke_view_players', 'es', 'Ver jugadores'),
  ('trke_view_players', 'ca', 'Veure jugadors'),

  ('trke_hide_players', 'en', 'Hide players'),
  ('trke_hide_players', 'es', 'Ocultar jugadores'),
  ('trke_hide_players', 'ca', 'Amagar jugadors'),

  ('trke_player_photo', 'en', 'Photo'),
  ('trke_player_photo', 'es', 'Foto'),
  ('trke_player_photo', 'ca', 'Foto'),

  ('trke_team_no_players', 'en', 'This team has no players'),
  ('trke_team_no_players', 'es', 'Este equipo no tiene jugadores'),
  ('trke_team_no_players', 'ca', 'Aquest equip no té jugadors'),

  ('trke_team_players_error', 'en', 'Could not load players'),
  ('trke_team_players_error', 'es', 'No se han podido cargar los jugadores'),
  ('trke_team_players_error', 'ca', 'No s''han pogut carregar els jugadors')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
