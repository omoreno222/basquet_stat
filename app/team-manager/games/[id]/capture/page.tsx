'use client';

import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BasketballCourt } from './components/BasketballCourt';
import { CaptureBoard, type CaptureBoardAction } from './components/CaptureBoard';
import { FreeThrowSequencePopup, type FreeThrowSequenceResult } from './components/FreeThrowSequencePopup';
import { JumpBallPopup, type JumpBallResult } from './components/JumpBallPopup';
import { OpponentBenchAddModal } from './components/OpponentBenchAddModal';
import { OpponentRosterModal, type OpponentRosterInput } from './components/OpponentRosterModal';
import { SquadPickerModal } from './components/SquadPickerModal';
import { PeriodLineupModal } from './components/PeriodLineupModal';
import { SubstitutionPopup, type SubstitutionChoice, type SubstitutionSwap } from './components/SubstitutionPopup';
import { ChooseSideModal } from './components/ChooseSideModal';
import { TurnoverReasonModal } from './components/TurnoverReasonModal';
import { FoulSituationModal } from './components/FoulSituationModal';
import { CaptureNoticeModal } from './components/CaptureNoticeModal';
import { MadeAssistPopup, MadeFreeThrowCountPopup } from './components/MadeShotPopups';
import { PeriodInboundModal } from './components/PeriodInboundModal';
import { commitCapturePlay } from './actions';
import {
  missChooseFouler,
  missChooseRebounder,
  missChooseShooter,
  missChooseThrowCount,
  missCourtTap,
  missStepBack,
  missStopsClock,
  openMiss,
  type MissDraft,
} from '@/lib/capture/miss';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import {
  clockViolationCountsAsTeamFoul,
  foulCountsForPlayer,
  foulCountsForTeam,
  foulEjects,
  foulOrdinalCopy,
  foulKindFallback,
  foulKindKey,
  foulKinds,
  foulNeedsOther,
  foulThrowAllowance,
  madeAssistRequired,
  madeStopsClock,
  offenseAttacksRight,
  otherCaptureSide,
  shotInPaint,
  shotOnAttackingHalf,
  shotValueFromWorld,
  turnoverReasonFallback,
  turnoverReasonKey,
  turnoverReasons,
  turnoverStopsClock,
  type CaptureSide,
  type ClockViolation,
  type FoulContext,
  type FoulKind,
  type FreeThrowMark,
  type TurnoverReason,
} from '@/lib/capture/plays';
import { normalizeHexColor } from '@/lib/colors';
import { gameSquadSchema, incorporatePlayerSchema, openingTipWinnerSchema, opponentBenchAddSchema, opponentRosterSchema, periodLineupSchema, schemaError } from '@/lib/form-schemas';
import { userCanEditGame, userManagesClub } from '@/lib/live-access';
import { canStartPeriod, isEliminated, minimumToStart } from '@/lib/period-lineup';
import { nextClockFromRemote } from '@/lib/capture/clock-sync';
import { clockFace, liveRemaining, sameClockFace, type ClockFace } from '@/lib/capture/clock-run';
import { periodInbound } from '@/lib/capture/period-inbound';
import { onCourtAfterSubs } from '@/lib/capture/substitutions';
import { countTimeouts, periodOutcome, timeoutWindow } from '@/lib/capture/timeouts';
import { Profile } from '@/lib/types';
import type { GameOpponentPlayer } from '@/types/database';

const TURNOVER_REASON_CLOSE_MS = 600;
const TIMEOUT_TICK_MS = 300;

function opponentShirt(player: GameOpponentPlayer) {
  return player.jersey_number ?? 0;
}

function readTipWinner(value: unknown): 'home' | 'away' | null {
  const parsed = openingTipWinnerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isInvertedLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const orientation = window.screen?.orientation;
  if (orientation?.type) return orientation.type === 'landscape-secondary';
  if (window.innerWidth <= window.innerHeight) return false;
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (legacy === 90) return true;
  if (typeof orientation?.angle === 'number') {
    const angle = ((orientation.angle % 360) + 360) % 360;
    return angle === 180 || angle === 270;
  }
  return false;
}

interface Player {
  id: string;
  full_name: string;
  jersey_number: number;
  avatar_url: string | null;
  is_guest?: boolean;
  guest_team_name?: string;
  jersey_override?: number;
}

interface Game {
  id: string;
  team_id: string;
  opponent_name: string;
  opponent_color?: string;
  kit_color?: 'primary' | 'secondary';
  opponent_score: number;
  team_score: number;
  is_home: boolean;
  venue?: string;
  game_date: string;
  status: string;
  official?: boolean;
  clock_running: boolean;
  clock_remaining_ms: number;
  current_period: number;
  possession: 'home' | 'away' | null;
  opening_tip_winner?: 'home' | 'away' | null;
  attack_right_first: boolean;
  created_at?: string;
  updated_at?: string;
  teams?: {
    name: string;
    club_id?: string;
    coach_id?: string | null;
    clubs?: { name?: string; logo_url?: string | null; primary_color?: string; secondary_color?: string } | null;
  };
}

interface PeriodLineupRow {
  period_number: number;
  side: 'home' | 'away';
  position_index: number;
  player_id: string | null;
  opponent_player_id: string | null;
}

interface GameEvent {
  id: string;
  game_id: string;
  player_id?: string;
  player_out_id?: string;
  opponent_player_out_id?: string | null;
  event_type: string;
  period_number: number;
  clock_remaining_ms: number;
  elapsed_ms: number;
  points?: number;
  made?: boolean;
  coord_x?: number;
  coord_y?: number;
  foul_type?: string;
  free_throws_awarded?: number;
  is_offensive?: boolean;
  turnover_type?: string | null;
  turnover_side?: 'home' | 'away' | null;
  timeout_side?: 'home' | 'away' | null;
  opponent_player_id?: string | null;
  coach_technical_side?: 'home' | 'away' | null;
  foul_side?: 'home' | 'away' | null;
  foul_context?: string | null;
  shot_value?: number | null;
  play_group_id?: string | null;
  possession_before?: 'home' | 'away' | null;
  recorded_by_user_id: string;
  created_at: string;
  player?: Player;
  player_out?: Player;
}

type CaptureNotice =
  | { kind: 'timeout_cap'; body: string }
  | { kind: 'period_ended' }
  | { kind: 'attack_change' }
  | { kind: 'overtime' }
  | { kind: 'final' };

/**
 * COORDINATE SYSTEM CONVENTION:
 * 
 * WORLD COORDINATES (what we display and where users tap):
 * - Full court: x ∈ [0, 1] from left to right, y ∈ [0, 1] from top to bottom
 * - Left basket at x ≈ 0.025, right basket at x ≈ 0.975
 * 
 * NORMALIZED ATTACKING COORDINATES (what we store in DB):
 * - Always stored as if attacking the RIGHT basket (x ≈ 0.975)
 * - This makes shot charts/heatmaps consistent across periods
 * - coord_x and coord_y in game_events table use this convention
 * 
 * TRANSFORMATION:
 * - When attacking right (Q1-Q2 if attack_right_first=true, Q3-Q4 if false):
 *   normalized_x = world_x, normalized_y = world_y
 * - When attacking left (Q3-Q4 if attack_right_first=true, Q1-Q2 if false):
 *   normalized_x = 1 - world_x (horizontal flip)
 *   normalized_y = world_y (vertical stays same)
 * 
 * DISPLAY TRANSFORMATION (for shot markers):
 * - Reverse the above: if we're attacking left, flip stored coords back to world
 */

/**
 * Get FIBA period label (Q1-Q4, OT1, OT2, ...)
 */
function opponentMark(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}

function getPeriodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

function playStep(type: string): number {
  if (type === 'free_throw') return 4;
  if (type === 'foul') return 3;
  if (type === 'rebound') return 2;
  if (type === 'shot') return 1;
  return 0;
}

function newerCaptureEvent(
  a: { period_number: number; clock_remaining_ms: number; created_at?: string | null; event_type: string },
  b: { period_number: number; clock_remaining_ms: number; created_at?: string | null; event_type: string },
): number {
  if (a.period_number !== b.period_number) return b.period_number - a.period_number;
  if (a.clock_remaining_ms !== b.clock_remaining_ms) return a.clock_remaining_ms - b.clock_remaining_ms;
  const aAt = a.created_at ?? '';
  const bAt = b.created_at ?? '';
  if (aAt !== bAt) return aAt < bAt ? 1 : -1;
  return playStep(b.event_type) - playStep(a.event_type);
}

function scoreAfterMadeShots(events: GameEvent[]): Map<string, string> {
  const scores = new Map<string, string>();
  let home = 0;
  let away = 0;
  const ordered = [...events].sort((a, b) => newerCaptureEvent(b, a));
  for (const event of ordered) {
    const scoring = (event.event_type === 'shot' || event.event_type === 'free_throw')
      && event.made
      && event.points;
    if (scoring) {
      if (event.player_id) home += event.points ?? 0;
      else if (event.opponent_player_id) away += event.points ?? 0;
    }
    if ((event.event_type === 'shot' || event.event_type === 'free_throw') && event.made) {
      scores.set(event.id, `${home}-${away}`);
    }
  }
  return scores;
}

