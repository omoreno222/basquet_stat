'use client';

import { useState, type ReactNode } from 'react';

export type CaptureBoardAction = 'made' | 'miss' | 'foul' | 'turnover';

export interface CaptureBoardPlayer {
  id: string;
  jersey: number;
  fouls: number;
  name: string;
  avatarUrl: string | null;
  onCourt?: boolean;
}

export interface CaptureLogItem {
  id: string;
  periodLabel: string;
  clock: string;
  title: string;
  detail: string;
}

interface CaptureBoardProps {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  periodLabel: string;
  clockMinutes: string;
  clockSeconds: string;
  clockRunning: boolean;
  canControlClock: boolean;
  onAdjustClock: (unit: 'minute' | 'second', delta: number) => void;
  onToggleClock: () => void;
  homePlayers: CaptureBoardPlayer[];
  awayPlayers: CaptureBoardPlayer[];
  homeBench: CaptureBoardPlayer[];
  awayBench: CaptureBoardPlayer[];
  homePersonalFouls: number;
  awayPersonalFouls: number;
  activeAction: CaptureBoardAction | null;
  onAction: (side: 'home' | 'away', action: CaptureBoardAction) => void;
  homeActionsEnabled: Record<CaptureBoardAction, boolean>;
  hint: string;
  logItems: CaptureLogItem[];
  onUndo: () => void;
  canUndo: boolean;
  court: ReactNode;
  jumpBallLabel: string;
  onJumpBall: () => void;
  nextLabel?: string;
  onNextPeriod?: () => void;
  onFlipCourt?: () => void;
  onBack?: () => void;
  onAddAwayPlayer?: () => void;
  addAwayPlayerLabel?: string;
  homeCoach?: { name: string } | null;
  awayCoach?: { name: string } | null;
  onHomeCoach?: () => void;
  onAwayCoach?: () => void;
  possessionLabel: string;
  canSetPossession: boolean;
  onSetPossession: (side: 'home' | 'away') => void;
}

const LABEL_SHADOW = '[text-shadow:0_2px_3px_rgba(0,0,0,0.45)]';

function LogCollapseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 5.5 11 10l-4.5 4.5" />
      <path d="M14.5 4v12" />
    </svg>
  );
}

function LogExpandIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 4v12" />
      <path d="M13.5 5.5 9 10l4.5 4.5" />
    </svg>
  );
}
const ACTION_GRAY = 'bg-[#b0b0b0]';

const ACTIONS: { id: CaptureBoardAction; label: string }[] = [
  { id: 'made', label: 'MADE' },
  { id: 'miss', label: 'MISS' },
  { id: 'foul', label: 'FOUL' },
  { id: 'turnover', label: 'TURNOVER' },
];

function FoulBolts({ count, compact = false, large = false, fit = false }: { count: number; compact?: boolean; large?: boolean; fit?: boolean }) {
  const filled = Math.min(5, Math.max(0, count));
  const fouledOut = filled >= 5;
  const size = compact ? 'text-[9px]' : fit ? 'text-sm' : large ? 'text-lg' : 'text-[11px]';
  return (
    <div className={`flex w-full shrink-0 justify-center ${fit ? 'mt-1 gap-px' : large ? 'mt-1 gap-0.5' : compact ? 'mt-0.5 gap-px' : 'mt-1 gap-px'}`} aria-label={`${filled} personal fouls`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`leading-none ${size} ${
            index < filled
              ? fouledOut
                ? 'text-red-500'
                : 'text-amber-400'
              : 'text-white/25'
          }`}
        >
          ⚡
        </span>
      ))}
    </div>
  );
}

const BENCH_SLOT = 'h-14 w-14 shrink-0';

function BenchAvatar() {
  return (
    <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx="28" cy="20" r="9" fill="rgba(255,255,255,0.88)" />
      <path d="M6 56c2-15 10-22 22-22s20 7 22 22" fill="rgba(255,255,255,0.88)" />
    </svg>
  );
}

