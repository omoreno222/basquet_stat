-- Opponent roster captured at the start of a game.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_opponent_roster_title', 'en', 'Opponent roster'),
  ('trke_opponent_roster_title', 'es', 'Equipo rival'),
  ('trke_opponent_roster_title', 'ca', 'Equip rival'),

  ('trke_opponent_roster_hint', 'en', 'Enter at least 5 jerseys and choose the starting five'),
  ('trke_opponent_roster_hint', 'es', 'Introduce al menos 5 dorsales y elige el quinteto'),
  ('trke_opponent_roster_hint', 'ca', 'Introdueix almenys 5 dorsals i tria el quintet'),

  ('trke_opponent_roster_jersey', 'en', 'Jersey'),
  ('trke_opponent_roster_jersey', 'es', 'Dorsal'),
  ('trke_opponent_roster_jersey', 'ca', 'Dorsal'),

  ('trke_opponent_roster_name', 'en', 'Name, if readable'),
  ('trke_opponent_roster_name', 'es', 'Nombre, si se lee'),
  ('trke_opponent_roster_name', 'ca', 'Nom, si es llegeix'),

  ('trke_opponent_roster_add', 'en', 'Add jersey'),
  ('trke_opponent_roster_add', 'es', 'Añadir dorsal'),
  ('trke_opponent_roster_add', 'ca', 'Afegir dorsal'),

  ('trke_opponent_roster_remove', 'en', 'Remove'),
  ('trke_opponent_roster_remove', 'es', 'Quitar'),
  ('trke_opponent_roster_remove', 'ca', 'Treure'),

  ('trke_opponent_roster_starter', 'en', 'Starting five'),
  ('trke_opponent_roster_starter', 'es', 'Quinteto inicial'),
  ('trke_opponent_roster_starter', 'ca', 'Quintet inicial'),

  ('trke_opponent_roster_need_five', 'en', 'Choose exactly 5 starters'),
  ('trke_opponent_roster_need_five', 'es', 'Elige exactamente 5 titulares'),
  ('trke_opponent_roster_need_five', 'ca', 'Tria exactament 5 titulars'),

  ('trke_opponent_roster_max', 'en', 'This game already has 12 opponent jerseys'),
  ('trke_opponent_roster_max', 'es', 'Este partido ya tiene 12 dorsales rivales'),
  ('trke_opponent_roster_max', 'ca', 'Aquest partit ja té 12 dorsals rivals'),

  ('trke_opponent_roster_duplicate', 'en', 'That jersey is already on this team'),
  ('trke_opponent_roster_duplicate', 'es', 'Ese dorsal ya está en este equipo'),
  ('trke_opponent_roster_duplicate', 'ca', 'Aquest dorsal ja és en aquest equip'),

  ('trke_opponent_roster_save', 'en', 'Save roster'),
  ('trke_opponent_roster_save', 'es', 'Guardar equipo'),
  ('trke_opponent_roster_save', 'ca', 'Desar equip'),

  ('trke_opponent_roster_locked', 'en', 'The starting five cannot be changed after the game starts'),
  ('trke_opponent_roster_locked', 'es', 'El quinteto no se puede cambiar una vez empezado el partido'),
  ('trke_opponent_roster_locked', 'ca', 'El quintet no es pot canviar un cop començat el partit')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
