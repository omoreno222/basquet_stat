import { MapPin, User } from 'lucide-react';

import type { ReactNode } from 'react';

export interface ScoreboardPlayer {
  id: string;
  name: string;
  jerseyNumber: number | null;
  avatarUrl: string | null;
}

export interface ScoreboardTimeout {
  id: string;
  label: string;
  used: number;
  max: number;
}

export function formatGameClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function periodFace(period: number, overtimeLabel: string): string {
  if (period <= 4) return String(Math.max(1, period));
  return `${overtimeLabel}${period - 4}`;
}

function PlayerFace({
  player,
  size,
  placeholder = 'jersey',
}: {
  player: ScoreboardPlayer;
  size: 'board' | 'row';
  placeholder?: 'jersey' | 'avatar';
}) {
  const box = size === 'board' ? 'h-8 w-8 text-[10px] sm:h-10 sm:w-10 sm:text-xs' : 'h-9 w-9 text-xs';
  const ring = size === 'board' ? 'ring-white/25' : 'ring-black/10 dark:ring-white/15';
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt=""
        className={`${box} shrink-0 rounded-full object-cover ring-2 ${ring}`}
      />
    );
  }
  const face = size === 'board'
    ? 'bg-white/10 font-semibold text-white'
    : 'bg-gray-200 font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-100';
  const mark = player.jerseyNumber != null ? String(player.jerseyNumber) : (player.name.trim().charAt(0).toUpperCase() || '·');
  return (
    <span className={`${box} inline-flex shrink-0 items-center justify-center rounded-full ring-2 ${ring} ${face}`} aria-hidden="true">
      {placeholder === 'avatar' ? <User className="h-1/2 w-1/2" strokeWidth={1.75} /> : mark}
    </span>
  );
}

function TimeoutPips({
  bank,
  prefix,
  align,
}: {
  bank: ScoreboardTimeout;
  prefix: string;
  align: 'start' | 'end';
}) {
  const taken = Math.max(0, Math.min(bank.used, bank.max));
  const extra = Math.max(0, bank.used - bank.max);
  return (
    <div
      className={`flex items-center gap-1.5 ${align === 'end' ? 'flex-row-reverse' : ''}`}
      aria-label={`${prefix} ${bank.label} ${bank.used}/${bank.max}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-white/55">
        {prefix} {bank.label}
      </span>
      <span className="flex items-center gap-1">
        {Array.from({ length: bank.max }, (_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${index < taken ? 'bg-amber-400' : 'ring-1 ring-white/40'}`}
          />
        ))}
        {extra > 0 ? <span className="text-[10px] font-bold text-amber-300">+{extra}</span> : null}
      </span>
    </div>
  );
}

function OnCourt({
  players,
  label,
  placeholder = 'jersey',
  align = 'start',
}: {
  players: ScoreboardPlayer[];
  label: string;
  placeholder?: 'jersey' | 'avatar';
  align?: 'start' | 'end';
}) {
  const end = align === 'end';
  return (
    <div className={`flex flex-col gap-1 ${end ? 'items-end' : 'items-start'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">{label}</p>
      {players.length === 0 ? null : (
    <ul className={`flex shrink-0 flex-nowrap items-end gap-1 ${end ? 'justify-end' : ''}`}>
      {players.map((player) => (
        <li key={player.id} className="flex w-8 flex-col items-center gap-0.5 sm:w-10" title={player.name}>
          <PlayerFace player={player} size="board" placeholder={placeholder} />
          <span className="max-w-full truncate text-[10px] font-bold leading-none text-white/80">
            {player.jerseyNumber != null ? player.jerseyNumber : player.name}
          </span>
        </li>
      ))}
    </ul>
      )}
    </div>
  );
}

function TeamSide({
  name,
  score,
  possessionsLabel,
  possessions,
  hasBall,
  timeouts,
  timeoutPrefix,
  locationLabel,
  align,
}: {
  name: string;
  score: number;
  possessionsLabel: string;
  possessions: string;
  hasBall: boolean;
  timeouts: ScoreboardTimeout[];
  timeoutPrefix: string;
  locationLabel: string;
  align: 'start' | 'end';
}) {
  const end = align === 'end';
  return (
    <div className={`min-w-0 ${end ? 'text-right' : 'text-left'}`}>
      <p className={`flex min-w-0 items-center gap-1 ${end ? 'flex-row-reverse' : ''}`}>
        <button
          type="button"
          aria-label={locationLabel}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="truncate text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">{name}</span>
      </p>
      <div className={`mt-1 flex items-center gap-2 ${end ? 'flex-row-reverse' : ''}`}>
        <p className="text-5xl font-black tabular-nums leading-none sm:text-6xl">{score}</p>
        <span className={`text-2xl leading-none ${hasBall ? '' : 'invisible'}`} aria-hidden="true">
          🏀
        </span>
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-white/50">
        {possessionsLabel}{' '}
        <span className="text-sm font-bold tabular-nums text-white">{possessions}</span>
      </p>
      <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${end ? 'justify-end' : 'justify-start'}`}>
        {timeouts.map((bank) => (
          <TimeoutPips key={bank.id} bank={bank} prefix={timeoutPrefix} align={align} />
        ))}
      </div>
    </div>
  );
}

