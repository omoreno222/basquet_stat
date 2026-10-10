'use client';

import { useState } from 'react';
import { otherCaptureSide, type CaptureSide } from '@/lib/capture/plays';

type Translate = (key: string, fallback: string) => string;

export interface JumpEditPlayer {
  id: string;
  label: string;
}

interface JumpEditPopupProps {
  t: Translate;
  teamName: string;
  jumpSide: CaptureSide;
  jumpWon: boolean;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  homePlayers: JumpEditPlayer[];
  awayPlayers: JumpEditPlayer[];
  onClose: () => void;
  onSubmit: (input: {
    jumpWon: boolean;
    homePlayerId: string | null;
    awayPlayerId: string | null;
  }) => Promise<string | null>;
}

function PlayerSelect({
  label,
  players,
  value,
  onChange,
}: {
  label: string;
  players: JumpEditPlayer[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
      >
        <option value="" />
        {players.map((player) => (
          <option key={player.id} value={player.id}>{player.label}</option>
        ))}
      </select>
    </label>
  );
}

export function JumpEditPopup({
  t,
  teamName,
  jumpSide,
  jumpWon,
  homePlayerId,
  awayPlayerId,
  homePlayers,
  awayPlayers,
  onClose,
  onSubmit,
}: JumpEditPopupProps) {
  const [won, setWon] = useState(jumpWon);
  const [homeId, setHomeId] = useState<string | null>(homePlayerId);
  const [awayId, setAwayId] = useState<string | null>(awayPlayerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const winnerSide: CaptureSide = won ? jumpSide : otherCaptureSide(jumpSide);
  const loserSide: CaptureSide = otherCaptureSide(winnerSide);
  const roster = (side: CaptureSide) => (side === 'home' ? homePlayers : awayPlayers);
  const selected = (side: CaptureSide) => (side === 'home' ? homeId : awayId);
  const setSelected = (side: CaptureSide, id: string | null) => {
    if (side === 'home') setHomeId(id);
    else setAwayId(id);
  };

  async function save() {
    if (saving) return;
    if ((homeId === null) !== (awayId === null)) {
      setError(t('trke_jump_need_both', 'Choose both players'));
      return;
    }
    setSaving(true);
    setError('');
    const message = await onSubmit({ jumpWon: won, homePlayerId: homeId, awayPlayerId: awayId });
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jump-edit-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="jump-edit-title" className="text-base font-black">
            {t('trke_jump_edit', 'Edit jump')} · {teamName}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWon(true)}
              className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${won ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
            >
              {t('trke_deferred_jump_won', 'Jump won')}
            </button>
            <button
              type="button"
              onClick={() => setWon(false)}
              className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${!won ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
            >
              {t('trke_deferred_jump_lost', 'Jump lost')}
            </button>
          </div>
          <PlayerSelect
            label={t('trke_jump_winner', 'Player who won')}
            players={roster(winnerSide)}
            value={selected(winnerSide)}
            onChange={(id) => setSelected(winnerSide, id)}
          />
          <PlayerSelect
            label={t('trke_jump_loser', 'Player who lost')}
            players={roster(loserSide)}
            value={selected(loserSide)}
            onChange={(id) => setSelected(loserSide, id)}
          />
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
