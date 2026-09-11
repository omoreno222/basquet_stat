'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function GamesPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    const { data } = await supabase
      .from('games')
      .select('*, teams(name)')
      .order('game_date', { ascending: false });

    if (data) {
      setGames(data);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Games</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {games.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No games found</li>
              ) : (
                games.map((game) => (
                  <li key={game.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
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
                        {game.slot_a_user_id && (
                          <p className="text-xs text-gray-500 mt-1">Slot A/B assigned</p>
                        )}
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
  );
}
