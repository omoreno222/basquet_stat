'use client';

import { useState } from 'react';
import { BasketballCourt } from './BasketballCourt';
import type { MadeAssistPlayer } from './MadeShotPopups';
import { madeAssistRequired, shotInPaint, shotOnAttackingHalf, shotValueFromWorld } from '@/lib/capture/plays';

type Translate = (key: string, fallback: string) => string;

interface ShotPointPopupProps {
  t: Translate;
  attackingRight: boolean;
  placement: { x: number; y: number } | null;
  /** Same-team players on the court at the shot, including the recorded shooter. */
  players: MadeAssistPlayer[];
  shooterId: string;
  assistId: string | null;
  onClose: () => void;
  onSubmit: (
    coordX: number,
    coordY: number,
    assistId: string | null,
    shooterId: string,
  ) => Promise<string | null>;
}

export function ShotPointPopup({
  t,
  attackingRight,
  placement,
  players,
  shooterId: initialShooterId,
  assistId: initialAssistId,
  onClose,
  onSubmit,
}: ShotPointPopupProps) {
  const [coord, setCoord] = useState(placement);
  const [shooterId, setShooterId] = useState(initialShooterId);
  const [assistId, setAssistId] = useState<string | null>(initialAssistId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mates = players.filter((player) => player.id !== shooterId);
  const onHalf = coord ? shotOnAttackingHalf(coord.x, attackingRight) : false;
  const value = coord && onHalf ? shotValueFromWorld(coord.x, coord.y, attackingRight) : null;
  const inPaint = coord && onHalf ? shotInPaint(coord.x, coord.y, attackingRight) : false;
  const assistNeeded = value ? madeAssistRequired(value, inPaint, mates.length) : false;
  const shooterReady = players.some((player) => player.id === shooterId);
  const assistOnCourt = !assistId || mates.some((player) => player.id === assistId);
  const assistReady = assistOnCourt && (!assistNeeded || !!assistId);

  function chooseShooter(id: string) {
    setShooterId(id);
    if (assistId === id) setAssistId(null);
  }

  async function save() {
    if (!coord || !onHalf || !shooterReady || !assistReady || saving) return;
    setSaving(true);
    setError('');
    const message = await onSubmit(coord.x, coord.y, assistId, shooterId);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shot-point-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="shot-point-title" className="text-base font-black">
            {t('trke_shot_point_title', 'Shot spot')}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-sm">{t('trke_shot_point_hint', 'Tap where the shot went in')}</p>
          <div className="aspect-[28/15] w-full">
            <BasketballCourt
              className="h-full w-full"
              attackingRight={attackingRight}
              isOffense
              onCourtTap={(x, y) => setCoord({ x, y })}
              placement={coord}
            />
          </div>
          {coord && !onHalf ? (
            <p className="mt-2 text-sm text-red-700">{t('trke_made_hint_half', 'That point is not on the attacking half')}</p>
          ) : null}
          {value ? (
            <p className="mt-2 text-sm font-bold">
              {value === 3
                ? t('trke_shot_made_3', '3-point basket')
                : t('trke_shot_made_2', '2-point basket')}
            </p>
          ) : null}
          <fieldset className="mt-3">
            <legend className="text-sm font-black">{t('trke_shot_shooter', 'Shooter')}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {players.map((player) => {
                const selected = shooterId === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => chooseShooter(player.id)}
                    className={`px-3 py-3 text-left disabled:opacity-40 ${selected ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-900'}`}
                    style={{ minHeight: '56px' }}
                  >
                    <span className="block text-xl font-black tabular-nums">#{player.jersey}</span>
                    <span className="block truncate text-sm font-semibold">{player.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="text-sm font-black">{t('trke_made_assist_title', 'Assist')}</legend>
            <p className="mb-2 text-sm text-neutral-600">{t('trke_made_hint_assist', 'Choose the assist')}</p>
            {mates.length ? (
              <div className="grid grid-cols-2 gap-2">
                {mates.map((player) => {
                  const selected = assistId === player.id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={saving}
                      onClick={() => setAssistId(player.id)}
                      className={`px-3 py-3 text-left disabled:opacity-40 ${selected ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-900'}`}
                      style={{ minHeight: '56px' }}
                    >
                      <span className="block text-xl font-black tabular-nums">#{player.jersey}</span>
                      <span className="block truncate text-sm font-semibold">{player.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {!assistNeeded ? (
              <button
                type="button"
                aria-pressed={assistId === null}
                disabled={saving}
                onClick={() => setAssistId(null)}
                className={`mt-2 w-full py-3 text-sm font-black disabled:opacity-40 ${assistId === null ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-900'}`}
                style={{ minHeight: '48px' }}
              >
                {t('trke_made_no_assist', 'No assist')}
              </button>
            ) : null}
            {coord && onHalf && !assistReady ? (
              <p className="mt-2 text-sm text-red-700">{t('trke_made_hint_assist', 'Choose the assist')}</p>
            ) : null}
          </fieldset>
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </div>
        <footer className="border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={() => { void save(); }}
            disabled={!coord || !onHalf || !shooterReady || !assistReady || saving}
            className="min-h-11 w-full rounded-lg bg-black text-sm font-black text-white disabled:opacity-40"
          >
            {t('trke_save', 'Save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