function BenchPlayerCard({
  player,
  tone,
}: {
  player: CaptureBoardPlayer;
  tone: 'home' | 'away';
}) {
  const filledClass = tone === 'home' ? 'bg-black text-white' : 'bg-neutral-500 text-white';

  return (
    <div
      title={player.name}
      className={`relative overflow-hidden rounded-lg shadow-md ${BENCH_SLOT} ${filledClass}`}
    >
      {player.avatarUrl ? (
        <img
          src={player.avatarUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <BenchAvatar />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 pb-px pt-2 text-center">
        <span className={`text-base font-black tabular-nums leading-none text-white ${LABEL_SHADOW}`}>
          {player.jersey}
        </span>
        <FoulBolts count={player.fouls} compact />
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  tone,
  size,
}: {
  player: CaptureBoardPlayer | null;
  tone: 'home' | 'away';
  size: 'court' | 'bench';
}) {
  if (size === 'bench' && player) {
    return <BenchPlayerCard player={player} tone={tone} />;
  }

  const filledClass = tone === 'home' ? 'bg-black text-white' : 'bg-neutral-500 text-white';
  const emptyClass = tone === 'home' ? 'bg-neutral-900 text-white/35' : 'bg-neutral-400 text-white/70';
  const showPhoto = Boolean(player?.avatarUrl) && tone === 'home';
  const numberOnly = !showPhoto;

  return (
    <div
      title={player?.name}
      className={`flex min-h-0 w-full flex-1 flex-col items-center justify-end overflow-hidden rounded-lg px-1 pb-1 pt-1 shadow-md ${
        player ? filledClass : emptyClass
      }`}
    >
      {showPhoto && player?.avatarUrl ? (
        <div className="relative mb-1 min-h-0 w-full flex-1">
          <img
            src={player.avatarUrl}
            alt=""
            className="absolute inset-0 h-full w-full rounded-md object-cover"
          />
        </div>
      ) : null}
      {numberOnly ? (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
          <span className={`font-black tabular-nums leading-none ${LABEL_SHADOW} ${tone === 'away' ? 'text-6xl' : 'text-5xl'}`}>
            {player ? player.jersey : '–'}
          </span>
        </div>
      ) : (
        <span className={`text-3xl font-black tabular-nums leading-none ${LABEL_SHADOW}`}>
          {player ? player.jersey : '–'}
        </span>
      )}
      <FoulBolts count={player?.fouls ?? 0} large={!numberOnly} fit={numberOnly} />
    </div>
  );
}

function PlayerColumn({
  players,
  tone,
}: {
  players: CaptureBoardPlayer[];
  tone: 'home' | 'away';
}) {
  const slots = Array.from({ length: 5 }, (_, index) => players[index] ?? null);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2">
      {slots.map((player, index) => (
        <PlayerCard
          key={player?.id ?? `empty-${tone}-${index}`}
          player={player}
          tone={tone}
          size="court"
        />
      ))}
    </div>
  );
}

const BENCH_SLOTS = 12;

function BenchRow({
  players,
  tone,
  addLabel,
  onAdd,
  coach,
  onCoach,
}: {
  players: CaptureBoardPlayer[];
  tone: 'home' | 'away';
  addLabel?: string;
  onAdd?: () => void;
  coach?: { name: string } | null;
  onCoach?: () => void;
}) {
  const sorted = [...players].sort((a, b) => a.jersey - b.jersey || a.name.localeCompare(b.name));
  const slotCount = Math.max(BENCH_SLOTS, sorted.length);
  const slots = Array.from({ length: slotCount }, (_, index) => sorted[index] ?? null);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-sm bg-white/70 px-1 py-1">
      <span className="shrink-0 px-1 text-[9px] font-black tracking-wider text-neutral-500">
        BENCH
      </span>
      {coach ? (
        <button
          type="button"
          onClick={onCoach}
          disabled={!onCoach}
          title={coach.name}
          className={`flex ${BENCH_SLOT} flex-col items-center justify-center rounded-lg px-0.5 text-white disabled:opacity-80 ${
            tone === 'home' ? 'bg-black' : 'bg-neutral-500'
          }`}
        >
          <span className="text-[8px] font-black tracking-wider">COACH</span>
          <span className="max-w-full truncate text-[10px] font-bold">{coach.name}</span>
        </button>
      ) : null}
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          title={addLabel}
          className={`flex ${BENCH_SLOT} items-center justify-center rounded-lg bg-neutral-700 text-2xl font-black text-white hover:bg-neutral-800`}
        >
          +
        </button>
      ) : null}
      {slots.map((player, index) => {
        if (player && !player.onCourt) {
          return <PlayerCard key={player.id} player={player} tone={tone} size="bench" />;
        }
        if (player?.onCourt) {
          return (
            <div
              key={player.id}
              title={`${player.name} is on the court`}
              aria-label={`Empty bench spot, ${player.jersey} is playing`}
              className={`${BENCH_SLOT} rounded-lg border-2 border-dashed border-neutral-400 bg-white/50`}
            />
          );
        }
        return (
          <div
            key={`unused-${tone}-${index}`}
            title="No player"
            aria-label="Empty roster spot"
            className={`flex ${BENCH_SLOT} items-center justify-center rounded-lg text-lg font-black ${LABEL_SHADOW} ${
              tone === 'home' ? 'bg-amber-200 text-amber-800' : 'bg-neutral-300 text-neutral-500'
            }`}
          >
            ∅
          </div>
        );
      })}
    </div>
  );
}

