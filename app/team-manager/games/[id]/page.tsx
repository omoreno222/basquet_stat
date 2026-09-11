'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  
  const [game, setGame] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [slotAUserId, setSlotAUserId] = useState<string>('');
  const [slotBUserId, setSlotBUserId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [gameId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setCurrentUser(profile);

    const { data: gameData } = await supabase
      .from('games')
      .select('*, teams(name)')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData);
      setSlotAUserId(gameData.slot_a_user_id || '');
      setSlotBUserId(gameData.slot_b_user_id || '');

      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', gameData.team_id)
        .single();

      setTeam(teamData);

      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', gameData.team_id)
        .order('jersey_number');

      setPlayers(playersData || []);

      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['admin', 'team_manager'])
        .order('email');

      setUsers(usersData || []);
    }

    setLoading(false);
  }

  async function handleAssignSlots() {
    if (!slotAUserId && !slotBUserId) {
      alert('Please assign at least one user to a slot');
      return;
    }

    const { error } = await supabase
      .from('games')
      .update({
        slot_a_user_id: slotAUserId || null,
        slot_b_user_id: slotBUserId || null,
      })
      .eq('id', gameId);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      alert('Slots assigned successfully!');
      loadData();
    }
  }

  async function handleSwapSlots() {
    const { error } = await supabase
      .from('games')
      .update({
        slot_a_user_id: slotBUserId || null,
        slot_b_user_id: slotAUserId || null,
      })
      .eq('id', gameId);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setSlotAUserId(slotBUserId);
      setSlotBUserId(slotAUserId);
      loadData();
    }
  }

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

  const canCapture = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.id === game.slot_a_user_id ||
    currentUser.id === game.slot_b_user_id
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/team-manager" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back to Games
              </Link>
              <h1 className="text-xl font-bold">Game Management</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Game Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">
              {game.teams?.name} vs {game.opponent_name}
            </h2>
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

          {/* Slot Assignment */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold mb-4">Slot Assignment</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slot A (Clock, Shots, Fouls, Subs)
                </label>
                <select
                  value={slotAUserId}
                  onChange={(e) => setSlotAUserId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={game.status === 'final'}
                >
                  <option value="">-- None --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slot B (Rebounds, Assists, Steals, Turnovers)
                </label>
                <select
                  value={slotBUserId}
                  onChange={(e) => setSlotBUserId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  disabled={game.status === 'final'}
                >
                  <option value="">-- None --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAssignSlots}
                disabled={game.status === 'final'}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                Assign Slots
              </button>
              <button
                onClick={handleSwapSlots}
                disabled={!game.slot_a_user_id || !game.slot_b_user_id || game.status === 'final'}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
              >
                Swap A ↔ B
              </button>
            </div>

            {game.slot_a_user_id && (
              <div className="mt-4 text-sm">
                <p className="text-green-600">
                  ✓ Slot A: {users.find(u => u.id === game.slot_a_user_id)?.full_name || 'Assigned'}
                </p>
              </div>
            )}
            {game.slot_b_user_id && (
              <div className="mt-1 text-sm">
                <p className="text-green-600">
                  ✓ Slot B: {users.find(u => u.id === game.slot_b_user_id)?.full_name || 'Assigned'}
                </p>
              </div>
            )}
          </div>

          {/* Launch Capture */}
          {canCapture && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Live Capture</h3>
              
              {game.status === 'scheduled' && (
                <button
                  onClick={handleStartGame}
                  disabled={!game.slot_a_user_id && !game.slot_b_user_id}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 text-lg font-bold"
                >
                  Start Game
                </button>
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

              <p className="mt-4 text-sm text-gray-600">
                You are assigned to: {
                  currentUser.id === game.slot_a_user_id ? 'Slot A' :
                  currentUser.id === game.slot_b_user_id ? 'Slot B' :
                  'Admin (can use any slot)'
                }
              </p>
            </div>
          )}

          {/* Roster */}
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
  );
}
