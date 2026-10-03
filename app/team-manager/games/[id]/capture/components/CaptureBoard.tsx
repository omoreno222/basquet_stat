'use client';

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { inkOn } from '@/lib/colors';
import type { ClockFace } from '@/lib/capture/clock-run';

export type CaptureBoardAction = 'made' | 'made_personal' | 'miss' | 'miss_personal' | 'foul' | 'turnover';

export interface CaptureBoardPlayer {
  id: string;
  jersey: number;
  fouls: number;
  name: string;
  onCourt?: boolean;
  eliminated?: boolean;
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
  subscribeClock: (listener: () => void) => () => void;
  getClockFace: () => ClockFace;
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
  homeTimeoutsUsed: number;
  awayTimeoutsUsed: number;
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
  onTimeout: (side: 'home' | 'away') => void;
  timeoutTickSide: 'home' | 'away' | null;
  activeAction: CaptureBoardAction | null;
  activeSide: 'home' | 'away' | null;
  onAction: (side: 'home' | 'away', action: CaptureBoardAction) => void;
  madePersonalLabel: string;
  missPersonalLabel: string;
  homeActionsEnabled: Record<CaptureBoardAction, boolean>;
  awayTurnoverEnabled: boolean;
  hint: string;
  onStepBack?: () => void;
  onCancelDelete?: () => void;
  logItems: CaptureLogItem[];
  onUndo: () => void;
  canUndo: boolean;
  court: ReactNode;
  homeAttacksRight: boolean;
  nextLabel?: string;
  onNextPeriod?: () => void;
  quintetoLabel?: string;
  onQuinteto?: () => void;
  onFlipCourt?: () => void;
  onEditGame?: () => void;
  editLabel?: string;
  onBack?: () => void;
  homeCoach?: { name: string } | null;
  awayCoach?: { name: string } | null;
  onHomeCoach?: () => void;
  onAwayCoach?: () => void;
  onEditAwayBench?: () => void;
  editBenchLabel?: string;
  canSetPossession: boolean;
  onSetPossession: (side: 'home' | 'away') => void;
  courtPickSide: 'home' | 'away' | 'both' | null;
  onCourtPlayer: (side: 'home' | 'away', playerId: string) => void;
  cambioSide: 'home' | 'away' | null;
  onCambio: (side: 'home' | 'away') => void;
  benchPickSide: 'home' | 'away' | null;
  onBenchPlayer: (side: 'home' | 'away', playerId: string) => void;
  selectedCourtId: string | null;
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

const BENCH_WOOD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="96" viewBox="0 0 90 96">
  <defs>
    <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3dcc0"/>
      <stop offset="8%" stop-color="#e8c79a"/>
      <stop offset="18%" stop-color="#d7aa6c"/>
      <stop offset="31%" stop-color="#c48b4a"/>
      <stop offset="44%" stop-color="#e6c48c"/>
      <stop offset="57%" stop-color="#b67c3c"/>
      <stop offset="71%" stop-color="#dfb67a"/>
      <stop offset="84%" stop-color="#a56e38"/>
      <stop offset="100%" stop-color="#c99558"/>
    </linearGradient>
    <filter id="fiber" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.42" numOctaves="4" seed="9" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" result="streaks" values="0 0 0 0 0.36 0 0 0 0 0.2 0 0 0 0 0.08 1.1 1.1 1.1 0 -1.35"/>
      <feBlend in="SourceGraphic" in2="streaks" mode="multiply"/>
    </filter>
  </defs>
  <g filter="url(#fiber)">
    <rect width="90" height="96" fill="url(#board)"/>
    <path d="M-4 18c20-3 28 7 46 2c10-3 22-9 48 1v6c-24-8-30 4-46 1c-16 4-28-8-48-2Z" fill="#6a3c18" opacity="0.22"/>
    <path d="M-4 47c14 4 36-9 58-3c12 3 20 8 40-2v5c-18 9-26-4-40 1c-20 6-40-10-58-2Z" fill="#5c3214" opacity="0.16"/>
    <path d="M-4 74c22-6 34 5 52 0c14-4 24-2 42 6v4c-16-7-28-2-42-5c-18 5-32-8-52-1Z" fill="#f6e6cc" opacity="0.35"/>
    <g fill="none" stroke-linecap="round">
      <path d="M-2 7c18-2 24 4 40 1c18-3 28-1 54 3" stroke="#5a3416" stroke-width="0.55" opacity="0.55"/>
      <path d="M8 12c16 2 22-3 34-1" stroke="#f8ead4" stroke-width="0.4" opacity="0.8"/>
      <path d="M-2 27c12 2 30-5 48-2c16 2 24 5 46-1" stroke="#7a4a24" stroke-width="0.35" opacity="0.45"/>
      <path d="M-2 36c22-1 18 3 36 2c20-2 22 1 58 2" stroke="#4a2c12" stroke-width="0.7" opacity="0.35"/>
      <path d="M20 41c14 1 18-2 28 0" stroke="#f3dcc0" stroke-width="0.45" opacity="0.7"/>
      <path d="M-2 63c16 2 26-4 44-1c14 2 22 4 50-2" stroke="#6e4120" stroke-width="0.4" opacity="0.5"/>
      <path d="M-2 69c24-2 20 3 42 1c16-2 18 2 52 1" stroke="#f7e4c6" stroke-width="0.5" opacity="0.55"/>
      <path d="M-2 86c14 1 32-3 50-1c12 1 18 3 42-1" stroke="#5e3818" stroke-width="0.45" opacity="0.4"/>
      <path d="M4 91c20-1 16 2 34 1" stroke="#e7c89a" stroke-width="0.35" opacity="0.6"/>
    </g>
  </g>
</svg>`;

const BENCH_WOOD: CSSProperties = {
  backgroundColor: '#c99558',
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(BENCH_WOOD_SVG)}")`,
  backgroundRepeat: 'repeat-y',
  backgroundSize: '100% auto',
};

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
  selected = false,
  dimmed = false,
  pulse = false,
}: {
  player: CaptureBoardPlayer | null;
  color: string;
  onSelect?: () => void;
  compact?: boolean;
  wide?: boolean;
  court?: boolean;
  vacant?: boolean;
  fit?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  pulse?: boolean;
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
        className={`${box} overflow-hidden rounded-md border-2 border-black bg-transparent`}
      />
    );
  }

  const photo = player.avatarUrl || null;
  const blocked = Boolean(player.eliminated && (onSelect || pulse));
  const pick = blocked ? undefined : onSelect;
  const ring = selected
    ? 'ring-4 ring-orange-500'
    : pick
      ? 'cursor-pointer ring-2 ring-orange-400'
      : court
        ? 'ring-2 ring-black ring-offset-1'
        : '';
  const typeSize = photo ? '' : fit ? 'text-2xl' : wide ? (compact ? 'text-lg' : 'text-xl') : compact ? 'text-xl' : 'text-2xl';
  const className = `relative flex flex-col items-center justify-end overflow-hidden rounded-md pb-0.5 font-black tabular-nums leading-none shadow-md ${LABEL_SHADOW} ${box} ${typeSize} ${
    photo ? 'bg-neutral-200' : ''
  } ${wide ? 'border-2 border-black' : ''} ${ring} ${dimmed || blocked ? 'opacity-40' : ''} ${pulse && pick ? 'animate-pulse' : ''}`;
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

  if (pick) {
    return (
      <button type="button" title={player.name} onClick={pick} className={className} style={painted}>
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
  selectedLeftId,
  selectedRightId,
  compact = false,
  pulse = false,
}: {
  leftPlayers: CaptureBoardPlayer[];
  rightPlayers: CaptureBoardPlayer[];
  leftColor: string;
  rightColor: string;
  onSelectLeft?: (playerId: string) => void;
  onSelectRight?: (playerId: string) => void;
  selectedLeftId?: string | null;
  selectedRightId?: string | null;
  compact?: boolean;
  pulse?: boolean;
}) {
  const chip = (
    player: CaptureBoardPlayer,
    color: string,
    onSelect?: (playerId: string) => void,
    selected = false,
  ) => (
    <div key={player.id} className="aspect-square h-full shrink-0">
      <JerseyChip
        player={player}
        color={color}
        fit
        pulse={pulse}
        selected={selected}
        onSelect={onSelect ? () => onSelect(player.id) : undefined}
      />
    </div>
  );

  return (
    <div className={`flex w-full items-stretch justify-center gap-1 ${compact ? 'h-[3.75rem]' : 'h-[4.25rem]'}`}>
      {leftPlayers.slice(0, 5).map((player) => chip(player, leftColor, onSelectLeft, player.id === selectedLeftId))}
      {leftPlayers.length > 0 && rightPlayers.length > 0 ? <span className="w-2 shrink-0" /> : null}
      {rightPlayers.slice(0, 5).map((player) => chip(player, rightColor, onSelectRight, player.id === selectedRightId))}
    </div>
  );
}