function SubButton() {
  return (
    <button
      type="button"
      className={`flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg px-2 text-sm font-black tracking-wide text-neutral-900 shadow-md ${ACTION_GRAY} ${LABEL_SHADOW}`}
    >
      SUB
    </button>
  );
}

function ShotClockButton() {
  return (
    <button
      type="button"
      className="flex h-9 items-center justify-center rounded-lg bg-red-600 px-2.5 text-xl font-black leading-none text-white"
    >
      24s
    </button>
  );
}

function PossessionButton({
  active,
  label,
  canSet,
  onSelect,
}: {
  active: boolean;
  label: string;
  canSet: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!canSet || active) return;
        onSelect();
      }}
      aria-pressed={active}
      className={`flex h-9 items-center justify-center rounded-lg px-2.5 text-xl font-black leading-none text-white ${
        active ? 'bg-red-600' : 'bg-neutral-300'
      } ${canSet ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {label}
    </button>
  );
}

function TimeoutPill({ max, label }: { max: number; label: string }) {
  return (
    <div
      className="flex h-9 items-center gap-1 rounded-lg bg-black px-2 text-white shadow-md"
      aria-label={label}
    >
      <span className="text-[10px] font-black tracking-wider text-amber-300">TO</span>
      <span className={`text-xl font-black tabular-nums leading-none ${LABEL_SHADOW}`}>0/{max}</span>
    </div>
  );
}

function TeamStatPills({ personalFouls }: { personalFouls: number }) {
  const bonus = personalFouls >= 5;
  const nearBonus = personalFouls === 4;

  return (
    <div
      className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-white shadow-md ${
        bonus ? 'bg-red-600' : 'bg-black'
      }`}
      aria-label={`${personalFouls} team personal fouls this period`}
    >
      <span aria-hidden className="text-lg leading-none text-amber-400">
        ⚡
      </span>
      <span className={`text-xl font-black tabular-nums leading-none ${LABEL_SHADOW} ${nearBonus ? 'text-amber-300' : 'text-white'}`}>
        {personalFouls}
      </span>
    </div>
  );
}

