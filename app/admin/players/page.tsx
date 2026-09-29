'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Club, Player } from '@/types/database';
import { AdminNavbar } from '@/components/AdminNavbar';
import { ClubLogo } from '@/components/ClubLogo';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { Plus } from 'lucide-react';
import { DeleteButton, EditLink, ViewLink } from '../row-actions';

interface PlayerWithTeam extends Player {
  teams?: {
    name: string;
    seasons?: { name: string };
    clubs?: Club;
  };
}

export default function PlayersPage() {
  const { t } = useLocaleTranslations();
  const [players, setPlayers] = useState<PlayerWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      setError('Failed to load user roles');
      setLoading(false);
      return;
    }

    const platformAdmin = roles?.some((role) => role.role === 'admin' && role.club_id === null) || false;
    const clubAdmin = roles?.find((role) => (role.role === 'club_admin' || role.role === 'admin') && role.club_id !== null);

    let playersQuery = supabase
      .from('players')
      .select('*, teams(name, seasons(name), clubs(id, name, short_name, logo_url, primary_color, secondary_color))')
      .order('full_name');

    if (!platformAdmin && clubAdmin?.club_id) {
      playersQuery = playersQuery.eq('club_id', clubAdmin.club_id);
    }

    const { data } = await playersQuery;
    if (data) setPlayers(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('trke_player_delete_confirm', 'Are you sure you want to delete this player?'))) return;

    const { error: deleteError } = await supabase.from('players').delete().eq('id', id);
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
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Players</h1>
            <Link href="/admin/players/new" className="inline-flex items-center gap-2 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('trke_add_player', 'Add player')}
            </Link>
          </div>
          {error && <div className="mb-4 px-4"><div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div></div>}
          <div className="px-4 py-6 sm:px-0">
            <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {players.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No players found</li>
                ) : (
                  players.map((player) => (
                    <li key={player.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          {player.avatar_url ? (
                            <Image src={player.avatar_url} alt={player.full_name} width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <span className="text-lg font-medium text-gray-500 dark:text-gray-300">{player.full_name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          {player.teams?.clubs && (
                            <ClubLogo logoUrl={player.teams.clubs.logo_url} clubName={player.teams.clubs.name} size="sm" />
                          )}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              <Link
                                href={`/admin/players/${player.id}`}
                                className="text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                              >
                                #{player.jersey_number} {player.full_name}
                              </Link>
                            </h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {player.teams?.clubs?.name && <span>Club: {player.teams.clubs.name} • </span>}
                              <span>Team: {player.teams?.name || 'N/A'}</span>
                            </div>
                            {player.position && <p className="text-sm text-gray-500 dark:text-gray-400">Position: {player.position}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <ViewLink href={`/admin/players/${player.id}`} label={`${t('trke_view', 'View')} ${player.full_name}`} />
                          <EditLink href={`/admin/players/${player.id}?edit=1`} label={`${t('trke_edit', 'Edit')} ${player.full_name}`} />
                          <DeleteButton label={`${t('trke_delete', 'Delete')} ${player.full_name}`} onClick={() => handleDelete(player.id)} />
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
