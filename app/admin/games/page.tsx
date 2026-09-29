'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Club, Game } from '@/types/database';
import { AdminNavbar } from '@/components/AdminNavbar';
import { ClubLogo } from '@/components/ClubLogo';
import { assignmentComplete, userCanOpenLiveGame } from '@/lib/live-access';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { Plus } from 'lucide-react';
import { DeleteButton, EditLink } from '../row-actions';

interface GameWithTeam extends Game {
  teams?: {
    name: string;
    clubs?: Club;
  };
}

export default function GamesPage() {
  const { t } = useLocaleTranslations();
  const [games, setGames] = useState<GameWithTeam[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

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

    let gamesQuery = supabase
      .from('games')
      .select('*, teams(name, seasons(name), clubs(id, name, short_name, logo_url, primary_color, secondary_color))')
      .order('game_date', { ascending: false });

    if (!platformAdmin && clubAdmin?.club_id) {
      const { data: clubTeams } = await supabase.from('teams').select('id').eq('club_id', clubAdmin.club_id);
      const teamIds = clubTeams?.map((team) => team.id) || [];
      gamesQuery = gamesQuery.in('team_id', teamIds.length > 0 ? teamIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data, error: gamesError } = await gamesQuery;
    if (gamesError) {
      setError(gamesError.message);
      setLoading(false);
      return;
    }
    setGames(data ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('trke_game_delete_confirm', 'Are you sure you want to delete this game?'))) return;

    const { error: deleteError } = await supabase.from('games').delete().eq('id', id);
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
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Games</h1>
            <Link href="/admin/games/new" className="inline-flex items-center gap-2 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('trke_add_game', 'Add game')}
            </Link>
          </div>
          {error && <div className="mb-4 px-4"><div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div></div>}
          <div className="px-4 py-6 sm:px-0">
            <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {games.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No games found</li>
                ) : (
                  games.map((game) => {
                    const recorders = {
                      singleRecorder: game.single_recorder ?? false,
                      slotAUserId: game.slot_a_user_id,
                      slotBUserId: game.slot_b_user_id,
                    };
                    const live = userCanOpenLiveGame({
                      status: game.status,
                      userId,
                      ...recorders,
                    });
                    const needsRecorders = game.status === 'live' && !assignmentComplete(recorders);
                    const title = `${game.teams?.name} vs ${game.opponent_name}`;
                    return (
                    <li key={game.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {game.teams?.clubs ? (
                            <ClubLogo logoUrl={game.teams.clubs.logo_url} clubName={game.teams.clubs.name} size="sm" />
                          ) : null}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              {live ? (
                                <Link
                                  href={`/team-manager/games/${game.id}/capture`}
                                  className="inline-flex items-center gap-2 hover:underline"
                                >
                                  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                                  </span>
                                  <span className="animate-pulse">{title}</span>
                                  <span className="sr-only">Live</span>
                                </Link>
                              ) : needsRecorders ? (
                                <Link href={`/admin/games/${game.id}`} className="hover:underline">
                                  {title}
                                </Link>
                              ) : (
                                <span>{title}</span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(game.game_date).toLocaleString()} - {game.venue || 'TBD'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{game.is_home ? 'Home' : 'Away'} · {game.official ? 'Official' : 'Friendly'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-1 text-xs font-semibold uppercase ${game.status === 'live' ? 'bg-green-100 text-green-800 dark:bg-green-300 dark:text-green-950' : game.status === 'final' ? 'bg-gray-100 text-gray-800 dark:bg-gray-300 dark:text-gray-950' : 'bg-blue-100 text-blue-800 dark:bg-blue-300 dark:text-blue-950'}`}>
                            {game.status}
                          </span>
                          <EditLink href={`/admin/games/${game.id}`} label={`${t('trke_edit', 'Edit')} ${game.opponent_name}`} />
                          <DeleteButton label={`${t('trke_delete', 'Delete')} ${game.opponent_name}`} onClick={() => handleDelete(game.id)} />
                        </div>
                      </div>
                    </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
