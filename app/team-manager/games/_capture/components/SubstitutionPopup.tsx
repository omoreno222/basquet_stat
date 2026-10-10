'use client';

import { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { inkOn } from '@/lib/colors';
import {
  COURT_MAX,
  applySubstitutionTap,
  createSubstitutionDraft,
  draftCourtIds,
  substitutionReady,
  type SubstitutionDraft,
} from '@/lib/capture/substitution-draft';

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

type RowMark = 'in' | 'out';

/** Fixed fills so a green kit does not hide who entered. */
const MARK_FILL: Record<RowMark, string> = {
  in: '#15803d',
  out: '#b91c1c',
};

interface SubstitutionPopupProps {
  t: Translate;
  teamName: string;
  color: string;
  players: SubstitutionChoice[];
  saving: boolean;
  error: string | null;
  addFirstNote?: string | null;
  /** Player already moved to the bench because they fouled out. They cannot return. */
  forcedOutId?: string | null;
  onConfirm: (swaps: SubstitutionSwap[], entries: string[]) => void;
  onClose: () => void;
}

function PlayerRow({
  player,
  color,
  muted = false,
  mark = null,
  markLabel,
  locked = false,
  note,
  selected = false,
  onPick,
}: {
  player: SubstitutionChoice;
  color: string;
  muted?: boolean;
  mark?: RowMark | null;
  markLabel?: string;
  locked?: boolean;
  note?: string;
  selected?: boolean;
  onPick: () => void;
}) {
  const fill = muted ? '#d4d4d4' : mark ? MARK_FILL[mark] : color;
  const ink = muted ? '#525252' : inkOn(fill);
  const MarkIcon = mark === 'in' ? LogIn : LogOut;
  return (
    <button
      type="button"
      disabled={muted || locked}
      aria-pressed={selected || !!mark}
      onClick={onPick}
      className={`flex min-h-12 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left shadow-sm disabled:cursor-default ${selected ? 'ring-4 ring-neutral-900 ring-offset-2' : ''}`}
      style={{ backgroundColor: fill, color: ink }}
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
      {mark && markLabel ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-black">
          <MarkIcon className="h-4 w-4" aria-hidden />
          {markLabel}
        </span>
      ) : null}
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
  forcedOutId = null,
  onConfirm,
  onClose,
}: SubstitutionPopupProps) {
  const [session] = useState(() => {
    const initialCourt = players.filter((player) => player.onCourt).map((player) => player.id);
    const parkedId = forcedOutId && initialCourt.includes(forcedOutId) ? forcedOutId : null;
    return {
      initialCourt,
      parkedId,
      draft: createSubstitutionDraft(initialCourt, forcedOutId ?? null),
    };
  });
  const [draft, setDraft] = useState<SubstitutionDraft>(session.draft);
  const [full, setFull] = useState(false);
  const { initialCourt, parkedId } = session;
  const byId = new Map(players.map((player) => [player.id, player]));
  const courtIds = draftCourtIds(initialCourt, draft);
  const onCourt = courtIds.flatMap((id) => {
    const player = byId.get(id);
    return player ? [player] : [];
  });
  const entered = new Set([...draft.swaps.map((swap) => swap.inId), ...draft.entries]);
  const departed = new Set([...draft.swaps.map((swap) => swap.outId), ...draft.waitingOutIds]);
  const bench = players
    .filter((player) => !courtIds.includes(player.id))
    .sort((a, b) => {
      const aLeft = departed.has(a.id) ? 0 : 1;
      const bLeft = departed.has(b.id) ? 0 : 1;
      return aLeft - bLeft || a.jersey - b.jersey || a.name.localeCompare(b.name);
    });
  const eligible = players.filter((player) => !player.eliminated && player.id !== parkedId).length;
  const fillVacancies = eligible >= COURT_MAX;
  const ready = substitutionReady(draft, saving, onCourt.length, fillVacancies ? COURT_MAX : 0);
  const eliminatedLabel = t('trke_period_lineup_eliminated', 'Eliminado');
  const inLabel = t('trke_in', 'Entra');
  const outLabel = t('trke_out', 'Sale');
  const benchCanEnter = players.some((player) => !player.onCourt && !player.eliminated);
  const foulOutWaiting = !!parkedId && draft.waitingOutIds.includes(parkedId);
  const foulOutHint = t('trke_sub_hint_foul_out', 'Fuera del partido. Toca quién entra del banquillo.');
  const hint = parkedId && !benchCanEnter
    ? (addFirstNote ?? t('trke_sub_hint_foul_out_short', 'Fuera del partido. El equipo sigue con uno menos.'))
    : foulOutWaiting
      ? foulOutHint
      : draft.pendingInId
        ? t('trke_sub_hint_out', 'Toca quién sale')
        : !benchCanEnter && addFirstNote
          ? addFirstNote
          : full
            ? t('trke_sub_hint_full', 'Máximo 5 en pista')
            : draft.waitingOutIds.length > 0 || (fillVacancies && onCourt.length < COURT_MAX)
              ? t('trke_sub_hint_in', 'Toca quién entra del banquillo')
              : t('trke_sub_hint_move', 'Toca en pista para bajar al banquillo. Toca en el banquillo para subir.');

  function apply(tap: Parameters<typeof applySubstitutionTap>[2]) {
    if (saving) return;
    const result = applySubstitutionTap(initialCourt, draft, tap, fillVacancies);
    setDraft(result.draft);
    setFull(result.full);
  }

  function confirm() {
    if (!ready) return;
    onConfirm(draft.swaps, draft.entries);
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
                  mark={entered.has(player.id) ? 'in' : null}
                  markLabel={inLabel}
                  locked={saving}
                  onPick={() => apply({ kind: 'court', playerId: player.id })}
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
                const fouledOut = player.eliminated || player.id === parkedId;
                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    color={color}
                    muted={fouledOut}
                    mark={!fouledOut && departed.has(player.id) ? 'out' : null}
                    markLabel={outLabel}
                    locked={saving && !fouledOut}
                    selected={draft.pendingInId === player.id}
                    note={fouledOut ? eliminatedLabel : undefined}
                    onPick={() => apply({
                      kind: 'bench',
                      playerId: player.id,
                      eliminated: player.eliminated,
                      forcedOut: player.id === parkedId,
                    })}
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
