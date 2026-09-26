'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Player {
  id: string;
  full_name: string;
  jersey_number: number;
  avatar_url: string | null;
}

interface SubstitutionModalProps {
  onCourtPlayers: Player[];
  benchPlayers: Player[];
  playerMinutes: Record<string, number>; // seconds played per player
  onConfirm: (playersOut: Player[], playersIn: Player[]) => void;
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

function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function SubstitutionModal({
  onCourtPlayers,
  benchPlayers,
  playerMinutes,
  onConfirm,
  onClose
}: SubstitutionModalProps) {
  const [step, setStep] = useState<'out' | 'in'>('out');
  const [playersOut, setPlayersOut] = useState<Player[]>([]);
  const [playersIn, setPlayersIn] = useState<Player[]>([]);

  const togglePlayerOut = (player: Player) => {
    if (playersOut.some(p => p.id === player.id)) {
      setPlayersOut(playersOut.filter(p => p.id !== player.id));
    } else {
      setPlayersOut([...playersOut, player]);
    }
  };

  const togglePlayerIn = (player: Player) => {
    if (playersIn.some(p => p.id === player.id)) {
      setPlayersIn(playersIn.filter(p => p.id !== player.id));
    } else if (playersIn.length < playersOut.length) {
      setPlayersIn([...playersIn, player]);
    }
  };

  const handleNextStep = () => {
    if (playersOut.length > 0) {
      setStep('in');
    }
  };

  const canConfirm = playersOut.length > 0 && playersIn.length === playersOut.length;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(playersOut, playersIn);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-2 border-orange-500 shadow-2xl flex flex-col">
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <h2 className="text-2xl font-bold text-white text-center">
            Substitution
          </h2>
          <p className="text-center text-gray-400 text-sm mt-1">
            {step === 'out' 
              ? `Select players coming OUT (${playersOut.length} selected)`
              : `Select ${playersOut.length} player(s) going IN (${playersIn.length}/${playersOut.length})`
            }
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Players OUT (from on-court) */}
          {step === 'out' && (
            <div>
              <h3 className="text-lg font-bold text-white mb-4">On Court</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {onCourtPlayers.map((player) => {
                  const selected = playersOut.some(p => p.id === player.id);
                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayerOut(player)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all touch-manipulation ${
                        selected
                          ? 'bg-red-600 ring-4 ring-red-400'
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
                        <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-gray-800">
                          {player.jersey_number}
                        </div>
                      </div>
                      <div className="text-xs text-center font-medium line-clamp-2">
                        {player.full_name}
                      </div>
                      {/* Minutes Played */}
                      <div className="text-xs text-gray-400 font-mono">
                        {formatMinutes(playerMinutes[player.id] || 0)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Select Players IN (from bench) */}
          {step === 'in' && (
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Bench</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {benchPlayers.map((player) => {
                  const selected = playersIn.some(p => p.id === player.id);
                  const disabled = !selected && playersIn.length >= playersOut.length;
                  
                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayerIn(player)}
                      disabled={disabled}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all touch-manipulation ${
                        selected
                          ? 'bg-green-600 ring-4 ring-green-400'
                          : disabled
                          ? 'bg-gray-800 opacity-50 cursor-not-allowed'
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
                        <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold border-2 border-gray-800">
                          {player.jersey_number}
                        </div>
                      </div>
                      <div className="text-xs text-center font-medium line-clamp-2">
                        {player.full_name}
                      </div>
                      {/* Minutes Played */}
                      <div className="text-xs text-gray-400 font-mono">
                        {formatMinutes(playerMinutes[player.id] || 0)}
                      </div>
                    </button>
                  );
                })}
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
          {step === 'out' && (
            <button
              onClick={handleNextStep}
              disabled={playersOut.length === 0}
              className={`flex-1 px-4 py-3 rounded-lg text-white font-bold ${
                playersOut.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
              style={{ minHeight: '44px' }}
            >
              Next
            </button>
          )}
          {step === 'in' && (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`flex-1 px-4 py-3 rounded-lg text-white font-bold ${
                canConfirm
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 cursor-not-allowed opacity-50'
              }`}
              style={{ minHeight: '44px' }}
            >
              Confirm Substitution
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
