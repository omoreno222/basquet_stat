'use client';

import { useState } from 'react';
import { inkOn } from '@/lib/colors';

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

type Translate = (key: string, fallback: string) => string;

interface JumpBallPopupProps {
  t: Translate;
  clockRunning: boolean;
  homeName: string;
  awayName: string;
  homePlayers: JumpBallPlayer[];
  awayPlayers: JumpBallPlayer[];
  awayColor: string;
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
  awayColor,
  onStartClock,
  onConfirm,
  onClose,
}: JumpBallPopupProps) {
  const [homeId, setHomeId] = useState<string | null>(null);
  const [awayId, setAwayId] = useState<string | null>(null);
  const [winner, setWinner] = useState<JumpBallWinner | null>(null);
  const homeSlots = Array.from({ length: COURT_SLOTS }, (_, index) => homePlayers[index] ?? null);
  const awaySlots = Array.from({ length: COURT_SLOTS }, (_, index) => awayPlayers[index] ?? null);

  const homeJumper = homePlayers.find((player) => player.id === homeId) ?? null;
  const awayJumper = awayPlayers.find((player) => player.id === awayId) ?? null;
  const canFinish = clockRunning && homeJumper !== null && awayJumper !== null && winner !== null;

  function pick(side: JumpBallWinner, id: string) {
    if (side === 'home') setHomeId(id);
    else setAwayId(id);
  }

  function confirm() {
    if (!canFinish || !winner || !homeJumper || !awayJumper) return;
    const player = winner === 'home' ? homeJumper : awayJumper;
    const team = winner === 'home' ? homeName : awayName;
    onConfirm({ winner, label: jumperLabel(player, team) });
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
            {t('trke_jump_hint', 'Tap one jumper on each team. Start the clock and mark who wins.')}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 gap-3 px-3 py-3">
          <section className="flex w-36 shrink-0 flex-col gap-2" aria-label={homeName}>
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
                const selected = homeId === player.id;
                const won = selected && winner === 'home';
                return (
                  <button
                    key={player.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => pick('home', player.id)}
                    className={`flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg px-1 pb-1 text-white ${
                      won
                        ? 'bg-amber-500 text-neutral-900 ring-4 ring-amber-300'
                        : selected
                          ? 'bg-black ring-4 ring-amber-400'
                          : 'bg-neutral-900 hover:bg-black'
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
                    <span className={`mt-1 max-w-full truncate text-[10px] font-bold ${won ? 'text-neutral-900/80' : 'text-white/80'}`}>
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
              {homeJumper && awayJumper
                ? t('trke_jump_winner', 'Who wins the tip?')
                : t('trke_jump_who', 'Who jumps?')}
            </p>
            {homeJumper && awayJumper ? (
              <div className="flex w-full max-w-xs gap-2">
                <button
                  type="button"
                  onClick={() => setWinner('home')}
                  className={`flex-1 px-2 py-3 text-xs font-black ${
                    winner === 'home' ? 'bg-amber-400 text-neutral-900' : 'bg-neutral-900 text-white'
                  }`}
                >
                  {jumperLabel(homeJumper, homeName)}
                </button>
                <button
                  type="button"
                  onClick={() => setWinner('away')}
                  className={`flex-1 px-2 py-3 text-xs font-black ${
                    winner === 'away' ? 'bg-amber-400 text-neutral-900' : 'text-neutral-900'
                  }`}
                  style={winner === 'away' ? undefined : { backgroundColor: awayColor, color: inkOn(awayColor) }}
                >
                  {jumperLabel(awayJumper, awayName)}
                </button>
              </div>
            ) : (
              <p className="text-center text-xs font-bold text-neutral-500">
                {[homeJumper ? jumperLabel(homeJumper, homeName) : null, awayJumper ? jumperLabel(awayJumper, awayName) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>

          <section className="flex w-36 shrink-0 flex-col gap-2" aria-label={awayName}>
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
                const selected = awayId === player.id;
                const won = selected && winner === 'away';
                return (
                  <button
                    key={player.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => pick('away', player.id)}
                    className={`flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg px-1 pb-1 ${
                      won || selected ? 'ring-4 ring-amber-400' : ''
                    }`}
                    style={{
                      backgroundColor: won ? '#fbbf24' : awayColor,
                      color: won ? '#171717' : inkOn(awayColor),
                    }}
                  >
                    <span className="text-4xl font-black tabular-nums leading-none">{player.jersey}</span>
                    <span className="mt-1 max-w-full truncate text-[10px] font-bold opacity-80">
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
