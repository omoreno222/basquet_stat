'use client';

import { BasketballCourt } from './BasketballCourt';

interface ChooseSideModalProps {
  onChoose: (attackRight: boolean) => void;
}

export function ChooseSideModal({ onChoose }: ChooseSideModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full p-6">
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Choose Attacking Basket
        </h2>
        <p className="text-gray-300 text-center mb-6">
          Tap the basket your team will attack in Q1
        </p>

        {/* Court with interactive baskets */}
        <div className="relative bg-gray-900 rounded-lg p-4 mb-4" style={{ aspectRatio: '2800/1560' }}>
          <BasketballCourt className="opacity-90" />
          
          {/* Left basket touch target */}
          <button
            onClick={() => onChoose(false)}
            className="absolute left-[2%] top-[30%] w-[15%] h-[40%] bg-orange-500 bg-opacity-20 hover:bg-opacity-40 border-4 border-orange-500 rounded-lg transition-all flex flex-col items-center justify-center group"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <svg className="w-16 h-16 text-orange-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-white font-bold text-lg group-hover:scale-110 transition-transform">
              Left Basket
            </span>
            <span className="text-gray-300 text-sm mt-1">
              Attack Q1 →
            </span>
          </button>

          {/* Right basket touch target */}
          <button
            onClick={() => onChoose(true)}
            className="absolute right-[2%] top-[30%] w-[15%] h-[40%] bg-blue-500 bg-opacity-20 hover:bg-opacity-40 border-4 border-blue-500 rounded-lg transition-all flex flex-col items-center justify-center group"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <svg className="w-16 h-16 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-white font-bold text-lg group-hover:scale-110 transition-transform">
              Right Basket
            </span>
            <span className="text-gray-300 text-sm mt-1">
              ← Attack Q1
            </span>
          </button>
        </div>

        <p className="text-gray-400 text-sm text-center">
          The scorer&apos;s table (TABLE) shows the physical reference point. Choose which basket you&apos;ll attack in Q1.
        </p>
      </div>
    </div>
  );
}