export default function GameCapturePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [canEditGame, setCanEditGame] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  
  // Game state
  const [clockRunning, setClockRunning] = useState(false);
  const [clockRemaining, setClockRemaining] = useState(600000);
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const [possession, setPossession] = useState<'home' | 'away' | null>('home');
  const [teamScore, setTeamScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [attackRightFirst, setAttackRightFirst] = useState(true);
  const [tableOnFarSideline, setTableOnFarSideline] = useState(false);

  useLayoutEffect(() => {
    const apply = () => {
      const next = isInvertedLandscape();
      setTableOnFarSideline((prev) => (prev === next ? prev : next));
    };
    apply();
    screen.orientation?.addEventListener('change', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('resize', apply);
    return () => {
      screen.orientation?.removeEventListener('change', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);

  // UI state
  const [tapCoordinates, setTapCoordinates] = useState<{ x: number; y: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<CaptureBoardAction | null>(null);
  const [boardNote, setBoardNote] = useState<string | null>(null);
  const [turnoverSide, setTurnoverSide] = useState<CaptureSide | null>(null);
  const [turnoverStep, setTurnoverStep] = useState<'court' | 'player' | 'reason' | null>(null);
  const [turnoverOffenderId, setTurnoverOffenderId] = useState<string | null>(null);
  const [showTurnoverMenu, setShowTurnoverMenu] = useState(false);
  const [turnoverReasonPicked, setTurnoverReasonPicked] = useState<TurnoverReason | null>(null);
  const [turnoverSaving, setTurnoverSaving] = useState(false);
  const turnoverSavingRef = useRef(false);
  const turnoverPickRef = useRef<TurnoverReason | null>(null);
  const turnoverCloseTimer = useRef<number | null>(null);
  const clockViolationRef = useRef(false);
  const [foulSide, setFoulSide] = useState<CaptureSide | null>(null);
  const [foulStep, setFoulStep] = useState<'court' | 'player' | 'type' | 'other' | null>(null);
  const [foulOffenderId, setFoulOffenderId] = useState<string | null>(null);
  const [foulKind, setFoulKind] = useState<FoulKind | null>(null);
  const [foulContext, setFoulContext] = useState<FoulContext | null>(null);
  const [foulCoach, setFoulCoach] = useState(false);
  const [foulOffense, setFoulOffense] = useState(false);
  const [foulPick, setFoulPick] = useState<string | null>(null);
  const [foulThrowCount, setFoulThrowCount] = useState<1 | 2 | 3 | null>(null);
  const [showFoulThrowCount, setShowFoulThrowCount] = useState(false);
  const foulSavingRef = useRef(false);
  const foulPickRef = useRef<string | null>(null);
  const foulCloseTimer = useRef<number | null>(null);
  const [shotSide, setShotSide] = useState<CaptureSide | null>(null);
  const [shotStep, setShotStep] = useState<'court' | 'shooter' | 'assist' | 'fouler' | 'ft' | null>(null);
  const [shotPersonal, setShotPersonal] = useState(false);
  const [shotThrowCount, setShotThrowCount] = useState<1 | 2 | 3 | null>(null);
  const [shotShooterId, setShotShooterId] = useState<string | null>(null);
  const [shotAssistId, setShotAssistId] = useState<string | null>(null);
  const [shotFoulerId, setShotFoulerId] = useState<string | null>(null);
  const [shotPoints, setShotPoints] = useState<2 | 3 | null>(null);
  const [shotPaint, setShotPaint] = useState(false);
  const [shotSaving, setShotSaving] = useState(false);
  const shotSavingRef = useRef(false);
  const shotPersonalRef = useRef(false);
  const shotWasRunningRef = useRef(false);
  const shotClockAtRef = useRef<number | null>(null);
  const [miss, setMiss] = useState<MissDraft | null>(null);
  const [missSaving, setMissSaving] = useState(false);
  const missSavingRef = useRef(false);
  const missWasRunningRef = useRef(false);
  const missClockAtRef = useRef<number | null>(null);
  const foulDraftRef = useRef<{
    side: CaptureSide;
    kind: FoulKind;
    context: FoulContext;
    offenderId: string | null;
    otherId: string | null;
    coach: boolean;
    throws: FreeThrowMark[];
  } | null>(null);
  const [subSide, setSubSide] = useState<CaptureSide | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const subSavingRef = useRef(false);

  useEffect(() => () => {
    if (turnoverCloseTimer.current !== null) window.clearTimeout(turnoverCloseTimer.current);
    if (foulCloseTimer.current !== null) window.clearTimeout(foulCloseTimer.current);
    if (timeoutTickTimer.current !== null) window.clearTimeout(timeoutTickTimer.current);
  }, []);
  
  // New lineup and action modals
  const [showFreeThrowScript, setShowFreeThrowScript] = useState(false);
  const [showJumpBall, setShowJumpBall] = useState(false);
  const [showOpponentRoster, setShowOpponentRoster] = useState(false);
  const [showOpponentBenchAdd, setShowOpponentBenchAdd] = useState(false);
  const [opponentPlayers, setOpponentPlayers] = useState<GameOpponentPlayer[]>([]);
  const [periodLineups, setPeriodLineups] = useState<PeriodLineupRow[]>([]);
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [homeCoachName, setHomeCoachName] = useState<string | null>(null);
  const [showSquad, setShowSquad] = useState(false);
  const [showPeriodLineup, setShowPeriodLineup] = useState(false);
  const [showInbound, setShowInbound] = useState(false);
  const [inboundFlipped, setInboundFlipped] = useState<'home' | 'away' | null>(null);
  const [openingTipWinner, setOpeningTipWinner] = useState<'home' | 'away' | null>(null);
  const openingTipWinnerRef = useRef<'home' | 'away' | null>(null);
  const inboundAnsweredPeriodRef = useRef<number | null>(null);
  const [showChooseSide, setShowChooseSide] = useState(false);
  const [sideChosen, setSideChosen] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<CaptureNotice | null>(null);
  const [timeoutTickSide, setTimeoutTickSide] = useState<CaptureSide | null>(null);
  const timeoutTickTimer = useRef<number | null>(null);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockRunningRef = useRef(false);
  const clockRemainingRef = useRef(600000);
  const clockEndsAtRef = useRef<number | null>(null);
  const clockListenersRef = useRef(new Set<() => void>());
  const clockFaceRef = useRef<ClockFace>(clockFace(false, 600000));
  const adoptClockRef = useRef<(running: boolean, remainingMs: number, period?: number, own?: boolean) => void>(() => {});
  const updateGameStateRef = useRef<(updates: Partial<Game>) => Promise<boolean>>(async () => false);
  const currentPeriodRef = useRef(1);
  // After this tablet starts, stops, or edits the clock, its on-screen
  // value wins over the row Postgres echoes back.
  const clockOwnedRef = useRef(false);
  const requestPeriodEndRef = useRef<(source: 'clock' | 'next') => void>(() => {});
  const noticeOpenRef = useRef(false);
  const periodEndBusyRef = useRef(false);
  const teamScoreRef = useRef(0);
  const opponentScoreRef = useRef(0);
  const gameStatusRef = useRef('');
  teamScoreRef.current = teamScore;
  opponentScoreRef.current = opponentScore;
  gameStatusRef.current = game?.status ?? '';

  function releaseClockInterval() {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
  }

  function clockNow(now = Date.now()) {
    const ms = liveRemaining(
      clockRunningRef.current,
      clockRemainingRef.current,
      clockEndsAtRef.current,
      now,
    );
    clockRemainingRef.current = ms;
    return ms;
  }

  function publishFace() {
    const next = clockFace(clockRunningRef.current, clockRemainingRef.current);
    if (sameClockFace(clockFaceRef.current, next)) return;
    clockFaceRef.current = next;
    clockListenersRef.current.forEach((listener) => listener());
  }

  function armTicker() {
    releaseClockInterval();
    const endsAt = clockEndsAtRef.current;
    if (!clockRunningRef.current || endsAt == null) return;
    clockIntervalRef.current = setInterval(() => {
      if (clockEndsAtRef.current !== endsAt || !clockRunningRef.current) return;
      const remaining = liveRemaining(true, 0, endsAt, Date.now());
      clockRemainingRef.current = remaining;
      if (remaining > 0) {
        publishFace();
        return;
      }
      clockRunningRef.current = false;
      clockEndsAtRef.current = null;
      clockOwnedRef.current = true;
      releaseClockInterval();
      setClockRunning(false);
      setClockRemaining(0);
      publishFace();
      requestPeriodEndRef.current('clock');
      void updateGameStateRef.current({ clock_running: false, clock_remaining_ms: 0 });
    }, 50);
  }

  function adoptClock(running: boolean, remainingMs: number, period?: number, own = false) {
    releaseClockInterval();
    const ms = Math.max(0, Math.round(remainingMs));
    const active = running && ms > 0;
    if (own) clockOwnedRef.current = true;
    clockRunningRef.current = active;
    clockRemainingRef.current = ms;
    clockEndsAtRef.current = active ? Date.now() + ms : null;
    if (period != null) {
      currentPeriodRef.current = period;
      setCurrentPeriod(period);
    }
    setClockRunning(active);
    setClockRemaining(ms);
    publishFace();
    if (active) armTicker();
  }

  function holdClock(running: boolean, remainingMs: number, period?: number) {
    adoptClock(running, remainingMs, period, true);
  }

  adoptClockRef.current = adoptClock;

  const subscribeClock = useCallback((listener: () => void) => {
    clockListenersRef.current.add(listener);
    return () => {
      clockListenersRef.current.delete(listener);
    };
  }, []);

  const getClockFace = useCallback(() => clockFaceRef.current, []);

  // Derive on-court players from starting lineup + substitution events using useMemo
  // This ensures it's always up-to-date and avoids stale closure issues
  const homeLineupIds = periodLineups
    .filter((row) => row.period_number === currentPeriod && row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayLineupIds = periodLineups
    .filter((row) => row.period_number === currentPeriod && row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);

  const onCourtPlayerIds = useMemo(() => {
    return onCourtAfterSubs(homeLineupIds, events, currentPeriod, 'home');
  }, [homeLineupIds, events, currentPeriod]);

  const awayOnCourtIds = useMemo(() => {
    return onCourtAfterSubs(awayLineupIds, events, currentPeriod, 'away');
  }, [awayLineupIds, events, currentPeriod]);

  // Helper to get period length in milliseconds (FIBA rules)
  // Q1-Q4: 10 minutes (600,000 ms)
  // Q5+: 5 minutes (300,000 ms) overtime
  const getPeriodLengthMs = (period: number): number => {
    return period <= 4 ? 600000 : 300000;
  };

  // Determine which basket we're attacking based on period and initial direction
  // FIBA: Switch at halftime. Q1-Q2 one direction, Q3-Q4+ the other.
  const isAttackingRight = () => {
    const isFirstHalf = currentPeriod <= 2;
    return isFirstHalf ? attackRightFirst : !attackRightFirst;
  };

  // Transform world coordinates to normalized attacking coordinates (for storage)
  const worldToNormalized = (worldX: number, worldY: number) => {
    const attacking = isAttackingRight();
    return {
      x: attacking ? worldX : 1 - worldX,
      y: worldY,
    };
  };

  // Transform normalized attacking coordinates to world coordinates (for display)
  const normalizedToWorld = (normX: number, normY: number) => {
    const attacking = isAttackingRight();
    return {
      x: attacking ? normX : 1 - normX,
      y: normY,
    };
  };

  const updateGameState = useCallback(async (updates: Partial<Game>) => {
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);

    if (error) console.error('Failed to update game state:', error);
    return !error;
  }, [gameId]);

  updateGameStateRef.current = updateGameState;

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setCurrentUser(profile);

    const { data: roleRows } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);
    const roles = roleRows && roleRows.length > 0
      ? roleRows
      : [{ role: profile?.role ?? '', club_id: null }];

    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*, teams(name, club_id, coach_id, clubs(name, logo_url, primary_color, secondary_color))')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      setLoadError(gameError?.message || 'Game not found');
      setLoading(false);
      return;
    }

    if (gameData) {
      const assigned = userManagesClub(roles, gameData.teams?.club_id ?? null);
      setAllowed(assigned);
      setCanEditGame(userCanEditGame(roles, gameData.teams?.club_id ?? null));
      if (!assigned) {
        setLoading(false);
        return;
      }

      setLoadError(null);
      setGame(gameData);
      if (!clockOwnedRef.current) {
        const period = gameData.current_period || 1;
        const remaining = gameData.clock_remaining_ms ?? getPeriodLengthMs(period);
        adoptClockRef.current(Boolean(gameData.clock_running), remaining, period, Boolean(gameData.clock_running));
      }
      setPossession(gameData.possession || 'home');
      setTeamScore(gameData.team_score || 0);
      setOpponentScore(gameData.opponent_score || 0);
      setAttackRightFirst(gameData.attack_right_first ?? true);
      const tipWinner = readTipWinner(gameData.opening_tip_winner);
      openingTipWinnerRef.current = tipWinner;
      setOpeningTipWinner(tipWinner);
      
      // Check if side has been chosen (if game has started or events exist, side was chosen)
      const hasStarted = gameData.current_period > 0 || (gameData.team_score + gameData.opponent_score) > 0;
      setSideChosen(hasStarted);

      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', gameData.team_id)
        .order('jersey_number');

      // Load guest players for this game
      const { data: guestsData } = await supabase
        .from('game_guest_players')
        .select('player_id, jersey_override, players(id, full_name, jersey_number, avatar_url, teams(name))')
        .eq('game_id', gameId);

      // Merge regular and guest players
      const regularPlayers = (playersData || []).map(p => ({
        ...p,
        is_guest: false,
      }));

      // Load guest players with joined data (complex Supabase nested query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const guestPlayers = (guestsData || []).map((g: any) => {
        const player = g.players;
        return {
          id: player.id,
          full_name: player.full_name,
          jersey_number: g.jersey_override || player.jersey_number,
          avatar_url: player.avatar_url,
          is_guest: true,
          guest_team_name: player.teams?.name,
          jersey_override: g.jersey_override || undefined,
        };
      });

      setPlayers([...regularPlayers, ...guestPlayers]);

      const { data: eventsData } = await supabase
        .from('game_events')
        .select(`
          *, 
          player:players!game_events_player_id_fkey(full_name, jersey_number),
          player_out:players!game_events_player_out_id_fkey(full_name, jersey_number)
        `)
        .eq('game_id', gameId)
        .order('created_at', { ascending: false });

      setEvents(eventsData || []);

      if (gameData.teams?.coach_id) {
        const { data: coachProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', gameData.teams.coach_id)
          .single();
        setHomeCoachName(coachProfile?.full_name?.trim() || t('trke_team_coach', 'Coach'));
      } else {
        setHomeCoachName(null);
      }

      const periodLength = (gameData.current_period || 1) <= 4 ? 600000 : 300000;
      const started = (gameData.current_period || 1) > 1
        || Boolean(gameData.clock_running)
        || (gameData.clock_remaining_ms ?? periodLength) < periodLength
        || (eventsData || []).length > 0;

      const [{ data: squadData }, { data: periodData }, { data: legacyHome }, { data: legacyAway }] = await Promise.all([
        supabase.from('game_squads').select('player_id').eq('game_id', gameId),
        supabase.from('game_period_lineups').select('period_number, side, position_index, player_id, opponent_player_id').eq('game_id', gameId),
        supabase.from('starting_lineups').select('player_id, position_index').eq('game_id', gameId).order('position_index'),
        supabase.from('game_opponent_lineups').select('opponent_player_id, position_index').eq('game_id', gameId).order('position_index'),
      ]);

      let nextSquad = (squadData || []).map((row) => row.player_id);
      if (regularPlayers.length > 0 && regularPlayers.length <= 12) {
        const desired = regularPlayers.map((player) => player.id);
        const same = desired.length === nextSquad.length && desired.every((id) => nextSquad.includes(id));
        if (!same && nextSquad.length === 0) {
          const { error: insertError } = await supabase
            .from('game_squads')
            .insert(desired.map((playerId) => ({ game_id: gameId, player_id: playerId })));
          if (!insertError) nextSquad = desired;
        } else if (!same && !started) {
          const { error: clearError } = await supabase.from('game_squads').delete().eq('game_id', gameId);
          if (!clearError) {
            const { error: insertError } = await supabase
              .from('game_squads')
              .insert(desired.map((playerId) => ({ game_id: gameId, player_id: playerId })));
            if (!insertError) nextSquad = desired;
          }
        }
      }
      setSquadIds(nextSquad);

      let nextLineups = (periodData || []) as PeriodLineupRow[];
      const hasHomeLineup = nextLineups.some((row) => row.side === 'home' && row.player_id);
      const hasAwayLineup = nextLineups.some((row) => row.side === 'away' && row.opponent_player_id);
      if (!hasHomeLineup) {
        nextLineups = [
          ...nextLineups,
          ...(legacyHome || []).map((row) => ({
            period_number: 1,
            side: 'home' as const,
            position_index: row.position_index,
            player_id: row.player_id,
            opponent_player_id: null,
          })),
        ];
      }
      if (!hasAwayLineup) {
        nextLineups = [
          ...nextLineups,
          ...(legacyAway || []).map((row) => ({
            period_number: 1,
            side: 'away' as const,
            position_index: row.position_index,
            player_id: null,
            opponent_player_id: row.opponent_player_id,
          })),
        ];
      }
      setPeriodLineups(nextLineups);

      const { data: rosterData } = await supabase
        .from('game_opponent_players')
        .select('id, game_id, jersey_number, name, is_coach, created_at')
        .eq('game_id', gameId)
        .order('jersey_number');
      setOpponentPlayers(rosterData || []);

    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, router]);
  
  // REMOVED loadData from dependencies of setupRealtimeSubscription
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabase
      .channel(`game:${gameId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('game_events')
            .select(`
              *, 
              player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
              player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setEvents(prev => {
              if (prev.some((event) => event.id === data.id)) return prev;
              return [data, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setEvents(prev => {
            const filtered = prev.filter(e => e.id !== payload.old.id);
            // On-court lineup automatically re-derived via useMemo when events change
            return filtered;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload: { new: Game }) => {
          if (payload.new) {
            const newData = payload.new;
            if (!clockOwnedRef.current) {
              const clock = nextClockFromRemote(
                {
                  running: clockRunningRef.current,
                  remainingMs: clockRemainingRef.current,
                  period: currentPeriodRef.current,
                },
                {
                  running: Boolean(newData.clock_running),
                  remainingMs: newData.clock_remaining_ms,
                  period: newData.current_period || currentPeriodRef.current,
                },
                false,
              );
              adoptClockRef.current(clock.running, clock.remainingMs, clock.period, false);
            }
            if (newData.possession === 'home' || newData.possession === 'away' || newData.possession === null) {
              setPossession(newData.possession);
            }
            setTeamScore(newData.team_score);
            setOpponentScore(newData.opponent_score);
            if (newData.attack_right_first !== undefined) {
              setAttackRightFirst(newData.attack_right_first);
            }
            const tipWinner = readTipWinner(newData.opening_tip_winner);
            if (tipWinner) {
              openingTipWinnerRef.current = tipWinner;
              setOpeningTipWinner(tipWinner);
            }

            setGame((prev) => ({ ...prev, ...newData }) as Game);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_period_lineups',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          const { data } = await supabase
            .from('game_period_lineups')
            .select('period_number, side, position_index, player_id, opponent_player_id')
            .eq('game_id', gameId);
          if (data) setPeriodLineups(data);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_opponent_players',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          const { data } = await supabase
            .from('game_opponent_players')
            .select('id, game_id, jersey_number, name, is_coach, created_at')
            .eq('game_id', gameId)
            .order('jersey_number');
          setOpponentPlayers(data || []);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_squads',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          const { data } = await supabase
            .from('game_squads')
            .select('player_id')
            .eq('game_id', gameId);
          if (data) setSquadIds(data.map((row) => row.player_id));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_guest_players',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          // Reload players when guests change
          loadData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [gameId]);

  // Effects: run on mount and handle clock ticker
  useEffect(() => {
    loadData();
    const cleanup = setupRealtimeSubscription();
    return () => cleanup();
    // Only run on mount and when gameId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const opponentLineupLocked = events.length > 0 || clockRunning || clockRemaining < getPeriodLengthMs(currentPeriod) || currentPeriod > 1;
  const opponentPlaying = opponentPlayers.filter((player) => !player.is_coach);
  const awayCoach = opponentPlayers.find((player) => player.is_coach);
  const awayCoachName = awayCoach
    ? (awayCoach.name?.trim() || t('trke_opponent_roster_coach', 'Coach'))
    : null;
  const opponentEventIds = new Set(
    events.flatMap((event) => (event.opponent_player_id ? [event.opponent_player_id] : [])),
  );
  const opponentInStartedLineup = new Set(
    periodLineups.flatMap((row) => {
      if (row.side !== 'away' || !row.opponent_player_id) return [];
      const periodStarted = row.period_number < currentPeriod
        || events.some((event) => event.period_number === row.period_number);
      return periodStarted ? [row.opponent_player_id] : [];
    }),
  );
  const opponentRosterDraft = [...opponentPlayers]
    .sort((a, b) => Number(a.is_coach) - Number(b.is_coach) || (a.jersey_number ?? 100) - (b.jersey_number ?? 100))
    .map((player) => ({
      key: player.id,
      id: player.id,
      jerseyNumber: player.jersey_number == null ? '' : String(player.jersey_number),
      name: player.name ?? '',
      isCoach: player.is_coach,
      removable: !opponentEventIds.has(player.id) && !opponentInStartedLineup.has(player.id),
    }));

  useEffect(() => {
    if (loading || !allowed || opponentLineupLocked || opponentPlaying.length > 0) return;
    setShowOpponentRoster(true);
  }, [loading, allowed, opponentLineupLocked, opponentPlaying.length]);

  useEffect(() => {
    if (!clockRunning || !subSide || subSavingRef.current) return;
    setSubSide(null);
    setSubError(null);
  }, [clockRunning, subSide]);

  // Wall-clock sync. The on-screen clock is local; this only publishes it.
  useEffect(() => {
    if (!allowed || !clockRunning) return;

    const interval = setInterval(() => {
      if (!clockRunningRef.current) return;
      const remaining = clockNow();
      void supabase
        .from('games')
        .update({ clock_remaining_ms: remaining })
        .eq('id', gameId)
        .eq('clock_running', true);
    }, 3000);

    return () => clearInterval(interval);
  }, [allowed, clockRunning, gameId]);

  function courtRoster(side: CaptureSide) {
    if (side === 'home') {
      return players
        .filter((player) => onCourtPlayerIds.includes(player.id))
        .map((player) => ({
          id: player.id,
          full_name: player.full_name,
          jersey_number: player.jersey_number,
          avatar_url: player.avatar_url,
        }));
    }
    return awayOnCourtIds.flatMap((id) => {
      const player = opponentPlayers.find((item) => item.id === id && !item.is_coach);
      if (!player) return [];
      return [{
        id: player.id,
        full_name: player.name?.trim() || game?.opponent_name || '',
        jersey_number: opponentShirt(player),
        avatar_url: null,
      }];
    });
  }

  function turnoverHintKey(code: string) {
    if (code === 'turnover_possession') return 'trke_turnover_hint_possession';
    if (code === 'turnover_eliminated') return 'trke_turnover_hint_eliminated';
    if (code === 'turnover_victim') return 'trke_turnover_hint_victim';
    if (code === 'turnover_player') return 'trke_turnover_hint_player';
    return 'trke_turnover_hint_error';
  }

  function turnoverHintFallback(code: string) {
    if (code === 'turnover_possession') return 'The ball changed hands. Turnover was not saved.';
    if (code === 'turnover_eliminated') return 'That player is already eliminated';
    if (code === 'turnover_victim') return 'Choose the player who was fouled';
    if (code === 'turnover_player') return 'Choose the player who lost the ball';
    return 'Could not save the turnover';
  }

  function clearTurnoverClose() {
    if (turnoverCloseTimer.current !== null) {
      window.clearTimeout(turnoverCloseTimer.current);
      turnoverCloseTimer.current = null;
    }
    turnoverPickRef.current = null;
    setTurnoverReasonPicked(null);
  }

  function cancelTurnover() {
    clearTurnoverClose();
    setTurnoverSide(null);
    setTurnoverStep(null);
    setTurnoverOffenderId(null);
    setShowTurnoverMenu(false);
    setTurnoverSaving(false);
    setPendingAction(null);
    setTapCoordinates(null);
    setBoardNote(null);
  }

  function armTurnover(side: CaptureSide) {
    if (clockViolationRef.current) return;
    if (possession !== side) {
      setBoardNote(t('trke_turnover_hint_wrong_side', 'Only the team with the ball can turn it over'));
      return;
    }
    if (courtRoster(side).length === 0) {
      setBoardNote(t('trke_turnover_hint_player', 'Choose the player who lost the ball'));
      return;
    }
    setTurnoverSide(side);
    setTurnoverStep('court');
    setTurnoverOffenderId(null);
    setPendingAction('turnover');
    setBoardNote(t('trke_turnover_hint_court', 'Tap the court where the ball was lost'));
  }

  function shooterHint(points: 2 | 3) {
    return points === 3
      ? t('trke_made_hint_shooter_3', '3-point basket. Choose the shooter.')
      : t('trke_made_hint_shooter_2', '2-point basket. Choose the shooter.');
  }

  function clearShotUi() {
    setShotSide(null);
    setShotStep(null);
    setShotShooterId(null);
    setShotAssistId(null);
    setShotFoulerId(null);
    setShotPoints(null);
    setShotPaint(false);
    setShotPersonal(false);
    setShotThrowCount(null);
    setPendingAction(null);
    setTapCoordinates(null);
    shotPersonalRef.current = false;
    shotWasRunningRef.current = false;
    shotClockAtRef.current = null;
  }

  function cancelShot(resumeClock = true) {
    if (shotSavingRef.current) return;
    const wasRunning = shotWasRunningRef.current;
    const clockAt = shotClockAtRef.current;
    const personal = shotPersonalRef.current;
    clearShotUi();
    setBoardNote(null);
    if (resumeClock && personal && wasRunning && clockAt != null) {
      holdClock(true, clockAt);
      void updateGameState({ clock_running: true, clock_remaining_ms: clockAt });
    }
  }

  function armMade(side: CaptureSide, personal: boolean) {
    if (noticeOpenRef.current || gameStatusRef.current === 'final' || clockViolationRef.current) return;
    if (foulStep || turnoverStep || subSide || miss) return;
    if (possession !== side) return;
    if (courtRoster(side).length === 0) {
      setBoardNote(t('trke_made_hint_roster', 'Put players on the court before the basket'));
      return;
    }
    const clockAtPlay = clockNow();
    shotWasRunningRef.current = clockRunningRef.current;
    shotClockAtRef.current = clockAtPlay;
    shotPersonalRef.current = personal;
    setShotPersonal(personal);
    setShotThrowCount(null);
    if (madeStopsClock(personal)) {
      holdClock(false, clockAtPlay);
      void updateGameState({ clock_running: false, clock_remaining_ms: clockAtPlay });
    }
    setShotSide(side);
    setShotStep('court');
    setShotShooterId(null);
    setShotAssistId(null);
    setShotFoulerId(null);
    setShotPoints(null);
    setShotPaint(false);
    setTapCoordinates(null);
    setPendingAction(personal ? 'made_personal' : 'made');
    setBoardNote(t('trke_made_hint_court', 'Tap the shot on the attacking half'));
  }

  function stepShotBack() {
    if (shotSavingRef.current || !shotStep) return;
    if (shotStep === 'court') {
      cancelShot();
      return;
    }
    if (shotStep === 'shooter') {
      setShotStep('court');
      setTapCoordinates(null);
      setShotPoints(null);
      setShotPaint(false);
      setBoardNote(t('trke_made_hint_court', 'Tap the shot on the attacking half'));
      return;
    }
    if (shotStep === 'assist') {
      setShotShooterId(null);
      setShotStep('shooter');
      setBoardNote(shotPoints === 3 ? shooterHint(3) : shooterHint(2));
      return;
    }
    if (shotStep === 'fouler') {
      setShotFoulerId(null);
      setShotStep('assist');
      setBoardNote(t('trke_made_hint_assist', 'Choose the assist'));
      return;
    }
    if (shotThrowCount) {
      setShotThrowCount(null);
      setBoardNote(t('trke_made_ft_count', 'How many free throws?'));
      return;
    }
    setShotFoulerId(null);
    setShotStep('fouler');
    setBoardNote(t('trke_made_hint_fouler', 'Choose who committed the foul'));
  }

  function madeErrorText(code: string) {
    if (code === 'made_half') return t('trke_made_hint_half', 'That point is not on the attacking half');
    if (code === 'made_assist') return t('trke_made_hint_assist', 'Choose the assist');
    if (code === 'made_foul') return t('trke_made_hint_fouler', 'Choose who committed the foul');
    if (code === 'made_eliminated') return t('trke_foul_hint_eliminated', 'That player is already eliminated');
    if (code === 'made_player') return t('trke_made_hint_shooter_2', '2-point basket. Choose the shooter.');
    return t('trke_made_hint_error', 'Could not save the basket');
  }

  async function saveMade(extra: { foulerId: string | null; throws: FreeThrowMark[] }) {
    if (shotSavingRef.current || !shotSide || !tapCoordinates || !shotShooterId || shotPoints == null) return;
    const side = shotSide;
    const clockAtPlay = shotClockAtRef.current ?? clockNow();
    shotSavingRef.current = true;
    setShotSaving(true);
    try {
      const result = await commitCapturePlay({
        play: 'made',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: clockAtPlay,
        side,
        coordX: tapCoordinates.x,
        coordY: tapCoordinates.y,
        shooterId: shotShooterId,
        assistId: shotAssistId,
        foulerId: extra.foulerId,
        throws: extra.throws,
      });
      if ('error' in result) {
        setBoardNote(madeErrorText(result.error));
        return;
      }
      if (result.groupId) {
        const { data } = await supabase
          .from('game_events')
          .select(`
            *,
            player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
            player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
          `)
          .eq('play_group_id', result.groupId);
        if (data) {
          const added = [...data].sort(newerCaptureEvent);
          setEvents((prev) => {
            const ids = new Set(prev.map((event) => event.id));
            const fresh = added.filter((event) => !ids.has(event.id));
            return fresh.length ? [...fresh, ...prev] : prev;
          });
        }
      }
      setPossession(result.possession ?? null);
      setGame((prev) => (prev ? { ...prev, possession: result.possession ?? null } : prev));
      if (typeof result.teamScore === 'number') setTeamScore(result.teamScore);
      if (typeof result.opponentScore === 'number') setOpponentScore(result.opponentScore);
      const lastThrow = extra.throws[extra.throws.length - 1];
      const note = !extra.foulerId
        ? t('trke_made_hint_scored', 'Basket.')
        : lastThrow === 'made'
          ? t('trke_foul_hint_inbound', 'Inbound. Press start clock.')
          : t('trke_foul_hint_live', 'Live ball. Set possession, then press start clock.');
      clearShotUi();
      setBoardNote(note);
    } catch {
      setBoardNote(t('trke_made_hint_error', 'Could not save the basket'));
    } finally {
      shotSavingRef.current = false;
      setShotSaving(false);
    }
  }

  function chooseMadeAssist(assistId: string | null) {
    if (shotSavingRef.current || shotStep !== 'assist' || !shotSide || !shotShooterId) return;
    if (assistId === shotShooterId) return;
    if (assistId && !courtRoster(shotSide).some((player) => player.id === assistId)) return;
    setShotAssistId(assistId);
    if (!shotPersonalRef.current) {
      void saveMade({ foulerId: null, throws: [] });
      return;
    }
    setShotStep('fouler');
    setBoardNote(t('trke_made_hint_fouler', 'Choose who committed the foul'));
  }

  function selectShotCourtPlayer(side: CaptureSide, playerId: string) {
    if (shotSavingRef.current || !shotSide) return;
    if (!courtRoster(side).some((player) => player.id === playerId)) return;
    if (playerIsOut(playerId, side)) {
      setBoardNote(t('trke_foul_hint_eliminated', 'That player is already eliminated'));
      return;
    }
    if (shotStep === 'shooter' && side === shotSide) {
      setShotShooterId(playerId);
      setShotStep('assist');
      setBoardNote(t('trke_made_hint_assist', 'Choose the assist'));
      return;
    }
    if (shotStep === 'fouler' && side === otherCaptureSide(shotSide)) {
      setShotFoulerId(playerId);
      setShotThrowCount(null);
      setShotStep('ft');
      setBoardNote(t('trke_made_ft_count', 'How many free throws?'));
    }
  }

  function missShooterHint(points: 2 | 3) {
    return points === 3
      ? t('trke_miss_hint_shooter_3', 'Missed 3. Choose the shooter.')
      : t('trke_miss_hint_shooter_2', 'Missed 2. Choose the shooter.');
  }

  function missHint(draft: MissDraft) {
    if (draft.step === 'court') return t('trke_miss_hint_court', 'Tap the miss on the attacking half');
    if (draft.step === 'shooter') return missShooterHint(draft.points === 3 ? 3 : 2);
    if (draft.step === 'rebound') return t('trke_miss_hint_rebound', 'Choose who took the rebound');
    if (draft.step === 'fouler') return t('trke_made_hint_fouler', 'Choose who committed the foul');
    if (draft.throwCount) return t('trke_made_hint_ft', 'Mark the free throw');
    return t('trke_made_ft_count', 'How many free throws?');
  }

  function clearMissUi() {
    setMiss(null);
    setPendingAction(null);
    setTapCoordinates(null);
    missWasRunningRef.current = false;
    missClockAtRef.current = null;
  }

  function cancelMiss(resumeClock = true) {
    if (missSavingRef.current || !miss) return;
    const personal = miss.personal;
    const wasRunning = missWasRunningRef.current;
    const clockAt = missClockAtRef.current;
    clearMissUi();
    setBoardNote(null);
    if (resumeClock && missStopsClock(personal) && wasRunning && clockAt != null) {
      holdClock(true, clockAt);
      void updateGameState({ clock_running: true, clock_remaining_ms: clockAt });
    }
  }

  function armMiss(side: CaptureSide, personal: boolean) {
    if (noticeOpenRef.current || gameStatusRef.current === 'final' || clockViolationRef.current) return;
    if (foulStep || turnoverStep || subSide || shotStep) return;
    if (possession !== side) return;
    if (courtRoster(side).length === 0) {
      setBoardNote(t('trke_miss_hint_roster', 'Put players on the court before the miss'));
      return;
    }
    const clockAtPlay = clockNow();
    missWasRunningRef.current = clockRunningRef.current;
    missClockAtRef.current = clockAtPlay;
    if (missStopsClock(personal)) {
      holdClock(false, clockAtPlay);
      void updateGameState({ clock_running: false, clock_remaining_ms: clockAtPlay });
    }
    setMiss(openMiss(side, personal));
    setPendingAction(personal ? 'miss_personal' : 'miss');
    setTapCoordinates(null);
    setBoardNote(t('trke_miss_hint_court', 'Tap the miss on the attacking half'));
  }

  function stepMissBack() {
    if (missSavingRef.current || !miss) return;
    const next = missStepBack(miss);
    if (next === 'cancel') {
      cancelMiss();
      return;
    }
    setMiss(next);
    setTapCoordinates(next.coord);
    setBoardNote(missHint(next));
  }

  function missErrorText(code: string) {
    if (code === 'miss_half') return t('trke_made_hint_half', 'That point is not on the attacking half');
    if (code === 'miss_rebound') return t('trke_miss_hint_rebound', 'Choose who took the rebound');
    if (code === 'miss_foul') return t('trke_made_hint_fouler', 'Choose who committed the foul');
    if (code === 'miss_eliminated') return t('trke_foul_hint_eliminated', 'That player is already eliminated');
    if (code === 'miss_player') return t('trke_miss_hint_shooter_2', 'Missed 2. Choose the shooter.');
    return t('trke_miss_hint_error', 'Could not save the miss');
  }

  async function saveMiss(draft: MissDraft, throws: FreeThrowMark[]) {
    if (
      missSavingRef.current
      || !draft.coord
      || !draft.shooterId
      || draft.points == null
    ) return;
    if (draft.personal) {
      if (!draft.foulerId || draft.rebounderId) return;
    } else if (!draft.rebounderId) return;
    const clockAtPlay = missClockAtRef.current ?? clockNow();
    missSavingRef.current = true;
    setMissSaving(true);
    setMiss(draft);
    try {
      const result = await commitCapturePlay({
        play: 'miss',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: clockAtPlay,
        side: draft.side,
        coordX: draft.coord.x,
        coordY: draft.coord.y,
        shooterId: draft.shooterId,
        rebounderId: draft.personal ? null : draft.rebounderId,
        foulerId: draft.personal ? draft.foulerId : null,
        throws: draft.personal ? throws : [],
      });
      if ('error' in result) {
        setBoardNote(missErrorText(result.error));
        return;
      }
      if (result.groupId) {
        const { data } = await supabase
          .from('game_events')
          .select(`
            *,
            player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
            player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
          `)
          .eq('play_group_id', result.groupId);
        if (data) {
          const added = [...data].sort(newerCaptureEvent);
          setEvents((prev) => {
            const ids = new Set(prev.map((event) => event.id));
            const fresh = added.filter((event) => !ids.has(event.id));
            return fresh.length ? [...fresh, ...prev] : prev;
          });
        }
      }
      setPossession(result.possession ?? null);
      setGame((prev) => (prev ? { ...prev, possession: result.possession ?? null } : prev));
      if (typeof result.teamScore === 'number') setTeamScore(result.teamScore);
      if (typeof result.opponentScore === 'number') setOpponentScore(result.opponentScore);
      const lastThrow = throws[throws.length - 1];
      const note = !draft.personal
        ? t('trke_miss_hint_scored', 'Miss.')
        : lastThrow === 'made'
          ? t('trke_foul_hint_inbound', 'Inbound. Press start clock.')
          : t('trke_foul_hint_live', 'Live ball. Set possession, then press start clock.');
      clearMissUi();
      setBoardNote(note);
    } catch {
      setBoardNote(t('trke_miss_hint_error', 'Could not save the miss'));
    } finally {
      missSavingRef.current = false;
      setMissSaving(false);
    }
  }

  function selectMissPlayer(side: CaptureSide, playerId: string) {
    if (missSavingRef.current || !miss) return;
    if (!courtRoster(side).some((player) => player.id === playerId)) return;
    if (playerIsOut(playerId, side)) {
      setBoardNote(t('trke_foul_hint_eliminated', 'That player is already eliminated'));
      return;
    }
    if (miss.step === 'shooter' && side === miss.side) {
      const next = missChooseShooter(miss, playerId);
      if (!next) return;
      setMiss(next);
      setBoardNote(next.step === 'fouler'
        ? t('trke_made_hint_fouler', 'Choose who committed the foul')
        : t('trke_miss_hint_rebound', 'Choose who took the rebound'));
      return;
    }
    if (miss.step === 'rebound') {
      const picked = missChooseRebounder(miss, side, playerId);
      if (!picked.ok) return;
      void saveMiss(picked.draft, []);
      return;
    }
    if (miss.step === 'fouler' && side === otherCaptureSide(miss.side)) {
      const next = missChooseFouler(miss, playerId);
      if (!next) return;
      setMiss(next);
      setBoardNote(t('trke_made_ft_count', 'How many free throws?'));
    }
  }

  function handleCourtTap(worldX: number, worldY: number) {
    if (miss?.step === 'court') {
      const attacksRight = offenseAttacksRight(miss.side, currentPeriod, attackRightFirst);
      const tapped = missCourtTap(miss, worldX, worldY, attacksRight);
      if (!tapped.ok) {
        setBoardNote(t('trke_made_hint_half', 'That point is not on the attacking half'));
        return;
      }
      setTapCoordinates(tapped.draft.coord);
      setMiss(tapped.draft);
      setBoardNote(missShooterHint(tapped.draft.points === 3 ? 3 : 2));
      return;
    }
    if (miss) return;
    if (shotStep === 'court' && shotSide) {
      const attacksRight = offenseAttacksRight(shotSide, currentPeriod, attackRightFirst);
      if (!shotOnAttackingHalf(worldX, attacksRight)) {
        setBoardNote(t('trke_made_hint_half', 'That point is not on the attacking half'));
        return;
      }
      const points = shotValueFromWorld(worldX, worldY, attacksRight);
      setTapCoordinates({ x: worldX, y: worldY });
      setShotPoints(points);
      setShotPaint(shotInPaint(worldX, worldY, attacksRight));
      setShotStep('shooter');
      setBoardNote(shooterHint(points));
      return;
    }
    if (shotStep) return;
    if (foulStep === 'court') {
      setTapCoordinates({ x: worldX, y: worldY });
      setFoulStep('player');
      setBoardNote(t('trke_foul_hint_player', 'Choose who committed the foul'));
      return;
    }
    if (!turnoverStep || foulStep) return;
    setTapCoordinates({ x: worldX, y: worldY });
    if (turnoverStep === 'court') {
      setTurnoverStep('player');
      setBoardNote(t('trke_turnover_hint_player', 'Choose the player who lost the ball'));
    }
  }

  async function saveTurnover(reason: TurnoverReason) {
    if (turnoverSavingRef.current) return;
    if (!turnoverSide || !turnoverOffenderId || !tapCoordinates) {
      const message = t('trke_turnover_hint_error', 'Could not save the turnover');
      setBoardNote(message);
      setShowTurnoverMenu(true);
      return;
    }
    const normalized = worldToNormalized(tapCoordinates.x, tapCoordinates.y);
    const stopsClock = turnoverStopsClock(reason);
    const nextPossession = otherCaptureSide(turnoverSide);
    const wasRunning = clockRunningRef.current;
    const clockAtPlay = clockNow();
    turnoverSavingRef.current = true;
    setTurnoverSaving(true);
    setPossession(nextPossession);
    if (stopsClock) holdClock(false, clockAtPlay);
    try {
      const result = await commitCapturePlay({
        play: 'turnover',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: clockAtPlay,
        coordX: Math.min(1, Math.max(0, normalized.x)),
        coordY: Math.min(1, Math.max(0, normalized.y)),
        side: turnoverSide,
        reason,
        offenderId: turnoverOffenderId,
      });
      if ('error' in result) {
        const message = t(turnoverHintKey(result.error), turnoverHintFallback(result.error));
        setBoardNote(message);
        setPossession(turnoverSide);
        setTurnoverStep('reason');
        setShowTurnoverMenu(true);
        if (stopsClock && wasRunning) holdClock(true, clockAtPlay);
        return;
      }
      const { data } = await supabase
        .from('game_events')
        .select(`
          *,
          player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
          player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
        `)
        .eq('id', result.id)
        .single();
      if (data) {
        setEvents((prev) => (prev.some((event) => event.id === data.id) ? prev : [data, ...prev]));
      }
      setPossession(nextPossession);
      setGame((prev) => (prev ? { ...prev, possession: nextPossession } : prev));
      setTurnoverSide(null);
      setTurnoverStep(null);
      setTurnoverOffenderId(null);
      setShowTurnoverMenu(false);
      setPendingAction(null);
      setTapCoordinates(null);
      setBoardNote(stopsClock
        ? t('trke_turnover_hint_saved', 'Turnover saved. Press start clock.')
        : t('trke_turnover_hint_saved_live', 'Turnover saved.'));
    } catch {
      const message = t('trke_turnover_hint_error', 'Could not save the turnover');
      setBoardNote(message);
      setPossession(turnoverSide);
      setShowTurnoverMenu(true);
      if (stopsClock && wasRunning) holdClock(true, clockAtPlay);
    } finally {
      turnoverSavingRef.current = false;
      setTurnoverSaving(false);
    }
  }

  function selectTurnoverCourtPlayer(side: CaptureSide, playerId: string) {
    if (turnoverSavingRef.current) return;
    if (turnoverStep === 'player' && side === turnoverSide) {
      if (!courtRoster(side).some((player) => player.id === playerId)) return;
      setTurnoverOffenderId(playerId);
      setTurnoverStep('reason');
      setShowTurnoverMenu(true);
      setBoardNote(t('trke_turnover_hint_reason', 'Choose why the ball was lost'));
    }
  }

  function chooseTurnoverReason(reason: TurnoverReason) {
    if (turnoverSavingRef.current || turnoverPickRef.current || !turnoverSide || !turnoverOffenderId) return;
    turnoverPickRef.current = reason;
    setTurnoverReasonPicked(reason);
    turnoverCloseTimer.current = window.setTimeout(() => {
      turnoverCloseTimer.current = null;
      turnoverPickRef.current = null;
      setTurnoverReasonPicked(null);
      setShowTurnoverMenu(false);
      void saveTurnover(reason);
    }, TURNOVER_REASON_CLOSE_MS);
  }

  async function recordClockViolation(play: ClockViolation, side: CaptureSide) {
    if (shotStep || miss || turnoverStep || foulStep || subSide || turnoverSavingRef.current || clockViolationRef.current) return;
    if (possession !== side) {
      setBoardNote(t('trke_turnover_hint_wrong_side', 'Only the team with the ball can turn it over'));
      return;
    }
    const wasRunning = clockRunningRef.current;
    const clockAtPlay = clockNow();
    holdClock(false, clockAtPlay);
    clockViolationRef.current = true;
    try {
      const result = await commitCapturePlay({
        play,
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: clockAtPlay,
        side,
      });
      if ('error' in result) {
        setBoardNote(t('trke_turnover_hint_error', 'Could not save the turnover'));
        if (wasRunning) holdClock(true, clockAtPlay);
        return;
      }
      const { data } = await supabase
        .from('game_events')
        .select(`
          *,
          player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
          player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
        `)
        .eq('id', result.id)
        .single();
      if (data) {
        setEvents((prev) => (prev.some((event) => event.id === data.id) ? prev : [data, ...prev]));
      }
      setPossession(otherCaptureSide(side));
      setBoardNote(play === 'shot_clock'
        ? t('trke_shot_clock_hint', '24s violation. Press start clock.')
        : play === 'eight_seconds'
          ? t('trke_eight_seconds_hint', '8s violation. Press start clock.')
          : t('trke_five_seconds_hint', '5s violation. Press start clock.'));
    } catch {
      setBoardNote(t('trke_turnover_hint_error', 'Could not save the turnover'));
      if (wasRunning) holdClock(true, clockAtPlay);
    } finally {
      clockViolationRef.current = false;
    }
  }

  function timeoutCapText(period: number) {
    if (period <= 2) return t('trke_timeout_none_first_half', 'No more timeouts in the first two periods');
    if (period <= 4) return t('trke_timeout_none_second_half', 'No more timeouts in periods 3 and 4');
    return t('trke_timeout_none_overtime', 'No more timeouts in this overtime');
  }

  function openCaptureNotice(notice: CaptureNotice) {
    noticeOpenRef.current = true;
    setCaptureNotice(notice);
  }

  function closeCaptureNotice() {
    noticeOpenRef.current = false;
    setCaptureNotice(null);
  }

  async function recordTimeout(side: CaptureSide) {
    if (noticeOpenRef.current || shotStep || miss || turnoverStep || foulStep || subSide || turnoverSavingRef.current || clockViolationRef.current) return;
    if (clockRunningRef.current) return;
    if (gameStatusRef.current === 'final') return;
    const period = currentPeriodRef.current;
    if (countTimeouts(events, side, period) >= timeoutWindow(period).max) {
      openCaptureNotice({ kind: 'timeout_cap', body: timeoutCapText(period) });
      return;
    }
    const clockAtPlay = clockNow();
    const pendingId = `pending-timeout-${side}-${clockAtPlay}`;
    holdClock(false, clockAtPlay);
    setTimeoutTickSide(side);
    if (timeoutTickTimer.current !== null) window.clearTimeout(timeoutTickTimer.current);
    timeoutTickTimer.current = window.setTimeout(() => {
      timeoutTickTimer.current = null;
      setTimeoutTickSide(null);
    }, TIMEOUT_TICK_MS);
    clockViolationRef.current = true;
    await new Promise((resolve) => window.setTimeout(resolve, TIMEOUT_TICK_MS));
    setEvents((prev) => [{
      id: pendingId,
      game_id: gameId,
      event_type: 'timeout',
      period_number: period,
      clock_remaining_ms: clockAtPlay,
      elapsed_ms: 0,
      timeout_side: side,
      recorded_by_user_id: currentUser?.id ?? '',
      created_at: new Date().toISOString(),
    }, ...prev.filter((event) => event.id !== pendingId)]);
    const dropPending = () => {
      setEvents((prev) => prev.filter((event) => event.id !== pendingId));
    };
    try {
      const result = await commitCapturePlay({
        play: 'timeout',
        gameId,
        periodNumber: period,
        clockRemainingMs: clockAtPlay,
        side,
      });
      if ('error' in result) {
        dropPending();
        openCaptureNotice({
          kind: 'timeout_cap',
          body: result.error === 'timeout_cap'
            ? timeoutCapText(period)
            : t('trke_timeout_error', 'Could not save the timeout'),
        });
        return;
      }
      const { data } = await supabase
        .from('game_events')
        .select(`
          *,
          player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
          player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
        `)
        .eq('id', result.id)
        .single();
      setEvents((prev) => {
        if (!data) {
          return prev.map((event) => (event.id === pendingId ? { ...event, id: result.id } : event));
        }
        const rest = prev.filter((event) => event.id !== pendingId && event.id !== result.id);
        return [data, ...rest];
      });
      setBoardNote(t('trke_timeout_hint', 'Timeout. Press start clock.'));
    } catch {
      dropPending();
      openCaptureNotice({
        kind: 'timeout_cap',
        body: t('trke_timeout_error', 'Could not save the timeout'),
      });
    } finally {
      clockViolationRef.current = false;
    }
  }

  function handleFreeThrowScriptConfirm(result: FreeThrowSequenceResult) {
    const draft = foulDraftRef.current;
    setShowFreeThrowScript(false);
    if (!draft) return;
    void saveFoul({ ...draft, throws: result.shots });
  }

  function clearFoulTimer() {
    if (foulCloseTimer.current !== null) {
      window.clearTimeout(foulCloseTimer.current);
      foulCloseTimer.current = null;
    }
    foulPickRef.current = null;
    setFoulPick(null);
  }

  function clearFoulUi() {
    clearFoulTimer();
    foulDraftRef.current = null;
    setFoulSide(null);
    setFoulStep(null);
    setFoulOffenderId(null);
    setFoulKind(null);
    setFoulContext(null);
    setFoulCoach(false);
    setFoulOffense(false);
    setFoulThrowCount(null);
    setShowFoulThrowCount(false);
    setShowFreeThrowScript(false);
    setPendingAction(null);
    setTapCoordinates(null);
  }

  function cancelFoul() {
    if (foulSavingRef.current) return;
    clearFoulUi();
    setBoardNote(null);
  }

  function stepFoulBack() {
    if (foulSavingRef.current) return;
    clearFoulTimer();
    if (showFreeThrowScript) {
      setShowFreeThrowScript(false);
      if (foulCoach) {
        foulDraftRef.current = null;
        setFoulThrowCount(null);
        setBoardNote(t('trke_foul_hint_shooter', 'Choose the free-throw shooter'));
        return;
      }
      setFoulThrowCount(null);
      setShowFoulThrowCount(true);
      setBoardNote(t('trke_made_ft_count', 'How many free throws?'));
      return;
    }
    if (showFoulThrowCount) {
      setShowFoulThrowCount(false);
      setFoulThrowCount(null);
      foulDraftRef.current = null;
      setBoardNote(foulKind ? otherPrompt(foulKind) : t('trke_foul_hint_victim', 'Choose who was fouled'));
      return;
    }
    if (foulStep === 'court' || !foulStep) {
      cancelFoul();
      return;
    }
    if (foulStep === 'player') {
      setFoulStep('court');
      setTapCoordinates(null);
      setFoulOffenderId(null);
      setBoardNote(t('trke_foul_hint_court', 'Tap where the foul happened'));
      return;
    }
    if (foulStep === 'type') {
      setFoulStep('player');
      setFoulOffenderId(null);
      setFoulKind(null);
      setBoardNote(t('trke_foul_hint_player', 'Choose who committed the foul'));
      return;
    }
    if (foulCoach) {
      cancelFoul();
      return;
    }
    setFoulStep('type');
    setFoulKind(null);
    setFoulContext(null);
    setBoardNote(t('trke_foul_hint_type', 'Choose the foul'));
  }

  function foulErrorText(code: string) {
    if (code === 'foul_possession') return t('trke_foul_hint_possession', 'Set possession before the foul');
    if (code === 'foul_eliminated') return t('trke_foul_hint_eliminated', 'That player is already eliminated');
    if (code === 'foul_player') return t('trke_foul_hint_player', 'Choose who committed the foul');
    if (code === 'foul_victim') return t('trke_foul_hint_victim', 'Choose who was fouled');
    return t('trke_foul_hint_error', 'Could not save the foul');
  }

  async function saveFoul(draft: {
    side: CaptureSide;
    kind: FoulKind;
    context: FoulContext;
    offenderId: string | null;
    otherId: string | null;
    coach: boolean;
    throws: FreeThrowMark[];
  }) {
    if (foulSavingRef.current) return;
    if (!draft.coach && !tapCoordinates) {
      setBoardNote(t('trke_foul_hint_error', 'Could not save the foul'));
      return;
    }
    const wasRunning = clockRunningRef.current;
    const clockAtPlay = clockNow();
    holdClock(false, clockAtPlay);
    foulSavingRef.current = true;
    try {
      const result = await commitCapturePlay({
        play: 'foul',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: clockAtPlay,
        side: draft.side,
        coordX: draft.coach || !tapCoordinates ? null : tapCoordinates.x,
        coordY: draft.coach || !tapCoordinates ? null : tapCoordinates.y,
        kind: draft.kind,
        context: draft.context,
        offenderId: draft.offenderId,
        otherId: draft.otherId,
        coach: draft.coach,
        throws: draft.throws,
      });
      if ('error' in result) {
        setBoardNote(foulErrorText(result.error));
        if (wasRunning) holdClock(true, clockAtPlay);
        return;
      }
      if (result.groupId) {
        const { data } = await supabase
          .from('game_events')
          .select(`
            *,
            player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
            player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
          `)
          .eq('play_group_id', result.groupId);
        if (data) {
          setEvents((prev) => {
            const ids = new Set(prev.map((event) => event.id));
            const added = data.filter((event) => !ids.has(event.id));
            return added.length ? [...added, ...prev] : prev;
          });
        }
      }
      if (result.possessionChanged) {
        setPossession(result.possession ?? null);
        setGame((prev) => (prev ? { ...prev, possession: result.possession ?? null } : prev));
      }
      if (typeof result.teamScore === 'number') setTeamScore(result.teamScore);
      if (typeof result.opponentScore === 'number') setOpponentScore(result.opponentScore);
      const ejected = foulEjects(draft.kind)
        || (!draft.coach && !!draft.offenderId && personalFoulCount(draft.offenderId, draft.side) + 1 >= 5);
      const outcome = !result.possessionChanged
        ? t('trke_foul_hint_resume', 'Possession unchanged. Press start clock.')
        : result.possession == null
          ? t('trke_foul_hint_live', 'Live ball. Set possession, then press start clock.')
          : t('trke_foul_hint_inbound', 'Inbound. Press start clock.');
      setBoardNote(ejected ? `${outcome} ${t('trke_foul_hint_ejected', 'That player is out of the game.')}` : outcome);
      clearFoulUi();
    } catch {
      setBoardNote(t('trke_foul_hint_error', 'Could not save the foul'));
      if (wasRunning) holdClock(true, clockAtPlay);
    } finally {
      foulSavingRef.current = false;
    }
  }

  function armFoul(side: CaptureSide) {
    if (shotStep || miss || clockViolationRef.current || foulSavingRef.current) return;
    if (possession !== 'home' && possession !== 'away') {
      setBoardNote(t('trke_foul_hint_possession', 'Set possession before the foul'));
      return;
    }
    if (courtRoster(side).length === 0) {
      setBoardNote(t('trke_foul_hint_roster', 'Put players on the court before the foul'));
      return;
    }
    const clockAtWhistle = clockNow();
    holdClock(false, clockAtWhistle);
    void updateGameState({
      clock_running: false,
      clock_remaining_ms: clockAtWhistle,
    });
    clearFoulTimer();
    setFoulSide(side);
    setFoulStep('court');
    setFoulOffenderId(null);
    setFoulKind(null);
    setFoulContext(null);
    setFoulCoach(false);
    setPendingAction('foul');
    setBoardNote(t('trke_foul_hint_court', 'Tap where the foul happened'));
  }

  function armCoachTechnical(side: CaptureSide) {
    if (shotStep || miss || turnoverStep || foulStep || subSide || foulSavingRef.current) return;
    if (possession !== 'home' && possession !== 'away') {
      setBoardNote(t('trke_foul_hint_possession', 'Set possession before the foul'));
      return;
    }
    if (courtRoster(otherCaptureSide(side)).length === 0) {
      setBoardNote(t('trke_foul_hint_shooter', 'Choose the free-throw shooter'));
      return;
    }
    clearFoulTimer();
    setFoulSide(side);
    setFoulStep('other');
    setFoulKind('technical');
    setFoulContext('technical');
    setFoulCoach(true);
    setFoulOffenderId(null);
    setPendingAction('foul');
    setTapCoordinates(null);
    setBoardNote(t('trke_foul_hint_shooter', 'Choose the free-throw shooter'));
  }

  function otherPrompt(kind: FoulKind) {
    if (kind === 'technical') return t('trke_foul_hint_shooter', 'Choose the free-throw shooter');
    if (kind === 'double') return t('trke_foul_hint_other', 'Choose the other player');
    return t('trke_foul_hint_victim', 'Choose who was fouled');
  }

  function advanceFoul(draft: {
    side: CaptureSide;
    kind: FoulKind;
    context: FoulContext;
    offenderId: string | null;
    coach: boolean;
  }) {
    const needsOther = foulNeedsOther({
      kind: draft.kind,
      context: draft.context,
      teamFoulsBefore: teamFoulsBefore(draft.side),
    });
    if (needsOther) {
      if (courtRoster(otherCaptureSide(draft.side)).length === 0) {
        setBoardNote(otherPrompt(draft.kind));
        return;
      }
      setFoulKind(draft.kind);
      setFoulContext(draft.context);
      setFoulOffenderId(draft.offenderId);
      setFoulCoach(draft.coach);
      setFoulStep('other');
      setBoardNote(otherPrompt(draft.kind));
      return;
    }
    void saveFoul({ ...draft, otherId: null, throws: [] });
  }

  function selectFoulCourtPlayer(side: CaptureSide, playerId: string) {
    if (foulSavingRef.current || !foulSide || !foulStep) return;
    if (!courtRoster(side).some((player) => player.id === playerId)) return;
    if (playerIsOut(playerId, side)) {
      setBoardNote(t('trke_foul_hint_eliminated', 'That player is already eliminated'));
      return;
    }
    if (foulStep === 'player' && side === foulSide) {
      setFoulOffenderId(playerId);
      setFoulOffense(possession === foulSide);
      setFoulStep('type');
      setBoardNote(t('trke_foul_hint_type', 'Choose the foul'));
      return;
    }
    if (foulStep === 'other' && side === otherCaptureSide(foulSide) && foulKind && foulContext) {
      const draft = {
        side: foulSide,
        kind: foulKind,
        context: foulContext,
        offenderId: foulCoach ? null : foulOffenderId,
        otherId: playerId,
        coach: foulCoach,
        throws: [] as FreeThrowMark[],
      };
      const allowance = foulThrowAllowance({
        kind: foulKind,
        context: foulContext,
        teamFoulsBefore: teamFoulsBefore(foulSide),
      });
      if (allowance === 0) {
        void saveFoul(draft);
        return;
      }
      foulDraftRef.current = draft;
      if (foulCoach) {
        setFoulThrowCount(1);
        setShowFreeThrowScript(true);
        setBoardNote(t('trke_made_hint_ft', 'Mark the free throw'));
        return;
      }
      setFoulThrowCount(null);
      setShowFoulThrowCount(true);
      setBoardNote(t('trke_made_ft_count', 'How many free throws?'));
    }
  }

  function queueFoulChoice(id: string, after: () => void) {
    if (foulPickRef.current || foulSavingRef.current) return;
    foulPickRef.current = id;
    setFoulPick(id);
    foulCloseTimer.current = window.setTimeout(() => {
      foulCloseTimer.current = null;
      foulPickRef.current = null;
      setFoulPick(null);
      after();
    }, TURNOVER_REASON_CLOSE_MS);
  }

  function chooseFoulKind(kind: FoulKind) {
    if (!foulSide || !foulOffenderId) return;
    queueFoulChoice(kind, () => {
      if (kind === 'personal' && foulOffense) {
        void saveFoul({
          side: foulSide,
          kind: 'personal',
          context: 'offensive',
          offenderId: foulOffenderId,
          otherId: null,
          coach: false,
          throws: [],
        });
        return;
      }
      if (kind === 'technical' || kind === 'double') {
        advanceFoul({
          side: foulSide,
          kind,
          context: kind === 'technical' ? 'technical' : 'double',
          offenderId: foulOffenderId,
          coach: false,
        });
        return;
      }
      advanceFoul({
        side: foulSide,
        kind,
        context: 'no_shot',
        offenderId: foulOffenderId,
        coach: false,
      });
    });
  }

  function rememberTipWinner(side: 'home' | 'away') {
    if (openingTipWinnerRef.current) return;
    const parsed = openingTipWinnerSchema.safeParse(side);
    if (!parsed.success) return;
    openingTipWinnerRef.current = parsed.data;
    setOpeningTipWinner(parsed.data);
    void updateGameState({ opening_tip_winner: parsed.data });
  }

  async function writePossession(side: 'home' | 'away') {
    const parsed = openingTipWinnerSchema.safeParse(side);
    if (!parsed.success) return false;
    setPossession(parsed.data);
    setGame((prev) => (prev ? { ...prev, possession: parsed.data } : prev));
    return updateGameState({ possession: parsed.data });
  }

  function proposedInboundSide() {
    const winner = openingTipWinnerRef.current;
    if (!winner) return null;
    return periodInbound(currentPeriodRef.current, winner);
  }

  async function keepProposedInbound() {
    const side = proposedInboundSide();
    if (!side) return;
    const saved = await writePossession(side);
    if (!saved) return;
    inboundAnsweredPeriodRef.current = currentPeriodRef.current;
    setInboundFlipped(null);
    setShowInbound(false);
  }

  async function acceptHeldBall() {
    const proposed = proposedInboundSide();
    if (!proposed) return;
    const saved = await writePossession(otherCaptureSide(proposed));
    if (!saved) return;
    setInboundFlipped(otherCaptureSide(proposed));
  }

  function acknowledgeInboundFlip() {
    inboundAnsweredPeriodRef.current = currentPeriodRef.current;
    setInboundFlipped(null);
    setShowInbound(false);
  }

  function handleJumpBallConfirm(result: JumpBallResult) {
    setBoardNote(`${t('trke_jump_title', 'Jump ball')}: ${result.label}`);
    setShowJumpBall(false);
    setPossession(result.winner);
    void updateGameState({ possession: result.winner });
    rememberTipWinner(result.winner);
  }

  function countsAsPlayerFoul(event: GameEvent, id: string, side: 'home' | 'away') {
    if (event.coach_technical_side) return false;
    const charged = side === 'home' ? event.player_id === id : event.opponent_player_id === id;
    if (!charged) return false;
    if (event.event_type === 'foul' && foulCountsForPlayer(event.foul_type)) return true;
    return event.event_type === 'turnover'
      && (event.turnover_type === 'offensive_foul' || event.turnover_type === 'technical')
      && event.turnover_side === side;
  }

  function personalFoulCount(id: string, side: 'home' | 'away') {
    return events.filter((event) => countsAsPlayerFoul(event, id, side)).length;
  }

  /** Which personal foul this row is for that player: 1 on the first, 5 on the one that fouls them out. */
  function playerFoulNumber(event: GameEvent) {
    if (event.coach_technical_side || event.event_type !== 'foul') return 0;
    const side = event.foul_side
      ?? (event.player_id ? 'home' : event.opponent_player_id ? 'away' : null);
    const id = side === 'home' ? event.player_id : side === 'away' ? event.opponent_player_id : null;
    if (!side || !id || !foulCountsForPlayer(event.foul_type)) return 0;
    return events.filter((item) => (
      countsAsPlayerFoul(item, id, side) && newerCaptureEvent(item, event) >= 0
    )).length;
  }

  function playerIsOut(id: string, side: 'home' | 'away') {
    if (isEliminated(personalFoulCount(id, side))) return true;
    return events.some((event) => {
      if (event.coach_technical_side) return false;
      const charged = side === 'home' ? event.player_id === id : event.opponent_player_id === id;
      return charged
        && event.event_type === 'foul'
        && (event.foul_type === 'flagrant' || event.foul_type === 'disqualifying');
    });
  }

  function teamFoulsBefore(side: CaptureSide) {
    return events.filter((event) => {
      if (event.period_number !== currentPeriod) return false;
      if (event.event_type === 'foul' && foulCountsForTeam(event.foul_type)) {
        if (event.foul_side === side || event.coach_technical_side === side) return true;
        if (!event.foul_side && !event.coach_technical_side) {
          if (side === 'home') return !!event.player_id && !event.opponent_player_id;
          return !!event.opponent_player_id && !event.player_id;
        }
      }
      return event.event_type === 'turnover'
        && event.turnover_side === side
        && (
          event.turnover_type === 'offensive_foul'
          || event.turnover_type === 'technical'
          || clockViolationCountsAsTeamFoul(event)
        );
    }).length;
  }

  function periodAlreadyStarted(period: number) {
    if (currentPeriod > period) return true;
    if (events.some((event) => event.period_number === period)) return true;
    return currentPeriod === period && (clockRunning || clockRemaining < getPeriodLengthMs(period));
  }

  function teamSheet() {
    return players.filter((player) => !player.is_guest);
  }

  function dressedIdsNow() {
    if (squadIds.length > 0) return squadIds;
    const sheet = teamSheet();
    return sheet.length <= 12 ? sheet.map((player) => player.id) : [];
  }

  function dressedPlayers() {
    const teamPlayers = teamSheet();
    const dressed = dressedIdsNow();
    if (dressed.length === 0) return [];
    return teamPlayers.filter((player) => dressed.includes(player.id));
  }

  function captureDbMessage(message: string) {
    if (message.includes('Only a dressed player')) {
      return t('trke_period_lineup_not_dressed', 'Only a dressed player can start a period');
    }
    if (message.includes('at most 12') || message.includes('dress at most 12')) {
      return t('trke_squad_incorporate_full', 'This game already has 12 dressed players');
    }
    if (message.includes('duplicate key') || message.includes('game_squads_pkey')) {
      return t('trke_squad_incorporate_duplicate', 'That player is already dressed');
    }
    return message;
  }

  function idsForPeriod(period: number, side: 'home' | 'away') {
    return periodLineups
      .filter((row) => row.period_number === period && row.side === side)
      .sort((a, b) => a.position_index - b.position_index)
      .flatMap((row) => {
        const id = side === 'home' ? row.player_id : row.opponent_player_id;
        return id ? [id] : [];
      });
  }

  function suggestedStarterIds(side: 'home' | 'away') {
    return idsForPeriod(currentPeriod, side).filter((id) => !playerIsOut(id, side));
  }

  function eliminatedCount(side: 'home' | 'away') {
    const pool = side === 'home'
      ? dressedPlayers()
      : opponentPlayers.filter((player) => !player.is_coach);
    return pool.filter((player) => playerIsOut(player.id, side)).length;
  }

  function blockUntilReady() {
    if (periodAlreadyStarted(currentPeriod)) return false;
    if (opponentPlayers.filter((player) => !player.is_coach).length === 0) {
      setShowOpponentRoster(true);
      return true;
    }
    const teamPlayers = players.filter((player) => !player.is_guest);
    if (teamPlayers.length > 12 && squadIds.length !== 12) {
      setShowSquad(true);
      return true;
    }
    const homeCount = periodLineups.filter((row) => row.period_number === currentPeriod && row.side === 'home').length;
    const awayCount = periodLineups.filter((row) => row.period_number === currentPeriod && row.side === 'away').length;
    if (!canStartPeriod(homeCount, awayCount, eliminatedCount('home'), eliminatedCount('away'))) {
      setShowPeriodLineup(true);
      setBoardNote(t('trke_lineup_start_blocked', 'Set both lineups before starting the period'));
      return true;
    }
    if (currentPeriod > 1 && openingTipWinnerRef.current && inboundAnsweredPeriodRef.current !== currentPeriod) {
      setShowInbound(true);
      return true;
    }
    return false;
  }

  function rosterSchemaMessage(error: Parameters<typeof schemaError>[0]) {
    const message = schemaError(error);
    if (message === 'duplicate jersey') {
      return t('trke_opponent_roster_duplicate', 'That jersey is already on this team');
    }
    if (message === 'only one coach') {
      return t('trke_opponent_roster_one_coach', 'Only one coach');
    }
    if (message === 'at most 12 opponent players') {
      return t('trke_opponent_roster_max', 'This game already has 12 opponent jerseys');
    }
    if (message === 'invalid color') {
      return t('trke_opponent_color', 'Opponent color');
    }
    return t('trke_opponent_roster_hint', 'Fill in the jerseys you see. Leave the rest blank. The coach has no jersey.');
  }

  function rosterDbMessage(error: { message: string; code?: string }) {
    const text = error.message;
    if (error.code === '23505' || text.includes('duplicate key') || text.includes('jersey_number')) {
      return t('trke_opponent_roster_duplicate', 'That jersey is already on this team');
    }
    if (text.includes('at most 12') || text.includes('only one opponent coach')) {
      return text.includes('coach')
        ? t('trke_opponent_roster_one_coach', 'Only one coach')
        : t('trke_opponent_roster_max', 'This game already has 12 opponent jerseys');
    }
    if (text.includes('starting five') || text.includes('opponent starter')) {
      return t('trke_opponent_roster_locked', 'The starting five cannot be changed after the game starts');
    }
    return text;
  }

  async function reloadOpponentRoster() {
    const { data: rosterData } = await supabase
      .from('game_opponent_players')
      .select('id, game_id, jersey_number, name, is_coach, created_at')
      .eq('game_id', gameId)
      .order('jersey_number');
    setOpponentPlayers(rosterData || []);
  }

  async function saveOpponentRoster(players: OpponentRosterInput[]): Promise<string | null> {
    const parsed = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: normalizeHexColor(game?.opponent_color),
      players,
    });
    if (!parsed.success) return rosterSchemaMessage(parsed.error);

    const draft = parsed.data.players.map((player) => ({ ...player }));
    const locked = events.length > 0 || clockRunning || clockRemaining < 600000;
    const { data: currentRows, error: currentError } = await supabase
      .from('game_opponent_players')
      .select('id, jersey_number, is_coach')
      .eq('game_id', gameId);
    if (currentError || !currentRows) {
      return rosterDbMessage(currentError || { message: 'Could not save the opponent roster' });
    }

    const usedIds = new Set(draft.flatMap((player) => (player.id ? [player.id] : [])));
    for (const player of draft) {
      if (player.id) continue;
      const match = player.is_coach
        ? currentRows.find((row) => row.is_coach && !usedIds.has(row.id))
        : currentRows.find((row) => !row.is_coach && row.jersey_number === player.jersey_number && !usedIds.has(row.id));
      if (!match) continue;
      player.id = match.id;
      usedIds.add(match.id);
    }

    const keepIds = new Set(draft.flatMap((player) => (player.id ? [player.id] : [])));
    for (const row of currentRows) {
      if (keepIds.has(row.id)) continue;
      if (locked && (opponentEventIds.has(row.id) || opponentInStartedLineup.has(row.id))) {
        return t('trke_opponent_roster_locked', 'The starting five cannot be changed after the game starts');
      }
      const { error } = await supabase.from('game_opponent_players').delete().eq('id', row.id);
      if (error) return rosterDbMessage(error);
    }

    const changing = draft.filter((player) => {
      if (!player.id || player.is_coach || player.jersey_number === null) return false;
      const current = currentRows.find((row) => row.id === player.id);
      return current && current.jersey_number !== player.jersey_number;
    });
    const blocked = new Set<number>();
    for (const player of draft) {
      if (player.jersey_number !== null) blocked.add(player.jersey_number);
    }
    for (const row of currentRows) {
      if (keepIds.has(row.id) && row.jersey_number !== null) blocked.add(row.jersey_number);
    }
    const temps: number[] = [];
    for (let number = 0; number <= 99 && temps.length < changing.length; number += 1) {
      if (!blocked.has(number)) temps.push(number);
    }
    if (temps.length < changing.length) {
      return t('trke_opponent_roster_duplicate', 'That jersey is already on this team');
    }
    for (let index = 0; index < changing.length; index += 1) {
      const { error } = await supabase
        .from('game_opponent_players')
        .update({ jersey_number: temps[index] })
        .eq('id', changing[index].id);
      if (error) return rosterDbMessage(error);
    }
    for (const player of draft) {
      if (!player.id) continue;
      const { error } = await supabase
        .from('game_opponent_players')
        .update({ jersey_number: player.jersey_number, name: player.name, is_coach: player.is_coach })
        .eq('id', player.id);
      if (error) return rosterDbMessage(error);
    }

    const fresh = draft.filter((player) => !player.id);
    if (fresh.length > 0) {
      const { data: inserted, error } = await supabase
        .from('game_opponent_players')
        .insert(fresh.map((player) => ({
          game_id: gameId,
          jersey_number: player.jersey_number,
          name: player.name,
          is_coach: player.is_coach,
        })))
        .select('id, jersey_number, is_coach');
      if (error || !inserted) return rosterDbMessage(error || { message: 'Could not save the opponent roster' });
      for (const player of fresh) {
        const created = player.is_coach
          ? inserted.find((row) => row.is_coach)
          : inserted.find((row) => row.jersey_number === player.jersey_number);
        if (!created) return t('trke_opponent_roster_hint', 'Fill in the jerseys you see. Leave the rest blank. The coach has no jersey.');
        player.id = created.id;
      }
    }

    await reloadOpponentRoster();
    setShowOpponentRoster(false);
    return null;
  }

  async function addOpponentBenchPlayer(jerseyNumber: number, name: string): Promise<string | null> {
    const existing = opponentPlaying.flatMap((player) => (
      player.jersey_number == null ? [] : [player.jersey_number]
    ));
    const parsed = opponentBenchAddSchema.safeParse({
      game_id: gameId,
      jersey_number: jerseyNumber,
      name,
      existing_jerseys: existing,
    });
    if (!parsed.success) return rosterSchemaMessage(parsed.error);
    const { error } = await supabase.from('game_opponent_players').insert({
      game_id: parsed.data.game_id,
      jersey_number: parsed.data.jersey_number,
      name: parsed.data.name,
      is_coach: false,
    });
    if (error) return rosterDbMessage(error);
    await reloadOpponentRoster();
    return null;
  }

  async function saveSquad(playerIds: string[]) {
    const parsed = gameSquadSchema.safeParse({
      game_id: gameId,
      player_ids: playerIds,
      require_twelve: true,
    });
    if (!parsed.success) {
      const message = schemaError(parsed.error);
      return message === 'exactly 12 players'
        ? t('trke_squad_need_twelve', 'Choose exactly 12 players')
        : message;
    }

    const { error: deleteError } = await supabase.from('game_squads').delete().eq('game_id', gameId);
    if (deleteError) return deleteError.message;
    const { error } = await supabase.from('game_squads').insert(
      parsed.data.player_ids.map((playerId) => ({ game_id: gameId, player_id: playerId })),
    );
    if (error) return captureDbMessage(error.message);
    setSquadIds(parsed.data.player_ids);
    setShowSquad(false);
    setShowPeriodLineup(true);
    return null;
  }

  async function ensureSmallTeamSquad() {
    const sheet = teamSheet();
    if (sheet.length === 0 || sheet.length > 12 || squadIds.length > 0) return { ids: dressedIdsNow(), error: null as string | null };
    const desired = sheet.map((player) => player.id);
    const { error } = await supabase
      .from('game_squads')
      .insert(desired.map((playerId) => ({ game_id: gameId, player_id: playerId })));
    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        const { data } = await supabase.from('game_squads').select('player_id').eq('game_id', gameId);
        const ids = (data || []).map((row) => row.player_id);
        if (ids.length > 0) {
          setSquadIds(ids);
          return { ids, error: null as string | null };
        }
      }
      return { ids: [] as string[], error: captureDbMessage(error.message) };
    }
    setSquadIds(desired);
    return { ids: desired, error: null as string | null };
  }

  async function incorporatePlayer(playerId: string) {
    const sheet = teamSheet();
    if (!sheet.some((player) => player.id === playerId)) {
      return t('trke_period_lineup_not_dressed', 'Only a dressed player can start a period');
    }
    const dressed = dressedIdsNow();
    const parsed = incorporatePlayerSchema.safeParse({
      game_id: gameId,
      player_id: playerId,
      dressed_ids: dressed,
    });
    if (!parsed.success) {
      const message = schemaError(parsed.error);
      if (message === 'already dressed') return t('trke_squad_incorporate_duplicate', 'That player is already dressed');
      if (message === 'at most 12 players') return t('trke_squad_incorporate_full', 'This game already has 12 dressed players');
      return message;
    }
    const { error } = await supabase.from('game_squads').insert({ game_id: gameId, player_id: playerId });
    if (error) return captureDbMessage(error.message);
    setSquadIds((current) => (current.includes(playerId) ? current : [...(current.length > 0 ? current : dressed), playerId]));
    return null;
  }

  async function replacePeriodSide(side: 'home' | 'away', ids: string[]) {
    const { error: deleteError } = await supabase
      .from('game_period_lineups')
      .delete()
      .eq('game_id', gameId)
      .eq('period_number', currentPeriod)
      .eq('side', side);
    if (deleteError) return deleteError.message;
    if (ids.length === 0) return null;
    const { error } = await supabase.from('game_period_lineups').insert(ids.map((id, index) => ({
      game_id: gameId,
      period_number: currentPeriod,
      side,
      position_index: index,
      player_id: side === 'home' ? id : null,
      opponent_player_id: side === 'away' ? id : null,
    })));
    return error ? captureDbMessage(error.message) : null;
  }

  async function savePeriodLineup(homeIds: string[], awayIds: string[]) {
    const parsed = periodLineupSchema.safeParse({
      game_id: gameId,
      period_number: currentPeriod,
      home_player_ids: homeIds,
      away_player_ids: awayIds,
    });
    if (!parsed.success) return schemaError(parsed.error);

    const squad = await ensureSmallTeamSquad();
    if (squad.error) return squad.error;
    if (parsed.data.home_player_ids.some((id) => !squad.ids.includes(id))) {
      return t('trke_period_lineup_not_dressed', 'Only a dressed player can start a period');
    }

    const homeError = await replacePeriodSide('home', parsed.data.home_player_ids);
    if (homeError) return homeError;
    const awayError = await replacePeriodSide('away', parsed.data.away_player_ids);
    if (awayError) return awayError;

    if (currentPeriod === 1 && !periodAlreadyStarted(1)) {
      await supabase.from('starting_lineups').delete().eq('game_id', gameId);
      if (parsed.data.home_player_ids.length > 0) {
        await supabase.from('starting_lineups').insert(parsed.data.home_player_ids.map((playerId, index) => ({
          game_id: gameId,
          player_id: playerId,
          position_index: index,
        })));
      }
      await supabase.from('game_opponent_lineups').delete().eq('game_id', gameId);
      if (parsed.data.away_player_ids.length > 0) {
        await supabase.from('game_opponent_lineups').insert(parsed.data.away_player_ids.map((playerId, index) => ({
          game_id: gameId,
          opponent_player_id: playerId,
          position_index: index,
        })));
      }
    }

    setPeriodLineups((current) => [
      ...current.filter((row) => row.period_number !== currentPeriod),
      ...parsed.data.home_player_ids.map((id, index) => ({
        period_number: currentPeriod,
        side: 'home' as const,
        position_index: index,
        player_id: id,
        opponent_player_id: null,
      })),
      ...parsed.data.away_player_ids.map((id, index) => ({
        period_number: currentPeriod,
        side: 'away' as const,
        position_index: index,
        player_id: null,
        opponent_player_id: id,
      })),
    ]);
    setShowPeriodLineup(false);
    if (!canStartPeriod(
      parsed.data.home_player_ids.length,
      parsed.data.away_player_ids.length,
      eliminatedCount('home'),
      eliminatedCount('away'),
    )) {
      setBoardNote(t('trke_period_lineup_saved_short', 'Saved. This period cannot start yet.'));
    } else {
      setBoardNote(null);
    }
    return null;
  }

  async function startClock() {
    if (clockRunningRef.current || subSide) return;
    if (blockUntilReady()) return;
    if (currentPeriod === 1 && !sideChosen) {
      setShowChooseSide(true);
      return;
    }
    const remaining = clockNow();
    holdClock(true, remaining);
    await updateGameState({
      clock_running: true,
      clock_remaining_ms: remaining,
    });
  }

  async function toggleClock() {
    if (shotStep || miss || turnoverStep || foulStep || subSide) return;
    if (!clockRunningRef.current && currentPeriod === 1 && !periodAlreadyStarted(1)) {
      if (blockUntilReady()) return;
      if (!sideChosen) {
        setShowChooseSide(true);
        return;
      }
      setShowJumpBall(true);
      return;
    }
    if (!clockRunningRef.current && blockUntilReady()) return;
    
    const remaining = clockNow();
    const newState = !clockRunningRef.current;
    holdClock(newState, remaining);
    await updateGameState({
      clock_running: newState,
      clock_remaining_ms: remaining,
    });
  }

  async function adjustClock(unit: 'minute' | 'second' | 'tenth', delta: number) {
    if (shotStep || miss || turnoverStep || foulStep) return;
    if (blockUntilReady()) return;
    const step = unit === 'minute' ? 60000 : unit === 'second' ? 1000 : 100;
    const max = getPeriodLengthMs(currentPeriod);
    const next = Math.max(0, Math.min(max, clockNow() + delta * step));
    holdClock(clockRunningRef.current, next);
    await updateGameState({ clock_remaining_ms: next });
  }

  async function advancePeriod() {
    const period = currentPeriodRef.current;
    const { error: periodError } = await supabase
      .from('game_periods')
      .upsert({
        game_id: gameId,
        period_number: period,
        clock_remaining_ms: clockNow(),
        duration_ms: getPeriodLengthMs(period),
        is_overtime: period > 4,
      }, {
        onConflict: 'game_id,period_number'
      });

    if (periodError) {
      console.error('Failed to record period end time:', periodError);
      alert(`Error recording period end time: ${periodError.message}`);
      return false;
    }

    const newPeriod = period + 1;
    const newPeriodLength = getPeriodLengthMs(newPeriod);
    holdClock(false, newPeriodLength, newPeriod);
    await updateGameState({
      current_period: newPeriod,
      clock_remaining_ms: newPeriodLength,
      clock_running: false,
    });
    setShowInbound(false);
    setInboundFlipped(null);
    return true;
  }

  async function finishGame() {
    const period = currentPeriodRef.current;
    gameStatusRef.current = 'final';
    holdClock(false, 0);
    const saved = await updateGameState({
      status: 'final',
      clock_running: false,
      clock_remaining_ms: 0,
    });
    if (!saved) {
      gameStatusRef.current = game?.status ?? '';
      return false;
    }
    const { error: periodError } = await supabase.from('game_periods').upsert({
      game_id: gameId,
      period_number: period,
      clock_remaining_ms: 0,
      duration_ms: getPeriodLengthMs(period),
      is_overtime: period > 4,
    }, {
      onConflict: 'game_id,period_number'
    });
    if (periodError) {
      console.error('Failed to record period end time:', periodError);
      return false;
    }
    setGame((prev) => (prev ? { ...prev, status: 'final' } : prev));
    return true;
  }

  function requestPeriodEnd(source: 'clock' | 'next') {
    if (noticeOpenRef.current || periodEndBusyRef.current) return;
    if (gameStatusRef.current === 'final') return;
    if (source === 'next') {
      if (shotStep || miss || turnoverStep || foulStep) return;
      if (blockUntilReady()) return;
    }
    const period = currentPeriodRef.current;
    if (source === 'clock' && shotStep) cancelShot(false);
    if (source === 'clock' && miss) cancelMiss(false);
    if (source === 'clock' && period < 4) {
      openCaptureNotice({ kind: 'period_ended' });
      return;
    }
    const outcome = periodOutcome(period, teamScoreRef.current, opponentScoreRef.current);
    if (outcome === 'next') {
      periodEndBusyRef.current = true;
      void advancePeriod().then((saved) => {
        if (saved) offerAttackChange();
      }).finally(() => {
        periodEndBusyRef.current = false;
      });
      return;
    }
    const remaining = clockNow();
    holdClock(false, remaining);
    void updateGameState({ clock_running: false, clock_remaining_ms: remaining });
    openCaptureNotice({ kind: outcome });
  }

  requestPeriodEndRef.current = requestPeriodEnd;

  function offerAttackChange() {
    if (currentPeriodRef.current === 3) {
      openCaptureNotice({ kind: 'attack_change' });
    }
  }

  async function confirmCaptureNotice() {
    const notice = captureNotice;
    if (!notice) return;
    if (notice.kind === 'timeout_cap' || notice.kind === 'attack_change') {
      closeCaptureNotice();
      return;
    }
    if (periodEndBusyRef.current) return;
    periodEndBusyRef.current = true;
    try {
      cancelTurnover();
      if (!foulSavingRef.current) cancelFoul();
      cancelShot(false);
      cancelSub();
      const saved = notice.kind === 'final' ? await finishGame() : await advancePeriod();
      if (saved) {
        closeCaptureNotice();
        if (notice.kind !== 'final') offerAttackChange();
      }
    } finally {
      periodEndBusyRef.current = false;
    }
  }

  function nextPeriod() {
    requestPeriodEnd('next');
  }

  async function assignPossession(side: 'home' | 'away') {
    if (shotStep || miss || turnoverStep || foulStep) return;
    if (possession === side) return;
    setPossession(side);
    await updateGameState({ possession: side });
  }

  async function handleChooseSide(attackRight: boolean) {
    setAttackRightFirst(attackRight);
    setSideChosen(true);
    setShowChooseSide(false);
    await updateGameState({ attack_right_first: attackRight });
  }

  async function flipCourt() {
    if (shotStep || miss || turnoverStep || foulStep) return;
    if (periodAlreadyStarted(currentPeriodRef.current)) return;
    const newDirection = !attackRightFirst;
    setAttackRightFirst(newDirection);
    await updateGameState({ attack_right_first: newDirection });
  }

  function leaveCapture() {
    router.push(`/team-manager/games/${gameId}`);
  }

  function openGameEditor() {
    const returnTo = encodeURIComponent(`/team-manager/games/${gameId}/capture`);
    router.push(`/admin/games/${gameId}?returnTo=${returnTo}`);
  }

  async function handleUndo() {
    if (shotStep || miss || turnoverStep || foulStep || subSide || events.length === 0) return;

    const lastEvent = events[0];
    const group = lastEvent.play_group_id
      ? events.filter((event) => event.play_group_id === lastEvent.play_group_id)
      : [lastEvent];
    const isOwnEvent = group.every((event) => event.recorded_by_user_id === currentUser?.id);

    if (!isOwnEvent) {
      if (!confirm('This event was recorded by another user. Undo anyway?')) {
        return;
      }
    }

    let homePoints = 0;
    let awayPoints = 0;
    group.forEach((event) => {
      if (!event.made || !event.points) return;
      if (event.player_id) homePoints += event.points;
      else if (event.opponent_player_id) awayPoints += event.points;
    });
    const priorPossession = group.find((event) => event.possession_before)?.possession_before;
    const nextTeam = Math.max(0, teamScore - homePoints);
    const nextOpponent = Math.max(0, opponentScore - awayPoints);
    const updates: Partial<Game> = {};
    if (homePoints) updates.team_score = nextTeam;
    if (awayPoints) updates.opponent_score = nextOpponent;
    if (priorPossession) updates.possession = priorPossession;
    if (homePoints) setTeamScore(nextTeam);
    if (awayPoints) setOpponentScore(nextOpponent);
    if (priorPossession) setPossession(priorPossession);
    if (Object.keys(updates).length) await updateGameState(updates);

    const removeIds = new Set(group.map((event) => event.id));
    const { error } = lastEvent.play_group_id
      ? await supabase.from('game_events').delete().eq('play_group_id', lastEvent.play_group_id)
      : await supabase.from('game_events').delete().eq('id', lastEvent.id);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setEvents((prev) => prev.filter((event) => !removeIds.has(event.id)));
      if (!priorPossession && lastEvent.event_type === 'turnover' && lastEvent.turnover_side) {
        setPossession(lastEvent.turnover_side);
        await updateGameState({ possession: lastEvent.turnover_side });
      }
    }
  }

  const homeStarterCount = periodLineups.filter((row) => row.period_number === currentPeriod && row.side === 'home').length;
  const awayStarterCount = periodLineups.filter((row) => row.period_number === currentPeriod && row.side === 'away').length;
  const inboundLineupReady = !loading
    && !showPeriodLineup
    && currentPeriod > 1
    && openingTipWinner != null
    && captureNotice?.kind !== 'attack_change'
    && !periodAlreadyStarted(currentPeriod)
    && canStartPeriod(homeStarterCount, awayStarterCount, eliminatedCount('home'), eliminatedCount('away'));

  useEffect(() => {
    if (inboundAnsweredPeriodRef.current === currentPeriod) return;
    setShowInbound(inboundLineupReady);
  }, [currentPeriod, inboundLineupReady]);

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-8">
        <div className="text-center">
          <p className="mb-4">{loadError}</p>
          <Link href={`/team-manager/games/${gameId}`} className="text-orange-500 hover:text-orange-400">
            Go to game management
          </Link>
        </div>
      </div>
    );
  }

  if (!game || !allowed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-8">
        <div className="text-center">
          <p className="mb-4">{t('trke_capture_not_allowed', 'Only a platform admin, or a team manager or club admin of this club, can record this game.')}</p>
          <Link href={`/team-manager/games/${gameId}`} className="text-orange-500 hover:text-orange-400">
            Go to game management
          </Link>
        </div>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const shotMarkerLabel = (event: GameEvent) => {
    if (event.player) return String(event.player.jersey_number);
    if (event.player_id) {
      const player = players.find((item) => item.id === event.player_id);
      if (player) return String(player.jersey_number);
    }
    if (event.opponent_player_id) {
      const player = opponentPlayers.find((item) => item.id === event.opponent_player_id);
      if (player) return String(opponentShirt(player));
    }
    return String(event.points || 0);
  };

  const shotMarkers = events
    .filter((event) => event.event_type === 'shot' && event.coord_x != null && event.coord_y != null)
    .map((event) => {
      const world = normalizedToWorld(event.coord_x!, event.coord_y!);
      return {
        id: event.id,
        x: world.x,
        y: world.y,
        made: event.made ?? false,
        points: event.points || 0,
        label: shotMarkerLabel(event),
      };
    });

  // Helper functions for lineup management
  const onCourtPlayers = players.filter(p => onCourtPlayerIds.includes(p.id));

  const attacking = isAttackingRight();
  const isOffense = possession === 'home';

  const matchStarted = currentPeriod > 1
    || events.length > 0
    || clockRunning
    || clockRemaining < getPeriodLengthMs(currentPeriod);
  const boardPeriodLabel = matchStarted
    ? getPeriodLabel(currentPeriod)
    : t('trke_jump_title', 'Jump ball');
  const lineupReady = onCourtPlayers.length > 0;
  const homePersonalFouls = teamFoulsBefore('home');
  const awayPersonalFouls = teamFoulsBefore('away');
  function playingIds(side: CaptureSide) {
    return side === 'home' ? onCourtPlayerIds : awayOnCourtIds;
  }

  function cancelSub() {
    if (subSavingRef.current) return;
    setSubSide(null);
    setSubError(null);
  }

  function armSub(side: CaptureSide) {
    if (subSavingRef.current || shotStep || miss || foulStep || turnoverStep || clockRunningRef.current) return;
    if (subSide === side) {
      cancelSub();
      return;
    }
    if (playingIds(side).length === 0) {
      setBoardNote(t('trke_sub_hint_lineup', 'Pon el quinteto antes de un cambio'));
      return;
    }
    setSubError(null);
    setSubSide(side);
    setPendingAction(null);
    setBoardNote(null);
  }

  function subChoices(side: CaptureSide): SubstitutionChoice[] {
    if (side === 'home') {
      const order = new Map(onCourtPlayerIds.map((id, index) => [id, index]));
      return dressedPlayers()
        .map((player) => ({
          id: player.id,
          jersey: player.jersey_number,
          name: player.full_name,
          avatarUrl: player.avatar_url,
          onCourt: onCourtPlayerIds.includes(player.id),
          eliminated: playerIsOut(player.id, 'home'),
        }))
        .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.jersey - b.jersey);
    }
    const order = new Map(awayOnCourtIds.map((id, index) => [id, index]));
    return opponentPlaying
      .map((player) => ({
        id: player.id,
        jersey: opponentShirt(player),
        name: player.name?.trim() || game?.opponent_name || 'Away',
        avatarUrl: null,
        onCourt: awayOnCourtIds.includes(player.id),
        eliminated: playerIsOut(player.id, 'away'),
      }))
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.jersey - b.jersey);
  }

  function subErrorText(code: string) {
    if (code === 'substitution_eliminated') return t('trke_sub_hint_eliminated', 'Ese jugador ya está eliminado');
    if (code === 'substitution_out') return t('trke_sub_hint_out', 'Toca quién sale');
    if (code === 'substitution_in') return t('trke_sub_hint_in', 'Toca quién entra del banquillo');
    if (code === 'substitution_period' || code === 'substitution_lineup') {
      return t('trke_sub_hint_lineup', 'Pon el quinteto antes de un cambio');
    }
    return t('trke_sub_hint_error', 'No se ha podido guardar el cambio');
  }

  async function saveSubstitution(side: CaptureSide, swaps: SubstitutionSwap[]) {
    if (subSavingRef.current || swaps.length === 0 || clockRunningRef.current) return;
    subSavingRef.current = true;
    setSubSaving(true);
    setSubError(null);
    try {
      const result = await commitCapturePlay({
        play: 'substitution',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: clockNow(),
        side,
        swaps,
      });
      if ('error' in result) {
        setSubError(subErrorText(result.error));
        return;
      }
      const query = supabase
        .from('game_events')
        .select(`
          *,
          player:players!game_events_player_id_fkey(full_name, jersey_number, avatar_url),
          player_out:players!game_events_player_out_id_fkey(full_name, jersey_number, avatar_url)
        `);
      const { data } = result.groupId
        ? await query.eq('play_group_id', result.groupId)
        : await query.eq('id', result.id);
      if (data) {
        setEvents((prev) => {
          const ids = new Set(prev.map((event) => event.id));
          const added = data.filter((event) => !ids.has(event.id));
          return added.length ? [...added, ...prev] : prev;
        });
      }
      setSubSide(null);
      setSubError(null);
      setBoardNote(t('trke_sub_hint_saved', 'Cambio guardado'));
    } catch {
      setSubError(t('trke_sub_hint_error', 'No se ha podido guardar el cambio'));
    } finally {
      subSavingRef.current = false;
      setSubSaving(false);
    }
  }

  function handleBoardAction(side: 'home' | 'away', action: CaptureBoardAction) {
    if (shotSavingRef.current || missSavingRef.current || turnoverSavingRef.current || foulSavingRef.current || subSavingRef.current) return;
    if (subSide) return;
    if (miss) {
      if (side === miss.side && action === pendingAction) cancelMiss();
      return;
    }
    if (shotStep) {
      if (side === shotSide && action === pendingAction) cancelShot();
      return;
    }
    if (foulStep) {
      if (action === 'foul' && side === foulSide) cancelFoul();
      return;
    }
    if (turnoverStep) {
      if (action === 'turnover' && side === turnoverSide) cancelTurnover();
      return;
    }
    if (action === 'miss' || action === 'miss_personal') {
      armMiss(side, action === 'miss_personal');
      return;
    }
    if (action === 'made' || action === 'made_personal') {
      armMade(side, action === 'made_personal');
      return;
    }
    if (action === 'turnover') {
      armTurnover(side);
      return;
    }
    if (action === 'foul') {
      armFoul(side);
      return;
    }
    if (side === 'away') {
      setPendingAction(null);
      setBoardNote('Opponent numbers will sit in the gray column. This tablet records your team.');
    }
  }

  const actionHint = boardNote
    ?? (pendingAction === 'turnover'
      ? t('trke_turnover_hint_court', 'Tap the court where the ball was lost')
      : '');

  const scoreAtShot = scoreAfterMadeShots(events);
  const seenSubGroups = new Set<string>();
  const seenFreeThrowGroups = new Set<string>();
  const logEvents: GameEvent[] = [];
  for (const event of [...events].sort(newerCaptureEvent)) {
    if (logEvents.length >= 40) break;
    if (event.event_type === 'assist') continue;
    if (event.event_type === 'substitution' && event.play_group_id) {
      if (seenSubGroups.has(event.play_group_id)) continue;
      seenSubGroups.add(event.play_group_id);
    }
    if (event.event_type === 'free_throw' && event.play_group_id) {
      if (seenFreeThrowGroups.has(event.play_group_id)) continue;
      seenFreeThrowGroups.add(event.play_group_id);
    }
    logEvents.push(event);
  }

  const logItems = logEvents.map((event) => {
    const opponent = event.opponent_player_id
      ? opponentPlayers.find((player) => player.id === event.opponent_player_id)
      : null;
    const who = event.player
      ? `#${event.player.jersey_number} ${event.player.full_name}`
      : opponent
        ? `#${opponentShirt(opponent)} ${opponent.name?.trim() || game.opponent_name || 'Away'}`
        : 'Team';
    let title = event.event_type.replaceAll('_', ' ').toUpperCase();
    let detail = who;
    if (event.event_type === 'shot') {
      const score = event.made ? scoreAtShot.get(event.id) : null;
      title = event.made ? `Shot made${score ? ` · ${score}` : ''}` : 'SHOT MISSED';
      const assist = event.play_group_id
        ? events.find((item) => item.event_type === 'assist' && item.play_group_id === event.play_group_id)
        : null;
      const assistWho = assist?.player
        ? `#${assist.player.jersey_number}`
        : (() => {
          const mate = assist?.opponent_player_id
            ? opponentPlayers.find((player) => player.id === assist.opponent_player_id)
            : null;
          return mate ? `#${opponentShirt(mate)}` : '';
        })();
      detail = assistWho
        ? `${who} · ${event.points ?? 0}P · ${t('trke_made_log_assist', 'assist')} ${assistWho}`
        : `${who} · ${event.points ?? 0}P`;
    } else if (event.event_type === 'rebound') {
      title = event.is_offensive
        ? t('trke_offensive_rebound', 'Offensive Rebound')
        : t('trke_defensive_rebound', 'Defensive Rebound');
      detail = who;
    } else if (event.event_type === 'free_throw') {
      const group = event.play_group_id
        ? events.filter((item) => item.event_type === 'free_throw' && item.play_group_id === event.play_group_id)
        : [event];
      const ordered = [...group].sort((a, b) => {
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      const lastMade = [...ordered].reverse().find((item) => item.made);
      const score = lastMade ? scoreAtShot.get(lastMade.id) : null;
      const label = ordered.length === 1
        ? t('trke_ft_log_one', 'Free throw')
        : t('trke_ft_log_many', 'Free throws');
      title = score ? `${label} · ${score}` : label;
      const marks = ordered.map((item) => (
        item.made
          ? t('trke_ft_sequence_made', 'Made')
          : t('trke_ft_sequence_miss', 'Miss')
      ));
      detail = [who, ...marks].join('\n');
    } else if (event.event_type === 'foul') {
      const coachName = event.coach_technical_side === 'home'
        ? (homeCoachName || 'Coach')
        : event.coach_technical_side === 'away'
          ? (awayCoachName || 'Coach')
          : null;
      const ordinal = foulOrdinalCopy(playerFoulNumber(event));
      const place = ordinal ? t(ordinal.key, ordinal.fallback) : '';
      const label = event.coach_technical_side
        ? 'TECHNICAL'
        : event.foul_context === 'offensive'
          ? t('trke_foul_log_attack', 'Attack foul')
          : event.foul_type === 'personal' || !event.foul_type
            ? t('trke_foul_log_defensive', 'Defensive foul')
            : event.foul_type in foulKindKey
              ? t(foulKindKey[event.foul_type as FoulKind], foulKindFallback[event.foul_type as FoulKind])
              : t('trke_foul', 'Foul');
      title = place && !event.coach_technical_side ? `${label} · ${place}` : label;
      detail = coachName ?? who;
    } else if (
      event.event_type === 'turnover'
      && (
        event.turnover_type === 'shot_clock'
        || event.turnover_type === 'eight_seconds'
        || (event.turnover_type === 'five_seconds' && !event.player_id && !event.opponent_player_id)
      )
    ) {
      const violation = event.turnover_type === 'shot_clock'
        ? t('trke_shot_clock_log', '24-second possession violation')
        : event.turnover_type === 'eight_seconds'
          ? t('trke_eight_seconds_log', 'Did not cross half court in 8 seconds')
          : t('trke_five_seconds_log', 'Did not inbound in 5 seconds');
      title = `${t('trke_turnover_log', 'Pérdida')} ${t('trke_game_team', 'Equipo').toLocaleLowerCase()} · ${violation}`;
      detail = event.turnover_side === 'away'
        ? (game.opponent_name || 'Away')
        : (game.teams?.name || 'Home');
    } else if (event.event_type === 'turnover') {
      const reasonId = event.turnover_type;
      const reasonKey = reasonId && reasonId in turnoverReasonKey
        ? turnoverReasonKey[reasonId as TurnoverReason]
        : null;
      title = reasonKey
        ? `${t('trke_turnover_log', 'Turnover')} · ${t(reasonKey, turnoverReasonFallback[reasonId as TurnoverReason])}`
        : t('trke_turnover_log', 'Turnover');
      if (event.turnover_side === 'away') {
        const opponent = opponentPlayers.find((player) => player.id === event.opponent_player_id);
        detail = opponent
          ? `#${opponentShirt(opponent)} ${opponent.name?.trim() || game.opponent_name || ''}`.trim()
          : who;
      } else if (event.player) {
        detail = `#${event.player.jersey_number} ${event.player.full_name}`;
      }
      if (event.turnover_type === 'technical') {
        detail = `${detail} · ${t('trke_turnover_one_free_throw', '1 free throw')}`;
      }
    } else if (event.event_type === 'timeout') {
      title = t('trke_timeout_log', 'Timeout');
      detail = event.timeout_side === 'away'
        ? (game.opponent_name || 'Away')
        : (game.teams?.name || 'Home');
    } else if (event.event_type === 'substitution') {
      const group = event.play_group_id
        ? events.filter((item) => item.event_type === 'substitution' && item.play_group_id === event.play_group_id)
        : [event];
      const ordered = [...group].sort((a, b) => (
        a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
      ));
      const pairs = ordered.flatMap((item) => {
        const leaves = item.player_out
          ? `#${item.player_out.jersey_number}`
          : (() => {
            const leaving = item.opponent_player_out_id
              ? opponentPlayers.find((player) => player.id === item.opponent_player_out_id)
              : null;
            return leaving ? `#${opponentShirt(leaving)}` : '';
          })();
        const enters = item.player
          ? `#${item.player.jersey_number}`
          : (() => {
            const arriving = item.opponent_player_id
              ? opponentPlayers.find((player) => player.id === item.opponent_player_id)
              : null;
            return arriving ? `#${opponentShirt(arriving)}` : '';
          })();
        return leaves && enters
          ? [`${t('trke_out', 'Sale')} ${leaves} → ${t('trke_in', 'Entra')} ${enters}`]
          : [];
      });
      title = t('trke_cambio', 'Cambio');
      detail = pairs.join('\n');
    }
    return {
      id: event.id,
      periodLabel: getPeriodLabel(event.period_number),
      clock: formatTime(event.clock_remaining_ms),
      title,
      detail,
      period: event.period_number,
      clockMs: event.clock_remaining_ms,
      at: event.created_at ?? '',
      step: playStep(event.event_type),
    };
  });

  const enteredAtTip = [...new Set(periodLineups.map((row) => row.period_number))]
    .sort((a, b) => b - a)
    .flatMap((period) => (['home', 'away'] as const).flatMap((side) => {
      const names = idsForPeriod(period, side).flatMap((id) => {
        const name = side === 'home'
          ? (() => {
            const player = players.find((item) => item.id === id);
            return player ? `#${player.jersey_number} ${player.full_name}` : '';
          })()
          : (() => {
            const player = opponentPlayers.find((item) => item.id === id);
            return player
              ? `#${opponentShirt(player)} ${player.name?.trim() || game.opponent_name || 'Away'}`
              : '';
          })();
        return name ? [name] : [];
      });
      if (names.length === 0) return [];
      const team = side === 'home'
        ? (game.teams?.name || 'Home')
        : (game.opponent_name || 'Away');
      return [{
        id: `enter-${period}-${side}`,
        periodLabel: getPeriodLabel(period),
        clock: formatTime(getPeriodLengthMs(period)),
        title: `${t('trke_sub_in', 'Entra')} · ${team}`,
        detail: names.join('\n'),
        period,
        clockMs: getPeriodLengthMs(period),
        at: '',
        step: -1,
      }];
    }));

  const visibleLog = [...logItems, ...enteredAtTip]
    .sort((a, b) => {
      if (a.period !== b.period) return b.period - a.period;
      if (a.clockMs !== b.clockMs) return a.clockMs - b.clockMs;
      if (a.at !== b.at) return a.at < b.at ? 1 : -1;
      return b.step - a.step;
    })
    .slice(0, 40)
    .map((row) => ({
      id: row.id,
      periodLabel: row.periodLabel,
      clock: row.clock,
      title: row.title,
      detail: row.detail,
    }));

  const teamLabel = (side: 'home' | 'away') => (
    side === 'home' ? (game.teams?.name || 'Home') : (game.opponent_name || 'Away')
  );

  const withTeam = (key: string, fallback: string, side: 'home' | 'away') => (
    t(key, fallback).split('{team}').join(teamLabel(side))
  );

  const proposedSide = openingTipWinner ? periodInbound(currentPeriod, openingTipWinner) : null;

  const homePlayingIds = onCourtPlayerIds.length > 0 ? onCourtPlayerIds : suggestedStarterIds('home');
  const awayPlayingIds = awayOnCourtIds.length > 0 ? awayOnCourtIds : suggestedStarterIds('away');

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <CaptureBoard
          homeName={game.teams?.name || 'Home'}
          awayName={game.opponent_name || 'Away'}
          homeScore={teamScore}
          awayScore={opponentScore}
          possession={possession}
          periodLabel={boardPeriodLabel}
          subscribeClock={subscribeClock}
          getClockFace={getClockFace}
          clockRunning={clockRunning}
          canControlClock
          idleClockLabel={
            currentPeriod === 1 && !periodAlreadyStarted(1)
              ? t('trke_salto_inicial', 'Jump')
              : undefined
          }
          onAdjustClock={(unit, delta) => { void adjustClock(unit, delta); }}
          onToggleClock={() => { void toggleClock(); }}
          homePlayers={homePlayingIds.flatMap((id) => {
            const player = players.find((item) => item.id === id);
            if (!player) return [];
            return [{
              id: player.id,
              jersey: player.jersey_number,
              fouls: personalFoulCount(player.id, 'home'),
              name: player.full_name,
              avatarUrl: player.avatar_url,
              onCourt: true,
              eliminated: playerIsOut(player.id, 'home'),
            }];
          })}
          awayPlayers={awayPlayingIds.flatMap((id) => {
            const player = opponentPlayers.find((item) => item.id === id && !item.is_coach);
            if (!player) return [];
            return [{
              id: player.id,
              jersey: opponentShirt(player),
              fouls: personalFoulCount(player.id, 'away'),
              name: player.name?.trim() || game.opponent_name || 'Away',
              eliminated: playerIsOut(player.id, 'away'),
            }];
          })}
          homeBench={[...dressedPlayers()]
            .sort((a, b) => a.jersey_number - b.jersey_number)
            .map((player) => ({
              id: player.id,
              jersey: player.jersey_number,
              fouls: personalFoulCount(player.id, 'home'),
              name: player.full_name,
              avatarUrl: player.avatar_url,
              onCourt: homePlayingIds.includes(player.id),
              eliminated: playerIsOut(player.id, 'home'),
            }))}
          awayBench={opponentPlaying.map((player) => ({
            id: player.id,
            jersey: opponentShirt(player),
            fouls: personalFoulCount(player.id, 'away'),
            name: player.name?.trim() || game.opponent_name || 'Away',
            onCourt: awayPlayingIds.includes(player.id),
            eliminated: playerIsOut(player.id, 'away'),
          }))}
          homePersonalFouls={homePersonalFouls}
          awayPersonalFouls={awayPersonalFouls}
          homeTimeoutsUsed={countTimeouts(events, 'home', currentPeriod)}
          awayTimeoutsUsed={countTimeouts(events, 'away', currentPeriod)}
          timeoutMax={timeoutWindow(currentPeriod).max}
          cambioLabel={t('trke_cambio', 'Change')}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelDeleteLabel={t('trke_cancel_delete', 'Cancel and delete')}
          timeoutLabel={t('trke_timeout_short', 'TO')}
          foulsLabel={t('trke_period_fouls', 'Fouls')}
          clockViolationsEnabled={!shotStep && !miss && !turnoverStep && !foulStep && !subSide}
          onShotClock={(side) => { void recordClockViolation('shot_clock', side); }}
          onEightSeconds={(side) => { void recordClockViolation('eight_seconds', side); }}
          onFiveSeconds={(side) => { void recordClockViolation('five_seconds', side); }}
          onTimeout={(side) => { void recordTimeout(side); }}
          timeoutTickSide={timeoutTickSide}
          activeAction={
            miss ? (miss.personal ? 'miss_personal' : 'miss')
              : shotStep ? (shotPersonal ? 'made_personal' : 'made')
                : foulStep ? 'foul'
                  : pendingAction
          }
          madePersonalLabel={t('trke_made_and_personal', 'Made and a personal foul')}
          missPersonalLabel={t('trke_miss_and_personal', 'Miss and a personal foul')}
          activeSide={miss ? miss.side : shotStep ? shotSide : foulStep ? foulSide : turnoverSide}
          onAction={handleBoardAction}
          homeActionsEnabled={{
            made: lineupReady && possession === 'home',
            made_personal: lineupReady && possession === 'home',
            miss: lineupReady && possession === 'home',
            miss_personal: lineupReady && possession === 'home',
            foul: lineupReady,
            turnover: possession === 'home' && onCourtPlayers.length > 0,
          }}
          awayTurnoverEnabled={possession === 'away' && courtRoster('away').length > 0}
          courtPickSide={
            miss?.step === 'rebound'
              ? 'both'
              : miss?.step === 'shooter'
                ? miss.side
                : miss?.step === 'fouler'
                  ? otherCaptureSide(miss.side)
                  : shotStep === 'shooter'
                    ? shotSide
                    : shotStep === 'fouler' && shotSide
                      ? otherCaptureSide(shotSide)
                      : foulStep === 'player'
                        ? foulSide
                        : foulStep === 'other' && foulSide
                          ? otherCaptureSide(foulSide)
                          : turnoverStep === 'player'
                            ? turnoverSide
                            : null
          }
          onCourtPlayer={
            miss && (miss.step === 'shooter' || miss.step === 'rebound' || miss.step === 'fouler')
              ? selectMissPlayer
              : shotStep === 'shooter' || shotStep === 'fouler'
                ? selectShotCourtPlayer
                : foulStep
                  ? selectFoulCourtPlayer
                  : selectTurnoverCourtPlayer
          }
          cambioSide={subSide}
          onCambio={armSub}
          benchPickSide={null}
          onBenchPlayer={() => undefined}
          selectedCourtId={null}
          homeColor={normalizeHexColor(
            game.kit_color === 'secondary' ? game.teams?.clubs?.secondary_color : game.teams?.clubs?.primary_color,
            '#171717',
          )}
          awayColor={normalizeHexColor(game.opponent_color)}
          hint={actionHint}
          onStepBack={miss ? stepMissBack : shotStep ? stepShotBack : foulStep ? stepFoulBack : undefined}
          onCancelDelete={miss ? () => cancelMiss() : shotStep ? () => cancelShot() : foulStep ? () => cancelFoul() : undefined}
          logItems={visibleLog}
          onUndo={() => { void handleUndo(); }}
          canUndo={events.length > 0}
          nextLabel="Next"
          onNextPeriod={() => { void nextPeriod(); }}
          quintetoLabel={t('trke_quinteto', 'Quinteto')}
          onQuinteto={
            game.status !== 'final' && currentPeriod > 1 && !periodAlreadyStarted(currentPeriod)
              ? () => setShowPeriodLineup(true)
              : undefined
          }
          onFlipCourt={
            game.status !== 'final' && !periodAlreadyStarted(currentPeriod)
              ? () => { void flipCourt(); }
              : undefined
          }
          onEditGame={canEditGame ? openGameEditor : undefined}
          editLabel={t('trke_game_edit', 'Edit game')}
          onBack={leaveCapture}
          homeCoach={homeCoachName ? { name: homeCoachName } : null}
          awayCoach={awayCoachName ? { name: awayCoachName } : null}
          onHomeCoach={homeCoachName ? () => { armCoachTechnical('home'); } : undefined}
          onAwayCoach={awayCoachName ? () => { armCoachTechnical('away'); } : undefined}
          onEditAwayBench={
            game.status !== 'final' && opponentPlaying.length < 12
              ? () => setShowOpponentBenchAdd(true)
              : undefined
          }
          editBenchLabel={t('trke_opponent_bench_edit', 'Edit bench')}
          canSetPossession
          onSetPossession={(side) => { void assignPossession(side); }}
          homeAttacksRight={attacking}
          court={(
            <BasketballCourt
              onCourtTap={handleCourtTap}
              shotMarkers={shotMarkers}
              placement={(turnoverStep || foulStep || (shotStep && shotStep !== 'court') || (miss && miss.step !== 'court')) && tapCoordinates ? tapCoordinates : null}
              attackingRight={attacking}
              isOffense={isOffense}
              showAttackBar={clockRunning && (possession === 'home' || possession === 'away')}
              opponentCode={opponentMark(game.opponent_name || '')}
              opponentColor={normalizeHexColor(game.opponent_color)}
              teamLogoUrl={game.teams?.clubs?.logo_url || null}
              tableOnBottom={tableOnFarSideline ? !attackRightFirst : attackRightFirst}
              logoInverted={tableOnFarSideline}
              tableLabel={t('trke_scorer_table', "Scorer's table")}
            />
          )}
        />
      </div>

      {captureNotice && game ? (
        <CaptureNoticeModal
          title={captureNotice.kind === 'final' ? t('trke_game_finished_notice', 'Game finished') : undefined}
          body={
            captureNotice.kind === 'timeout_cap'
              ? captureNotice.body
              : captureNotice.kind === 'period_ended'
                ? t('trke_period_ended_notice', 'Period ended')
                : captureNotice.kind === 'attack_change'
                  ? t('trke_attack_change_notice', 'Change the attacking basket.')
                  : captureNotice.kind === 'overtime'
                  ? t('trke_overtime_notice', 'The score is tied. Overtime starts.')
                  : `${game.teams?.name || 'Home'} ${teamScore}\n${game.opponent_name || 'Away'} ${opponentScore}`
          }
          confirmLabel={t('trke_notice_ok', 'OK')}
          onConfirm={() => { void confirmCaptureNotice(); }}
        />
      ) : null}

      {showInbound && proposedSide ? (
        <PeriodInboundModal
          proposal={withTeam('trke_inbound_proposal', '{team} will inbound.', proposedSide)}
          question={t('trke_held_ball_question', 'Was there a held ball?')}
          yesLabel={t('trke_held_ball_yes', 'Yes')}
          noLabel={t('trke_held_ball_no', 'No')}
          flipped={inboundFlipped
            ? withTeam('trke_inbound_flipped', 'Possession changes to {team}.', inboundFlipped)
            : null}
          okLabel={t('trke_notice_ok', 'OK')}
          onNo={() => { void keepProposedInbound(); }}
          onYes={() => { void acceptHeldBall(); }}
          onAck={acknowledgeInboundFlip}
        />
      ) : null}

      {/* Modals */}
      {subSide && (
        <SubstitutionPopup
          t={t}
          teamName={subSide === 'home' ? (game.teams?.name || 'Home') : (game.opponent_name || 'Away')}
          color={subSide === 'home'
            ? normalizeHexColor(
              game.kit_color === 'secondary' ? game.teams?.clubs?.secondary_color : game.teams?.clubs?.primary_color,
              '#171717',
            )
            : normalizeHexColor(game.opponent_color)}
          players={subChoices(subSide)}
          saving={subSaving}
          error={subError}
          addFirstNote={
            subSide === 'away' && !opponentPlaying.some((player) => (
              !awayOnCourtIds.includes(player.id) && !playerIsOut(player.id, 'away')
            ))
              ? t('trke_sub_add_player_first', 'Add the player with the pencil on the bench, then substitute.')
              : null
          }
          onConfirm={(swaps) => { void saveSubstitution(subSide, swaps); }}
          onClose={cancelSub}
        />
      )}

      {showChooseSide && (
        <ChooseSideModal onChoose={handleChooseSide} />
      )}

      {showTurnoverMenu && (
        <TurnoverReasonModal
          reasons={turnoverReasons.map((id) => ({
            id,
            label: t(turnoverReasonKey[id], turnoverReasonFallback[id]),
          }))}
          cancelLabel={t('trke_turnover_cancel', 'Cancel')}
          disabled={turnoverSaving}
          selectedId={turnoverReasonPicked}
          onSelect={chooseTurnoverReason}
          onClose={cancelTurnover}
        />
      )}

      {showFoulThrowCount && (
        <MadeFreeThrowCountPopup
          t={t}
          saving={false}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelDeleteLabel={t('trke_cancel_delete', 'Cancel and delete')}
          onPick={(count) => {
            setFoulThrowCount(count);
            setShowFoulThrowCount(false);
            setShowFreeThrowScript(true);
            setBoardNote(t('trke_made_hint_ft', 'Mark the free throw'));
          }}
          onStepBack={stepFoulBack}
          onCancel={() => cancelFoul()}
        />
      )}

      {showFreeThrowScript && foulThrowCount ? (
        <FreeThrowSequencePopup
          t={t}
          count={foulThrowCount}
          onConfirm={handleFreeThrowScriptConfirm}
          onClose={stepFoulBack}
        />
      ) : null}

      {shotStep === 'assist' && shotSide && shotShooterId && shotPoints ? (
        <MadeAssistPopup
          t={t}
          players={courtRoster(shotSide)
            .filter((player) => player.id !== shotShooterId && !playerIsOut(player.id, shotSide))
            .map((player) => ({
              id: player.id,
              jersey: player.jersey_number,
              name: player.full_name,
            }))}
          allowNone={!madeAssistRequired(
            shotPoints,
            shotPaint,
            courtRoster(shotSide).filter((player) => player.id !== shotShooterId && !playerIsOut(player.id, shotSide)).length,
          )}
          saving={shotSaving}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelDeleteLabel={t('trke_cancel_delete', 'Cancel and delete')}
          onPick={(playerId) => chooseMadeAssist(playerId)}
          onNone={() => chooseMadeAssist(null)}
          onStepBack={stepShotBack}
          onCancel={() => cancelShot()}
        />
      ) : null}

      {shotStep === 'ft' && shotFoulerId && !shotThrowCount ? (
        <MadeFreeThrowCountPopup
          t={t}
          saving={shotSaving}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelDeleteLabel={t('trke_cancel_delete', 'Cancel and delete')}
          onPick={(count) => {
            setShotThrowCount(count);
            setBoardNote(t('trke_made_hint_ft', 'Mark the free throw'));
          }}
          onStepBack={stepShotBack}
          onCancel={() => cancelShot()}
        />
      ) : null}

      {shotStep === 'ft' && shotFoulerId && shotThrowCount ? (
        <FreeThrowSequencePopup
          t={t}
          count={shotThrowCount}
          onConfirm={(result) => { void saveMade({ foulerId: shotFoulerId, throws: result.shots }); }}
          onClose={stepShotBack}
        />
      ) : null}

      {miss?.step === 'ft' && miss.foulerId && !miss.throwCount ? (
        <MadeFreeThrowCountPopup
          t={t}
          saving={missSaving}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelDeleteLabel={t('trke_cancel_delete', 'Cancel and delete')}
          onPick={(count) => {
            const next = missChooseThrowCount(miss, count);
            if (!next) return;
            setMiss(next);
            setBoardNote(t('trke_made_hint_ft', 'Mark the free throw'));
          }}
          onStepBack={stepMissBack}
          onCancel={() => cancelMiss()}
        />
      ) : null}

      {miss?.step === 'ft' && miss.foulerId && miss.throwCount ? (
        <FreeThrowSequencePopup
          t={t}
          count={miss.throwCount}
          onConfirm={(result) => { void saveMiss(miss, result.shots); }}
          onClose={stepMissBack}
        />
      ) : null}

      {showOpponentBenchAdd && (
        <OpponentBenchAddModal
          t={t}
          players={opponentPlaying.map((player) => ({
            id: player.id,
            jerseyNumber: opponentShirt(player),
            name: player.name?.trim() || '',
          }))}
          onAdd={addOpponentBenchPlayer}
          onClose={() => setShowOpponentBenchAdd(false)}
        />
      )}

      {showOpponentRoster && (
        <OpponentRosterModal
          t={t}
          lineupLocked={opponentLineupLocked}
          canClose={opponentPlaying.length > 0 || opponentLineupLocked}
          initialPlayers={opponentRosterDraft}
          onSave={saveOpponentRoster}
          onClose={() => setShowOpponentRoster(false)}
        />
      )}

      {showSquad && (
        <SquadPickerModal
          t={t}
          players={players.filter((player) => !player.is_guest).map((player) => ({
            id: player.id,
            jersey: player.jersey_number,
            name: player.full_name,
          }))}
          initialIds={squadIds}
          canClose={squadIds.length === 12}
          onSave={saveSquad}
          onClose={() => setShowSquad(false)}
        />
      )}

      {showPeriodLineup && (
        <PeriodLineupModal
          t={t}
          periodLabel={getPeriodLabel(currentPeriod)}
          homeName={game.teams?.name || 'Home'}
          awayName={game.opponent_name || 'Away'}
          homePlayers={dressedPlayers().map((player) => ({
            id: player.id,
            jersey: player.jersey_number,
            name: player.full_name,
            avatarUrl: player.avatar_url,
            eliminated: playerIsOut(player.id, 'home'),
          }))}
          awayPlayers={opponentPlaying.map((player) => ({
            id: player.id,
            jersey: opponentShirt(player),
            name: player.name?.trim() || game.opponent_name || 'Away',
            eliminated: playerIsOut(player.id, 'away'),
          }))}
          initialHomeIds={suggestedStarterIds('home')}
          initialAwayIds={suggestedStarterIds('away')}
          homeRequired={minimumToStart(eliminatedCount('home'))}
          awayRequired={minimumToStart(eliminatedCount('away'))}
          undressedPlayers={teamSheet()
            .filter((player) => !dressedIdsNow().includes(player.id))
            .map((player) => ({
              id: player.id,
              jersey: player.jersey_number,
              name: player.full_name,
              avatarUrl: player.avatar_url,
              eliminated: false,
            }))}
          onIncorporate={incorporatePlayer}
          onSave={savePeriodLineup}
          onClose={() => setShowPeriodLineup(false)}
        />
      )}

      {showJumpBall && (
        <JumpBallPopup
          t={t}
          clockRunning={clockRunning}
          homeName={game.teams?.name || 'Home'}
          awayName={game.opponent_name || 'Away'}
          homePlayers={[...onCourtPlayers]
            .sort((a, b) => a.jersey_number - b.jersey_number)
            .map((player) => ({
              id: player.id,
              jersey: player.jersey_number,
              name: player.full_name,
              avatarUrl: player.avatar_url,
            }))}
          awayPlayers={awayOnCourtIds.flatMap((id) => {
            const player = opponentPlayers.find((item) => item.id === id);
            if (!player) return [];
            return [{
              id: player.id,
              jersey: opponentShirt(player),
              name: player.name?.trim() || '',
              avatarUrl: null,
            }];
          })}
          awayColor={normalizeHexColor(game.opponent_color)}
          onStartClock={() => { void startClock(); }}
          onConfirm={handleJumpBallConfirm}
          onClose={() => setShowJumpBall(false)}
        />
      )}

      {foulStep === 'type' && foulSide && (
        <FoulSituationModal
          hint={t('trke_foul_hint_type', 'Choose the foul')}
          choices={foulKinds.map((id) => ({
            id,
            label: id === 'personal' && foulOffense
              ? t('trke_foul_offensive', 'Offensive foul')
              : t(foulKindKey[id], foulKindFallback[id]),
          }))}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelLabel={t('trke_cancel_delete', 'Cancel and delete')}
          disabled={foulPick !== null}
          selectedId={foulPick}
          onSelect={(id) => chooseFoulKind(id as FoulKind)}
          onStepBack={stepFoulBack}
          onClose={cancelFoul}
        />
      )}
    </div>
  );
}
