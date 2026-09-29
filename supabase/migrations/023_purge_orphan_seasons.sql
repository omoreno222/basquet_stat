-- Migration 023: Also delete seasons that no longer have teams.
-- A single-club purge removes that club's teams first, then any season left empty.
-- A full purge still removes every season, because every team is already gone.

CREATE OR REPLACE FUNCTION purge_app_data(p_club_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Only a platform admin can do this';
  END IF;

  IF p_club_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id) THEN
      RAISE EXCEPTION 'Club not found';
    END IF;

    DELETE FROM clubs WHERE id = p_club_id;
  ELSE
    -- Clubs first. Teams reference seasons, so deleting seasons earlier
    -- would cascade into teams of every club.
    DELETE FROM clubs;
    DELETE FROM profiles WHERE id <> auth.uid();
  END IF;

  DELETE FROM seasons
  WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE teams.season_id = seasons.id
  );
END;
$$;

COMMENT ON FUNCTION purge_app_data(UUID) IS
  'Platform admin only. NULL deletes all clubs, empty seasons, and profiles except the caller. A club id deletes that club and any season left without teams. Does not delete auth users or translations.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_purge_body', 'en', 'This deletes clubs, teams, players, games and their stats. Seasons left without teams are deleted too. All clubs also deletes profiles. Logins and translations stay. Your profile stays.'),
  ('trke_purge_body', 'es', 'Esto borra clubes, equipos, jugadores, partidos y sus estadísticas. También borra las temporadas que se quedan sin equipos. Todos los clubes también borra perfiles. Los accesos y las traducciones se quedan. Tu perfil se queda.'),
  ('trke_purge_body', 'ca', 'Això esborra clubs, equips, jugadors, partits i les seves estadístiques. També esborra les temporades que es queden sense equips. Tots els clubs també esborra perfils. Els accessos i les traduccions es queden. El teu perfil es queda.')
ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
