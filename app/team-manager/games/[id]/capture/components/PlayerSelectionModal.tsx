'use client';

import Image from 'next/image';

interface Player {
  id: string;
  full_name: string;
  jersey_number: number;
  avatar_url?: string | null;
}

interface PlayerSelectionModalProps {
  players: Player[];
  onSelectPlayer: (playerId: string) => void;
  onClose: () => void;
  title?: string;
}

export function PlayerSelectionModal({
  players,
  onSelectPlayer,
  onClose,
  title = 'Select Player'
}: PlayerSelectionModalProps) {
  // Generate initials from full name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Generate consistent color based on player ID
  const getPlayerColor = (playerId: string) => {
    const colors = [
      '#ef4444', // red
      '#f59e0b', // amber
      '#10b981', // green
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
    ];
    const hash = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border-2 border-orange-500 shadow-2xl">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center z-10">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-4xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Grid of player cards - 5 per row for landscape tablets */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => onSelectPlayer(player.id)}
              className="flex flex-col items-center gap-3 p-4 bg-gray-700 hover:bg-orange-600 rounded-xl transition-all transform hover:scale-105 touch-manipulation"
              style={{ minHeight: '180px' }}
            >
              {/* Player Photo or Initials */}
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gray-600 bg-gray-600">
                {player.avatar_url ? (
                  <Image
                    src={player.avatar_url}
                    alt={player.full_name}
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                    unoptimized={!player.avatar_url.includes('supabase.co')}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: getPlayerColor(player.id) }}
                  >
                    {getInitials(player.full_name)}
                  </div>
                )}
                
                {/* Jersey Number Badge */}
                <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border-2 border-gray-800">
                  {player.jersey_number}
                </div>
              </div>
              
              {/* Player Name */}
              <div className="text-sm font-bold text-white text-center leading-tight">
                {player.full_name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
