'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

interface Player {
  id: string;
  full_name: string;
  jersey_number: number;
  avatar_url: string | null;
  team_id: string;
  team?: {
    id: string;
    name: string;
  };
}

interface GuestPlayerModalProps {
  gameId: string;
  clubId: string;
  currentTeamId: string;
  onClose: () => void;
  onGuestAdded: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getPlayerColor(id: string): string {
  const colors = ['#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0891B2'];
  const index = parseInt(id.slice(0, 8), 16) % colors.length;
  return colors[index];
}

export function GuestPlayerModal({ gameId, clubId, currentTeamId, onClose, onGuestAdded }: GuestPlayerModalProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [jerseyOverride, setJerseyOverride] = useState<number | ''>('');

  async function loadPlayers() {
    setLoading(true);
    
    // Query players from same club but different teams
    const { data, error } = await supabase
      .from('players')
      .select('id, full_name, jersey_number, avatar_url, team_id, teams(id, name)')
      .eq('club_id', clubId)
      .neq('team_id', currentTeamId)
      .order('full_name');

    if (error) {
      console.error('Error loading players:', error);
    } else {
      setPlayers(data as Player[]);
    }
    
    setLoading(false);
  }

  useEffect(() => {
    loadPlayers();
  }, [clubId, currentTeamId]);

  async function handleAddGuest() {
    if (!selectedPlayer) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('game_guest_players')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
        jersey_override: jerseyOverride || null,
        added_by: user.id,
      });

    if (error) {
      alert(`Error adding guest player: ${error.message}`);
      return;
    }

    onGuestAdded();
    onClose();
  }

  const filteredPlayers = players.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.jersey_number.toString().includes(search)
  );

  if (selectedPlayer) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
        <div className="bg-gray-800 rounded-xl max-w-md w-full border-2 border-orange-500 shadow-2xl">
          <div className="bg-gray-900 border-b border-gray-700 p-4">
            <h2 className="text-xl font-bold text-white text-center">
              Add Guest Player
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
              <div className="relative w-16 h-16">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-gray-600 bg-gray-600">
                  {selectedPlayer.avatar_url ? (
                    <Image
                      src={selectedPlayer.avatar_url}
                      alt={selectedPlayer.full_name}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                      unoptimized={!selectedPlayer.avatar_url.includes('supabase.co')}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
                      style={{ backgroundColor: getPlayerColor(selectedPlayer.id) }}
                    >
                      {getInitials(selectedPlayer.full_name)}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {selectedPlayer.jersey_number}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">{selectedPlayer.full_name}</div>
                <div className="text-sm text-gray-400">
                  {selectedPlayer.team?.name} • #{selectedPlayer.jersey_number}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Jersey Override (optional)
              </label>
              <input
                type="number"
                value={jerseyOverride}
                onChange={(e) => setJerseyOverride(e.target.value ? parseInt(e.target.value) : '')}
                placeholder={`Default: ${selectedPlayer.jersey_number}`}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                min="0"
                max="99"
              />
              <p className="text-xs text-gray-400 mt-1">
                Use if jersey number conflicts with a player on this team
              </p>
            </div>
          </div>

          <div className="border-t border-gray-700 p-4 flex gap-3">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
            >
              Back
            </button>
            <button
              onClick={handleAddGuest}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold"
            >
              Add Guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-2 border-orange-500 shadow-2xl flex flex-col">
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <h2 className="text-2xl font-bold text-white text-center">
            Add Guest Player
          </h2>
          <p className="text-center text-gray-400 text-sm mt-1">
            Search players from other teams in your club
          </p>
        </div>

        <div className="p-4 border-b border-gray-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or jersey..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading players...</div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              {search ? 'No players found matching search' : 'No players available from other teams'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all"
                >
                  <div className="relative w-20 h-20">
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-gray-600 bg-gray-600">
                      {player.avatar_url ? (
                        <Image
                          src={player.avatar_url}
                          alt={player.full_name}
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                          unoptimized={!player.avatar_url.includes('supabase.co')}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-xl font-bold text-white"
                          style={{ backgroundColor: getPlayerColor(player.id) }}
                        >
                          {getInitials(player.full_name)}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-gray-800">
                      {player.jersey_number}
                    </div>
                  </div>
                  <div className="text-xs text-center font-medium line-clamp-2">
                    {player.full_name}
                  </div>
                  <div className="text-xs text-gray-400 truncate w-full text-center">
                    {player.team?.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
