'use client';

interface SlotBActionModalProps {
  playerName: string;
  playerJersey: number;
  onAction: (actionType: 'rebound_off' | 'rebound_def' | 'assist' | 'steal' | 'turnover') => void;
  onClose: () => void;
}

export function SlotBActionModal({
  playerName,
  playerJersey,
  onAction,
  onClose
}: SlotBActionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full border-2 border-blue-500 shadow-2xl">
        <div className="bg-gray-900 border-b border-gray-700 p-4">
          <h2 className="text-2xl font-bold text-white text-center">
            Action by #{playerJersey} {playerName}
          </h2>
        </div>
        
        <div className="p-6 space-y-3">
          <button
            onClick={() => onAction('rebound_off')}
            className="w-full px-6 py-5 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold text-white transition-all touch-manipulation"
          >
            Offensive Rebound
          </button>
          
          <button
            onClick={() => onAction('rebound_def')}
            className="w-full px-6 py-5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-bold text-white transition-all touch-manipulation"
          >
            Defensive Rebound
          </button>
          
          <button
            onClick={() => onAction('assist')}
            className="w-full px-6 py-5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xl font-bold text-white transition-all touch-manipulation"
          >
            Assist
          </button>
          
          <button
            onClick={() => onAction('steal')}
            className="w-full px-6 py-5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xl font-bold text-white transition-all touch-manipulation"
          >
            Steal
          </button>
          
          <button
            onClick={() => onAction('turnover')}
            className="w-full px-6 py-5 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold text-white transition-all touch-manipulation"
          >
            Turnover
          </button>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium mt-4"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
