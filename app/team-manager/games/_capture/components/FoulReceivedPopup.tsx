'use client';

import { useState } from 'react';

type Translate = (key: string, fallback: string) => string;

export interface FoulReceivedPlayer {
  id: string;
  label: string;
}

interface FoulReceivedPopupProps {
  t: Translate;
  players: FoulReceivedPlayer[];
  playerId: string | null;
  /** Same-team players who can be the one that fouled. Hidden for a coach technical. */
  offenders?: FoulReceivedPlayer[];
  offenderId?: string | null;
  onClose: () => void;
  onSubmit: (input: { receiverId: string | null; offenderId: string | null }) => Promise<string | null>;
}

export function FoulReceivedPopup({
  t,
  players,
  playerId,
  offenders,
  offenderId,
  onClose,
  onSubmit,
}: FoulReceivedPopupProps) {
  const [selected, setSelected] = useState<string | null>(playerId);
  const [offender, setOffender] = useState<string | null>(offenderId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const offenderReady = !offenders || offenders.some((player) => player.id === offender);

  async function save() {
    if (saving || !offenderReady) return;
    setSaving(true);
    setError('');
    const message = await onSubmit({ receiverId: selected, offenderId: offenders ? offender : null });
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="foul-received-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="foul-received-title" className="text-base font-black">
            {offenders
              ? t('trke_foul_edit', 'Edit foul')
              : t('trke_foul_received_edit', 'Who received the foul')}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {offenders ? (
            <label className="block text-sm font-medium">
              {t('trke_foul_player', 'Who fouled')}
              <select
                value={offender ?? ''}
                onChange={(event) => setOffender(event.target.value || null)}
                className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
              >
                {offenders.map((player) => (
                  <option key={player.id} value={player.id}>{player.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            {t('trke_foul_received_by', 'Received by')}
            <select
              value={selected ?? ''}
              onChange={(event) => setSelected(event.target.value || null)}
              className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
            >
              <option value="" />
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
            disabled={saving || !offenderReady}
            className="min-h-11 w-full rounded-lg bg-black text-sm font-black text-white disabled:opacity-40"
          >
            {t('trke_save', 'Save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
