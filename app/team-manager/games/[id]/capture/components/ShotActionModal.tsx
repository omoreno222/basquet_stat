'use client';

interface ShotActionModalProps {
  playerName: string;
  playerJersey: number;
  coordinateX: number;
  coordinateY: number;
  onAction: (made: boolean, points: number) => void;
  onClose: () => void;
}

export function ShotActionModal({
  playerName,
  playerJersey,
  coordinateX,
  coordinateY,
  onAction,
  onClose
}: ShotActionModalProps) {
  // Detect if tap was inside 3pt line
  // Simplified 3pt detection: use distance from basket + court position
  const basketX = 0.5;
  const basketY = 0.05; // Near top baseline
  const dx = coordinateX - basketX;
  const dy = coordinateY - basketY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Corners: x near edges (< 0.15 or > 0.85) and y < 0.25
  const isCorner = (coordinateX < 0.15 || coordinateX > 0.85) && coordinateY < 0.25;
  
  // FIBA 3pt: ~6.75m arc, ~6.60m corner (normalized)
  // Rough threshold: distance > 0.35 OR corner shot within first 25%
  const isLikely3pt = distance > 0.35 || isCorner;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full border-2 border-orange-500 shadow-2xl">
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <h2 className="text-2xl font-bold text-white text-center">
            Shot by #{playerJersey} {playerName}
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          {/* 2-Point Buttons */}
          <div className="space-y-2">
            <p className="text-sm text-gray-400 text-center">2-Point Shot</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onAction(true, 2)}
                className={`px-6 py-6 rounded-lg text-xl font-bold transition-all touch-manipulation ${
                  !isLikely3pt
                    ? 'bg-green-600 hover:bg-green-700 ring-4 ring-green-400'
                    : 'bg-green-700 hover:bg-green-600'
                }`}
              >
                2P MADE
              </button>
              <button
                onClick={() => onAction(false, 0)}
                className={`px-6 py-6 rounded-lg text-xl font-bold transition-all touch-manipulation ${
                  !isLikely3pt
                    ? 'bg-red-600 hover:bg-red-700 ring-4 ring-red-400'
                    : 'bg-red-700 hover:bg-red-600'
                }`}
              >
                2P MISS
              </button>
            </div>
          </div>
          
          {/* 3-Point Buttons */}
          <div className="space-y-2">
            <p className="text-sm text-gray-400 text-center">3-Point Shot</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onAction(true, 3)}
                className={`px-6 py-6 rounded-lg text-xl font-bold transition-all touch-manipulation ${
                  isLikely3pt
                    ? 'bg-purple-600 hover:bg-purple-700 ring-4 ring-purple-400'
                    : 'bg-purple-700 hover:bg-purple-600'
                }`}
              >
                3P MADE
              </button>
              <button
                onClick={() => onAction(false, 0)}
                className={`px-6 py-6 rounded-lg text-xl font-bold transition-all touch-manipulation ${
                  isLikely3pt
                    ? 'bg-orange-600 hover:bg-orange-700 ring-4 ring-orange-400'
                    : 'bg-orange-700 hover:bg-orange-600'
                }`}
              >
                3P MISS
              </button>
            </div>
          </div>
          
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
