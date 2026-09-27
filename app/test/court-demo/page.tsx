'use client';

import { BasketballCourt } from '@/app/team-manager/games/[id]/capture/components/BasketballCourt';

export default function CourtDemoPage() {
  // Sample shot markers showing various positions
  const shotMarkers = [
    { id: '1', x: 0.2, y: 0.3, made: true, points: 2 },
    { id: '2', x: 0.15, y: 0.7, made: false, points: 3 },
    { id: '3', x: 0.8, y: 0.5, made: true, points: 3 },
    { id: '4', x: 0.9, y: 0.2, made: false, points: 2 },
  ];

  return (
    <div className="fixed inset-0 bg-gray-900">
      {/* Court in landscape */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-full max-w-6xl h-full max-h-4xl">
          <BasketballCourt
            shotMarkers={shotMarkers}
            attackingRight={true}
            isOffense={true}
          />
        </div>
      </div>
      
      {/* Scorer's table marker visible at bottom */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 px-4 py-2 rounded text-white text-sm">
        FIBA Court 28m × 15m + Scorer&apos;s Table
      </div>
    </div>
  );
}
