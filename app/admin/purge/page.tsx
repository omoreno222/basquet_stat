'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AdminNavbar } from '@/components/AdminNavbar';
import { type Club } from '@/types/database';

type Locale = 'en' | 'es' | 'ca';
type Scope = 'club' | 'all';

const CONFIRM_ALL: Record<Locale, string> = {
  en: 'DELETE ALL',
  es: 'BORRAR TODO',
  ca: 'ESBORRAR TOT',
};

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    trke_purge_title: 'Reset app data',
    trke_purge_body: 'This deletes clubs, teams, players, games and their stats. Seasons left without teams are deleted too. All clubs also deletes profiles. Logins and translations stay. Your profile stays.',
    trke_purge_scope_club: 'One club',
    trke_purge_scope_all: 'All clubs',
    trke_purge_confirm_club: 'Type the club name to confirm',
    trke_purge_confirm_all: 'Type DELETE ALL to confirm',
    trke_purge_submit: 'Delete data',
    trke_purge_success_club: 'Club deleted',
    trke_purge_success_all: 'App data deleted',
    trke_purge_error: 'Could not delete the data',
    trke_purge_forbidden: 'Only a platform admin can do this',
  },
  es: {
    trke_purge_title: 'Borrar datos de la app',
    trke_purge_body: 'Esto borra clubes, equipos, jugadores, partidos y sus estadísticas. También borra las temporadas que se quedan sin equipos. Todos los clubes también borra perfiles. Los accesos y las traducciones se quedan. Tu perfil se queda.',
    trke_purge_scope_club: 'Un club',
    trke_purge_scope_all: 'Todos los clubes',
    trke_purge_confirm_club: 'Escribe el nombre del club para confirmar',
    trke_purge_confirm_all: 'Escribe BORRAR TODO para confirmar',
    trke_purge_submit: 'Borrar datos',
    trke_purge_success_club: 'Club borrado',
    trke_purge_success_all: 'Datos de la app borrados',
    trke_purge_error: 'No se han podido borrar los datos',
    trke_purge_forbidden: 'Solo un administrador de plataforma puede hacerlo',
  },
  ca: {
    trke_purge_title: "Esborrar dades de l'app",
    trke_purge_body: "Això esborra clubs, equips, jugadors, partits i les seves estadístiques. També esborra les temporades que es queden sense equips. Tots els clubs també esborra perfils. Els accessos i les traduccions es queden. El teu perfil es queda.",
    trke_purge_scope_club: 'Un club',
    trke_purge_scope_all: 'Tots els clubs',
    trke_purge_confirm_club: 'Escriu el nom del club per confirmar',
    trke_purge_confirm_all: 'Escriu ESBORRAR TOT per confirmar',
    trke_purge_submit: 'Esborrar dades',
    trke_purge_success_club: 'Club esborrat',
    trke_purge_success_all: "Dades de l'app esborrades",
    trke_purge_error: "No s'han pogut esborrar les dades",
    trke_purge_forbidden: 'Només un administrador de plataforma pot fer-ho',
  },
};

function resolveLocale(profile: { locale?: string | null; language?: string | null }): Locale {
  const value = profile.locale || profile.language;
  if (value === 'es' || value === 'ca') return value;
  return 'en';
}

export default function PurgePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState<Locale>('en');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [scope, setScope] = useState<Scope>('club');
  const [clubId, setClubId] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const t = useCallback((key: string) => translations[key] || COPY[locale][key] || key, [translations, locale]);

  const loadPage = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profileData) {
      router.push('/login');
      return;
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      router.push('/login');
      return;
    }

    const platformAdmin = userRoles?.some(role => role.role === 'admin' && role.club_id === null) || false;

    if (!platformAdmin) {
      router.replace('/admin');
      return;
    }

    const nextLocale = resolveLocale(profileData);
    const { data: clubsData } = await supabase.from('clubs').select('*').order('name');
    const { data: translationsData } = await supabase
      .from('translations')
      .select('key, value')
      .eq('locale', nextLocale);

    const nextTranslations: Record<string, string> = {};
    translationsData?.forEach(row => {
      nextTranslations[row.key] = row.value;
    });

    setLocale(nextLocale);
    setTranslations(nextTranslations);
    setClubs(clubsData || []);
    setClubId(clubsData?.[0]?.id || '');
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const selectedClub = clubs.find(club => club.id === clubId) || null;
  const expectedConfirm = scope === 'all'
    ? CONFIRM_ALL[locale]
    : (selectedClub?.name.trim() || '');
  const canSubmit = !submitting
    && expectedConfirm.length > 0
    && confirmText.trim() === expectedConfirm
    && (scope === 'all' || Boolean(selectedClub));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    const { error: rpcError } = await supabase.rpc('purge_app_data', {
      p_club_id: scope === 'all' ? null : clubId,
    });

    if (rpcError) {
      const forbidden = rpcError.message.toLowerCase().includes('platform admin');
      setError(t(forbidden ? 'trke_purge_forbidden' : 'trke_purge_error'));
      setSubmitting(false);
      return;
    }

    setSuccess(t(scope === 'all' ? 'trke_purge_success_all' : 'trke_purge_success_club'));
    setConfirmText('');
    if (scope === 'all') {
      setClubs([]);
      setClubId('');
    } else {
      const remaining = clubs.filter(club => club.id !== clubId);
      setClubs(remaining);
      setClubId(remaining[0]?.id || '');
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="p-8 text-gray-900 dark:text-gray-100">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <AdminNavbar />

      <div className="lg:pl-56">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <form
            onSubmit={handleSubmit}
            className="max-w-xl bg-white dark:bg-gray-900 border border-brand/15 dark:border-white/10 rounded-lg p-6"
          >
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('trke_purge_title')}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('trke_purge_body')}</p>

            <fieldset className="mt-6">
              <legend className="sr-only">{t('trke_purge_title')}</legend>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="inline-flex items-center gap-2 min-h-11 text-gray-900 dark:text-gray-100">
                  <input
                    type="radio"
                    name="scope"
                    value="club"
                    checked={scope === 'club'}
                    onChange={() => {
                      setScope('club');
                      setConfirmText('');
                      setSuccess('');
                      setError('');
                    }}
                  />
                  {t('trke_purge_scope_club')}
                </label>
                <label className="inline-flex items-center gap-2 min-h-11 text-gray-900 dark:text-gray-100">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={() => {
                      setScope('all');
                      setConfirmText('');
                      setSuccess('');
                      setError('');
                    }}
                  />
                  {t('trke_purge_scope_all')}
                </label>
              </div>
            </fieldset>

            {scope === 'club' && (
              <label className="block mt-4 text-sm text-gray-900 dark:text-gray-100">
                {t('trke_purge_scope_club')}
                <select
                  value={clubId}
                  onChange={(event) => {
                    setClubId(event.target.value);
                    setConfirmText('');
                    setSuccess('');
                    setError('');
                  }}
                  className="mt-1 block w-full min-h-11 rounded border border-brand/25 bg-white px-3 text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-white/25"
                >
                  {clubs.map(club => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block mt-4 text-sm text-gray-900 dark:text-gray-100">
              {t(scope === 'all' ? 'trke_purge_confirm_all' : 'trke_purge_confirm_club')}
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                className="mt-1 block w-full min-h-11 rounded border border-brand/25 bg-white px-3 text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-white/25"
              />
            </label>

            {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="mt-4 text-sm text-green-700 dark:text-green-400">{success}</p>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-6 inline-flex items-center justify-center min-h-11 px-4 rounded bg-red-600 text-white font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
            >
              {t('trke_purge_submit')}
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
