'use client';

import { useState } from 'react';

export type JumpBallWinner = 'home' | 'away';

export interface JumpBallPlayer {
  id: string;
  jersey: number;
  name: string;
  avatarUrl: string | null;
}

export interface JumpBallResult {
  winner: JumpBallWinner;
  label: string;
}

type Jumper = { side: 'home' | 'away'; id: string };

type Translate = (key: string, fallback: string) => string;

interface JumpBallPopupProps {
  t: Translate;
  clockRunning: boolean;
  homeName: string;
  awayName: string;
  homePlayers: JumpBallPlayer[];
  awayPlayers: JumpBallPlayer[];
  onStartClock: () => void;
  onConfirm: (result: JumpBallResult) => void;
  onClose: () => void;
}

const COURT_SLOTS = 5;

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function jumperLabel(player: JumpBallPlayer, teamName: string) {
  const name = player.name.trim();
  return name ? `#${player.jersey} ${name}` : `#${player.jersey} ${teamName}`;
}

export function JumpBallPopup({
  t,
  clockRunning,
  homeName,
  awayName,
  homePlayers,
  awayPlayers,
  onStartClock,
  onConfirm,
  onClose,
}: JumpBallPopupProps) {
  const [jumper, setJumper] = useState<Jumper | null>(null);
  const homeSlots = Array.from({ length: COURT_SLOTS }, (_, index) => homePlayers[index] ?? null);
  const awaySlots = Array.from({ length: COURT_SLOTS }, (_, index) => awayPlayers[index] ?? null);

  const homeJumper = jumper?.side === 'home'
    ? homePlayers.find((player) => player.id === jumper.id) ?? null
    : null;
  const awayJumper = jumper?.side === 'away'
    ? awayPlayers.find((player) => player.id === jumper.id) ?? null
    : null;
  const canFinish = clockRunning && (homeJumper !== null || awayJumper !== null);

  function confirm() {
    if (!canFinish || !jumper) return;
    if (jumper.side === 'home' && homeJumper) {
      onConfirm({ winner: 'home', label: jumperLabel(homeJumper, homeName) });
      return;
    }
    if (jumper.side === 'away' && awayJumper) {
      onConfirm({ winner: 'away', label: jumperLabel(awayJumper, awayName) });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jump-ball-title"
        className="flex h-[min(92vh,760px)] w-full max-w-5xl flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="jump-ball-title" className="text-center text-lg font-black tracking-tight">
            {t('trke_jump_title', 'Jump ball')}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">
            {t('trke_jump_hint', 'Start the clock, then tap who jumps')}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 gap-3 px-3 py-3">
          <section className={`flex w-36 shrink-0 flex-col gap-2 ${clockRunning ? '' : 'pointer-events-none opacity-40'}`} aria-label={homeName}>
            <p className="truncate text-center text-[11px] font-black tracking-wider text-neutral-500">
              {homeName}
            </p>
            <div className="flex min-h-0 flex-1 flex-col gap-2" role="radiogroup" aria-label={t('trke_jump_who', 'Who jumps?')}>
              {homeSlots.map((player, index) => {
                if (!player) {
                  return (
                    <div
                      key={`home-empty-${index}`}
                      className="min-h-0 flex-1 rounded-lg bg-neutral-200"
                    />
                  );
                }
                const selected = jumper?.side === 'home' && jumper.id === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!clockRunning}
                    onClick={() => setJumper({ side: 'home', id: player.id })}
                    className={`flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg px-1 pb-1 text-white disabled:cursor-not-allowed ${
                      selected ? 'bg-black ring-4 ring-amber-400' : 'bg-neutral-900 hover:bg-black'
                    }`}
                  >
                    {player.avatarUrl ? (
                      <img
                        src={player.avatarUrl}
                        alt=""
                        className="mb-1 h-8 w-8 rounded-full object-cover"
                      />
                    ) : null}
                    <span className="text-4xl font-black tabular-nums leading-none">{player.jersey}</span>
                    <span className="mt-1 max-w-full truncate text-[10px] font-bold text-white/80">
                      {shortName(player.name)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-2">
            <button
              type="button"
              onClick={onStartClock}
              disabled={clockRunning}
              className={`w-full max-w-xs py-5 text-sm font-black tracking-wider ${
                clockRunning
                  ? 'bg-neutral-900 text-white'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              style={{ minHeight: '72px' }}
            >
              {clockRunning
                ? t('trke_jump_clock_on', 'Clock running')
                : t('trke_jump_start_clock', 'Start clock')}
            </button>
            <p className="text-center text-sm font-black text-neutral-800">
              {homeJumper
                ? jumperLabel(homeJumper, homeName)
                : awayJumper
                  ? jumperLabel(awayJumper, awayName)
                  : t('trke_jump_who', 'Who jumps?')}
            </p>
          </div>

          <section className={`flex w-36 shrink-0 flex-col gap-2 ${clockRunning ? '' : 'pointer-events-none opacity-40'}`} aria-label={awayName}>
            <p className="truncate text-center text-[11px] font-black tracking-wider text-neutral-500">
              {awayName}
            </p>
            <div className="flex min-h-0 flex-1 flex-col gap-2" role="radiogroup" aria-label={t('trke_jump_who', 'Who jumps?')}>
              {awaySlots.map((player, index) => {
                if (!player) {
                  return (
                    <div
                      key={`away-empty-${index}`}
                      className="min-h-0 flex-1 rounded-lg bg-neutral-200"
                    />
                  );
                }
                const selected = jumper?.side === 'away' && jumper.id === player.id;
                return (
                  <button
                    key={player.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!clockRunning}
                    onClick={() => setJumper({ side: 'away', id: player.id })}
                    className={`flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg px-1 pb-1 text-white disabled:cursor-not-allowed ${
                      selected ? 'bg-neutral-600 ring-4 ring-amber-400' : 'bg-neutral-400 hover:bg-neutral-500'
                    }`}
                  >
                    <span className="text-4xl font-black tabular-nums leading-none">{player.jersey}</span>
                    <span className="mt-1 max-w-full truncate text-[10px] font-bold text-white/80">
                      {player.name.trim() ? shortName(player.name) : awayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300"
            style={{ minHeight: '48px' }}
          >
            {t('trke_cancel', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!canFinish}
            onClick={confirm}
            className="flex-1 bg-neutral-900 py-3 text-sm font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_jump_done', 'Done')}
          </button>
        </footer>
      </div>
    </div>
  );
}
