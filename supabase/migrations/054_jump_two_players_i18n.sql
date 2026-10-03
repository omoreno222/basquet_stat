-- Opening tip: one jumper on each team, then who wins.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_jump_hint', 'en', 'Tap one jumper on each team. Start the clock and mark who wins.'),
  ('trke_jump_hint', 'es', 'Toca un saltador de cada equipo. Arranca el reloj y marca quién gana.'),
  ('trke_jump_hint', 'ca', 'Toca un saltador de cada equip. Engega el rellotge i marca qui guanya.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
