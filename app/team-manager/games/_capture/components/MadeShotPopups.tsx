'use client';

import { useRef, useState, type ReactNode } from 'react';

type Translate = (key: string, fallback: string) => string;

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
  onBegin,
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
  /** Lock the play before the menu paints closed. Return false to ignore the tap. */
  onBegin?: () => boolean;
  onPick: (playerId: string) => boolean | void;
  onNone: () => boolean | void;
  onStepBack: () => void;
  onCancel: () => void;
}) {
  const picked = useRef(false);
  const [closed, setClosed] = useState(false);
  const locked = saving || closed;

  function choose(playerId: string | null) {
    if (locked || picked.current) return;
    if (onBegin && !onBegin()) return;
    picked.current = true;
    setClosed(true);
    // The capture screen redraws the whole board when the assist is saved.
    // Paint this menu gone first, then do that redraw.
    window.setTimeout(() => {
      const accepted = playerId ? onPick(playerId) : onNone();
      if (accepted === false) {
        picked.current = false;
        setClosed(false);
      }
    }, 0);
  }

  if (closed) return null;

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
          return (
            <button
              key={player.id}
              type="button"
              disabled={locked}
              onClick={() => choose(player.id)}
              className={`relative overflow-hidden bg-neutral-900 text-left text-white hover:bg-black ${photo ? 'p-2' : 'px-3 py-4'}`}
              style={{ minHeight: '64px' }}
            >
              {photo ? (
                <img src={photo} alt="" className="h-32 w-full rounded object-cover object-center" />
              ) : null}
              <span className={`block ${photo ? 'px-1 pb-1 pt-2' : ''}`}>
                <span className="block text-2xl font-black tabular-nums leading-none">#{player.jersey}</span>
                <span className="mt-1 block truncate text-sm font-semibold">{player.name}</span>
              </span>
            </button>
          );
        })}
      </div>
      {allowNone ? (
        <button
          type="button"
          disabled={locked}
          onClick={() => choose(null)}
          className="mt-3 flex w-full items-center justify-center gap-2 bg-neutral-200 py-3 text-sm font-black text-neutral-900 hover:bg-neutral-300"
          style={{ minHeight: '56px' }}
        >
          {t('trke_made_no_assist', 'No assist')}
        </button>
      ) : null}
    </PopupFrame>
  );
}

