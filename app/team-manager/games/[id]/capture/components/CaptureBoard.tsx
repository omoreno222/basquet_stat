'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { inkOn } from '@/lib/colors';

export type CaptureBoardAction = 'made' | 'miss' | 'foul' | 'turnover';

export interface CaptureBoardPlayer {
  id: string;
  jersey: number;
  fouls: number;
  name: string;
  onCourt?: boolean;
  avatarUrl?: string | null;
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
  possession: 'home' | 'away' | null;
  periodLabel: string;
  clockLeft: string;
  clockRight: string;
  lastMinute: boolean;
  clockRunning: boolean;
  canControlClock: boolean;
  onAdjustClock: (unit: 'minute' | 'second' | 'tenth', delta: number) => void;
  onToggleClock: () => void;
  /** Shown instead of start clock while the opening tip has not been taken. */
  idleClockLabel?: string;
  homePlayers: CaptureBoardPlayer[];
  awayPlayers: CaptureBoardPlayer[];
  homeBench: CaptureBoardPlayer[];
  awayBench: CaptureBoardPlayer[];
  homePersonalFouls: number;
  awayPersonalFouls: number;
  timeoutsUsed: number;
  timeoutMax: number;
  cambioLabel: string;
  stepBackLabel: string;
  cancelDeleteLabel: string;
  timeoutLabel: string;
  foulsLabel: string;
  clockViolationsEnabled: boolean;
  onShotClock: (side: 'home' | 'away') => void;
  onEightSeconds: (side: 'home' | 'away') => void;
  onFiveSeconds: (side: 'home' | 'away') => void;
  activeAction: CaptureBoardAction | null;
  activeSide: 'home' | 'away' | null;
  onAction: (side: 'home' | 'away', action: CaptureBoardAction) => void;
  homeActionsEnabled: Record<CaptureBoardAction, boolean>;
  awayTurnoverEnabled: boolean;
  hint: string;
  logItems: CaptureLogItem[];
  onUndo: () => void;
  canUndo: boolean;
  court: ReactNode;
  homeAttacksRight: boolean;
  nextLabel?: string;
  onNextPeriod?: () => void;
  onFlipCourt?: () => void;
  onBack?: () => void;
  homeCoach?: { name: string } | null;
  awayCoach?: { name: string } | null;
  onHomeCoach?: () => void;
  onAwayCoach?: () => void;
  canSetPossession: boolean;
  onSetPossession: (side: 'home' | 'away') => void;
  courtPickSide: 'home' | 'away' | null;
  onCourtPlayer: (side: 'home' | 'away', playerId: string) => void;
  homeColor: string;
  awayColor: string;
}

const LABEL_SHADOW = '[text-shadow:0_2px_3px_rgba(0,0,0,0.45)]';

function screenOrientationAngle(): number {
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === 'number') return ((angle % 360) + 360) % 360;
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (legacy === -90) return 90;
  if (legacy === 90) return 270;
  if (legacy === 180) return 180;
  return 0;
}

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