function ActionColumn({
  side,
  activeAction,
  enabled,
  onAction,
}: {
  side: 'home' | 'away';
  activeAction: CaptureBoardAction | null;
  enabled: Record<CaptureBoardAction, boolean>;
  onAction: (side: 'home' | 'away', action: CaptureBoardAction) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2">
      {ACTIONS.map((action) => {
        const isActive = side === 'home' && activeAction === action.id;
        const isEnabled = enabled[action.id];
        return (
          <button
            key={action.id}
            type="button"
            disabled={!isEnabled}
            onClick={() => onAction(side, action.id)}
            className={`flex min-h-0 w-full flex-1 items-center justify-center rounded-lg px-1 text-center text-xl font-black leading-tight tracking-wide shadow-md ${LABEL_SHADOW} ${
              isActive
                ? 'bg-white text-black ring-2 ring-black'
                : `${ACTION_GRAY} text-neutral-900 hover:bg-[#c8c8c8]`
            } disabled:cursor-default disabled:opacity-60 disabled:hover:bg-[#b0b0b0]`}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

function TeamNamePlate({
  name,
  align,
  active,
  label,
  canSet,
  onSelect,
  onBack,
}: {
  name: string;
  align: 'start' | 'end';
  active: boolean;
  label: string;
  canSet: boolean;
  onSelect: () => void;
  onBack?: () => void;
}) {
  const timeouts = (
    <div className="flex shrink-0 items-start gap-1 p-1">
      <TimeoutPill max={2} label="0 of 2 timeouts, first and second quarter" />
      <TimeoutPill max={3} label="0 of 3 timeouts, third and fourth quarter and overtime" />
    </div>
  );
  const shotClock = (
    <div className="flex shrink-0 flex-col self-stretch p-1">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to game"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-xl font-black leading-none text-white"
        >
          ←
        </button>
      ) : null}
      <div className={`mt-auto flex items-end gap-1 ${align === 'end' ? 'flex-row-reverse' : ''}`}>
        <ShotClockButton />
        <PossessionButton active={active} label={label} canSet={canSet} onSelect={onSelect} />
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 items-start bg-white shadow-sm">
      {align === 'start' ? shotClock : timeouts}
      <div
        className={`flex min-w-0 flex-1 flex-col justify-center px-4 py-2 ${
          align === 'end' ? 'items-end' : 'items-start'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (!canSet || active) return;
            onSelect();
          }}
          aria-pressed={active}
          className={`flex min-w-0 max-w-full flex-col text-neutral-900 ${
            align === 'end' ? 'items-end text-right' : 'items-start text-left'
          } ${canSet ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className="max-w-full truncate text-4xl font-bold tracking-tight sm:text-5xl">{name}</span>
        </button>
      </div>
      {align === 'start' ? timeouts : shotClock}
    </div>
  );
}

function ClockStepper({
  value,
  label,
  disabled,
  onUp,
  onDown,
}: {
  value: string;
  label: string;
  disabled: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={onUp}
        aria-label={`Add one ${label}`}
        className="flex h-5 w-8 items-center justify-center text-[11px] leading-none text-amber-300 hover:text-white disabled:opacity-30"
      >
        ▲
      </button>
      <span className="text-4xl font-black tabular-nums leading-none">{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onDown}
        aria-label={`Subtract one ${label}`}
        className="flex h-5 w-8 items-center justify-center text-[11px] leading-none text-amber-300 hover:text-white disabled:opacity-30"
      >
        ▼
      </button>
    </div>
  );
}

export function CaptureBoard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  possession,
  periodLabel,
  clockMinutes,
  clockSeconds,
  clockRunning,
  canControlClock,
  onAdjustClock,
  onToggleClock,
  homePlayers,
  awayPlayers,
  homeBench,
  awayBench,
  homePersonalFouls,
  awayPersonalFouls,
  activeAction,
  onAction,
  homeActionsEnabled,
  hint,
  logItems,
  onUndo,
  canUndo,
  court,
  jumpBallLabel,
  onJumpBall,
  nextLabel,
  onNextPeriod,
  onFlipCourt,
  onBack,
  onAddAwayPlayer,
  addAwayPlayerLabel,
  homeCoach,
  awayCoach,
  onHomeCoach,
  onAwayCoach,
  possessionLabel,
  canSetPossession,
  onSetPossession,
}: CaptureBoardProps) {
  const [logOpen, setLogOpen] = useState(false);
  const awayActionsEnabled: Record<CaptureBoardAction, boolean> = {
    made: true,
    miss: true,
    foul: true,
    turnover: true,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eceae6] text-neutral-900">
      <div className="flex items-stretch gap-2 px-2 pb-1 pt-2">
        <TeamNamePlate
          name={homeName}
          align="start"
          active={possession === 'home'}
          label={possessionLabel}
          canSet={canSetPossession}
          onSelect={() => onSetPossession('home')}
          onBack={onBack}
        />

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-blue-700 text-white shadow-sm">
          <span className="text-4xl font-black tabular-nums leading-none">{homeScore}</span>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center px-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600">
            {periodLabel} in progress
          </div>
          <div className="mt-1 flex items-center gap-1 bg-blue-700 px-2 py-0.5 text-white shadow-sm">
            <ClockStepper
              value={clockMinutes}
              label="minute"
              disabled={!canControlClock}
              onUp={() => onAdjustClock('minute', 1)}
              onDown={() => onAdjustClock('minute', -1)}
            />
            <span className="text-3xl font-black leading-none">:</span>
            <ClockStepper
              value={clockSeconds}
              label="second"
              disabled={!canControlClock}
              onUp={() => onAdjustClock('second', 1)}
              onDown={() => onAdjustClock('second', -1)}
            />
          </div>
          <button
            type="button"
            onClick={onToggleClock}
            disabled={!canControlClock}
            className={`mt-1 w-full rounded-lg px-3 py-1.5 text-xs font-black tracking-wider text-white shadow-md disabled:cursor-default disabled:opacity-50 ${
              clockRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {clockRunning ? 'STOP CLOCK' : 'START CLOCK'}
          </button>
        </div>

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-blue-700 text-white shadow-sm">
          <span className="text-4xl font-black tabular-nums leading-none">{awayScore}</span>
        </div>

        <TeamNamePlate
          name={awayName}
          align="end"
          active={possession === 'away'}
          label={possessionLabel}
          canSet={canSetPossession}
          onSelect={() => onSetPossession('away')}
        />
      </div>

      <div className="px-3 pb-1 text-center text-[11px] font-medium text-neutral-600">{hint}</div>

      <div
        className="grid min-h-0 w-full min-w-0 flex-1 overflow-hidden px-1 pb-1 [container-type:size]"
        style={{
          gridTemplateColumns: logOpen
            ? '9rem 1.25rem 9rem minmax(0,max-content) 9rem 1.25rem 9rem minmax(8rem,1fr)'
            : '9rem 1.25rem 9rem minmax(0,1fr) 9rem 1.25rem 9rem 3rem',
          gridTemplateRows: 'auto minmax(0,1fr) auto',
          rowGap: '0.25rem',
        }}
      >
        <div className="col-start-1 row-start-1 flex items-center justify-center">
          <SubButton />
        </div>
        <div className="col-start-3 row-start-1 flex items-center justify-center">
          <TeamStatPills personalFouls={homePersonalFouls} />
        </div>
        <div className="col-start-4 row-start-1 flex items-center justify-center gap-1">
          {onNextPeriod ? (
            <button
              type="button"
              onClick={onNextPeriod}
              className={`rounded-lg bg-white px-3 py-1.5 text-sm font-black tracking-wide text-black shadow-md hover:bg-neutral-100 ${LABEL_SHADOW}`}
            >
              {nextLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onJumpBall}
            className={`rounded-lg bg-white px-4 py-1.5 text-sm font-black tracking-wide text-black shadow-md hover:bg-neutral-100 ${LABEL_SHADOW}`}
          >
            {jumpBallLabel}
          </button>
          {onFlipCourt ? (
            <button
              type="button"
              onClick={onFlipCourt}
              title="Flip which basket we attack"
              aria-label="Flip which basket we attack"
              className={`rounded-lg bg-white px-3 py-1.5 text-sm font-black tracking-wide text-black shadow-md hover:bg-neutral-100 ${LABEL_SHADOW}`}
            >
              ↔
            </button>
          ) : null}
        </div>
        <div className="col-start-5 row-start-1 flex items-center justify-center">
          <TeamStatPills personalFouls={awayPersonalFouls} />
        </div>
        <div className="col-start-7 row-start-1 flex items-center justify-center">
          <SubButton />
        </div>

        <div className="col-start-1 row-start-2 h-full min-h-0 min-w-0">
          <PlayerColumn players={homePlayers} tone="home" />
        </div>
        <div className="col-start-2 row-start-2" />
        <div className="col-start-3 row-start-2 h-full min-h-0 min-w-0">
          <ActionColumn
            side="home"
            activeAction={activeAction}
            enabled={homeActionsEnabled}
            onAction={onAction}
          />
        </div>
        <div
          className="col-start-4 row-start-2 h-full min-h-0 min-w-0 max-w-full bg-[#e4e0d8]"
          style={logOpen
            ? { width: 'min(calc((100cqb - 7.25rem) * 28 / 15), max(0px, calc(100cqi - 51.5rem)))' }
            : undefined}
        >
          {court}
        </div>
        <div className="col-start-5 row-start-2 h-full min-h-0 min-w-0">
          <ActionColumn
            side="away"
            activeAction={null}
            enabled={awayActionsEnabled}
            onAction={onAction}
          />
        </div>
        <div className="col-start-6 row-start-2" />
        <div className="col-start-7 row-start-2 h-full min-h-0 min-w-0">
          <PlayerColumn players={awayPlayers} tone="away" />
        </div>
        <div className="col-span-7 row-start-3 flex min-w-0 gap-1 overflow-hidden">
          <BenchRow players={homeBench} tone="home" coach={homeCoach} onCoach={onHomeCoach} />
          <BenchRow
            players={awayBench}
            tone="away"
            addLabel={addAwayPlayerLabel}
            onAdd={onAddAwayPlayer}
            coach={awayCoach}
            onCoach={onAwayCoach}
          />
        </div>

        {logOpen ? (
          <aside className="col-start-8 row-span-2 row-start-2 ml-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-2 py-1">
              <span className="text-[11px] font-black tracking-wider">ACTION LOG</span>
              <button
                type="button"
                onClick={() => setLogOpen(false)}
                aria-label="Hide action log"
                aria-pressed="true"
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-white hover:text-black"
              >
                <LogCollapseIcon />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {logItems.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-neutral-400">No actions yet</p>
              ) : (
                logItems.map((item) => (
                  <div key={item.id} className="border-b border-neutral-100 px-2 py-1.5">
                    <div className="text-[10px] font-bold text-neutral-400">
                      {item.periodLabel} {item.clock}
                    </div>
                    <div className="text-[11px] font-black leading-tight">{item.title}</div>
                    <div className="text-[11px] leading-tight text-neutral-600">{item.detail}</div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-neutral-200 p-1.5">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="w-full bg-neutral-800 py-2 text-[11px] font-bold text-white hover:bg-neutral-700 disabled:opacity-40"
              >
                Undo last
              </button>
            </div>
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            aria-pressed="false"
            aria-label="Show action log"
            className="col-start-8 row-span-2 row-start-2 ml-2 flex h-full min-h-0 w-[calc(100%-0.5rem)] items-center justify-center rounded-lg bg-neutral-800 text-white shadow-sm hover:bg-neutral-700"
          >
            <LogExpandIcon />
          </button>
        )}
      </div>
    </div>
  );
}
