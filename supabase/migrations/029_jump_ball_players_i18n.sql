-- Jump ball: pick the player who jumps, with both lineups on the sides.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_jump_hint', 'en', 'Start the clock, then tap who jumps'),
  ('trke_jump_hint', 'es', 'Arranca el reloj y toca quién salta'),
  ('trke_jump_hint', 'ca', 'Engega el rellotge i toca qui salta'),

  ('trke_jump_who', 'en', 'Who jumps?'),
  ('trke_jump_who', 'es', '¿Quién salta?'),
  ('trke_jump_who', 'ca', 'Qui salta?'),

  ('trke_jump_jersey', 'en', 'Jersey'),
  ('trke_jump_jersey', 'es', 'Dorsal'),
  ('trke_jump_jersey', 'ca', 'Dorsal')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
