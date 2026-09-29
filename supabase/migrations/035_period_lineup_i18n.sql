-- Copy for the period lineup, the dressed twelve, and the coach on the bench.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_opponent_roster_hint', 'en', 'Enter up to 12 jerseys. Add the coach as one more row.'),
  ('trke_opponent_roster_hint', 'es', 'Introduce hasta 12 dorsales. El entrenador se anota como una fila más.'),
  ('trke_opponent_roster_hint', 'ca', 'Introdueix fins a 12 dorsals. L''entrenador s''anota com una fila més.'),

  ('trke_opponent_roster_coach', 'en', 'Coach'),
  ('trke_opponent_roster_coach', 'es', 'Entrenador'),
  ('trke_opponent_roster_coach', 'ca', 'Entrenador'),

  ('trke_opponent_roster_one_coach', 'en', 'Only one coach'),
  ('trke_opponent_roster_one_coach', 'es', 'Solo un entrenador'),
  ('trke_opponent_roster_one_coach', 'ca', 'Només un entrenador'),

  ('trke_team_coach', 'en', 'Coach'),
  ('trke_team_coach', 'es', 'Entrenador'),
  ('trke_team_coach', 'ca', 'Entrenador'),

  ('trke_team_coach_none', 'en', 'No coach'),
  ('trke_team_coach_none', 'es', 'Sin entrenador'),
  ('trke_team_coach_none', 'ca', 'Sense entrenador'),

  ('trke_team_coach_hint', 'en', 'Optional. A user with the coach role in this club.'),
  ('trke_team_coach_hint', 'es', 'Opcional. Un usuario con rol de entrenador en este club.'),
  ('trke_team_coach_hint', 'ca', 'Opcional. Un usuari amb rol d''entrenador en aquest club.'),

  ('trke_squad_title', 'en', 'Who dresses'),
  ('trke_squad_title', 'es', 'Quién juega'),
  ('trke_squad_title', 'ca', 'Qui juga'),

  ('trke_squad_hint', 'en', 'This team has more than 12 players. Choose the 12 for this game.'),
  ('trke_squad_hint', 'es', 'Este equipo tiene más de 12 jugadores. Elige los 12 de este partido.'),
  ('trke_squad_hint', 'ca', 'Aquest equip té més de 12 jugadors. Tria els 12 d''aquest partit.'),

  ('trke_squad_need_twelve', 'en', 'Choose exactly 12 players'),
  ('trke_squad_need_twelve', 'es', 'Elige exactamente 12 jugadores'),
  ('trke_squad_need_twelve', 'ca', 'Tria exactament 12 jugadors'),

  ('trke_period_lineup_title', 'en', 'Who starts this period'),
  ('trke_period_lineup_title', 'es', 'Quién inicia este periodo'),
  ('trke_period_lineup_title', 'ca', 'Qui comença aquest període'),

  ('trke_period_lineup_hint', 'en', 'You can save fewer than five. The period starts only when both teams have enough players on the court.'),
  ('trke_period_lineup_hint', 'es', 'Puedes guardar menos de cinco. El periodo solo empieza si los dos equipos tienen bastantes jugadores en pista.'),
  ('trke_period_lineup_hint', 'ca', 'Pots desar menys de cinc. El període només comença si els dos equips tenen prou jugadors a la pista.'),

  ('trke_period_lineup_need', 'en', 'Players needed to start'),
  ('trke_period_lineup_need', 'es', 'Jugadores necesarios para empezar'),
  ('trke_period_lineup_need', 'ca', 'Jugadors necessaris per començar'),

  ('trke_period_lineup_eliminated', 'en', 'Fouled out'),
  ('trke_period_lineup_eliminated', 'es', 'Eliminado'),
  ('trke_period_lineup_eliminated', 'ca', 'Eliminat'),

  ('trke_period_lineup_saved_short', 'en', 'Saved. This period cannot start yet.'),
  ('trke_period_lineup_saved_short', 'es', 'Guardado. Este periodo todavía no puede empezar.'),
  ('trke_period_lineup_saved_short', 'ca', 'Desat. Aquest període encara no pot començar.'),

  ('trke_lineup_start_blocked', 'en', 'Set both lineups before starting the period'),
  ('trke_lineup_start_blocked', 'es', 'Marca los dos quintetos antes de iniciar el periodo'),
  ('trke_lineup_start_blocked', 'ca', 'Marca els dos quintets abans d''iniciar el període'),

  ('trke_coach_technical', 'en', 'Technical on the coach'),
  ('trke_coach_technical', 'es', 'Técnica al entrenador'),
  ('trke_coach_technical', 'ca', 'Tècnica a l''entrenador'),

  ('trke_opponent_foul_pick', 'en', 'Who fouled?'),
  ('trke_opponent_foul_pick', 'es', '¿Quién ha hecho la falta?'),
  ('trke_opponent_foul_pick', 'ca', 'Qui ha fet la falta?')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
