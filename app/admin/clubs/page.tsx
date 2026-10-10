'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ClubLogo } from '@/components/ClubLogo';
import { AdminNavbar } from '@/components/AdminNavbar';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { Plus } from 'lucide-react';
import { DeleteButton, EditLink } from '../row-actions';

interface Club {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

export default function ClubsPage() {
  const { t } = useLocaleTranslations();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase.from('clubs').select('*').order('name');
    if (data) setClubs(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('trke_club_delete_confirm', 'Are you sure you want to delete this club? This will also delete all associated teams, players, and games.'))) {
      return;
    }

    const { error: deleteError } = await supabase.from('clubs').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    loadData();
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
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Clubs</h1>
            <Link href="/admin/clubs/new" className="inline-flex items-center gap-2 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('trke_add_club', 'Add club')}
            </Link>
          </div>
          {error && <div className="mb-4 px-4"><div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div></div>}
          <div className="px-4 py-6 sm:px-0">
            <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {clubs.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No clubs found</li>
                ) : (
                  clubs.map((club) => (
                    <li key={club.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <ClubLogo logoUrl={club.logo_url} clubName={club.name} size="md" />
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              {club.name}
                              {club.short_name && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({club.short_name})</span>}
                            </h3>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{t('trke_club_primary_color', 'Primary')}:</span>
                              <div className="h-6 w-6 rounded border border-gray-300 dark:border-white/20" style={{ backgroundColor: club.primary_color }} />
                              <span className="text-xs text-gray-500 dark:text-gray-400">{t('trke_club_secondary_color', 'Secondary')}:</span>
                              <div className="h-6 w-6 rounded border border-gray-300 dark:border-white/20" style={{ backgroundColor: club.secondary_color }} />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <EditLink href={`/admin/clubs/${club.id}`} label={`${t('trke_edit', 'Edit')} ${club.name}`} />
                          <DeleteButton label={`${t('trke_delete', 'Delete')} ${club.name}`} onClick={() => handleDelete(club.id)} />
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
