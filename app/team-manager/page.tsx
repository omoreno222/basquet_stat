'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TeamManagerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
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

    if (!profileData || profileData.role !== 'team_manager') {
      router.push('/login');
      return;
    }

    setProfile(profileData);
    await loadGames();
    setLoading(false);
  }

  async function loadGames() {
    const { data } = await supabase
      .from('games')
      .select('*, teams(name)')
      .order('game_date', { ascending: false });

    if (data) {
      setGames(data);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold">BasquetStat - Team Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {profile.full_name || profile.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-2xl font-bold mb-4">Games</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {games.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No games available</li>
              ) : (
                games.map((game) => (
                  <li key={game.id} className="px-6 py-4 hover:bg-gray-50">
                    <Link href={`/team-manager/games/${game.id}`}>
                      <div className="flex items-center justify-between cursor-pointer">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {game.teams?.name} vs {game.opponent_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(game.game_date).toLocaleDateString()} - {game.venue || 'TBD'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Score: {game.team_score} - {game.opponent_score}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-semibold rounded uppercase ${
                            game.status === 'live' ? 'text-green-800 bg-green-100' :
                            game.status === 'final' ? 'text-gray-800 bg-gray-100' :
                            'text-blue-800 bg-blue-100'
                          }`}>
                            {game.status}
                          </span>
                          <div className="mt-2 text-xs text-gray-600">
                            {game.slot_a_user_id ? '✓' : '○'} Slot A
                            {' | '}
                            {game.slot_b_user_id ? '✓' : '○'} Slot B
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
          
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-semibold text-blue-900">Live Capture (Coming Soon)</h3>
            <p className="text-sm text-blue-700 mt-1">
              Slot A: Clock control, shots (1/2/3 pts), fouls, substitutions, opponent score
            </p>
            <p className="text-sm text-blue-700">
              Slot B: Rebounds, assists, turnovers, steals
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
