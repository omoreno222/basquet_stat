'use client';

import { useState } from 'react';

type Translate = (key: string, fallback: string) => string;

export interface ReboundPlayer {
  id: string;
  label: string;
}

interface ReboundPlayerPopupProps {
  t: Translate;
  players: ReboundPlayer[];
  playerId: string;
  onClose: () => void;
  onSubmit: (playerId: string) => Promise<string | null>;
}

export function ReboundPlayerPopup({
  t,
  players,
  playerId,
  onClose,
  onSubmit,
}: ReboundPlayerPopupProps) {
  const [selected, setSelected] = useState(playerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ready = players.some((player) => player.id === selected);

  async function save() {
    if (saving || !ready) return;
    setSaving(true);
    setError('');
    const message = await onSubmit(selected);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebound-edit-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="rebound-edit-title" className="text-base font-black">
            {t('trke_rebound_edit', 'Who took the rebound')}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <label className="block text-sm font-medium">
            {t('trke_rebound_edit', 'Who took the rebound')}
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.label}</option>
              ))}
            </select>
          </label>
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
