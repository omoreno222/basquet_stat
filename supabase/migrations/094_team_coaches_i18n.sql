-- Copy for assigning up to three coaches on a team.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_team_coaches', 'en', 'Coaches'),
  ('trke_team_coaches', 'es', 'Entrenadores'),
  ('trke_team_coaches', 'ca', 'Entrenadors'),
  ('trke_team_coaches_hint', 'en', 'Optional. Up to 3 users with the coach role in this club.'),
  ('trke_team_coaches_hint', 'es', 'Opcional. Hasta 3 usuarios con rol de entrenador en este club.'),
  ('trke_team_coaches_hint', 'ca', 'Opcional. Fins a 3 usuaris amb rol d''entrenador en aquest club.'),
  ('trke_team_coaches_limit', 'en', 'A team can have at most 3 coaches'),
  ('trke_team_coaches_limit', 'es', 'Un equipo puede tener como máximo 3 entrenadores'),
  ('trke_team_coaches_limit', 'ca', 'Un equip pot tenir com a màxim 3 entrenadors'),
  ('trke_team_coach_invalid', 'en', 'Each coach must be a user with the coach role in this club'),
  ('trke_team_coach_invalid', 'es', 'Cada entrenador debe ser un usuario con rol de entrenador en este club'),
  ('trke_team_coach_invalid', 'ca', 'Cada entrenador ha de ser un usuari amb rol d''entrenador en aquest club'),
  ('trke_team_coaches_duplicate', 'en', 'Each coach can only be added once'),
  ('trke_team_coaches_duplicate', 'es', 'Cada entrenador solo puede añadirse una vez'),
  ('trke_team_coaches_duplicate', 'ca', 'Cada entrenador només es pot afegir una vegada'),
  ('trke_team_coach_none', 'en', 'No coaches'),
  ('trke_team_coach_none', 'es', 'Sin entrenadores'),
  ('trke_team_coach_none', 'ca', 'Sense entrenadors')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

DELETE FROM translations WHERE key = 'trke_team_coach_hint';
