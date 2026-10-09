'use client';

import { useState } from 'react';

type Translate = (key: string, fallback: string) => string;

export interface SubstitutionEditPlayer {
  id: string;
  label: string;
}

export interface SubstitutionEditPair {
  eventId: string;
  outId: string;
  inId: string;
}

interface SubstitutionEditPopupProps {
  t: Translate;
  pairs: SubstitutionEditPair[];
  outPlayers: SubstitutionEditPlayer[];
  inPlayers: SubstitutionEditPlayer[];
  onClose: () => void;
  onSubmit: (pairs: SubstitutionEditPair[]) => Promise<string | null>;
}

export function SubstitutionEditPopup({
  t,
  pairs: initialPairs,
  outPlayers,
  inPlayers,
  onClose,
  onSubmit,
}: SubstitutionEditPopupProps) {
  const [pairs, setPairs] = useState(initialPairs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ready = pairs.every((pair) => pair.outId && pair.inId && pair.outId !== pair.inId)
    && new Set(pairs.map((pair) => pair.outId)).size === pairs.length
    && new Set(pairs.map((pair) => pair.inId)).size === pairs.length;

  function setPair(index: number, patch: Partial<SubstitutionEditPair>) {
    setPairs((current) => current.map((pair, pairIndex) => (
      pairIndex === index ? { ...pair, ...patch } : pair
    )));
  }

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    setError('');
    const message = await onSubmit(pairs);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-edit-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="sub-edit-title" className="text-base font-black">
            {t('trke_sub_edit', 'Edit substitution')}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
          {pairs.map((pair, index) => {
            const takenOut = new Set(pairs.filter((_, pairIndex) => pairIndex !== index).map((item) => item.outId));
            const takenIn = new Set(pairs.filter((_, pairIndex) => pairIndex !== index).map((item) => item.inId));
            return (
              <div key={pair.eventId} className="grid gap-2">
                <label className="block text-sm font-medium">
                  {t('trke_out', 'Out')}
                  <select
                    value={pair.outId}
                    onChange={(event) => setPair(index, { outId: event.target.value })}
                    className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
                  >
                    {outPlayers.filter((player) => player.id === pair.outId || !takenOut.has(player.id)).map((player) => (
                      <option key={player.id} value={player.id}>{player.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {t('trke_in', 'In')}
                  <select
                    value={pair.inId}
                    onChange={(event) => setPair(index, { inId: event.target.value })}
                    className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
                  >
                    {inPlayers.filter((player) => player.id === pair.inId || !takenIn.has(player.id)).map((player) => (
                      <option key={player.id} value={player.id}>{player.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <footer className="border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={() => { void save(); }}
            disabled={!ready || saving}
            className="min-h-11 w-full rounded-lg bg-black text-sm font-black text-white disabled:opacity-40"
          >
            {t('trke_save', 'Save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
