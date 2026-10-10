'use client';

import { useEffect, useRef, useState } from 'react';
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
  homePlayerId: string;
  awayPlayerId: string;
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
const JUMP_WIN_CLOSE_MS = 400;

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
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const homeSlots = Array.from({ length: COURT_SLOTS }, (_, index) => homePlayers[index] ?? null);
  const awaySlots = Array.from({ length: COURT_SLOTS }, (_, index) => awayPlayers[index] ?? null);

  const homeJumper = homePlayers.find((player) => player.id === homeId) ?? null;
  const awayJumper = awayPlayers.find((player) => player.id === awayId) ?? null;
  const canFinish = clockRunning && homeJumper !== null && awayJumper !== null && winner !== null;

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function pick(side: JumpBallWinner, id: string) {
    if (closing) return;
    if (side === 'home') setHomeId(id);
    else setAwayId(id);
    if (winner === side) setWinner(null);
  }

  function chooseWinner(side: JumpBallWinner) {
    if (closing || !homeJumper || !awayJumper) return;
    setWinner(side);
    setClosing(true);
    const player = side === 'home' ? homeJumper : awayJumper;
    const team = side === 'home' ? homeName : awayName;
    const homePlayerId = homeJumper.id;
    const awayPlayerId = awayJumper.id;
    closeTimer.current = window.setTimeout(() => {
      onConfirm({
        winner: side,
        label: jumperLabel(player, team),
        homePlayerId,
        awayPlayerId,
      });
    }, JUMP_WIN_CLOSE_MS);
  }

  function confirm() {
    if (!canFinish || closing || !winner || !homeJumper || !awayJumper) return;
    chooseWinner(winner);
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
                    className={`relative flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg text-white ${
                      won
                        ? 'bg-amber-500 ring-4 ring-amber-300'
                        : selected
                          ? 'bg-black ring-4 ring-amber-400'
                          : 'bg-neutral-900 hover:bg-black'
                    }`}
                  >
                    {player.avatarUrl ? (
                      <img
                        src={player.avatarUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    {won ? (
                      <span className="absolute inset-0 z-10 flex items-center justify-center text-amber-300">
                        <Tick />
                      </span>
                    ) : null}
                    <span className={`relative z-10 flex w-full flex-col items-center px-1 pb-1 pt-8 ${player.avatarUrl ? 'bg-gradient-to-t from-black/80 to-transparent' : ''}`}>
                      <span className="text-4xl font-black tabular-nums leading-none">{player.jersey}</span>
                      <span className="mt-1 max-w-full truncate text-[10px] font-bold text-white/90">
                        {shortName(player.name)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-2">
            <button
              type="button"
              onPointerDown={(event) => {
                if (event.button !== 0 || clockRunning) return;
                event.preventDefault();
                onStartClock();
              }}
              onKeyDown={(event) => {
                if (clockRunning || (event.key !== 'Enter' && event.key !== ' ') || event.repeat) return;
                event.preventDefault();
                onStartClock();
              }}
              disabled={clockRunning}
              className={`w-full max-w-xs py-5 text-sm font-black tracking-wider ${
                clockRunning
                  ? 'bg-neutral-900 text-white'
                  : 'bg-green-600 text-white hover:bg-green-700'
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
                  disabled={closing}
                  onClick={() => chooseWinner('home')}
                  className={`flex flex-1 items-center justify-center gap-1 px-2 py-3 text-xs font-black disabled:cursor-default ${
                    winner === 'home' ? 'bg-amber-400 text-neutral-900' : 'bg-neutral-900 text-white'
                  }`}
                >
                  {winner === 'home' ? <Tick /> : null}
                  {jumperLabel(homeJumper, homeName)}
                </button>
                <button
                  type="button"
                  disabled={closing}
                  onClick={() => chooseWinner('away')}
                  className={`flex flex-1 items-center justify-center gap-1 px-2 py-3 text-xs font-black disabled:cursor-default ${
                    winner === 'away' ? 'bg-amber-400 text-neutral-900' : 'text-neutral-900'
                  }`}
                  style={winner === 'away' ? undefined : { backgroundColor: awayColor, color: inkOn(awayColor) }}
                >
                  {winner === 'away' ? <Tick /> : null}
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
                    className={`relative flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-lg px-1 pb-1 ${
                      won || selected ? 'ring-4 ring-amber-400' : ''
                    }`}
                    style={{
                      backgroundColor: won ? '#fbbf24' : awayColor,
                      color: won ? '#171717' : inkOn(awayColor),
                    }}
                  >
                    {won ? (
                      <span className="absolute inset-0 z-10 flex items-center justify-center text-neutral-900">
                        <Tick />
                      </span>
                    ) : null}
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
