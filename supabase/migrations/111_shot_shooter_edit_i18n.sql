-- Labels for changing the shooter of a made basket from the action log.
-- The shot stays with the same team. No schema change.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_shot_shooter', 'en', 'Shooter'),
  ('trke_shot_shooter', 'es', 'Tirador'),
  ('trke_shot_shooter', 'ca', 'Tirador'),

  ('trke_shot_point_player', 'en', 'Choose a teammate who was on the court'),
  ('trke_shot_point_player', 'es', 'Elige un compañero que estuviera en pista'),
  ('trke_shot_point_player', 'ca', 'Tria un company que fos a la pista')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
