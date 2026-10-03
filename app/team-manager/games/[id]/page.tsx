'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Player, Game } from '@/lib/types';
import { Club } from '@/types/database';
import { ClubLogo } from '@/components/ClubLogo';
import { canStartGame, formatTimeUntilStart, type GameStartCheck } from '@/lib/game-start-window';
import { userManagesClub } from '@/lib/live-access';
import { AdminNavbar } from '@/components/AdminNavbar';
import { TeamManagerNavPills } from '@/components/NavPills';

interface GameWithTeam extends Game {
  teams?: {
    id: string;
    name: string;
    category: string;
    season: string;
    created_at: string;
    clubs?: Club;
  };
}

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<GameWithTeam | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [canCapture, setCanCapture] = useState(false);
  const [adminShell, setAdminShell] = useState(false);
  const [gamesHref, setGamesHref] = useState('/team-manager');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameStartCheck, setGameStartCheck] = useState<GameStartCheck | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    setCurrentUserId(user.id);

    const { data: gameData } = await supabase
      .from('games')
      .select('*, teams(name, clubs(id, name, short_name, logo_url, primary_color, secondary_color))')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData);

      if (gameData.team_id) {
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', gameData.team_id)
          .order('jersey_number');

        setPlayers(playersData || []);
      }

      const { data: roleRows } = await supabase
        .from('profile_roles')
        .select('role, club_id')
        .eq('profile_id', user.id);
      const roles = roleRows ?? [];
      setCanCapture(userManagesClub(roles, gameData.teams?.clubs?.id ?? null));
      const usesAdminShell = roles.some((role) => role.role === 'admin' || role.role === 'club_admin');
      setAdminShell(usesAdminShell);
      setGamesHref(usesAdminShell ? '/admin/games' : '/team-manager');

      if (gameData.status === 'scheduled') {
        const startCheck = await canStartGame(gameId, user.id);
        setGameStartCheck(startCheck);
      }
    }

    setLoading(false);
  }, [gameId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!game || game.status !== 'scheduled' || !currentUserId) return;

    const interval = setInterval(async () => {
      const startCheck = await canStartGame(gameId, currentUserId);
      setGameStartCheck(startCheck);
    }, 60000);

    return () => clearInterval(interval);
  }, [game, currentUserId, gameId]);

  async function handleStartGame() {
    const { error } = await supabase
      .from('games')
      .update({
        status: 'live',
        clock_remaining_ms: 600000,
        current_period: 1,
        possession: 'home',
      })
      .eq('id', gameId);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      router.push(`/team-manager/games/${gameId}/capture`);
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!game) {
    return <div className="p-8">Game not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {adminShell ? (
        <AdminNavbar />
      ) : (
        <>
          <nav className="bg-brand dark:bg-brand-dark text-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <Link href={gamesHref} className="text-blue-500 hover:text-blue-700 mr-4">
                    ← Back to Games
                  </Link>
                  <h1 className="text-xl font-bold">Game Management</h1>
                </div>
              </div>
            </div>
          </nav>
          <TeamManagerNavPills />
        </>
      )}

      <div className={adminShell ? 'lg:pl-56' : undefined}>
      {adminShell ? (
        <div className="max-w-7xl mx-auto px-4 pt-6 sm:px-6 lg:px-8">
          <Link href={gamesHref} className="text-sm font-medium text-blue-700 hover:text-blue-900">
            ← Back to Games
          </Link>
        </div>
      ) : null}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              {game.teams?.clubs ? (
                <ClubLogo
                  logoUrl={game.teams.clubs.logo_url}
                  clubName={game.teams.clubs.name}
                  size="md"
                />
              ) : null}
              <h2 className="text-2xl font-bold">
                {game.teams?.name} vs {game.opponent_name}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{new Date(game.game_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Venue</p>
                <p className="font-medium">{game.venue || 'TBD'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium capitalize">{game.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Score</p>
                <p className="font-medium text-2xl">{game.team_score} - {game.opponent_score}</p>
              </div>
            </div>
          </div>

          {canCapture && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Live Capture</h3>

              {game.status === 'scheduled' && (
                <div>
                  <button
                    onClick={handleStartGame}
                    disabled={gameStartCheck !== null && !gameStartCheck.canStart}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 text-lg font-bold"
                  >
                    {gameStartCheck?.isAdmin ? 'Start Game (Admin Override)' : 'Start Game'}
                  </button>

                  {gameStartCheck && !gameStartCheck.canStart && gameStartCheck.minutesUntilStart && (
                    <p className="mt-2 text-sm text-orange-600">
                      Game can be started in {formatTimeUntilStart(gameStartCheck.minutesUntilStart)}
                      {gameStartCheck.isAdmin && ' (or now as admin)'}
                    </p>
                  )}
                </div>
              )}

              {game.status === 'live' && (
                <Link
                  href={`/team-manager/games/${gameId}/capture`}
                  className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-lg font-bold"
                >
                  Resume Live Capture
                </Link>
              )}

              {game.status === 'final' && (
                <p className="text-gray-500">Game has ended</p>
              )}
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h3 className="text-lg font-bold mb-4">Team Roster ({players.length} players)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {players.map(player => (
                <div key={player.id} className="border rounded p-2">
                  <span className="font-bold">#{player.jersey_number}</span> {player.full_name}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
