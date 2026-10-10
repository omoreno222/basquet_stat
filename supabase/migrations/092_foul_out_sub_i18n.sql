-- Prompt shown when a fifth personal, or an ejecting foul, sends a player to the bench.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_sub_hint_foul_out', 'en', 'Out of the game. Tap who comes in from the bench.'),
  ('trke_sub_hint_foul_out', 'es', 'Fuera del partido. Toca quién entra del banquillo.'),
  ('trke_sub_hint_foul_out', 'ca', 'Fora del partit. Toca qui entra de la banqueta.'),
  ('trke_sub_hint_foul_out_short', 'en', 'Out of the game. The team continues a player short.'),
  ('trke_sub_hint_foul_out_short', 'es', 'Fuera del partido. El equipo sigue con uno menos.'),
  ('trke_sub_hint_foul_out_short', 'ca', 'Fora del partit. L''equip segueix amb un menys.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