function CambioButton({
  label,
  compact = false,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  compact?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full shrink-0 items-center justify-center rounded-lg px-2 text-xl font-black leading-none ${
        disabled
          ? 'cursor-default bg-[#8e9894] text-[#e7eeeb]'
          : active
            ? 'bg-red-800 text-white ring-4 ring-black'
            : 'bg-red-600 text-white'
      } ${compact ? 'h-[3.75rem]' : 'h-[4.25rem]'}`}
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
  onSelect,
  onEdit,
  editLabel,
}: {
  players: CaptureBoardPlayer[];
  color: string;
  compact?: boolean;
  coach?: { name: string } | null;
  onCoach?: () => void;
  onSelect?: (playerId: string) => void;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const roster = [...players].sort((a, b) => a.jersey - b.jersey || a.name.localeCompare(b.name));
  const coachBox = `col-span-2 flex w-full items-center justify-center overflow-hidden rounded-md border-2 border-black px-1 text-center text-[11px] font-black leading-tight shadow-md ${LABEL_SHADOW} ${
    compact ? 'h-14' : 'h-16'
  }`;
  const coachStyle = jerseyFill(color);

  return (
    <div
      className="grid h-full min-h-0 grid-cols-2 content-start gap-2 overflow-y-auto rounded-md p-1"
      style={BENCH_WOOD}
    >
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          title={editLabel}
          aria-label={editLabel}
          className="col-span-2 flex h-12 w-full items-center justify-center rounded-md border-2 border-black bg-white text-black shadow-md"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11.5 4.5 15.5 8.5" />
            <path d="M3.5 16.5 4 13 13.2 3.8a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L7 16l-3.5.5Z" />
          </svg>
        </button>
      ) : null}
      {roster.map((player) => {
        const canEnter = !!onSelect && !player.onCourt && !player.eliminated;
        return (
          <JerseyChip
            key={player.id}
            player={player}
            color={color}
            compact={compact}
            wide
            vacant={!!player.onCourt}
            dimmed={!!player.eliminated && !player.onCourt}
            onSelect={canEnter ? () => onSelect(player.id) : undefined}
          />
        );
      })}
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
  onStepBack,
  onCancelDelete,
  nextLabel,
  onNextPeriod,
  quintetoLabel,
  onQuinteto,
  onBack,
  onEditGame,
  editLabel,
}: {
  stepBackLabel: string;
  hint: string;
  cancelDeleteLabel: string;
  onStepBack?: () => void;
  onCancelDelete?: () => void;
  nextLabel?: string;
  onNextPeriod?: () => void;
  quintetoLabel?: string;
  onQuinteto?: () => void;
  onBack?: () => void;
  onEditGame?: () => void;
  editLabel?: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 items-center gap-1 px-0.5 py-1">
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
      {onEditGame ? <EditGameButton onEditGame={onEditGame} label={editLabel || 'Edit game'} /> : null}
      <button
        type="button"
        disabled={!onStepBack}
        onClick={onStepBack}
        className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-black text-neutral-900 shadow-md disabled:opacity-40 ${ACTION_GRAY}`}
      >
        {stepBackLabel}
      </button>
      <p className="min-w-0 flex-1 overflow-hidden text-center text-sm font-semibold leading-snug text-neutral-800">
        {hint}
      </p>
      <button
        type="button"
        disabled={!onCancelDelete}
        onClick={onCancelDelete}
        className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-black text-neutral-900 shadow-md disabled:opacity-40 ${ACTION_GRAY}`}
      >
        {cancelDeleteLabel}
      </button>
      {onQuinteto ? (
        <button
          type="button"
          onClick={onQuinteto}
          className="shrink-0 whitespace-nowrap rounded-lg bg-neutral-900 px-3 text-[11px] font-black tracking-wide text-white shadow-md"
          style={{ minHeight: '48px' }}
        >
          {quintetoLabel}
        </button>
      ) : null}
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
  ticked = false,
  onClick,
}: {
  label: string;
  disabled: boolean;
  ticked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || ticked}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-base font-black leading-none sm:h-9 sm:px-2 sm:text-lg ${
        ticked
          ? 'bg-white text-black ring-2 ring-black'
          : disabled
            ? 'cursor-default bg-[#8e9894] text-[#e7eeeb]'
            : 'bg-red-600 text-white'
      }`}
    >
      {ticked ? '✓' : label}
    </button>
  );
}

