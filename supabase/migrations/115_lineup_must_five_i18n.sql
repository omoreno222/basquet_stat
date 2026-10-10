-- A team with 5 or more available players cannot take the court with fewer than 5.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_period_lineup_hint', 'en', 'With 5 or more players available, the team must take the court with 5.'),
  ('trke_period_lineup_hint', 'es', 'Si hay 5 o más jugadores, el equipo sale con 5. Solo puede haber menos cuando no quedan cinco.'),
  ('trke_period_lineup_hint', 'ca', 'Si hi ha 5 o més jugadors, l''equip surt amb 5. Només pot haver-n''hi menys quan no en queden cinc.'),
  ('trke_period_lineup_must_five', 'en', 'With 5 or more players available, the team cannot take the court with fewer than 5.'),
  ('trke_period_lineup_must_five', 'es', 'Con 5 o más jugadores, el equipo no puede quedarse con menos de 5.'),
  ('trke_period_lineup_must_five', 'ca', 'Amb 5 o més jugadors, l''equip no es pot quedar amb menys de 5.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
