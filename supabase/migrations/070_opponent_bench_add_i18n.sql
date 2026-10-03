-- Pencil on the opponent bench: add a jersey during the game, up to 12.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_opponent_bench_edit', 'en', 'Edit bench'),
  ('trke_opponent_bench_edit', 'es', 'Editar banquillo'),
  ('trke_opponent_bench_edit', 'ca', 'Editar la banqueta'),

  ('trke_opponent_bench_add_title', 'en', 'Add a bench player'),
  ('trke_opponent_bench_add_title', 'es', 'Añadir al banquillo'),
  ('trke_opponent_bench_add_title', 'ca', 'Afegir a la banqueta'),

  ('trke_opponent_bench_add_hint', 'en', 'Add a jersey from the bench. Up to 12. Then you can substitute them in.'),
  ('trke_opponent_bench_add_hint', 'es', 'Añade un dorsal del banquillo. Hasta 12. Después ya puede entrar en un cambio.'),
  ('trke_opponent_bench_add_hint', 'ca', 'Afegeix un dorsal de la banqueta. Fins a 12. Després ja pot entrar en un canvi.'),

  ('trke_sub_add_player_first', 'en', 'Add the player with the pencil on the bench, then substitute.'),
  ('trke_sub_add_player_first', 'es', 'Primero añade el jugador con el lápiz del banquillo y después haz el cambio.'),
  ('trke_sub_add_player_first', 'ca', 'Primer afegeix el jugador amb el llapis de la banqueta i després fes el canvi.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