export function EvalScoreboard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  homePossessions,
  awayPossessions,
  possession,
  period,
  clockRunning,
  clockLabel,
  homeOnCourt,
  awayOnCourt,
  homeTimeouts,
  awayTimeouts,
  quarterLabel,
  inPlayLabel,
  stoppedLabel,
  overtimeLabel,
  timeoutPrefix,
  possessionsLabel,
  locationLabel,
  playersLabel,
  children,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homePossessions: string;
  awayPossessions: string;
  possession: 'home' | 'away' | null;
  period: number;
  clockRunning: boolean;
  clockLabel: string;
  homeOnCourt: ScoreboardPlayer[];
  awayOnCourt: ScoreboardPlayer[];
  homeTimeouts: ScoreboardTimeout[];
  awayTimeouts: ScoreboardTimeout[];
  quarterLabel: string;
  inPlayLabel: string;
  stoppedLabel: string;
  overtimeLabel: string;
  timeoutPrefix: string;
  possessionsLabel: string;
  locationLabel: string;
  playersLabel: string;
  children?: ReactNode;
}) {
  const status = clockRunning ? inPlayLabel : stoppedLabel;
  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg ring-1 ring-white/10">
      <div className="flex items-stretch justify-between gap-3 overflow-x-auto px-4 py-4 sm:gap-6 sm:px-5 sm:py-5">
        <div className="flex shrink-0 items-start gap-8 sm:gap-12">
          <div className="flex flex-col items-start gap-3">
            <OnCourt players={homeOnCourt} label={playersLabel} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">{quarterLabel}</p>
              <p className="text-3xl font-black tabular-nums leading-none">{periodFace(period, overtimeLabel)}</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight leading-none">{clockLabel}</p>
              <p className={`mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${clockRunning ? 'text-emerald-400' : 'text-white/45'}`}>
                <span className={`h-2 w-2 rounded-full ${clockRunning ? 'animate-pulse bg-emerald-400' : 'bg-white/30'}`} />
                {status}
              </p>
            </div>
          </div>
          <TeamSide
            name={homeName}
            score={homeScore}
            possessionsLabel={possessionsLabel}
            possessions={homePossessions}
            hasBall={possession === 'home'}
            timeouts={homeTimeouts}
            timeoutPrefix={timeoutPrefix}
            locationLabel={locationLabel}
            align="start"
          />
        </div>
        <div className="flex shrink-0 items-start gap-8 sm:gap-12">
          <TeamSide
            name={awayName}
            score={awayScore}
            possessionsLabel={possessionsLabel}
            possessions={awayPossessions}
            hasBall={possession === 'away'}
            timeouts={awayTimeouts}
            timeoutPrefix={timeoutPrefix}
            locationLabel={locationLabel}
            align="end"
          />
          <div className="flex flex-col items-end self-stretch">
            <OnCourt players={awayOnCourt} label={playersLabel} placeholder="avatar" align="end" />
            <div className="mt-auto">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlayerPortrait({
  name,
  jerseyNumber,
  avatarUrl,
  placeholder = 'jersey',
}: {
  name: string;
  jerseyNumber: number | null;
  avatarUrl: string | null;
  placeholder?: 'jersey' | 'avatar';
}) {
  return <PlayerFace player={{ id: name, name, jerseyNumber, avatarUrl }} size="row" placeholder={placeholder} />;
}
