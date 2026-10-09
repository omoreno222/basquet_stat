'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Translate = (key: string, fallback: string) => string;

const ASSIST_TICK_MS = 150;

function Tick() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-12 w-12 shrink-0">
      <path
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface MadeAssistPlayer {
  id: string;
  jersey: number;
  name: string;
  avatarUrl?: string | null;
}

const footerButton = 'flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300 disabled:opacity-40';

function PopupFrame({
  title,
  hint,
  children,
  stepBackLabel,
  cancelDeleteLabel,
  disabled,
  onStepBack,
  onCancel,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  stepBackLabel: string;
  cancelDeleteLabel: string;
  disabled: boolean;
  onStepBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="made-shot-popup-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="made-shot-popup-title" className="text-center text-lg font-black tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">{hint}</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <footer className="flex gap-2 border-t border-neutral-200 p-3">
          <button type="button" disabled={disabled} onClick={onStepBack} className={footerButton} style={{ minHeight: '48px' }}>
            {stepBackLabel}
          </button>
          <button type="button" disabled={disabled} onClick={onCancel} className={footerButton} style={{ minHeight: '48px' }}>
            {cancelDeleteLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function MadeAssistPopup({
  t,
  players,
  allowNone,
  saving,
  stepBackLabel,
  cancelDeleteLabel,
  onPick,
  onNone,
  onStepBack,
  onCancel,
}: {
  t: Translate;
  players: MadeAssistPlayer[];
  allowNone: boolean;
  saving: boolean;
  stepBackLabel: string;
  cancelDeleteLabel: string;
  onPick: (playerId: string) => void;
  onNone: () => void;
  onStepBack: () => void;
  onCancel: () => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const locked = saving || pickedId !== null;

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function choose(playerId: string | null) {
    if (locked) return;
    setPickedId(playerId ?? 'none');
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      if (playerId) onPick(playerId);
      else onNone();
    }, ASSIST_TICK_MS);
  }

  return (
    <PopupFrame
      title={t('trke_made_assist_title', 'Assist')}
      hint={t('trke_made_hint_assist', 'Choose the assist')}
      stepBackLabel={stepBackLabel}
      cancelDeleteLabel={cancelDeleteLabel}
      disabled={locked}
      onStepBack={onStepBack}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-2">
        {players.map((player) => {
          const photo = player.avatarUrl || null;
          const picked = pickedId === player.id;
          return (
            <button
              key={player.id}
              type="button"
              disabled={locked}
              onClick={() => choose(player.id)}
              className={`relative overflow-hidden bg-neutral-900 text-left text-white hover:bg-black ${
                locked && !picked ? 'opacity-40' : ''
              } ${photo ? 'p-2' : 'px-3 py-4'}`}
              style={{ minHeight: '64px' }}
            >
              {photo ? (
                <img src={photo} alt="" className="h-32 w-full rounded object-cover object-center" />
              ) : null}
              <span className={`block ${photo ? 'px-1 pb-1 pt-2' : ''}`}>
                <span className="block text-2xl font-black tabular-nums leading-none">#{player.jersey}</span>
                <span className="mt-1 block truncate text-sm font-semibold">{player.name}</span>
              </span>
              {picked ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-amber-300">
                  <Tick />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {allowNone ? (
        <button
          type="button"
          disabled={locked}
          onClick={() => choose(null)}
          className={`mt-3 flex w-full items-center justify-center gap-2 py-3 text-sm font-black ${
            pickedId === 'none'
              ? 'bg-neutral-900 text-amber-300'
              : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300'
          } ${locked && pickedId !== 'none' ? 'opacity-40' : ''}`}
          style={{ minHeight: '56px' }}
        >
          {pickedId === 'none' ? <Tick /> : t('trke_made_no_assist', 'No assist')}
        </button>
      ) : null}
    </PopupFrame>
  );
}

