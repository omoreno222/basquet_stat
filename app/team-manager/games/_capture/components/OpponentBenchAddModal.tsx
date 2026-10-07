'use client';

import { useState } from 'react';

export interface OpponentBenchRow {
  id: string;
  jerseyNumber: number;
  name: string;
}

type Translate = (key: string, fallback: string) => string;

interface OpponentBenchAddModalProps {
  t: Translate;
  players: OpponentBenchRow[];
  onAdd: (jerseyNumber: number, name: string) => Promise<string | null>;
  onClose: () => void;
}

const ADD_HINT = 'Add a jersey from the bench. Up to 12. Then you can substitute them in.';

function jerseyDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 2);
}

export function OpponentBenchAddModal({
  t,
  players,
  onAdd,
  onClose,
}: OpponentBenchAddModalProps) {
  const [jersey, setJersey] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const full = players.length >= 12;
  const listed = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber || a.name.localeCompare(b.name));
  const canAdd = !saving && !full && /^\d{1,2}$/.test(jersey);

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    const message = await onAdd(Number(jersey), name);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setJersey('');
    setName('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opponent-bench-add-title"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl sm:max-h-[92dvh]"
      >
        <header className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-3 py-3 sm:px-4">
          <h2 id="opponent-bench-add-title" className="text-center text-base font-black tracking-tight sm:text-lg">
            {t('trke_opponent_bench_add_title', 'Add a bench player')}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium leading-snug text-neutral-500 sm:text-xs">
            {full
              ? t('trke_opponent_roster_max', 'This game already has 12 opponent jerseys')
              : t('trke_opponent_bench_add_hint', ADD_HINT)}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {listed.length > 0 ? (
            <ul className="mb-3 flex flex-col gap-1.5">
              {listed.map((player) => (
                <li
                  key={player.id}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2"
                >
                  <span className="w-10 shrink-0 text-center text-lg font-black tabular-nums">
                    {player.jerseyNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-700">
                    {player.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {full ? null : (
            <div className="flex gap-1.5 sm:gap-2">
              <input
                inputMode="numeric"
                aria-label={t('trke_opponent_roster_jersey', 'Jersey')}
                value={jersey}
                placeholder="–"
                onChange={(event) => {
                  setJersey(jerseyDigits(event.target.value));
                  setError(null);
                }}
                className="h-11 w-14 shrink-0 rounded-lg border border-neutral-300 bg-white text-center text-lg font-black tabular-nums text-neutral-900 outline-none focus:border-neutral-900"
              />
              <input
                aria-label={t('trke_opponent_roster_name', 'Name, if readable')}
                value={name}
                maxLength={80}
                placeholder={t('trke_opponent_roster_name', 'Name, if readable')}
                onChange={(event) => setName(event.target.value.slice(0, 80))}
                className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 text-base text-neutral-900 outline-none focus:border-neutral-900"
              />
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-neutral-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300 disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_cancel', 'Cancel')}
          </button>
          {full ? null : (
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => { void add(); }}
              className="flex-1 bg-neutral-900 py-3 text-sm font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              style={{ minHeight: '48px' }}
            >
              {t('trke_opponent_roster_add', 'Add jersey')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