function FoulBolts({ count }: { count: number }) {
  const filled = Math.min(5, Math.max(0, count));
  const fouledOut = filled >= 5;
  return (
    <div className="flex w-full shrink-0 items-center justify-center gap-0.5" aria-label={`${filled} personal fouls`}>
      {Array.from({ length: 5 }, (_, index) => {
        const done = index < filled;
        const color = done ? (fouledOut ? '#ef4444' : '#f59e0b') : '#a3a3a3';
        return (
          <svg key={index} viewBox="0 0 16 16" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <path
              d="M9.1 1.1 3.2 9.1h4.1L6.4 14.9 13.2 6.4H8.7L9.1 1.1Z"
              fill={done ? color : 'none'}
              stroke={color}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}

function jerseyFill(color: string | undefined): CSSProperties | undefined {
  if (!color) return undefined;
  return { backgroundColor: color, color: inkOn(color) };
}

function chipBox(compact: boolean, wide: boolean, fit: boolean) {
  if (fit) return 'h-full w-full';
  const height = wide
    ? compact ? 'h-14' : 'h-16'
    : compact ? 'h-14 w-14 shrink-0' : 'h-[4.5rem] w-[4.5rem] shrink-0';
  return `${height} ${wide ? 'w-full' : ''}`;
}

function JerseyChip({
  player,
  color,
  onSelect,
  compact = false,
  wide = false,
  court = false,
  vacant = false,
  fit = false,
}: {
  player: CaptureBoardPlayer | null;
  color: string;
  onSelect?: () => void;
  compact?: boolean;
  wide?: boolean;
  court?: boolean;
  vacant?: boolean;
  fit?: boolean;
}) {
  const box = chipBox(compact, wide, fit);

  if (!player) {
    return (
      <div
        aria-hidden="true"
        className={`${box} rounded-md border border-dashed border-neutral-400 bg-neutral-200`}
      />
    );
  }

  if (vacant) {
    return (
      <div
        title={player.name}
        aria-label={player.name}
        className={`${box} rounded-md border-2 border-neutral-900 bg-neutral-100`}
      />
    );
  }

  const photo = player.avatarUrl || null;
  const ring = onSelect ? 'cursor-pointer ring-2 ring-orange-400' : court ? 'ring-2 ring-black ring-offset-1' : '';
  const typeSize = photo ? '' : fit ? 'text-2xl' : wide ? (compact ? 'text-lg' : 'text-xl') : compact ? 'text-xl' : 'text-2xl';
  const className = `relative flex flex-col items-center justify-end overflow-hidden rounded-md pb-0.5 font-black tabular-nums leading-none shadow-md ${LABEL_SHADOW} ${box} ${typeSize} ${
    photo ? 'bg-neutral-200' : ''
  } ${ring}`;
  const painted = photo ? undefined : jerseyFill(color);
  const bolts = <FoulBolts count={player.fouls} />;
  const content = photo ? (
    <>
      <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute bottom-3.5 right-0.5 z-10 rounded bg-black/80 px-1 text-[10px] font-black leading-none text-white">
        {player.jersey}
      </span>
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-0.5 pb-px pt-2">
        {bolts}
      </div>
    </>
  ) : (
    <>
      <span className="flex min-h-0 flex-1 items-center justify-center">{player.jersey}</span>
      {bolts}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" title={player.name} onClick={onSelect} className={className} style={painted}>
        {content}
      </button>
    );
  }

  return (
    <div title={player.name} className={className} style={painted}>
      {content}
    </div>
  );
}

function CourtPlayerStrip({
  leftPlayers,
  rightPlayers,
  leftColor,
  rightColor,
  onSelectLeft,
  onSelectRight,
  compact = false,
}: {
  leftPlayers: CaptureBoardPlayer[];
  rightPlayers: CaptureBoardPlayer[];
  leftColor: string;
  rightColor: string;
  onSelectLeft?: (playerId: string) => void;
  onSelectRight?: (playerId: string) => void;
  compact?: boolean;
}) {
  const chip = (
    player: CaptureBoardPlayer,
    color: string,
    onSelect?: (playerId: string) => void,
  ) => (
    <div key={player.id} className="aspect-square h-full shrink-0">
      <JerseyChip
        player={player}
        color={color}
        fit
        onSelect={onSelect ? () => onSelect(player.id) : undefined}
      />
    </div>
  );

  return (
    <div className={`flex w-full items-stretch justify-center gap-1 ${compact ? 'h-[3.75rem]' : 'h-[4.25rem]'}`}>
      {leftPlayers.slice(0, 5).map((player) => chip(player, leftColor, onSelectLeft))}
      {leftPlayers.length > 0 && rightPlayers.length > 0 ? <span className="w-2 shrink-0" /> : null}
      {rightPlayers.slice(0, 5).map((player) => chip(player, rightColor, onSelectRight))}
    </div>
  );
}

function CambioButton({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <button
      type="button"
      className={`flex w-full shrink-0 items-center justify-center rounded-lg font-black text-neutral-900 shadow-md ${ACTION_GRAY} ${
        compact ? 'h-[3.75rem] px-1 text-[10px]' : 'h-[4.25rem] px-2 text-xs'
      }`}
    >
      {label}
    </button>
  );
}

function SideBench({
  players,
  color,
  compact = false,
  coach,
  onCoach,
}: {
  players: CaptureBoardPlayer[];
  color: string;
  compact?: boolean;
  coach?: { name: string } | null;
  onCoach?: () => void;
}) {
  const roster = [...players].sort((a, b) => a.jersey - b.jersey || a.name.localeCompare(b.name));
  const coachBox = `col-span-2 flex w-full items-center justify-center overflow-hidden rounded-md px-1 text-center text-[11px] font-black leading-tight shadow-md ${LABEL_SHADOW} ${
    compact ? 'h-14' : 'h-16'
  }`;
  const coachStyle = jerseyFill(color);

  return (
    <div className="grid h-full min-h-0 grid-cols-2 content-start gap-2 overflow-y-auto">
      {roster.map((player) => (
        <JerseyChip
          key={player.id}
          player={player}
          color={color}
          compact={compact}
          wide
          vacant={!!player.onCourt}
        />
      ))}
      {coach ? (
        onCoach ? (
          <button type="button" onClick={onCoach} title={coach.name} className={coachBox} style={coachStyle}>
            <span className="line-clamp-2 min-w-0">{coach.name}</span>
          </button>
        ) : (
          <div title={coach.name} className={coachBox} style={coachStyle}>
            <span className="line-clamp-2 min-w-0">{coach.name}</span>
          </div>
        )
      ) : null}
    </div>
  );
}

function HintBar({
  stepBackLabel,
  hint,
  cancelDeleteLabel,
  nextLabel,
  onNextPeriod,
}: {
  stepBackLabel: string;
  hint: string;
  cancelDeleteLabel: string;
  nextLabel?: string;
  onNextPeriod?: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <button
        type="button"
        className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-black text-neutral-900 shadow-md ${ACTION_GRAY}`}
      >
        {stepBackLabel}
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-neutral-600">{hint}</p>
      <button
        type="button"
        className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-black text-neutral-900 shadow-md ${ACTION_GRAY}`}
      >
        {cancelDeleteLabel}
      </button>
      {onNextPeriod ? (
        <button
          type="button"
          onClick={onNextPeriod}
          className={`shrink-0 whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-[11px] font-black tracking-wide text-black shadow-md ${LABEL_SHADOW}`}
        >
          {nextLabel}
        </button>
      ) : null}
    </div>
  );
}


function ClockViolationButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 items-center justify-center rounded-lg bg-red-600 px-2.5 text-xl font-black leading-none text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function PossessionDot({ active }: { active: boolean }) {
  return (
    <span className="flex w-12 shrink-0 items-center justify-center self-stretch" aria-hidden="true">
      <span className={`h-8 w-8 rounded-full ${active ? 'animate-pulse bg-red-600' : 'bg-transparent'}`} />
    </span>
  );
}

function ActionStats({
  fouls,
  foulsLabel,
  timeoutLabel,
  timeoutsUsed,
  timeoutMax,
  compact = false,
}: {
  fouls: number;
  foulsLabel: string;
  timeoutLabel: string;
  timeoutsUsed: number;
  timeoutMax: number;
  compact?: boolean;
}) {
  const bonus = fouls >= 5;
  const nearBonus = fouls === 4;
  const row = compact ? 'h-7 px-1' : 'h-8 px-1.5';
  const value = compact ? 'text-sm' : 'text-lg';

  return (
    <div className="flex w-full shrink-0 flex-col gap-1">
      <div
        className={`flex items-center justify-between rounded-lg bg-black text-white shadow-md ${row}`}
        aria-label={`${timeoutLabel} ${timeoutsUsed}/${timeoutMax}`}
      >
        <span className="truncate text-[10px] font-black tracking-wider text-amber-300">{timeoutLabel}</span>
        <span className={`${value} font-black tabular-nums leading-none ${LABEL_SHADOW}`}>{timeoutsUsed}/{timeoutMax}</span>
      </div>
      <div
        className={`flex items-center justify-between rounded-lg text-white shadow-md ${row} ${
          bonus ? 'bg-red-600' : 'bg-black'
        }`}
        aria-label={`${fouls} ${foulsLabel}`}
      >
        <span className="truncate text-[10px] font-black tracking-wider text-amber-300">{foulsLabel}</span>
        <span className={`${value} font-black tabular-nums leading-none ${LABEL_SHADOW} ${nearBonus ? 'text-amber-300' : 'text-white'}`}>
          {fouls}
        </span>
      </div>
    </div>
  );
}

function ActionColumn({
  side,
  activeAction,
  activeSide,
  enabled,
  onAction,
  direction = 'column',
  splitTurnover = false,
  compact = false,
}: {
  side: 'home' | 'away';
  activeAction: CaptureBoardAction | null;
  activeSide: 'home' | 'away' | null;
  enabled: Record<CaptureBoardAction, boolean>;
  onAction: (side: 'home' | 'away', action: CaptureBoardAction) => void;
  direction?: 'column' | 'row';
  splitTurnover?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={direction === 'row'
      ? 'flex h-full min-h-0 w-full min-w-0 flex-row gap-1'
      : 'flex h-full min-h-0 w-full min-w-0 flex-col gap-1'}>
      {ACTIONS.map((action) => {
        const isActive = activeAction === action.id && (activeSide != null ? side === activeSide : side === 'home');
        const isEnabled = enabled[action.id];
        const turnoverBlocked = action.id === 'turnover' && !isEnabled;
        const stacked = splitTurnover && action.id === 'turnover';
        return (
          <button
            key={action.id}
            type="button"
            disabled={!isEnabled}
            onClick={() => onAction(side, action.id)}
            className={`flex min-h-0 flex-1 items-center justify-center rounded-lg px-1 text-center font-black leading-tight tracking-wide ${compact ? 'text-[10px]' : 'text-sm'} ${direction === 'row' ? 'min-w-0' : 'w-full'} ${LABEL_SHADOW} ${
              isActive
                ? 'bg-white text-black ring-2 ring-black shadow-md'
                : turnoverBlocked
                  ? 'cursor-default bg-[#8e9894] text-[#e7eeeb] shadow-none'
                  : `${ACTION_GRAY} text-neutral-900 shadow-md hover:bg-[#c8c8c8] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-[#b0b0b0]`
            }`}
          >
            {stacked ? (
              <span className="flex flex-col items-center leading-none">
                <span>TURN</span>
                <span>OVER</span>
              </span>
            ) : action.label}
          </button>
        );
      })}
    </div>
  );
}

function ClockViolationButtons({
  side,
  enabled,
  onShotClock,
  onEightSeconds,
  onFiveSeconds,
}: {
  side: 'home' | 'away';
  enabled: boolean;
  onShotClock: (side: 'home' | 'away') => void;
  onEightSeconds: (side: 'home' | 'away') => void;
  onFiveSeconds: (side: 'home' | 'away') => void;
}) {
  return (
    <>
      <ClockViolationButton label="24s" disabled={!enabled} onClick={() => onShotClock(side)} />
      <ClockViolationButton label="8s" disabled={!enabled} onClick={() => onEightSeconds(side)} />
      <ClockViolationButton label="5s" disabled={!enabled} onClick={() => onFiveSeconds(side)} />
    </>
  );
}

function PossessionWash({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 animate-pulse"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 42%, white)` }}
    />
  );
}

function TeamNamePlate({
  side,
  name,
  align,
  active,
  canSet,
  onSelect,
  onBack,
  onFlipCourt,
  onShotClock,
  onEightSeconds,
  onFiveSeconds,
  clockViolationsEnabled,
  color,
}: {
  side: 'home' | 'away';
  name: string;
  align: 'start' | 'end';
  active: boolean;
  canSet: boolean;
  onSelect: () => void;
  onBack?: () => void;
  onFlipCourt?: () => void;
  onShotClock: (side: 'home' | 'away') => void;
  onEightSeconds: (side: 'home' | 'away') => void;
  onFiveSeconds: (side: 'home' | 'away') => void;
  clockViolationsEnabled: boolean;
  color: string;
}) {
  const stripe = (
    <span aria-hidden="true" className="relative z-10 w-5 shrink-0 self-stretch" style={{ backgroundColor: color }} />
  );
  const towardScore = align === 'start';
  const selectPossession = () => {
    if (!canSet || active) return;
    onSelect();
  };
  const clockButtons = (
    <div className={`flex w-full items-center gap-1 ${towardScore ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
        <ClockViolationButtons
          side={side}
          enabled={clockViolationsEnabled}
          onShotClock={onShotClock}
          onEightSeconds={onEightSeconds}
          onFiveSeconds={onFiveSeconds}
        />
      </div>
    </div>
  );

  return (
    <div
      onClick={selectPossession}
      className={`relative flex min-w-0 flex-1 items-stretch overflow-hidden bg-white shadow-sm ${
        canSet && !active ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {active ? <PossessionWash color={color} /> : null}
      {align === 'start' ? stripe : null}
      {align === 'start' ? <PossessionDot active={active} /> : null}
      <div className={`relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1 px-2 py-1 ${towardScore ? 'items-end' : 'items-start'}`}>
        <div className="flex w-full min-w-0 items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onBack();
              }}
              aria-label="Back to game"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-xl font-black leading-none text-white"
            >
              ←
            </button>
          ) : null}
          {onFlipCourt ? (
            <span onClick={(event) => event.stopPropagation()}>
              <FlipCourtButton onFlipCourt={onFlipCourt} />
            </span>
          ) : null}
          <span
            className={`min-w-0 flex-1 truncate text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl ${
              towardScore ? 'text-right' : 'text-left'
            }`}
          >
            {name}
          </span>
        </div>
        {clockButtons}
      </div>
      {align === 'end' ? <PossessionDot active={active} /> : null}
      {align === 'end' ? stripe : null}
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

function ScoreboardClock({
  dense,
  periodLabel,
  clockLeft,
  clockRight,
  lastMinute,
  clockRunning,
  canControlClock,
  onAdjustClock,
  onToggleClock,
  idleClockLabel,
}: {
  dense: boolean;
  periodLabel: string;
  clockLeft: string;
  clockRight: string;
  lastMinute: boolean;
  clockRunning: boolean;
  canControlClock: boolean;
  onAdjustClock: (unit: 'minute' | 'second' | 'tenth', delta: number) => void;
  onToggleClock: () => void;
  idleClockLabel?: string;
}) {
  const leftUnit = lastMinute ? 'second' : 'minute';
  const rightUnit = lastMinute ? 'tenth' : 'second';

  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600">
        {periodLabel}
      </div>
      <div className={`flex items-center gap-1 bg-blue-700 text-white ${dense ? 'mt-0.5 px-1.5 py-0.5' : 'mt-1 px-2 py-0.5 shadow-sm'}`}>
        <ClockStepper
          value={clockLeft}
          label={leftUnit}
          disabled={!canControlClock}
          onUp={() => onAdjustClock(leftUnit, 1)}
          onDown={() => onAdjustClock(leftUnit, -1)}
        />
        <span className={`font-black leading-none ${dense ? 'text-2xl' : 'text-3xl'}`}>:</span>
        <ClockStepper
          value={clockRight}
          label={rightUnit}
          disabled={!canControlClock}
          onUp={() => onAdjustClock(rightUnit, 1)}
          onDown={() => onAdjustClock(rightUnit, -1)}
        />
      </div>
      <button
        type="button"
        onClick={onToggleClock}
        disabled={!canControlClock}
        className={`w-full rounded-lg text-center font-black leading-tight tracking-wider text-white whitespace-normal disabled:cursor-default disabled:opacity-50 ${
          dense ? 'mt-0.5 px-1 py-1 text-[10px]' : 'mt-1 px-2 py-1.5 text-xs shadow-md'
        } ${
          clockRunning
            ? (dense ? 'bg-red-600' : 'bg-red-600 hover:bg-red-700')
            : (dense ? 'bg-green-600' : 'bg-green-600 hover:bg-green-700')
        }`}
      >
        {clockRunning
          ? (dense ? 'STOP' : 'STOP CLOCK')
          : (idleClockLabel ?? (dense ? 'START' : 'START CLOCK'))}
      </button>
    </div>
  );
}

function FlipCourtButton({ onFlipCourt }: { onFlipCourt: () => void }) {
  return (
    <button
      type="button"
      onClick={onFlipCourt}
      title="Flip which basket we attack"
      aria-label="Flip which basket we attack"
      className={`flex h-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white px-2.5 text-sm font-black tracking-wide text-black shadow-md ${LABEL_SHADOW}`}
    >
      ↔
    </button>
  );
}

function ActionLog({
  open,
  onToggle,
  items,
  onUndo,
  canUndo,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  items: CaptureLogItem[];
  onUndo: () => void;
  canUndo: boolean;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        aria-pressed="false"
        aria-label="Show action log"
        className="ml-1 flex h-full min-h-0 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-white shadow-sm hover:bg-neutral-700"
      >
        <LogExpandIcon />
      </button>
    );
  }

  return (
    <aside className="ml-1 flex h-full min-h-0 w-52 shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-2 py-1">
        <span className="text-[11px] font-black tracking-wider">ACTION LOG</span>
        <button
          type="button"
          onClick={() => onToggle(false)}
          aria-label="Hide action log"
          aria-pressed="true"
          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-white hover:text-black"
        >
          <LogCollapseIcon />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-neutral-400">No actions yet</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg bg-neutral-100 px-2 py-1.5">
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
  );
}

export function CaptureBoard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  possession,
  periodLabel,
  clockLeft,
  clockRight,
  lastMinute,
  clockRunning,
  canControlClock,
  onAdjustClock,
  onToggleClock,
  idleClockLabel,
  homePlayers,
  awayPlayers,
  homeBench,
  awayBench,
  homePersonalFouls,
  awayPersonalFouls,
  timeoutsUsed,
  timeoutMax,
  cambioLabel,
  stepBackLabel,
  cancelDeleteLabel,
  timeoutLabel,
  foulsLabel,
  clockViolationsEnabled,
  onShotClock,
  onEightSeconds,
  onFiveSeconds,
  activeAction,
  activeSide,
  onAction,
  homeActionsEnabled,
  awayTurnoverEnabled,
  hint,
  logItems,
  onUndo,
  canUndo,
  court,
  nextLabel,
  onNextPeriod,
  onFlipCourt,
  onBack,
  homeCoach,
  awayCoach,
  onHomeCoach,
  onAwayCoach,
  canSetPossession,
  onSetPossession,
  courtPickSide,
  onCourtPlayer,
  homeColor,
  awayColor,
}: CaptureBoardProps) {
  const [logOpen, setLogOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false);
  const [courtTurn, setCourtTurn] = useState<0 | 90 | -90>(0);
  const awayActionsEnabled: Record<CaptureBoardAction, boolean> = {
    made: true,
    miss: true,
    foul: true,
    turnover: awayTurnoverEnabled,
  };

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const apply = () => {
      const next = el.clientHeight > el.clientWidth;
      setPortrait((prev) => (prev === next ? prev : next));
      const angle = screenOrientationAngle();
      const turn: 0 | 90 | -90 = !next ? 0 : angle === 0 || angle === 270 ? -90 : 90;
      setCourtTurn((prev) => (prev === turn ? prev : turn));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    screen.orientation?.addEventListener('change', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      observer.disconnect();
      screen.orientation?.removeEventListener('change', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  const floor = (compact: boolean) => {
    const bench = compact ? '6.5rem' : '8rem';
    const actions = compact ? '4rem' : '6.25rem';
    const courtWidth = compact
      ? 'min(100cqh, calc(100cqw * 28 / 15))'
      : 'min(100cqw, calc(100cqh * 28 / 15))';
    const courtHeight = compact
      ? 'min(100cqw, calc(100cqh * 15 / 28))'
      : 'min(100cqh, calc(100cqw * 15 / 28))';

    return (
    <div
      className="grid h-full min-h-0 min-w-0 flex-1 gap-1"
      style={{
        gridTemplateColumns: `${bench} ${actions} minmax(0,1fr) ${actions} ${bench}`,
        gridTemplateRows: 'auto minmax(0,1fr) auto',
      }}
    >
      <div className="col-start-1 row-start-1 self-end">
        <CambioButton label={cambioLabel} compact={compact} />
      </div>
      <div className="col-start-2 row-start-1 self-end">
        <ActionStats
          fouls={homePersonalFouls}
          foulsLabel={foulsLabel}
          timeoutLabel={timeoutLabel}
          timeoutsUsed={timeoutsUsed}
          timeoutMax={timeoutMax}
          compact={compact}
        />
      </div>
      <div className="col-start-3 row-start-1 min-w-0 self-stretch">
        <CourtPlayerStrip
          leftPlayers={homePlayers}
          rightPlayers={awayPlayers}
          leftColor={homeColor}
          rightColor={awayColor}
          onSelectLeft={courtPickSide === 'home' ? (playerId) => onCourtPlayer('home', playerId) : undefined}
          onSelectRight={courtPickSide === 'away' ? (playerId) => onCourtPlayer('away', playerId) : undefined}
          compact={compact}
        />
      </div>
      <div className="col-start-4 row-start-1 self-end">
        <ActionStats
          fouls={awayPersonalFouls}
          foulsLabel={foulsLabel}
          timeoutLabel={timeoutLabel}
          timeoutsUsed={timeoutsUsed}
          timeoutMax={timeoutMax}
          compact={compact}
        />
      </div>
      <div className="col-start-5 row-start-1 self-end">
        <CambioButton label={cambioLabel} compact={compact} />
      </div>

      <div className="col-start-1 row-start-2 min-h-0">
        <SideBench
          players={homeBench}
          color={homeColor}
          compact={compact}
          coach={homeCoach}
          onCoach={onHomeCoach}
        />
      </div>
      <div className="col-start-2 row-start-2 flex min-h-0">
        <ActionColumn
          side="home"
          activeAction={activeAction}
          activeSide={activeSide}
          enabled={homeActionsEnabled}
          onAction={onAction}
          splitTurnover={compact}
          compact={compact}
        />
      </div>
      <div
        className="col-start-3 row-start-2 flex min-h-0 min-w-0 items-start justify-center overflow-hidden bg-[#e4e0d8]"
        style={{ containerType: 'size' }}
      >
        <div
          className="shrink-0"
          style={{
            width: courtWidth,
            height: courtHeight,
            transform: compact ? `rotate(${courtTurn}deg)` : undefined,
          }}
        >
          {court}
        </div>
      </div>
      <div className="col-start-4 row-start-2 flex min-h-0">
        <ActionColumn
          side="away"
          activeAction={activeAction}
          activeSide={activeSide}
          enabled={awayActionsEnabled}
          onAction={onAction}
          splitTurnover={compact}
          compact={compact}
        />
      </div>
      <div className="col-start-5 row-start-2 min-h-0">
        <SideBench
          players={awayBench}
          color={awayColor}
          compact={compact}
          coach={awayCoach}
          onCoach={onAwayCoach}
        />
      </div>

      <div className="col-start-3 row-start-3">
        <HintBar
          stepBackLabel={stepBackLabel}
          hint={hint}
          cancelDeleteLabel={cancelDeleteLabel}
          nextLabel={nextLabel}
          onNextPeriod={onNextPeriod}
        />
      </div>
    </div>
    );
  };

  return (
    <div ref={shellRef} className="flex h-full min-h-0 flex-col bg-[#eceae6] text-neutral-900">
      {portrait ? (
        <>
          <div className="flex shrink-0 items-stretch gap-1 px-1 pt-1">
            {onBack || onFlipCourt ? (
              <div className="flex shrink-0 items-center gap-1 self-center">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back to game"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-xl font-black leading-none text-white"
                  >
                    ←
                  </button>
                ) : null}
                {onFlipCourt ? <FlipCourtButton onFlipCourt={onFlipCourt} /> : null}
              </div>
            ) : null}
            <button
              type="button"
              title={homeName}
              onClick={() => {
                if (!canSetPossession || possession === 'home') return;
                onSetPossession('home');
              }}
              className="relative flex min-w-0 flex-1 items-stretch overflow-hidden bg-white text-left text-xl font-bold text-neutral-900"
            >
              <span aria-hidden="true" className="relative z-10 w-5 shrink-0" style={{ backgroundColor: homeColor }} />
              <span className="relative flex min-w-0 flex-1 items-center px-2">
                {possession === 'home' ? <PossessionWash color={homeColor} /> : null}
                <span className="relative z-10 truncate">{homeName}</span>
              </span>
            </button>
            <div className="flex w-14 shrink-0 items-center justify-center bg-blue-700 text-3xl font-black tabular-nums text-white">
              {homeScore}
            </div>
            <ScoreboardClock
              dense
              periodLabel={periodLabel}
              clockLeft={clockLeft}
              clockRight={clockRight}
              lastMinute={lastMinute}
              clockRunning={clockRunning}
              canControlClock={canControlClock}
              onAdjustClock={onAdjustClock}
              onToggleClock={onToggleClock}
              idleClockLabel={idleClockLabel}
            />
            <div className="flex w-14 shrink-0 items-center justify-center bg-blue-700 text-3xl font-black tabular-nums text-white">
              {awayScore}
            </div>
            <button
              type="button"
              title={awayName}
              onClick={() => {
                if (!canSetPossession || possession === 'away') return;
                onSetPossession('away');
              }}
              className="relative flex min-w-0 flex-1 items-stretch overflow-hidden bg-white text-right text-xl font-bold text-neutral-900"
            >
              <span className="relative flex min-w-0 flex-1 items-center justify-end px-2">
                {possession === 'away' ? <PossessionWash color={awayColor} /> : null}
                <span className="relative z-10 truncate">{awayName}</span>
              </span>
              <span aria-hidden="true" className="relative z-10 w-5 shrink-0" style={{ backgroundColor: awayColor }} />
            </button>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-1 overflow-x-auto px-1 py-1">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <PossessionDot active={possession === 'home'} />
              <ClockViolationButtons
                side="home"
                enabled={clockViolationsEnabled}
                onShotClock={onShotClock}
                onEightSeconds={onEightSeconds}
                onFiveSeconds={onFiveSeconds}
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
              <div className="flex flex-row-reverse items-center gap-1">
                <ClockViolationButtons
                  side="away"
                  enabled={clockViolationsEnabled}
                  onShotClock={onShotClock}
                  onEightSeconds={onEightSeconds}
                  onFiveSeconds={onFiveSeconds}
                />
              </div>
              <PossessionDot active={possession === 'away'} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 gap-1 px-1 pb-1">
            {floor(true)}
            <ActionLog
              open={logOpen}
              onToggle={setLogOpen}
              items={logItems}
              onUndo={onUndo}
              canUndo={canUndo}
            />
          </div>
        </>
      ) : (
        <>
      <div className="flex items-stretch gap-2 px-2 pb-1 pt-2">
        <TeamNamePlate
          side="home"
          name={homeName}
          align="start"
          active={possession === 'home'}
          canSet={canSetPossession}
          onSelect={() => onSetPossession('home')}
          onBack={onBack}
          onFlipCourt={onFlipCourt}
          onShotClock={onShotClock}
          onEightSeconds={onEightSeconds}
          onFiveSeconds={onFiveSeconds}
          clockViolationsEnabled={clockViolationsEnabled}
          color={homeColor}
        />

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-blue-700 text-white shadow-sm">
          <span className="text-4xl font-black tabular-nums leading-none">{homeScore}</span>
        </div>

        <ScoreboardClock
          dense={false}
          periodLabel={periodLabel}
          clockLeft={clockLeft}
          clockRight={clockRight}
          lastMinute={lastMinute}
          clockRunning={clockRunning}
          canControlClock={canControlClock}
          onAdjustClock={onAdjustClock}
          onToggleClock={onToggleClock}
          idleClockLabel={idleClockLabel}
        />

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-blue-700 text-white shadow-sm">
          <span className="text-4xl font-black tabular-nums leading-none">{awayScore}</span>
        </div>

        <TeamNamePlate
          side="away"
          name={awayName}
          align="end"
          active={possession === 'away'}
          canSet={canSetPossession}
          onSelect={() => onSetPossession('away')}
          onShotClock={onShotClock}
          onEightSeconds={onEightSeconds}
          onFiveSeconds={onFiveSeconds}
          clockViolationsEnabled={clockViolationsEnabled}
          color={awayColor}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-1 px-1 pb-1">
        {floor(false)}
        <ActionLog
          open={logOpen}
          onToggle={setLogOpen}
          items={logItems}
          onUndo={onUndo}
          canUndo={canUndo}
        />
      </div>
        </>
      )}
    </div>
  );
}
