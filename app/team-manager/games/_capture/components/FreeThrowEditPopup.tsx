'use client';

import { useState } from 'react';

export type FreeThrowEditMark = 'made' | 'miss';

type Translate = (key: string, fallback: string) => string;

interface FreeThrowEditPopupProps {
  t: Translate;
  marks: FreeThrowEditMark[];
  onClose: () => void;
  onSubmit: (marks: FreeThrowEditMark[]) => Promise<string | null>;
}

export function FreeThrowEditPopup({
  t,
  marks: initialMarks,
  onClose,
  onSubmit,
}: FreeThrowEditPopupProps) {
  const [marks, setMarks] = useState<FreeThrowEditMark[]>(initialMarks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    const message = await onSubmit(marks);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ft-edit-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="ft-edit-title" className="text-base font-black">
            {t('trke_ft_edit', 'Edit free throws')}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {marks.map((mark, index) => (
            <div key={index} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
              <span className="text-sm font-black tabular-nums">{index + 1}</span>
              <button
                type="button"
                aria-pressed={mark === 'made'}
                disabled={saving}
                onClick={() => setMarks((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? 'made' : item
                )))}
                className={`min-h-11 text-sm font-black disabled:opacity-40 ${mark === 'made' ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-900'}`}
              >
                {t('trke_ft_sequence_made', 'Made')}
              </button>
              <button
                type="button"
                aria-pressed={mark === 'miss'}
                disabled={saving}
                onClick={() => setMarks((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? 'miss' : item
                )))}
                className={`min-h-11 text-sm font-black disabled:opacity-40 ${mark === 'miss' ? 'bg-red-600 text-white' : 'bg-neutral-200 text-neutral-900'}`}
              >
                {t('trke_ft_sequence_miss', 'Miss')}
              </button>
            </div>
          ))}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <footer className="border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={() => { void save(); }}
            disabled={saving}
            className="min-h-11 w-full rounded-lg bg-black text-sm font-black text-white disabled:opacity-40"
          >
            {t('trke_save', 'Save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
