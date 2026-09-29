'use client';

import { useState } from 'react';

export type FreeThrowMark = 'made' | 'miss';

export interface FreeThrowSequenceResult {
  count: 1 | 2 | 3;
  shots: FreeThrowMark[];
}

type Translate = (key: string, fallback: string) => string;

interface FreeThrowSequencePopupProps {
  t: Translate;
  onConfirm: (result: FreeThrowSequenceResult) => void;
  onClose: () => void;
}

const COUNTS = [1, 2, 3] as const;

function resizeShots(shots: (FreeThrowMark | null)[], count: 1 | 2 | 3) {
  const next = shots.slice(0, count);
  while (next.length < count) next.push(null);
  return next;
}

export function FreeThrowSequencePopup({ t, onConfirm, onClose }: FreeThrowSequencePopupProps) {
  const [count, setCount] = useState<1 | 2 | 3>(2);
  const [shots, setShots] = useState<(FreeThrowMark | null)[]>([null, null]);

  const complete = shots.every((shot) => shot !== null);

  function selectCount(next: 1 | 2 | 3) {
    setCount(next);
    setShots((current) => resizeShots(current, next));
  }

  function markShot(index: number, mark: FreeThrowMark) {
    setShots((current) => current.map((shot, shotIndex) => (shotIndex === index ? mark : shot)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-throw-sequence-title"
        className="w-full max-w-md border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="free-throw-sequence-title" className="text-center text-lg font-black tracking-tight">
            {t('trke_ft_sequence_title', 'Free throws')}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">
            {t('trke_ft_sequence_hint', 'Personal foul · choose how many and mark each one')}
          </p>
        </header>

        <div className="space-y-5 px-4 py-5">
          <div>
            <p className="mb-2 text-center text-[11px] font-black tracking-wider text-neutral-500">
              {t('trke_ft_sequence_count', 'Number of shots')}
            </p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('trke_ft_sequence_count', 'Number of shots')}>
              {COUNTS.map((option) => {
                const selected = count === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectCount(option)}
                    className={`py-4 text-3xl font-black tabular-nums ${
                      selected
                        ? 'bg-black text-white'
                        : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    }`}
                    style={{ minHeight: '64px' }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {shots.map((shot, index) => (
              <div key={index} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
                <span className="text-sm font-black tabular-nums">{index + 1}.º</span>
                <button
                  type="button"
                  aria-pressed={shot === 'made'}
                  onClick={() => markShot(index, 'made')}
                  className={`py-4 text-sm font-black tracking-wide ${
                    shot === 'made'
                      ? 'bg-green-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-green-50'
                  }`}
                  style={{ minHeight: '56px' }}
                >
                  {t('trke_ft_sequence_made', 'Made')}
                </button>
                <button
                  type="button"
                  aria-pressed={shot === 'miss'}
                  onClick={() => markShot(index, 'miss')}
                  className={`py-4 text-sm font-black tracking-wide ${
                    shot === 'miss'
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-red-50'
                  }`}
                  style={{ minHeight: '56px' }}
                >
                  {t('trke_ft_sequence_miss', 'Miss')}
                </button>
              </div>
            ))}
          </div>
        </div>

        <footer className="flex gap-2 border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300"
            style={{ minHeight: '48px' }}
          >
            {t('trke_cancel', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!complete}
            onClick={() => {
              if (!complete) return;
              onConfirm({ count, shots: shots as FreeThrowMark[] });
            }}
            className="flex-1 bg-neutral-900 py-3 text-sm font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_ft_sequence_done', 'Done')}
          </button>
        </footer>
      </div>
    </div>
  );
}
