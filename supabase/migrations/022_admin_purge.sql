-- Migration 022: Platform-admin data purge
-- One club deletes that club and its cascaded game data.
-- All clubs also deletes seasons and every profile except the caller.
-- Auth users and translations are kept.

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
    RETURN;
  END IF;

  -- Clubs first. Teams reference seasons, so deleting seasons earlier
  -- would cascade into teams of every club.
  DELETE FROM clubs;
  DELETE FROM seasons;
  DELETE FROM profiles WHERE id <> auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION purge_app_data(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION purge_app_data(UUID) TO authenticated;

COMMENT ON FUNCTION purge_app_data(UUID) IS
  'Platform admin only. NULL deletes all clubs, seasons, and profiles except the caller. A club id deletes only that club. Does not delete auth users or translations.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_purge_nav', 'en', 'Reset data'),
  ('trke_purge_nav', 'es', 'Borrar datos'),
  ('trke_purge_nav', 'ca', 'Esborrar dades'),

  ('trke_purge_title', 'en', 'Reset app data'),
  ('trke_purge_title', 'es', 'Borrar datos de la app'),
  ('trke_purge_title', 'ca', 'Esborrar dades de l''app'),

  ('trke_purge_body', 'en', 'This deletes clubs, teams, players, games and their stats. All clubs also deletes seasons and profiles. Logins and translations stay. Your profile stays.'),
  ('trke_purge_body', 'es', 'Esto borra clubes, equipos, jugadores, partidos y sus estadísticas. Todos los clubes también borra temporadas y perfiles. Los accesos y las traducciones se quedan. Tu perfil se queda.'),
  ('trke_purge_body', 'ca', 'Això esborra clubs, equips, jugadors, partits i les seves estadístiques. Tots els clubs també esborra temporades i perfils. Els accessos i les traduccions es queden. El teu perfil es queda.'),

  ('trke_purge_scope_club', 'en', 'One club'),
  ('trke_purge_scope_club', 'es', 'Un club'),
  ('trke_purge_scope_club', 'ca', 'Un club'),

  ('trke_purge_scope_all', 'en', 'All clubs'),
  ('trke_purge_scope_all', 'es', 'Todos los clubes'),
  ('trke_purge_scope_all', 'ca', 'Tots els clubs'),

  ('trke_purge_confirm_club', 'en', 'Type the club name to confirm'),
  ('trke_purge_confirm_club', 'es', 'Escribe el nombre del club para confirmar'),
  ('trke_purge_confirm_club', 'ca', 'Escriu el nom del club per confirmar'),

  ('trke_purge_confirm_all', 'en', 'Type DELETE ALL to confirm'),
  ('trke_purge_confirm_all', 'es', 'Escribe BORRAR TODO para confirmar'),
  ('trke_purge_confirm_all', 'ca', 'Escriu ESBORRAR TOT per confirmar'),

  ('trke_purge_submit', 'en', 'Delete data'),
  ('trke_purge_submit', 'es', 'Borrar datos'),
  ('trke_purge_submit', 'ca', 'Esborrar dades'),

  ('trke_purge_success_club', 'en', 'Club deleted'),
  ('trke_purge_success_club', 'es', 'Club borrado'),
  ('trke_purge_success_club', 'ca', 'Club esborrat'),

  ('trke_purge_success_all', 'en', 'App data deleted'),
  ('trke_purge_success_all', 'es', 'Datos de la app borrados'),
  ('trke_purge_success_all', 'ca', 'Dades de l''app esborrades'),

  ('trke_purge_error', 'en', 'Could not delete the data'),
  ('trke_purge_error', 'es', 'No se han podido borrar los datos'),
  ('trke_purge_error', 'ca', 'No s''han pogut esborrar les dades'),

  ('trke_purge_forbidden', 'en', 'Only a platform admin can do this'),
  ('trke_purge_forbidden', 'es', 'Solo un administrador de plataforma puede hacerlo'),
  ('trke_purge_forbidden', 'ca', 'Només un administrador de plataforma pot fer-ho')
ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
