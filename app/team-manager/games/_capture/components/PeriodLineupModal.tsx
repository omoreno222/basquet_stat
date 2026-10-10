'use client';

import { useState } from 'react';

export interface LineupChoice {
  id: string;
  jersey: number;
  name: string;
  eliminated: boolean;
  avatarUrl?: string | null;
}

type Translate = (key: string, fallback: string) => string;

interface PeriodLineupModalProps {
  t: Translate;
  periodLabel: string;
  homeName: string;
  awayName: string;
  homePlayers: LineupChoice[];
  awayPlayers: LineupChoice[];
  initialHomeIds: string[];
  initialAwayIds: string[];
  homeRequired: number;
  awayRequired: number;
  undressedPlayers: LineupChoice[];
  onIncorporate: (playerId: string) => Promise<string | null>;
  onSave: (homeIds: string[], awayIds: string[]) => Promise<string | null>;
  onClose: () => void;
}

function SideList({
  title,
  players,
  selected,
  required,
  eliminatedLabel,
  onToggle,
}: {
  title: string;
  players: LineupChoice[];
  selected: string[];
  required: number;
  eliminatedLabel: string;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="min-w-0 flex-1">
      <p className="truncate text-center text-[11px] font-black tracking-wider text-neutral-500">
        {title} · {selected.length}/{required}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {players.map((player) => {
          const checked = selected.includes(player.id);
          const disabled = player.eliminated || (!checked && selected.length >= 5);
          return (
            <label
              key={player.id}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-2 ${
                player.eliminated ? 'border-neutral-200 bg-neutral-100 text-neutral-400' : 'border-neutral-200'
              }`}
            >
              <input
                type="checkbox"
                checked={checked && !player.eliminated}
                disabled={disabled}
                onChange={() => onToggle(player.id)}
                className="h-5 w-5 accent-neutral-900 disabled:opacity-40"
              />
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
              ) : null}
              <span className="w-8 text-lg font-black tabular-nums">{player.jersey}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {player.name}
                {player.eliminated ? ` · ${eliminatedLabel}` : ''}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function PeriodLineupModal({
  t,
  periodLabel,
  homeName,
  awayName,
  homePlayers,
  awayPlayers,
  initialHomeIds,
  initialAwayIds,
  homeRequired,
  awayRequired,
  undressedPlayers,
  onIncorporate,
  onSave,
  onClose,
}: PeriodLineupModalProps) {
  const [homeIds, setHomeIds] = useState(initialHomeIds.filter((id) => homePlayers.some((player) => player.id === id && !player.eliminated)));
  const [awayIds, setAwayIds] = useState(initialAwayIds.filter((id) => awayPlayers.some((player) => player.id === id && !player.eliminated)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [incorporating, setIncorporating] = useState(false);
  const eliminatedLabel = t('trke_period_lineup_eliminated', 'Fouled out');

  function toggle(side: 'home' | 'away', id: string) {
    const players = side === 'home' ? homePlayers : awayPlayers;
    const player = players.find((item) => item.id === id);
    if (!player || player.eliminated) return;
    const update = side === 'home' ? setHomeIds : setAwayIds;
    update((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
    setError(null);
  }

  function openIncorporate() {
    if (undressedPlayers.length === 0) {
      setPicking(false);
      setError(t('trke_squad_incorporate_none', 'Every player on the team is already dressed'));
      return;
    }
    if (homePlayers.length >= 12) {
      setPicking(false);
      setError(t('trke_squad_incorporate_full', 'This game already has 12 dressed players'));
      return;
    }
    setError(null);
    setPicking(true);
  }

  async function add(playerId: string) {
    setIncorporating(true);
    const message = await onIncorporate(playerId);
    setIncorporating(false);
    if (message) {
      setError(message);
      return;
    }
    setPicking(false);
    setError(null);
  }

  async function save() {
    const short = (count: number, required: number) => count > 0 && count < required;
    if (short(homeIds.length, homeRequired) || short(awayIds.length, awayRequired)) {
      setError(t('trke_period_lineup_must_five', 'With 5 or more players available, the team cannot take the court with fewer than 5.'));
      return;
    }
    setSaving(true);
    const message = await onSave(homeIds, awayIds);
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-lineup-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="period-lineup-title" className="text-center text-lg font-black tracking-tight">
            {periodLabel} · {t('trke_period_lineup_title', 'Who starts this period')}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">
            {t('trke_period_lineup_hint', 'With 5 or more players available, the team must take the court with 5.')}
          </p>
          <p className="mt-1 text-center text-[11px] font-bold text-neutral-700">
            {t('trke_period_lineup_need', 'Players needed to start')}: {homeName} {homeRequired} · {awayName} {awayRequired}
          </p>
        </header>
        <div className="flex min-h-0 flex-1 gap-3 overflow-y-auto px-3 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <SideList
              title={homeName}
              players={homePlayers}
              selected={homeIds}
              required={homeRequired}
              eliminatedLabel={eliminatedLabel}
              onToggle={(id) => toggle('home', id)}
            />
            <button
              type="button"
              onClick={openIncorporate}
              className="mt-2 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300"
              style={{ minHeight: '48px' }}
            >
              {t('trke_squad_incorporate', 'Add a player')}
            </button>
            {picking && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-center text-[11px] font-medium text-neutral-500">
                  {t('trke_squad_incorporate_hint', 'Choose a player from the team who is not dressed. At most 12.')}
                </p>
                {undressedPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    disabled={incorporating}
                    onClick={() => { void add(player.id); }}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 px-2 py-2 text-left hover:bg-neutral-50 disabled:opacity-40"
                  >
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                    ) : null}
                    <span className="w-8 text-lg font-black tabular-nums">{player.jersey}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <SideList
            title={awayName}
            players={awayPlayers}
            selected={awayIds}
            required={awayRequired}
            eliminatedLabel={eliminatedLabel}
            onToggle={(id) => toggle('away', id)}
          />
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-sm font-medium text-red-700">{error}</p>}
        <footer className="flex shrink-0 gap-2 border-t border-neutral-200 p-3">
          <button type="button" onClick={onClose} className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300" style={{ minHeight: '48px' }}>
            {t('trke_cancel', 'Cancel')}
          </button>
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
