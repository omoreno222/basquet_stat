import { User } from 'lucide-react';

import type { ReactNode } from 'react';
import { EvalClock } from './eval-clock';

export { formatGameClock } from '@/lib/capture/clock-run';

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

export function periodFace(period: number, overtimeLabel: string): string {
  if (period <= 4) return String(Math.max(1, period));
  return `${overtimeLabel}${period - 4}`;
}

export interface PeriodPartial {
  period: number;
  home: number;
  away: number;
}

function QuarterMark({
  period,
  quarterLabel,
  overtimeLabel,
  partials,
  partialsLabel,
}: {
  period: number;
  quarterLabel: string;
  overtimeLabel: string;
  partials: PeriodPartial[];
  partialsLabel: string;
}) {
  return (
    <div className="flex w-full min-w-0">
      {partials.length > 0 ? (
        <ol aria-label={partialsLabel} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          {partials.map((row) => {
            const face = periodFace(row.period, overtimeLabel);
            const live = row.period === period;
            return (
              <li
                key={row.period}
                title={`${quarterLabel} ${face}: ${row.home}–${row.away}`}
                className="flex items-center gap-1.5 whitespace-nowrap leading-none"
              >
                <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-base font-black tabular-nums sm:h-9 sm:min-w-9 sm:text-lg ${live ? 'bg-amber-400 text-slate-950' : 'bg-white/15 text-white'}`}>
                  {face}
                </span>
                <span className={`text-xs font-semibold tabular-nums sm:text-sm ${live ? 'text-white' : 'text-white/65'}`}>
                  {row.home}
                  <span className="px-0.5 text-white/35">–</span>
                  {row.away}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
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
  const box = size === 'board' ? 'h-8 w-8 text-[10px]' : 'h-9 w-9 text-xs';
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

export interface ScoreboardTeamLine {
  ft: string;
  two: string;
  three: string;
  drb: number;
  orb: number;
  foulsCommitted: number;
  foulsReceived: number;
}

export interface ScoreboardLineLabels {
  ft: string;
  two: string;
  three: string;
  rebDef: string;
  rebOff: string;
  fh: string;
  fr: string;
}

function shotFace(line: string): { value: string; detail: string | null } {
  const space = line.lastIndexOf(' ');
  if (space === -1) return { value: line, detail: null };
  return { value: line.slice(0, space), detail: line.slice(space + 1) };
}

function LineMark({
  label,
  value,
  detail,
  align,
}: {
  label: string;
  value: string;
  detail?: string | null;
  align: 'start' | 'end';
}) {
  const end = align === 'end';
  return (
    <div className={`flex min-w-0 flex-col ${end ? 'items-end' : 'items-start'}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</span>
      <span className="whitespace-nowrap text-base font-black tabular-nums leading-tight text-white min-[380px]:text-lg sm:text-xl">{value}</span>
      {detail ? (
        <span className="whitespace-nowrap text-sm font-bold tabular-nums leading-tight text-white/70 min-[380px]:text-base sm:text-lg">{detail}</span>
      ) : null}
    </div>
  );
}

function TeamLine({
  line,
  labels,
  align,
}: {
  line: ScoreboardTeamLine;
  labels: ScoreboardLineLabels;
  align: 'start' | 'end';
}) {
  const shots = [
    [labels.ft, line.ft],
    [labels.two, line.two],
    [labels.three, line.three],
  ] as const;
  const counts = [
    [labels.rebDef, line.drb],
    [labels.rebOff, line.orb],
    [labels.fh, line.foulsCommitted],
    [labels.fr, line.foulsReceived],
  ] as const;
  return (
    <div className={`mt-1.5 flex w-full max-w-full flex-col gap-2 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <div className="grid w-full grid-cols-3 gap-x-1">
        {shots.map(([label, text]) => {
          const face = shotFace(text);
          return <LineMark key={label} label={label} value={face.value} detail={face.detail} align={align} />;
        })}
      </div>
      <div className="grid w-full grid-cols-4 gap-x-1.5">
        {counts.map(([label, value]) => (
          <LineMark key={label} label={label} value={String(value)} align={align} />
        ))}
      </div>
    </div>
  );
}

function OnCourt({
  players,
  label,
  placeholder = 'jersey',
  align = 'start',
  line,
  lineLabels,
}: {
  players: ScoreboardPlayer[];
  label: string;
  placeholder?: 'jersey' | 'avatar';
  align?: 'start' | 'end';
  line: ScoreboardTeamLine;
  lineLabels: ScoreboardLineLabels;
}) {
  const end = align === 'end';
  return (
    <div className={`flex w-full min-w-0 max-w-full flex-col gap-1 lg:w-[15.5rem] lg:max-w-[15.5rem] lg:shrink-0 ${end ? 'items-end' : 'items-start'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">{label}</p>
      {players.length === 0 ? null : (
    <ul className={`flex flex-wrap items-end gap-1 ${end ? 'justify-end' : ''}`}>
      {players.map((player) => (
        <li key={player.id} className="flex w-8 flex-col items-center gap-0.5" title={player.name}>
          <PlayerFace player={player} size="board" placeholder={placeholder} />
          <span className="max-w-full truncate text-[10px] font-bold leading-none text-white/80">
            {player.jerseyNumber != null ? player.jerseyNumber : player.name}
          </span>
        </li>
      ))}
    </ul>
      )}
      <TeamLine line={line} labels={lineLabels} align={align} />
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
  align,
}: {
  name: string;
  score: number;
  possessionsLabel: string;
  possessions: string;
  hasBall: boolean;
  timeouts: ScoreboardTimeout[];
  timeoutPrefix: string;
  align: 'start' | 'end';
}) {
  const end = align === 'end';
  return (
    <div className={`min-w-0 ${end ? 'text-right' : 'text-left'}`}>
      <p className={`min-w-0 truncate text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm ${end ? 'text-right' : 'text-left'}`}>{name}</p>
      <div className={`mt-1 flex items-center gap-2 ${end ? 'flex-row-reverse' : ''}`}>
        <p className="text-3xl font-black tabular-nums leading-none min-[420px]:text-4xl sm:text-5xl">{score}</p>
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
  clockRemainingMs,
  clockSyncedAt,
  clockAsOf,
  homeOnCourt,
  awayOnCourt,
  homeLine,
  awayLine,
  lineLabels,
  homeTimeouts,
  awayTimeouts,
  quarterLabel,
  partials,
  partialsLabel,
  inPlayLabel,
  stoppedLabel,
  overtimeLabel,
  timeoutPrefix,
  possessionsLabel,
  playersLabel,
  possessionTimeLabel,
  homeHeld,
  awayHeld,
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
  clockRemainingMs: number;
  clockSyncedAt: string | null;
  clockAsOf: number;
  homeOnCourt: ScoreboardPlayer[];
  awayOnCourt: ScoreboardPlayer[];
  homeLine: ScoreboardTeamLine;
  awayLine: ScoreboardTeamLine;
  lineLabels: ScoreboardLineLabels;
  homeTimeouts: ScoreboardTimeout[];
  awayTimeouts: ScoreboardTimeout[];
  quarterLabel: string;
  partials: PeriodPartial[];
  partialsLabel: string;
  inPlayLabel: string;
  stoppedLabel: string;
  overtimeLabel: string;
  timeoutPrefix: string;
  possessionsLabel: string;
  playersLabel: string;
  possessionTimeLabel: string;
  homeHeld: string;
  awayHeld: string;
  children?: ReactNode;
}) {
  const status = clockRunning ? inPlayLabel : stoppedLabel;
  const clock = () => (
    <EvalClock
      running={clockRunning}
      remainingMs={clockRemainingMs}
      syncedAt={clockSyncedAt}
      asOf={clockAsOf}
    />
  );
  const betweenScores = () => (
    <div className="flex w-[6.5rem] max-w-full flex-col items-center self-start pt-5 text-center min-[420px]:w-[7.25rem] min-[420px]:pt-6 sm:w-[8.75rem] sm:pt-8">
      <p className="font-mono text-2xl font-semibold tabular-nums leading-none min-[420px]:text-3xl sm:text-4xl">{clock()}</p>
      <p className={`mt-1 flex max-w-full flex-wrap items-center justify-center gap-1.5 text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-xs ${clockRunning ? 'text-emerald-400' : 'text-white/45'}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${clockRunning ? 'animate-pulse bg-emerald-400' : 'bg-white/30'}`} />
        {status}
      </p>
      <p className="mt-3 max-w-full text-[10px] font-bold uppercase leading-tight tracking-wide text-white/50">{possessionTimeLabel}</p>
      <p className="mt-1 flex max-w-full flex-wrap items-baseline justify-center gap-x-1.5 font-mono text-xs font-semibold tabular-nums leading-tight sm:text-base">
        <span>{homeHeld}</span>
        <span className="text-white/30">·</span>
        <span>{awayHeld}</span>
      </p>
    </div>
  );
  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg ring-1 ring-white/10">
      <div className="flex flex-col gap-4 px-3 py-4 lg:hidden">
        <QuarterMark
          period={period}
          quarterLabel={quarterLabel}
          overtimeLabel={overtimeLabel}
          partials={partials}
          partialsLabel={partialsLabel}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
          <TeamSide
            name={homeName}
            score={homeScore}
            possessionsLabel={possessionsLabel}
            possessions={homePossessions}
            hasBall={possession === 'home'}
            timeouts={homeTimeouts}
            timeoutPrefix={timeoutPrefix}
            align="start"
          />
          {betweenScores()}
          <TeamSide
            name={awayName}
            score={awayScore}
            possessionsLabel={possessionsLabel}
            possessions={awayPossessions}
            hasBall={possession === 'away'}
            timeouts={awayTimeouts}
            timeoutPrefix={timeoutPrefix}
            align="end"
          />
        </div>
        <div className="grid grid-cols-2 items-start gap-3">
          <OnCourt players={homeOnCourt} label={playersLabel} line={homeLine} lineLabels={lineLabels} />
          <OnCourt players={awayOnCourt} label={playersLabel} placeholder="avatar" align="end" line={awayLine} lineLabels={lineLabels} />
        </div>
        {children}
      </div>
      <div className="hidden flex-col gap-4 px-3 py-4 sm:px-5 lg:flex">
        <QuarterMark
          period={period}
          quarterLabel={quarterLabel}
          overtimeLabel={overtimeLabel}
          partials={partials}
          partialsLabel={partialsLabel}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-5">
            <OnCourt players={homeOnCourt} label={playersLabel} line={homeLine} lineLabels={lineLabels} />
            <TeamSide
              name={homeName}
              score={homeScore}
              possessionsLabel={possessionsLabel}
              possessions={homePossessions}
              hasBall={possession === 'home'}
              timeouts={homeTimeouts}
              timeoutPrefix={timeoutPrefix}
              align="start"
            />
          </div>
          {betweenScores()}
          <div className="flex min-w-0 items-start justify-end gap-3 sm:gap-5">
            <TeamSide
              name={awayName}
              score={awayScore}
              possessionsLabel={possessionsLabel}
              possessions={awayPossessions}
              hasBall={possession === 'away'}
              timeouts={awayTimeouts}
              timeoutPrefix={timeoutPrefix}
              align="end"
            />
            <div className="flex flex-col items-end self-stretch">
              <OnCourt players={awayOnCourt} label={playersLabel} placeholder="avatar" align="end" line={awayLine} lineLabels={lineLabels} />
              <div className="mt-auto">{children}</div>
            </div>
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
