'use client';

import { useEffect, useRef, useState } from 'react';
import { freeThrowSequenceReady } from '@/lib/capture/free-throws';

export type FreeThrowMark = 'made' | 'miss';

export interface FreeThrowSequenceResult {
  count: 1 | 2 | 3;
  shots: FreeThrowMark[];
}

type Translate = (key: string, fallback: string) => string;

const FREE_THROW_CLOSE_MS = 100;

interface FreeThrowSequencePopupProps {
  t: Translate;
  count: 1 | 2 | 3;
  initialShots?: FreeThrowMark[];
  onShotsChange?: (shots: readonly (FreeThrowMark | null)[]) => void;
  onConfirm: (result: FreeThrowSequenceResult) => void;
  onClose: () => void;
}

export function FreeThrowSequencePopup({
  t,
  count,
  initialShots,
  onShotsChange,
  onConfirm,
  onClose,
}: FreeThrowSequencePopupProps) {
  const [shots, setShots] = useState<(FreeThrowMark | null)[]>(() => (
    initialShots && initialShots.length === count
      ? [...initialShots]
      : Array.from({ length: count }, () => null)
  ));
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function cancel() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    onClose();
  }

  function markShot(index: number, mark: FreeThrowMark) {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    const next = shots.map((shot, shotIndex) => (shotIndex === index ? mark : shot));
    setShots(next);
    onShotsChange?.(next);
    if (!freeThrowSequenceReady(next) || next.length !== count) return;
    const confirmed = next;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      onConfirm({ count, shots: confirmed });
    }, FREE_THROW_CLOSE_MS);
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
            {t('trke_ft_sequence_mark', 'Mark each free throw')}
          </p>
        </header>

        <div className="space-y-5 px-4 py-5">
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

        <footer className="border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={cancel}
            className="w-full bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300"
            style={{ minHeight: '48px' }}
          >
            {t('trke_cancel', 'Cancel')}
          </button>
        </footer>
      </div>
    </div>
  );
}
