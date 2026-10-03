'use client';

import { useState } from 'react';
import { inkOn } from '@/lib/colors';

export interface SubstitutionChoice {
  id: string;
  jersey: number;
  name: string;
  avatarUrl?: string | null;
  onCourt: boolean;
  eliminated: boolean;
}

export interface SubstitutionSwap {
  outId: string;
  inId: string;
}

type Translate = (key: string, fallback: string) => string;

const COURT_MAX = 5;

interface SubstitutionPopupProps {
  t: Translate;
  teamName: string;
  color: string;
  players: SubstitutionChoice[];
  saving: boolean;
  error: string | null;
  addFirstNote?: string | null;
  onConfirm: (swaps: SubstitutionSwap[]) => void;
  onClose: () => void;
}

function PlayerRow({
  player,
  color,
  muted = false,
  locked = false,
  note,
  onPick,
}: {
  player: SubstitutionChoice;
  color: string;
  muted?: boolean;
  locked?: boolean;
  note?: string;
  onPick: () => void;
}) {
  const ink = muted ? '#525252' : inkOn(color);
  return (
    <button
      type="button"
      disabled={muted || locked}
      onClick={onPick}
      className="flex min-h-12 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left shadow-sm disabled:cursor-default"
      style={{ backgroundColor: muted ? '#d4d4d4' : color, color: ink }}
    >
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-lg font-black tabular-nums">
          {player.jersey}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">
          {player.avatarUrl ? `#${player.jersey} ` : ''}{player.name}
        </span>
        {note ? <span className="block truncate text-[11px] font-bold opacity-80">{note}</span> : null}
      </span>
    </button>
  );
}

export function SubstitutionPopup({
  t,
  teamName,
  color,
  players,
  saving,
  error,
  addFirstNote = null,
  onConfirm,
  onClose,
}: SubstitutionPopupProps) {
  const initialCourt = players.filter((player) => player.onCourt).map((player) => player.id);
  const [courtIds, setCourtIds] = useState(initialCourt);
  const [full, setFull] = useState(false);
  const byId = new Map(players.map((player) => [player.id, player]));
  const onCourt = courtIds.flatMap((id) => {
    const player = byId.get(id);
    return player ? [player] : [];
  });
  const bench = players
    .filter((player) => !courtIds.includes(player.id))
    .sort((a, b) => {
      const aLeft = initialCourt.includes(a.id) ? 1 : 0;
      const bLeft = initialCourt.includes(b.id) ? 1 : 0;
      return aLeft - bLeft || a.jersey - b.jersey || a.name.localeCompare(b.name);
    });
  const outs = initialCourt.filter((id) => !courtIds.includes(id));
  const ins = courtIds.filter((id) => !initialCourt.includes(id));
  const ready = !saving && outs.length > 0 && outs.length === ins.length && onCourt.length <= COURT_MAX;
  const eliminatedLabel = t('trke_period_lineup_eliminated', 'Eliminado');
  const benchCanEnter = players.some((player) => !player.onCourt && !player.eliminated);
  const hint = !benchCanEnter && addFirstNote
    ? addFirstNote
    : full
      ? t('trke_sub_hint_full', 'Máximo 5 en pista')
      : outs.length !== ins.length
        ? t('trke_sub_hint_pair', 'Tiene que entrar uno por cada uno que sale')
        : t('trke_sub_hint_move', 'Toca en pista para bajar al banquillo. Toca en el banquillo para subir.');

  function toBench(id: string) {
    if (saving || !initialCourt.includes(id)) return;
    setFull(false);
    setCourtIds((current) => current.filter((item) => item !== id));
  }

  function toCourt(player: SubstitutionChoice) {
    if (saving || player.eliminated || initialCourt.includes(player.id)) return;
    setCourtIds((current) => {
      if (current.includes(player.id)) return current;
      if (current.length >= COURT_MAX) {
        setFull(true);
        return current;
      }
      setFull(false);
      return [...current, player.id];
    });
  }

  function confirm() {
    if (!ready) return;
    onConfirm(outs.map((outId, index) => ({ outId, inId: ins[index] })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="substitution-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="substitution-title" className="text-center text-lg font-black tracking-tight">
            {t('trke_cambio', 'Cambio')} · {teamName}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">{hint}</p>
          {error ? <p className="mt-1 text-center text-[11px] font-bold text-red-700">{error}</p> : null}
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto px-3 py-3">
          <section aria-label={t('trke_sub_on_court', 'En pista')}>
            <p className="mb-2 text-center text-[11px] font-black tracking-wider text-neutral-500">
              {t('trke_sub_on_court', 'En pista')} · {onCourt.length}/{COURT_MAX}
            </p>
            <div className="flex flex-col gap-2">
              {onCourt.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  color={color}
                  locked={saving || !initialCourt.includes(player.id)}
                  onPick={() => toBench(player.id)}
                />
              ))}
            </div>
          </section>
          <section aria-label={t('trke_sub_bench', 'Banquillo')}>
            <p className="mb-2 text-center text-[11px] font-black tracking-wider text-neutral-500">
              {t('trke_sub_bench', 'Banquillo')}
            </p>
            <div className="flex flex-col gap-2">
              {bench.map((player) => {
                const justLeft = initialCourt.includes(player.id);
                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    color={color}
                    muted={justLeft || player.eliminated}
                    locked={saving && !justLeft && !player.eliminated}
                    note={player.eliminated ? eliminatedLabel : undefined}
                    onPick={() => toCourt(player)}
                  />
                );
              })}
            </div>
          </section>
        </div>
        <footer className="flex shrink-0 gap-2 border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300 disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_cancel', 'Cancelar')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready}
            className="flex-1 bg-neutral-900 py-3 text-sm font-bold text-white hover:bg-black disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_cambio', 'Cambio')}
          </button>
        </footer>
      </div>
    </div>
  );
}
