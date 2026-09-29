'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Player {
  id: string;
  full_name: string;
  jersey_number: number;
  avatar_url: string | null;
}

interface FoulModalProps {
  players: Player[];
  playerFoulCounts: Record<string, number>;
  onConfirm: (player: Player, foulType: string, freeThrowsAwarded: number) => void;
  onPersonalFoul: (player: Player) => void;
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

export function FoulModal({ players, playerFoulCounts, onConfirm, onPersonalFoul, onClose }: FoulModalProps) {
  const [step, setStep] = useState<'player' | 'type' | 'fta'>('player');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [foulType, setFoulType] = useState<string>('');

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
    setStep('type');
  };

  const handleTypeSelect = (type: string) => {
    if (type === 'personal' && selectedPlayer) {
      onPersonalFoul(selectedPlayer);
      return;
    }
    setFoulType(type);
    setStep('fta');
  };

  const handleFTASelect = (count: number) => {
    if (selectedPlayer && foulType) {
      onConfirm(selectedPlayer, foulType, count);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-2 border-orange-500 shadow-2xl flex flex-col">
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <h2 className="text-2xl font-bold text-white text-center">
            Foul
          </h2>
          {selectedPlayer && (
            <p className="text-center text-gray-400 text-sm mt-1">
              #{selectedPlayer.jersey_number} {selectedPlayer.full_name}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Player Selection */}
          {step === 'player' && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {players.map((player) => {
                const foulCount = playerFoulCounts[player.id] || 0;
                const fouledOut = foulCount >= 5;
                
                return (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all touch-manipulation ${
                      fouledOut
                        ? 'bg-red-900 border-2 border-red-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    style={{ minWidth: '44px', minHeight: '44px' }}
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
                      
                      {/* Jersey Number Badge */}
                      <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-gray-800">
                        {player.jersey_number}
                      </div>
                      
                      {/* Foul Count Badge */}
                      {foulCount > 0 && (
                        <div className={`absolute top-0 left-0 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-gray-800 ${
                          fouledOut ? 'bg-red-600' : 'bg-yellow-600'
                        }`}>
                          F{foulCount}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-center font-medium line-clamp-2">
                      {player.full_name}
                    </div>
                    {fouledOut && (
                      <div className="text-xs font-bold text-red-400">
                        FOULED OUT
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Foul Type */}
          {step === 'type' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <p className="text-xl text-white font-medium">Foul Type</p>
              <div className="flex flex-col gap-4 w-full max-w-md">
                <button
                  onClick={() => handleTypeSelect('personal')}
                  className="py-6 bg-blue-600 hover:bg-blue-700 rounded-xl text-xl font-bold text-white transition-all touch-manipulation"
                  style={{ minHeight: '44px' }}
                >
                  Personal Foul
                </button>
                <button
                  onClick={() => handleTypeSelect('technical')}
                  className="py-6 bg-yellow-600 hover:bg-yellow-700 rounded-xl text-xl font-bold text-white transition-all touch-manipulation"
                  style={{ minHeight: '44px' }}
                >
                  Technical Foul
                </button>
                <button
                  onClick={() => handleTypeSelect('unsportsmanlike')}
                  className="py-6 bg-red-600 hover:bg-red-700 rounded-xl text-xl font-bold text-white transition-all touch-manipulation"
                  style={{ minHeight: '44px' }}
                >
                  Unsportsmanlike Foul
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Free Throws Awarded */}
          {step === 'fta' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <p className="text-xl text-white font-medium">Free throws awarded?</p>
              <p className="text-sm text-gray-400 text-center max-w-md">
                (If FTs are awarded to us, this is an opponent foul. We record our player&apos;s foul and return.)
              </p>
              <div className="flex gap-4">
                {[0, 1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => handleFTASelect(count)}
                    className="w-24 h-24 bg-purple-600 hover:bg-purple-700 rounded-xl text-4xl font-bold text-white transition-all touch-manipulation"
                    style={{ minWidth: '44px', minHeight: '44px' }}
                  >
                    {count === 0 ? 'None' : count}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
            style={{ minHeight: '44px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
