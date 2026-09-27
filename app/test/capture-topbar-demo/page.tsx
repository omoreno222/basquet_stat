'use client';

export default function CaptureTopbarDemoPage() {
  return (
    <div className="fixed inset-0 bg-gray-900 text-white">
      {/* Replica of capture top bar */}
      <div className="flex items-center justify-between bg-gray-800 border-b-2 border-orange-500 px-3 py-2" style={{ minHeight: '56px' }}>
        {/* LEFT: Clock Block with Menu */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          {/* Menu Button */}
          <button
            className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded text-lg"
            title="Back to Game"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            ☰
          </button>
          
          {/* Time & Period */}
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold leading-none">5:23</div>
            <div className="text-xs text-gray-400">Q2</div>
          </div>
          
          {/* START/STOP */}
          <button
            className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded font-bold"
            style={{ minHeight: '44px' }}
          >
            START
          </button>
          
          {/* NEXT PERIOD */}
          <button
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold text-sm"
            style={{ minHeight: '44px' }}
          >
            Next
          </button>
          
          {/* Possession Toggle */}
          <button
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded font-bold text-sm"
            style={{ minHeight: '44px' }}
          >
            ⟲
          </button>
        </div>
        
        {/* RIGHT: Score + Connection */}
        <div className="flex items-center gap-3">
          {/* Score */}
          <div className="flex items-center gap-2 text-base font-bold">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-xs">SM</span>
            </div>
            <span>Team Name</span>
            <span className="text-2xl text-green-400">45</span>
            <span className="text-gray-500">-</span>
            <span className="text-2xl text-red-400">42</span>
            <span>Opponent</span>
          </div>
          
          {/* Connection */}
          <div className="text-sm">
            <span className="text-green-400">● 2</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p className="text-2xl mb-2">Capture Top Bar Demo</p>
          <p>Shows menu button (☰), clock, controls, score, and connection status</p>
        </div>
      </div>
    </div>
  );
}
