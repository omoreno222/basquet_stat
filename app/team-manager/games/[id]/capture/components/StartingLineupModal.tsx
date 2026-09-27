'use client';

import Image from 'next/image';

interface Player {
  id: string;
  full_name: string;
  jersey_number: number;
  avatar_url: string | null;
}

interface StartingLineupModalProps {
  players: Player[];
  selectedPlayers: Player[];
  onTogglePlayer: (player: Player) => void;
  onConfirm: () => void;
  onClose: () => void;
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

export function StartingLineupModal({
  players,
  selectedPlayers,
  onTogglePlayer,
  onConfirm,
  onClose
}: StartingLineupModalProps) {
  const isSelected = (player: Player) => selectedPlayers.some(p => p.id === player.id);
  const canConfirm = selectedPlayers.length === 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-2 border-orange-500 shadow-2xl flex flex-col">
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <h2 className="text-2xl font-bold text-white text-center">
            Starting Lineup
          </h2>
          <p className="text-center text-gray-400 text-sm mt-1">
            Select 5 players to start ({selectedPlayers.length}/5)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {players.map((player) => {
              const selected = isSelected(player);
              return (
                <button
                  key={player.id}
                  onClick={() => onTogglePlayer(player)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all touch-manipulation ${
                    selected
                      ? 'bg-orange-600 ring-4 ring-orange-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  {/* Player Photo */}
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

                    {/* Jersey Number Badge */}
                    <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-gray-800">
                      {player.jersey_number}
                    </div>
                  </div>

                  {/* Player Name */}
                  <div className="text-xs text-center font-medium line-clamp-2">
                    {player.full_name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-700 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
            style={{ minHeight: '44px' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-1 px-4 py-3 rounded-lg text-white font-bold ${
              canConfirm
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
            style={{ minHeight: '44px' }}
          >
            Confirm Lineup
          </button>
        </div>
      </div>
    </div>
  );
}
