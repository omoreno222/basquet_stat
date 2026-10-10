'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season } from '@/types/database';
import { AdminNavbar } from '@/components/AdminNavbar';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { Plus } from 'lucide-react';
import { DeleteButton, EditLink } from '../row-actions';

export default function SeasonsPage() {
  const { t } = useLocaleTranslations();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSeasons();
  }, []);

  async function loadSeasons() {
    const { data } = await supabase.from('seasons').select('*').order('start_date', { ascending: false });
    if (data) setSeasons(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('trke_season_delete_confirm', 'Are you sure you want to delete this season? This will also delete all associated teams, players, and games.'))) {
      return;
    }

    const { error: deleteError } = await supabase.from('seasons').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    loadSeasons();
  }

  async function toggleActive(season: Season) {
    if (!season.is_active) {
      await supabase.from('seasons').update({ is_active: false }).neq('id', season.id);
    }

    const { error: updateError } = await supabase
      .from('seasons')
      .update({ is_active: !season.is_active })
      .eq('id', season.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    loadSeasons();
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-8 text-gray-900 dark:bg-gray-800 dark:text-gray-100">{t('trke_loading', 'Loading...')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <AdminNavbar />
      <div className="lg:pl-56">
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 px-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Seasons</h1>
            <Link href="/admin/seasons/new" className="inline-flex items-center gap-2 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('trke_add_season', 'Add season')}
            </Link>
          </div>
          {error && <div className="mb-4 px-4"><div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div></div>}
          <div className="px-4 py-6 sm:px-0">
            <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {seasons.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No seasons found</li>
                ) : (
                  seasons.map((season) => (
                    <li key={season.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{season.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{season.start_date} to {season.end_date}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {season.is_active && (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-300 dark:text-green-950">Active</span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleActive(season)}
                            className={`rounded px-3 py-1 text-xs font-semibold ${season.is_active ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600' : 'bg-green-200 text-green-800 hover:bg-green-300 dark:bg-green-300 dark:text-green-950 dark:hover:bg-green-200'}`}
                          >
                            {season.is_active ? t('trke_season_deactivate', 'Deactivate') : t('trke_season_activate', 'Activate')}
                          </button>
                          <EditLink href={`/admin/seasons/${season.id}`} label={`${t('trke_edit', 'Edit')} ${season.name}`} />
                          <DeleteButton label={`${t('trke_delete', 'Delete')} ${season.name}`} onClick={() => handleDelete(season.id)} />
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
