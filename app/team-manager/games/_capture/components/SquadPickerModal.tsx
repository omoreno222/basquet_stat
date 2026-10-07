'use client';

import { useState } from 'react';

export interface SquadChoice {
  id: string;
  jersey: number;
  name: string;
}

type Translate = (key: string, fallback: string) => string;

interface SquadPickerModalProps {
  t: Translate;
  players: SquadChoice[];
  initialIds: string[];
  canClose: boolean;
  onSave: (playerIds: string[]) => Promise<string | null>;
  onClose: () => void;
}

export function SquadPickerModal({
  t,
  players,
  initialIds,
  canClose,
  onSave,
  onClose,
}: SquadPickerModalProps) {
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 12) return current;
      return [...current, id];
    });
    setError(null);
  }

  async function save() {
    if (selected.length !== 12) {
      setError(t('trke_squad_need_twelve', 'Choose exactly 12 players'));
      return;
    }
    setSaving(true);
    const message = await onSave(selected);
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="squad-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="squad-title" className="text-center text-lg font-black tracking-tight">
            {t('trke_squad_title', 'Who dresses')}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">
            {t('trke_squad_hint', 'This team has more than 12 players. Choose the 12 for this game.')}
            {' '}
            {selected.length}/12
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-2">
            {players.map((player) => {
              const checked = selected.includes(player.id);
              const disabled = !checked && selected.length >= 12;
              return (
                <label key={player.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(player.id)}
                    className="h-5 w-5 accent-neutral-900 disabled:opacity-40"
                  />
                  <span className="w-8 text-lg font-black tabular-nums">{player.jersey}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
                </label>
              );
            })}
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        </div>
        <footer className="flex shrink-0 gap-2 border-t border-neutral-200 p-3">
          {canClose && (
            <button type="button" onClick={onClose} className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300" style={{ minHeight: '48px' }}>
              {t('trke_cancel', 'Cancel')}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => { void save(); }}
            className="flex-1 bg-neutral-900 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_opponent_roster_save', 'Save roster')}
          </button>
        </footer>
      </div>
    </div>
  );
}
