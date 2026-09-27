'use client';

import { BasketballCourt } from '@/app/team-manager/games/[id]/capture/components/BasketballCourt';

export default function FTMarkersDemoPage() {
  // Free throw markers - 3-shot set on left basket (made) and right basket (2 made, 1 missed)
  const shotMarkers = [
    // Left basket - 3 made FTs (green) at y=690, 750, 810
    { id: 'ft-L1', x: 0.207, y: 0.46, made: true, points: 1 },
    { id: 'ft-L2', x: 0.207, y: 0.5, made: true, points: 1 },
    { id: 'ft-L3', x: 0.207, y: 0.54, made: true, points: 1 },
    
    // Right basket - 2 made, 1 missed FTs (green + red) at y=690, 750, 810
    { id: 'ft-R1', x: 0.793, y: 0.46, made: true, points: 1 },
    { id: 'ft-R2', x: 0.793, y: 0.5, made: false, points: 1 },
    { id: 'ft-R3', x: 0.793, y: 0.54, made: true, points: 1 },
  ];

  return (
    <div className="fixed inset-0 bg-gray-900">
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-full max-w-6xl h-full max-h-4xl">
          <BasketballCourt
            shotMarkers={shotMarkers}
            attackingRight={true}
            isOffense={true}
          />
        </div>
      </div>
      
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 px-4 py-2 rounded text-white text-sm text-center">
        Free Throw Markers (3-shot set)<br />
        <span className="text-green-400">Green = Made</span> | <span className="text-red-400">Red = Missed</span>
      </div>
    </div>
  );
}