function PossessionDot({ active }: { active: boolean }) {
  return (
    <span className="flex w-12 shrink-0 items-center justify-center self-stretch" aria-hidden="true">
      <span className={`text-4xl leading-none ${active ? 'animate-pulse' : 'opacity-0'}`}>🏀</span>
    </span>
  );
}

function ActionStats({
  fouls,
  foulsLabel,
  timeoutLabel,
  timeoutsUsed,
  timeoutMax,
  onTimeout,
  timeoutEnabled,
  ticked = false,
  compact = false,
}: {
  fouls: number;
  foulsLabel: string;
  timeoutLabel: string;
  timeoutsUsed: number;
  timeoutMax: number;
  onTimeout: () => void;
  timeoutEnabled: boolean;
  ticked?: boolean;
  compact?: boolean;
}) {
  const bonus = fouls >= 5;
  const nearBonus = fouls === 4;
  const row = compact ? 'h-7 px-1' : 'h-8 px-1.5';
  const value = compact ? 'text-sm' : 'text-lg';
  const blocked = !timeoutEnabled && !ticked;

  return (
    <div className="flex w-full shrink-0 flex-col gap-1">
      <button
        type="button"
        disabled={blocked || ticked}
        onClick={onTimeout}
        className={`flex w-full items-center justify-between rounded-lg ${row} ${
          ticked
            ? 'bg-white text-black ring-2 ring-black'
            : blocked
              ? 'cursor-default bg-[#8e9894] text-[#e7eeeb]'
              : 'bg-black text-white shadow-md'
        }`}
        aria-label={`${timeoutLabel} ${timeoutsUsed}/${timeoutMax}`}
      >
        <span className={`truncate text-[10px] font-black tracking-wider ${ticked ? 'text-black' : blocked ? 'text-[#e7eeeb]' : 'text-amber-300'}`}>{timeoutLabel}</span>
        <span className={`${value} font-black tabular-nums leading-none ${ticked || blocked ? '' : LABEL_SHADOW}`}>{ticked ? '✓' : `${timeoutsUsed}/${timeoutMax}`}</span>
      </button>
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

function PersonalBolt({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M9.1 1.1 3.2 9.1h4.1L6.4 14.9 13.2 6.4H8.7L9.1 1.1Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionColumn({
  side,
  activeAction,
  activeSide,
  enabled,
  onAction,
  personalLabel,
  missPersonalLabel,
  direction = 'column',
  splitTurnover = false,
  compact = false,
}: {
  side: 'home' | 'away';
  activeAction: CaptureBoardAction | null;
  activeSide: 'home' | 'away' | null;
  enabled: Record<CaptureBoardAction, boolean>;
  onAction: (side: 'home' | 'away', action: CaptureBoardAction) => void;
  personalLabel: string;
  missPersonalLabel: string;
  direction?: 'column' | 'row';
  splitTurnover?: boolean;
  compact?: boolean;
}) {
  function shotButton(id: 'made' | 'made_personal' | 'miss' | 'miss_personal', label: string) {
    const isActive = activeAction === id && (activeSide != null ? side === activeSide : side === 'home');
    const isEnabled = enabled[id];
    const possessionLocked = !isEnabled;
    const live = isEnabled && !isActive;
    const bolt = id === 'made_personal' || id === 'miss_personal';
    return (
      <button
        key={id}
        type="button"
        disabled={!isEnabled}
        aria-label={bolt ? (id === 'miss_personal' ? missPersonalLabel : personalLabel) : label}
        onClick={() => onAction(side, id)}
        className={`flex min-h-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-center font-black leading-tight tracking-wide ${compact ? 'text-[10px]' : 'text-sm'} ${possessionLocked || live ? '' : LABEL_SHADOW} ${
          live
            ? 'bg-blue-700 text-white shadow-md hover:bg-blue-800'
            : isActive
              ? 'bg-white text-black ring-2 ring-black shadow-md'
              : possessionLocked
                ? `${ACTION_GRAY} cursor-not-allowed text-neutral-900 opacity-30 shadow-none`
                : `${ACTION_GRAY} text-neutral-900 shadow-md hover:bg-[#c8c8c8] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-[#b0b0b0]`
        }`}
      >
        <span>{label}</span>
        {bolt ? <PersonalBolt className={compact ? 'h-3 w-3' : 'h-4 w-4'} /> : null}
      </button>
    );
  }

  return (
    <div className={direction === 'row'
      ? 'flex h-full min-h-0 w-full min-w-0 flex-row gap-1'
      : 'flex h-full min-h-0 w-full min-w-0 flex-col gap-1'}>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {shotButton('made', 'MADE')}
        {shotButton('made_personal', 'MADE')}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {shotButton('miss', 'MISS')}
        {shotButton('miss_personal', 'MISS')}
      </div>
      {ACTIONS.filter((action) => action.id !== 'made' && action.id !== 'miss').map((action) => {
        const isActive = activeAction === action.id && (activeSide != null ? side === activeSide : side === 'home');
        const isEnabled = enabled[action.id];
        const followsPossession = action.id === 'turnover';
        const alwaysAvailable = action.id === 'foul';
        const possessionLocked = followsPossession && !isEnabled;
        const live = isEnabled && !isActive && (followsPossession || alwaysAvailable);
        const stacked = splitTurnover && action.id === 'turnover';
        return (
          <button
            key={action.id}
            type="button"
            disabled={!isEnabled}
            onClick={() => onAction(side, action.id)}
            className={`flex min-h-0 flex-1 items-center justify-center rounded-lg px-1 text-center font-black leading-tight tracking-wide ${compact ? 'text-[10px]' : 'text-sm'} ${direction === 'row' ? 'min-w-0' : 'w-full'} ${possessionLocked || live ? '' : LABEL_SHADOW} ${
              live
                ? 'bg-blue-700 text-white shadow-md hover:bg-blue-800'
                : isActive
                  ? 'bg-white text-black ring-2 ring-black shadow-md'
                  : possessionLocked
                    ? `${ACTION_GRAY} cursor-not-allowed text-neutral-900 opacity-30 shadow-none`
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
  onTimeout,
  timeoutLabel,
  timeoutEnabled,
  ticked,
}: {
  side: 'home' | 'away';
  enabled: boolean;
  onShotClock: (side: 'home' | 'away') => void;
  onEightSeconds: (side: 'home' | 'away') => void;
  onFiveSeconds: (side: 'home' | 'away') => void;
  onTimeout: (side: 'home' | 'away') => void;
  timeoutLabel: string;
  timeoutEnabled: boolean;
  ticked: boolean;
}) {
  return (
    <>
      <ClockViolationButton label="24s" disabled={!enabled} onClick={() => onShotClock(side)} />
      <ClockViolationButton label="8s" disabled={!enabled} onClick={() => onEightSeconds(side)} />
      <ClockViolationButton label="5s" disabled={!enabled} onClick={() => onFiveSeconds(side)} />
      <ClockViolationButton label={timeoutLabel} disabled={!timeoutEnabled} ticked={ticked} onClick={() => onTimeout(side)} />
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
  onFlipCourt,
  onShotClock,
  onEightSeconds,
  onFiveSeconds,
  onTimeout,
  timeoutLabel,
  ticked,
  clockViolationsEnabled,
  timeoutEnabled,
  color,
}: {
  side: 'home' | 'away';
  name: string;
  align: 'start' | 'end';
  active: boolean;
  canSet: boolean;
  onSelect: () => void;
  onFlipCourt?: () => void;
  onShotClock: (side: 'home' | 'away') => void;
  onEightSeconds: (side: 'home' | 'away') => void;
  onFiveSeconds: (side: 'home' | 'away') => void;
  onTimeout: (side: 'home' | 'away') => void;
  timeoutLabel: string;
  ticked: boolean;
  clockViolationsEnabled: boolean;
  timeoutEnabled: boolean;
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
      <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
        <ClockViolationButtons
          side={side}
          enabled={clockViolationsEnabled && active}
          onShotClock={onShotClock}
          onEightSeconds={onEightSeconds}
          onFiveSeconds={onFiveSeconds}
          onTimeout={onTimeout}
          timeoutLabel={timeoutLabel}
          timeoutEnabled={timeoutEnabled}
          ticked={ticked}
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

function scoreboardTone(running: boolean): string {
  return running ? 'bg-green-600' : 'bg-red-600';
}

function pressClockControl(
  event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  enabled: boolean,
  onPress: () => void,
) {
  if (!enabled) return;
  if ('button' in event && event.button !== 0) return;
  if ('key' in event && (event.key !== 'Enter' && event.key !== ' ' || event.repeat)) return;
  event.preventDefault();
  onPress();
}

function ClockReadout({
  dense,
  canControlClock,
  onAdjustClock,
  subscribeClock,
  getClockFace,
}: {
  dense: boolean;
  canControlClock: boolean;
  onAdjustClock: (unit: 'minute' | 'second' | 'tenth', delta: number) => void;
  subscribeClock: (listener: () => void) => () => void;
  getClockFace: () => ClockFace;
}) {
  const face = useSyncExternalStore(subscribeClock, getClockFace, getClockFace);
  const leftUnit = face.lastMinute ? 'second' : 'minute';
  const rightUnit = face.lastMinute ? 'tenth' : 'second';

  return (
    <div className={`flex w-full items-center justify-center gap-1 text-white ${scoreboardTone(face.running)} ${dense ? 'mt-0.5 px-1.5 py-0.5' : 'mt-1 px-2 py-0.5 shadow-sm'}`}>
      <ClockStepper
        value={face.left}
        label={leftUnit}
        disabled={!canControlClock}
        onUp={() => onAdjustClock(leftUnit, 1)}
        onDown={() => onAdjustClock(leftUnit, -1)}
      />
      <span className={`font-black leading-none ${dense ? 'text-2xl' : 'text-3xl'}`}>:</span>
      <ClockStepper
        value={face.right}
        label={rightUnit}
        disabled={!canControlClock}
        onUp={() => onAdjustClock(rightUnit, 1)}
        onDown={() => onAdjustClock(rightUnit, -1)}
      />
    </div>
  );
}

function ScoreboardClock({
  dense,
  periodLabel,
  subscribeClock,
  getClockFace,
  clockRunning,
  canControlClock,
  onAdjustClock,
  onToggleClock,
  idleClockLabel,
}: {
  dense: boolean;
  periodLabel: string;
  subscribeClock: (listener: () => void) => () => void;
  getClockFace: () => ClockFace;
  clockRunning: boolean;
  canControlClock: boolean;
  onAdjustClock: (unit: 'minute' | 'second' | 'tenth', delta: number) => void;
  onToggleClock: () => void;
  idleClockLabel?: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-stretch justify-center px-1">
      <div
        className={`w-full bg-black text-center font-black uppercase tracking-[0.16em] text-white shadow-sm ${
          dense ? 'px-2 py-px text-[10px]' : 'px-3 py-0.5 text-xs'
        } ${clockRunning ? 'animate-pulse' : ''}`}
      >
        {periodLabel}
      </div>
      <ClockReadout
        dense={dense}
        canControlClock={canControlClock}
        onAdjustClock={onAdjustClock}
        subscribeClock={subscribeClock}
        getClockFace={getClockFace}
      />
      <button
        type="button"
        disabled={!canControlClock}
        onPointerDown={(event) => pressClockControl(event, canControlClock, onToggleClock)}
        onKeyDown={(event) => pressClockControl(event, canControlClock, onToggleClock)}
        className={`w-full rounded-lg text-center font-black leading-tight tracking-wider text-white whitespace-normal disabled:cursor-default disabled:opacity-50 ${
          dense ? 'mt-0.5 min-h-9 px-1 py-1 text-[10px]' : 'mt-1 min-h-11 px-2 py-2 text-xs shadow-md'
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

function EditGameButton({ onEditGame, label }: { onEditGame: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onEditGame}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-black shadow-md"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11.5 4.5 15.5 8.5" />
        <path d="M3.5 16.5 4 13 13.2 3.8a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L7 16l-3.5.5Z" />
      </svg>
    </button>
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
  items,
  onUndo,
  canUndo,
}: {
  items: CaptureLogItem[];
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <aside className="ml-1 flex h-full min-h-0 w-52 shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm">
      <header className="flex items-center bg-black px-2 py-1.5 shadow-md">
        <span className="truncate text-[11px] font-black tracking-wider text-amber-300">ACTION LOG</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-neutral-400">No actions yet</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg bg-neutral-200 px-2 py-1.5">
              <div className="text-[10px] font-bold text-neutral-400">
                {item.periodLabel} {item.clock}
              </div>
              <div className="text-[11px] font-black leading-tight text-[rgb(0,0,255)]">{item.title}</div>
              {item.detail ? (
                <div className="whitespace-pre-line text-[11px] leading-tight text-neutral-600">{item.detail}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-neutral-200 p-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="w-full rounded-lg bg-black py-2 text-[11px] font-black tracking-wider text-amber-300 shadow-md hover:text-white disabled:opacity-40"
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
  subscribeClock,
  getClockFace,
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
  homeTimeoutsUsed,
  awayTimeoutsUsed,
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
  onTimeout,
  timeoutTickSide,
  activeAction,
  activeSide,
  onAction,
  madePersonalLabel,
  missPersonalLabel,
  homeActionsEnabled,
  awayTurnoverEnabled,
  hint,
  onStepBack,
  onCancelDelete,
  logItems,
  onUndo,
  canUndo,
  court,
  nextLabel,
  onNextPeriod,
  quintetoLabel,
  onQuinteto,
  onFlipCourt,
  onEditGame,
  editLabel,
  onBack,
  homeCoach,
  awayCoach,
  onHomeCoach,
  onAwayCoach,
  onEditAwayBench,
  editBenchLabel,
  canSetPossession,
  onSetPossession,
  courtPickSide,
  onCourtPlayer,
  cambioSide,
  onCambio,
  benchPickSide,
  onBenchPlayer,
  selectedCourtId,
  homeColor,
  awayColor,
}: CaptureBoardProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false);
  const [courtTurn, setCourtTurn] = useState<0 | 90 | -90>(0);
  const timeoutEnabled = clockViolationsEnabled && !clockRunning;
  const awayActionsEnabled: Record<CaptureBoardAction, boolean> = {
    made: possession === 'away',
    made_personal: possession === 'away',
    miss: possession === 'away',
    miss_personal: possession === 'away',
    foul: true,
    turnover: awayTurnoverEnabled,
  };
  const homeColumnEnabled: Record<CaptureBoardAction, boolean> = {
    ...homeActionsEnabled,
    made: homeActionsEnabled.made && possession === 'home',
    made_personal: homeActionsEnabled.made_personal && possession === 'home',
    miss: homeActionsEnabled.miss && possession === 'home',
    miss_personal: homeActionsEnabled.miss_personal && possession === 'home',
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
      ? 'min(calc(100cqh - 2.75rem), calc(100cqw * 28 / 15))'
      : 'min(100cqw, calc((100cqh - 2.75rem) * 28 / 15))';
    const courtHeight = compact
      ? 'min(100cqw, calc((100cqh - 2.75rem) * 15 / 28))'
      : 'min(calc(100cqh - 2.75rem), calc(100cqw * 15 / 28))';

    return (
    <div
      className="grid h-full min-h-0 min-w-0 flex-1 gap-1"
      style={{
        gridTemplateColumns: `${bench} ${actions} minmax(0,1fr) ${actions} ${bench}`,
        gridTemplateRows: 'auto minmax(0,1fr)',
      }}
    >
      <div className="col-start-1 row-start-1 self-end">
        <CambioButton
          label={cambioLabel}
          compact={compact}
          active={cambioSide === 'home'}
          disabled={clockRunning}
          onClick={() => onCambio('home')}
        />
      </div>
      <div className="col-start-2 row-start-1 self-end">
        <ActionStats
          fouls={homePersonalFouls}
          foulsLabel={foulsLabel}
          timeoutLabel={timeoutLabel}
          timeoutsUsed={homeTimeoutsUsed}
          timeoutMax={timeoutMax}
          onTimeout={() => onTimeout('home')}
          timeoutEnabled={timeoutEnabled}
          ticked={timeoutTickSide === 'home'}
          compact={compact}
        />
      </div>
      <div className="col-start-3 row-start-1 min-w-0 self-stretch">
        <CourtPlayerStrip
          leftPlayers={homePlayers}
          rightPlayers={awayPlayers}
          leftColor={homeColor}
          rightColor={awayColor}
          pulse={courtPickSide === 'both'}
          onSelectLeft={courtPickSide === 'home' || courtPickSide === 'both' ? (playerId) => onCourtPlayer('home', playerId) : undefined}
          onSelectRight={courtPickSide === 'away' || courtPickSide === 'both' ? (playerId) => onCourtPlayer('away', playerId) : undefined}
          selectedLeftId={cambioSide === 'home' ? selectedCourtId : null}
          selectedRightId={cambioSide === 'away' ? selectedCourtId : null}
          compact={compact}
        />
      </div>
      <div className="col-start-4 row-start-1 self-end">
        <ActionStats
          fouls={awayPersonalFouls}
          foulsLabel={foulsLabel}
          timeoutLabel={timeoutLabel}
          timeoutsUsed={awayTimeoutsUsed}
          timeoutMax={timeoutMax}
          onTimeout={() => onTimeout('away')}
          timeoutEnabled={timeoutEnabled}
          ticked={timeoutTickSide === 'away'}
          compact={compact}
        />
      </div>
      <div className="col-start-5 row-start-1 self-end">
        <CambioButton
          label={cambioLabel}
          compact={compact}
          active={cambioSide === 'away'}
          disabled={clockRunning}
          onClick={() => onCambio('away')}
        />
      </div>

      <div className="col-start-1 row-start-2 min-h-0">
        <SideBench
          players={homeBench}
          color={homeColor}
          compact={compact}
          coach={homeCoach}
          onCoach={onHomeCoach}
          onSelect={benchPickSide === 'home' ? (playerId) => onBenchPlayer('home', playerId) : undefined}
        />
      </div>
      <div className="col-start-2 row-start-2 flex min-h-0">
        <ActionColumn
          side="home"
          activeAction={activeAction}
          activeSide={activeSide}
          enabled={homeColumnEnabled}
          onAction={onAction}
          personalLabel={madePersonalLabel}
          missPersonalLabel={missPersonalLabel}
          splitTurnover={compact}
          compact={compact}
        />
      </div>
      <div
        className="col-start-3 row-start-2 min-h-0 min-w-0 overflow-hidden bg-[#e4e0d8]"
        style={{ containerType: 'size' }}
      >
        <div
          className="grid h-full min-h-0"
          style={{ gridTemplateRows: `${courtHeight} minmax(0, 1fr)` }}
        >
          <div className="flex min-h-0 items-start justify-center overflow-hidden">
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
          <HintBar
            stepBackLabel={stepBackLabel}
            hint={hint}
            cancelDeleteLabel={cancelDeleteLabel}
            onStepBack={onStepBack}
            onCancelDelete={onCancelDelete}
            nextLabel={nextLabel}
            onNextPeriod={onNextPeriod}
            quintetoLabel={quintetoLabel}
            onQuinteto={onQuinteto}
            onBack={onBack}
            onEditGame={onEditGame}
            editLabel={editLabel}
          />
        </div>
      </div>
      <div className="col-start-4 row-start-2 flex min-h-0">
        <ActionColumn
          side="away"
          activeAction={activeAction}
          activeSide={activeSide}
          enabled={awayActionsEnabled}
          onAction={onAction}
          personalLabel={madePersonalLabel}
          missPersonalLabel={missPersonalLabel}
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
          onEdit={onEditAwayBench}
          editLabel={editBenchLabel}
          onSelect={benchPickSide === 'away' ? (playerId) => onBenchPlayer('away', playerId) : undefined}
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
            {onFlipCourt ? (
              <div className="flex shrink-0 items-center gap-1 self-center">
                <FlipCourtButton onFlipCourt={onFlipCourt} />
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
              subscribeClock={subscribeClock}
              getClockFace={getClockFace}
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
          <div className="mb-3 flex shrink-0 items-center justify-between gap-1 overflow-x-auto px-1 pt-1 sm:mb-4 md:mb-5">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <PossessionDot active={possession === 'home'} />
              <ClockViolationButtons
                side="home"
                enabled={clockViolationsEnabled && possession === 'home'}
                onShotClock={onShotClock}
                onEightSeconds={onEightSeconds}
                onFiveSeconds={onFiveSeconds}
                onTimeout={onTimeout}
                timeoutLabel={timeoutLabel}
                timeoutEnabled={timeoutEnabled}
                ticked={timeoutTickSide === 'home'}
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
              <div className="flex flex-row-reverse items-center gap-1">
                <ClockViolationButtons
                  side="away"
                  enabled={clockViolationsEnabled && possession === 'away'}
                  onShotClock={onShotClock}
                  onEightSeconds={onEightSeconds}
                  onFiveSeconds={onFiveSeconds}
                  onTimeout={onTimeout}
                  timeoutLabel={timeoutLabel}
                  timeoutEnabled={timeoutEnabled}
                  ticked={timeoutTickSide === 'away'}
                />
              </div>
              <PossessionDot active={possession === 'away'} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 gap-1 px-1 pb-1">
            {floor(true)}
            <ActionLog
              items={logItems}
              onUndo={onUndo}
              canUndo={canUndo}
            />
          </div>
        </>
      ) : (
        <>
      <div className="mb-3 flex items-stretch gap-2 px-2 pt-2 sm:mb-4 md:mb-5">
        <TeamNamePlate
          side="home"
          name={homeName}
          align="start"
          active={possession === 'home'}
          canSet={canSetPossession}
          onSelect={() => onSetPossession('home')}
          onFlipCourt={onFlipCourt}
          onShotClock={onShotClock}
          onEightSeconds={onEightSeconds}
          onFiveSeconds={onFiveSeconds}
          onTimeout={onTimeout}
          timeoutLabel={timeoutLabel}
          ticked={timeoutTickSide === 'home'}
          clockViolationsEnabled={clockViolationsEnabled}
          timeoutEnabled={timeoutEnabled}
          color={homeColor}
        />

        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center bg-blue-700 text-white shadow-sm">
          <span className="text-4xl font-black tabular-nums leading-none">{homeScore}</span>
        </div>

        <ScoreboardClock
          dense={false}
          periodLabel={periodLabel}
          subscribeClock={subscribeClock}
          getClockFace={getClockFace}
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
          onTimeout={onTimeout}
          timeoutLabel={timeoutLabel}
          ticked={timeoutTickSide === 'away'}
          clockViolationsEnabled={clockViolationsEnabled}
          timeoutEnabled={timeoutEnabled}
          color={awayColor}
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-1 px-1 pb-1">
        {floor(false)}
        <ActionLog
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
