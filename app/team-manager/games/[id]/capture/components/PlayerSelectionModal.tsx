'use client';

import { useState } from 'react';
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border-2 border-orange-500 shadow-2xl">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-6">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => onSelectPlayer(player.id)}
              className="flex flex-col items-center gap-3 p-4 bg-gray-700 hover:bg-orange-600 rounded-lg transition-colors min-h-[120px] touch-manipulation"
              style={{ minHeight: '140px' }}
            >
              {/* Player Avatar */}
              <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center text-2xl font-bold text-white overflow-hidden border-2 border-gray-500">
                {player.avatar_url ? (
                  <Image
                    src={player.avatar_url}
                    alt={player.full_name}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span>{player.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                )}
              </div>
              
              {/* Jersey Number */}
              <div className="text-3xl font-bold text-orange-400">
                #{player.jersey_number}
              </div>
              
              {/* Player Name */}
              <div className="text-sm font-medium text-white text-center leading-tight">
                {player.full_name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
