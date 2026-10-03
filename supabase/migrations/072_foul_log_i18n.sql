-- Action-log label for a personal foul: attack or defense, then the player's foul number.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_foul_log_defensive', 'en', 'Defensive foul'),
  ('trke_foul_log_defensive', 'es', 'Falta defensiva'),
  ('trke_foul_log_defensive', 'ca', 'Falta defensiva'),

  ('trke_foul_log_attack', 'en', 'Attack foul'),
  ('trke_foul_log_attack', 'es', 'Falta en ataque'),
  ('trke_foul_log_attack', 'ca', 'Falta en atac'),

  ('trke_foul_ord_1', 'en', '1st'),
  ('trke_foul_ord_1', 'es', '1ª'),
  ('trke_foul_ord_1', 'ca', '1a'),

  ('trke_foul_ord_2', 'en', '2nd'),
  ('trke_foul_ord_2', 'es', '2ª'),
  ('trke_foul_ord_2', 'ca', '2a'),

  ('trke_foul_ord_3', 'en', '3rd'),
  ('trke_foul_ord_3', 'es', '3ª'),
  ('trke_foul_ord_3', 'ca', '3a'),

  ('trke_foul_ord_4', 'en', '4th'),
  ('trke_foul_ord_4', 'es', '4ª'),
  ('trke_foul_ord_4', 'ca', '4a'),

  ('trke_foul_ord_5', 'en', '5th (Out)'),
  ('trke_foul_ord_5', 'es', '5ª (fuera)'),
  ('trke_foul_ord_5', 'ca', '5a (fora)')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
