'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Club, Game } from '@/types/database';
import { AdminNavbar } from '@/components/AdminNavbar';
import { ClubLogo } from '@/components/ClubLogo';
import { isPlatformAdmin, userCanOpenLiveGame, userManagesClub } from '@/lib/live-access';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { ChartColumn, Plus, RadioTower } from 'lucide-react';
import { DeleteButton, EditLink, HoverLabel, ResetButton } from '../row-actions';

export interface GameWithTeam extends Game {
  teams?: {
    name: string;
    clubs?: Club;
  };
}

const GAME_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
};

function formatGameDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', GAME_DATE_FORMAT);
}

function subscribeHydration() {
  return () => {};
}

function useHydrated() {
  return useSyncExternalStore(subscribeHydration, () => true, () => false);
}

function kitSwatch(game: GameWithTeam) {
  const club = game.teams?.clubs;
  if (!club) return null;
  const secondary = game.kit_color === 'secondary';
  return {
    color: secondary ? club.secondary_color : club.primary_color,
    labelKey: secondary ? 'trke_club_secondary_color' : 'trke_club_primary_color',
    fallback: secondary ? 'Secondary color' : 'Primary color',
  };
}

export default function GamesList({
  initialGames,
  initialRoles,
  initialError,
}: {
  initialGames: GameWithTeam[];
  initialRoles: { role: string; club_id: string | null }[];
  initialError: string;
}) {
  const { t } = useLocaleTranslations();
  const hydrated = useHydrated();
  const [games, setGames] = useState<GameWithTeam[]>(initialGames);
  const [roles, setRoles] = useState(initialRoles);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [error, setError] = useState(initialError);
  const platformAdmin = isPlatformAdmin(roles);

  useEffect(() => {
    setGames(initialGames);
    setRoles(initialRoles);
    setError(initialError);
  }, [initialGames, initialRoles, initialError]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      return;
    }

    const { data: roleRows, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      setError('Failed to load user roles');
      return;
    }

    const loadedRoles = roleRows ?? [];
    setRoles(loadedRoles);
    const clubAdmin = loadedRoles.find((role) => (role.role === 'club_admin' || role.role === 'admin') && role.club_id !== null);
    const platformAdmin = isPlatformAdmin(loadedRoles);

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
      return;
    }
    setGames(data ?? []);
  }

  async function handleReset(id: string) {
    if (!confirm(t('trke_game_reset_confirm', 'Reset this game? Score, events, and lineups go back to zero. It stays live so you can open it again.'))) return;

    setResettingId(id);
    setError('');
    const { error: resetError } = await supabase.rpc('reset_game_for_testing', { p_game_id: id });
    setResettingId(null);

    if (resetError) {
      const forbidden = resetError.message.toLowerCase().includes('platform admin');
      setError(forbidden
        ? t('trke_purge_forbidden', 'Only a platform admin can do this')
        : t('trke_game_reset_error', 'Could not reset the game'));
      return;
    }
    loadData();
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
                    const live = userCanOpenLiveGame({
                      status: game.status,
                      managesClub: userManagesClub(roles, game.teams?.clubs?.id ?? null),
                    });
                    const title = `${game.teams?.name} vs ${game.opponent_name}`;
                    const kit = kitSwatch(game);
                    return (
                    <li key={game.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {game.teams?.clubs ? (
                            <ClubLogo logoUrl={game.teams.clubs.logo_url} clubName={game.teams.clubs.name} size="sm" />
                          ) : null}
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {live ? (
                                  <Link
                                    href={`/team-manager/games/live/${game.id}`}
                                    className="inline-flex items-center gap-2 hover:underline"
                                  >
                                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                                    </span>
                                    <span className="animate-pulse">{title}</span>
                                    <span className="sr-only">Live</span>
                                  </Link>
                                ) : (
                                  <span>{title}</span>
                                )}
                              </h3>
                              <span className={`rounded px-2 py-1 text-xs font-semibold uppercase ${game.status === 'live' ? 'bg-green-100 text-green-800 dark:bg-green-300 dark:text-green-950' : game.status === 'final' ? 'bg-gray-100 text-gray-800 dark:bg-gray-300 dark:text-gray-950' : 'bg-blue-100 text-blue-800 dark:bg-blue-300 dark:text-blue-950'}`}>
                                {game.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {hydrated ? `${formatGameDate(game.game_date)} - ` : null}
                              {game.venue || 'TBD'}
                            </p>
                            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <span>{game.is_home ? 'Home' : 'Away'} · {game.official ? 'Official' : 'Friendly'}</span>
                              {kit ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-4 w-4 rounded border border-gray-300 dark:border-white/20" style={{ backgroundColor: kit.color }} />
                                  <span>{t(kit.labelKey, kit.fallback)}</span>
                                </span>
                              ) : null}
                              {game.opponent_color ? (
                                <span className="inline-flex items-center gap-1" title={t('trke_opponent_color', 'Opponent color')}>
                                  <span className="h-4 w-4 rounded border border-gray-300 dark:border-white/20" style={{ backgroundColor: game.opponent_color }} />
                                  <span>{game.opponent_name}</span>
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <HoverLabel label={t('trke_eval_open', 'Evaluation')}>
                            <Link
                              href={`/games/eval/${game.id}`}
                              aria-label={t('trke_eval_open', 'Evaluation')}
                              className="inline-flex shrink-0 items-center justify-center rounded bg-rose-600 p-2 text-white hover:bg-rose-800"
                            >
                              <RadioTower className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </HoverLabel>
                          <EditLink href={`/admin/games/${game.id}`} label={`${t('trke_edit', 'Edit')} ${game.opponent_name}`} />
                          {platformAdmin ? (
                            <HoverLabel label={t('trke_capture_open', 'Open the court')}>
                              <Link
                                href={`/team-manager/games/live/${game.id}`}
                                aria-label={t('trke_capture_open', 'Open the court')}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 dark:border-white/20 dark:bg-gray-950 dark:text-gray-100"
                              >
                                <ChartColumn className="h-4 w-4" aria-hidden="true" />
                              </Link>
                            </HoverLabel>
                          ) : null}
                          {platformAdmin ? (
                            <ResetButton
                              label={t('trke_game_reset', 'Reiniciar')}
                              disabled={resettingId === game.id}
                              onClick={() => handleReset(game.id)}
                            />
                          ) : null}
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
