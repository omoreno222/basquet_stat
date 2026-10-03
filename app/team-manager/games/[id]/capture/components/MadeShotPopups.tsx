'use client';

import type { ReactNode } from 'react';

type Translate = (key: string, fallback: string) => string;

export interface MadeAssistPlayer {
  id: string;
  jersey: number;
  name: string;
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
  return (
    <PopupFrame
      title={t('trke_made_assist_title', 'Assist')}
      hint={t('trke_made_hint_assist', 'Choose the assist')}
      stepBackLabel={stepBackLabel}
      cancelDeleteLabel={cancelDeleteLabel}
      disabled={saving}
      onStepBack={onStepBack}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-2">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={saving}
            onClick={() => onPick(player.id)}
            className="bg-neutral-900 px-3 py-4 text-left text-white hover:bg-black disabled:opacity-40"
            style={{ minHeight: '64px' }}
          >
            <span className="block text-2xl font-black tabular-nums">#{player.jersey}</span>
            <span className="block truncate text-sm font-semibold">{player.name}</span>
          </button>
        ))}
      </div>
      {allowNone ? (
        <button
          type="button"
          disabled={saving}
          onClick={onNone}
          className="mt-3 w-full bg-neutral-200 py-3 text-sm font-black text-neutral-900 hover:bg-neutral-300 disabled:opacity-40"
          style={{ minHeight: '56px' }}
        >
          {t('trke_made_no_assist', 'No assist')}
        </button>
      ) : null}
    </PopupFrame>
  );
}

export function MadeFreeThrowCountPopup({
  t,
  saving,
  stepBackLabel,
  cancelDeleteLabel,
  onPick,
  onStepBack,
  onCancel,
}: {
  t: Translate;
  saving: boolean;
  stepBackLabel: string;
  cancelDeleteLabel: string;
  onPick: (count: 1 | 2 | 3) => void;
  onStepBack: () => void;
  onCancel: () => void;
}) {
  return (
    <PopupFrame
      title={t('trke_made_ft_count', 'How many free throws?')}
      hint={t('trke_made_ft_count', 'How many free throws?')}
      stepBackLabel={stepBackLabel}
      cancelDeleteLabel={cancelDeleteLabel}
      disabled={saving}
      onStepBack={onStepBack}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map((count) => (
          <button
            key={count}
            type="button"
            disabled={saving}
            onClick={() => onPick(count)}
            className="bg-neutral-900 py-4 text-3xl font-black text-white hover:bg-black disabled:opacity-40"
            style={{ minHeight: '72px' }}
          >
            {count}
          </button>
        ))}
      </div>
    </PopupFrame>
  );
}
