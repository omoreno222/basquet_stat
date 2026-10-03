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
import { OpponentRosterModal, type OpponentRosterInput } from './components/OpponentRosterModal';
import { SquadPickerModal } from './components/SquadPickerModal';
import { PeriodLineupModal } from './components/PeriodLineupModal';
import { ChooseSideModal } from './components/ChooseSideModal';
import { TurnoverReasonModal } from './components/TurnoverReasonModal';
import { FoulSituationModal } from './components/FoulSituationModal';
import { commitCapturePlay } from './actions';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import {
  foulCountsForPlayer,
  foulCountsForTeam,
  foulEjects,
  foulFreeThrowCount,
  foulKindFallback,
  foulKindKey,
  foulKinds,
  foulNeedsOther,
  offenseAttacksRight,
  otherCaptureSide,
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
import { gameSquadSchema, incorporatePlayerSchema, opponentRosterSchema, periodLineupSchema, schemaError } from '@/lib/form-schemas';
import { userManagesClub } from '@/lib/live-access';
import { canStartPeriod, isEliminated, minimumToStart } from '@/lib/period-lineup';
import { Profile } from '@/lib/types';
import type { GameOpponentPlayer } from '@/types/database';

const TURNOVER_REASON_CLOSE_MS = 600;

function opponentShirt(player: GameOpponentPlayer) {
  return player.jersey_number ?? 0;
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

/** Above one minute the board shows mm:ss. In the final minute it shows ss:d (tenths). */
function scoreboardClock(remainingMs: number): { lastMinute: boolean; left: string; right: string } {
  const ms = Math.max(0, remainingMs);
  if (ms < 60_000) {
    const seconds = Math.floor(ms / 1000);
    const tenth = Math.floor((ms % 1000) / 100);
    return {
      lastMinute: true,
      left: seconds.toString().padStart(2, '0'),
      right: String(tenth),
    };
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    lastMinute: false,
    left: minutes.toString().padStart(2, '0'),
    right: seconds.toString().padStart(2, '0'),
  };
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
  const [foulStep, setFoulStep] = useState<'court' | 'player' | 'type' | 'situation' | 'other' | null>(null);
  const [foulOffenderId, setFoulOffenderId] = useState<string | null>(null);
  const [foulKind, setFoulKind] = useState<FoulKind | null>(null);
  const [foulContext, setFoulContext] = useState<FoulContext | null>(null);
  const [foulCoach, setFoulCoach] = useState(false);
  const [foulPick, setFoulPick] = useState<string | null>(null);
  const [foulThrowCount, setFoulThrowCount] = useState<1 | 2 | 3>(1);
  const foulSavingRef = useRef(false);
  const foulPickRef = useRef<string | null>(null);
  const foulCloseTimer = useRef<number | null>(null);
  const foulDraftRef = useRef<{
    side: CaptureSide;
    kind: FoulKind;
    context: FoulContext;
    offenderId: string | null;
    otherId: string | null;
    coach: boolean;
    throws: FreeThrowMark[];
  } | null>(null);

  useEffect(() => () => {
    if (turnoverCloseTimer.current !== null) window.clearTimeout(turnoverCloseTimer.current);
    if (foulCloseTimer.current !== null) window.clearTimeout(foulCloseTimer.current);
  }, []);
  
  // New lineup and action modals
  const [showFreeThrowScript, setShowFreeThrowScript] = useState(false);
  const [showJumpBall, setShowJumpBall] = useState(false);
  const [showOpponentRoster, setShowOpponentRoster] = useState(false);
  const [opponentPlayers, setOpponentPlayers] = useState<GameOpponentPlayer[]>([]);
  const [periodLineups, setPeriodLineups] = useState<PeriodLineupRow[]>([]);
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [homeCoachName, setHomeCoachName] = useState<string | null>(null);
  const [showSquad, setShowSquad] = useState(false);
  const [showPeriodLineup, setShowPeriodLineup] = useState(false);
  const [showChooseSide, setShowChooseSide] = useState(false);
  const [sideChosen, setSideChosen] = useState(false);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockRunningRef = useRef(false);
  const clockRemainingRef = useRef(600000);

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
    return deriveOnCourtPlayers(homeLineupIds, events, currentPeriod);
  }, [homeLineupIds, events, currentPeriod]);

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

  // Derive current on-court players from starting lineup + substitution events
  function deriveOnCourtPlayers(startingIds: string[], allEvents: GameEvent[], period: number): string[] {
    const subs = allEvents
      .filter(e => e.event_type === 'substitution' && e.period_number === period && e.player_id && e.player_out_id)
      .sort((a, b) => {
        if (a.period_number !== b.period_number) {
          return a.period_number - b.period_number;
        }
        // Higher clock = earlier in period
        if (a.clock_remaining_ms !== b.clock_remaining_ms) {
          return b.clock_remaining_ms - a.clock_remaining_ms;
        }
        // Tie-breaker: sort by created_at ASC (earlier insertions first)
        if (a.created_at && b.created_at) {
          return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
        }
        return 0;
      });

    const currentLineup = [...startingIds];
    for (const sub of subs) {
      const outIndex = currentLineup.indexOf(sub.player_out_id!);
      if (outIndex !== -1) {
        currentLineup[outIndex] = sub.player_id!;
      }
    }
    return currentLineup;
  }

  const updateGameState = useCallback(async (updates: Partial<Game>) => {
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);

    if (error) console.error('Failed to update game state:', error);
    return !error;
  }, [gameId]);

  const handlePeriodEnd = useCallback(() => {
    alert(`Period ${currentPeriod} ended`);
  }, [currentPeriod]);

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
      const { data: roleRows } = await supabase
        .from('profile_roles')
        .select('role, club_id')
        .eq('profile_id', user.id);
      const assigned = userManagesClub(roleRows ?? [], gameData.teams?.club_id ?? null);
      setAllowed(assigned);
      if (!assigned) {
        setLoading(false);
        return;
      }

      setLoadError(null);
      setGame(gameData);
      const remaining = gameData.clock_remaining_ms ?? getPeriodLengthMs(gameData.current_period || 1);
      const running = Boolean(gameData.clock_running);
      clockRemainingRef.current = remaining;
      clockRunningRef.current = running;
      setClockRemaining(remaining);
      setClockRunning(running);
      setCurrentPeriod(gameData.current_period || 1);
      setPossession(gameData.possession || 'home');
      setTeamScore(gameData.team_score || 0);
      setOpponentScore(gameData.opponent_score || 0);
      setAttackRightFirst(gameData.attack_right_first ?? true);
      
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
            
            setClockRemaining(newData.clock_remaining_ms);
            setClockRunning(newData.clock_running);
            setCurrentPeriod(newData.current_period);
            if (newData.possession === 'home' || newData.possession === 'away' || newData.possession === null) {
              setPossession(newData.possession);
            }
            setTeamScore(newData.team_score);
            setOpponentScore(newData.opponent_score);
            if (newData.attack_right_first !== undefined) {
              setAttackRightFirst(newData.attack_right_first);
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

  const opponentLineupLocked = events.length > 0 || clockRemaining < getPeriodLengthMs(currentPeriod) || currentPeriod > 1;
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

  // Clock ticker - ONLY for Slot A
  useEffect(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }

    if (!allowed || !clockRunning) return;

    clockIntervalRef.current = setInterval(() => {
      setClockRemaining(prev => {
        const newTime = Math.max(0, prev - 100);
        clockRemainingRef.current = newTime;
        if (newTime === 0) {
          clockRunningRef.current = false;
          setClockRunning(false);
          handlePeriodEnd();
          updateGameState({ clock_running: false, clock_remaining_ms: 0 });
        }
        return newTime;
      });
    }, 100);

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [allowed, clockRunning, handlePeriodEnd, updateGameState]);

  // Periodic clock sync - Slot A safety net
  useEffect(() => {
    if (!allowed || !clockRunning || !game) return;

    const interval = setInterval(() => {
      supabase
        .from('games')
        .update({ clock_remaining_ms: clockRemaining })
        .eq('id', gameId)
        .then();
    }, 3000);

    return () => clearInterval(interval);
  }, [allowed, clockRunning, clockRemaining, game, gameId]);

  useEffect(() => {
    clockRunningRef.current = clockRunning;
  }, [clockRunning]);

  useEffect(() => {
    clockRemainingRef.current = clockRemaining;
  }, [clockRemaining]);

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
    return awayLineupIds.flatMap((id) => {
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

  function handleCourtTap(worldX: number, worldY: number) {
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
    turnoverSavingRef.current = true;
    setTurnoverSaving(true);
    setPossession(nextPossession);
    try {
      const result = await commitCapturePlay({
        play: 'turnover',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: Math.max(0, Math.round(clockRemainingRef.current)),
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
      if (stopsClock) {
        setClockRunning(false);
        clockRunningRef.current = false;
      }
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
    if (turnoverStep || foulStep || turnoverSavingRef.current || clockViolationRef.current) return;
    if (possession !== side) {
      setBoardNote(t('trke_turnover_hint_wrong_side', 'Only the team with the ball can turn it over'));
      return;
    }
    clockViolationRef.current = true;
    try {
      const result = await commitCapturePlay({
        play,
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: Math.max(0, Math.round(clockRemainingRef.current)),
        side,
      });
      if ('error' in result) {
        setBoardNote(t('trke_turnover_hint_error', 'Could not save the turnover'));
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
      setClockRunning(false);
      clockRunningRef.current = false;
      setBoardNote(play === 'shot_clock'
        ? t('trke_shot_clock_hint', '24s violation. Press start clock.')
        : play === 'eight_seconds'
          ? t('trke_eight_seconds_hint', '8s violation. Press start clock.')
          : t('trke_five_seconds_hint', '5s violation. Press start clock.'));
    } catch {
      setBoardNote(t('trke_turnover_hint_error', 'Could not save the turnover'));
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
    setShowFreeThrowScript(false);
    setPendingAction(null);
    setTapCoordinates(null);
  }

  function cancelFoul() {
    if (foulSavingRef.current) return;
    clearFoulUi();
    setBoardNote(null);
  }

  function foulErrorText(code: string) {
    if (code === 'foul_possession') return t('trke_foul_hint_possession', 'Set possession before the foul');
    if (code === 'foul_eliminated') return t('trke_foul_hint_eliminated', 'That player is already eliminated');
    if (code === 'foul_player') return t('trke_foul_hint_player', 'Choose who committed the foul');
    if (code === 'foul_victim') return t('trke_foul_hint_victim', 'Choose who was fouled');
    return t('trke_foul_hint_error', 'Could not save the foul');
  }

  function shotPointsFor(side: CaptureSide): 2 | 3 {
    const point = tapCoordinates ?? { x: 0.5, y: 0.5 };
    return shotValueFromWorld(
      point.x,
      point.y,
      offenseAttacksRight(otherCaptureSide(side), currentPeriod, attackRightFirst),
    );
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
    foulSavingRef.current = true;
    try {
      const result = await commitCapturePlay({
        play: 'foul',
        gameId,
        periodNumber: currentPeriod,
        clockRemainingMs: Math.max(0, Math.round(clockRemainingRef.current)),
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
      setClockRunning(false);
      clockRunningRef.current = false;
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
    } finally {
      foulSavingRef.current = false;
    }
  }

  function armFoul(side: CaptureSide) {
    if (clockViolationRef.current || foulSavingRef.current) return;
    if (possession !== 'home' && possession !== 'away') {
      setBoardNote(t('trke_foul_hint_possession', 'Set possession before the foul'));
      return;
    }
    if (courtRoster(side).length === 0) {
      setBoardNote(t('trke_foul_hint_player', 'Choose who committed the foul'));
      return;
    }
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
    if (turnoverStep || foulStep || foulSavingRef.current) return;
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
      if (possession === foulSide) {
        void saveFoul({
          side: foulSide,
          kind: 'personal',
          context: 'offensive',
          offenderId: playerId,
          otherId: null,
          coach: false,
          throws: [],
        });
        return;
      }
      setFoulStep('type');
      setBoardNote(t('trke_foul_hint_type', 'Choose the foul'));
      return;
    }
    if (foulStep === 'other' && side === otherCaptureSide(foulSide) && foulKind && foulContext) {
      const value = foulContext === 'shot_made' || foulContext === 'shot_missed' ? shotPointsFor(foulSide) : null;
      const count = foulFreeThrowCount({
        kind: foulKind,
        context: foulContext,
        shotValue: value,
        teamFoulsBefore: teamFoulsBefore(foulSide),
      });
      const draft = {
        side: foulSide,
        kind: foulKind,
        context: foulContext,
        offenderId: foulCoach ? null : foulOffenderId,
        otherId: playerId,
        coach: foulCoach,
        throws: [] as FreeThrowMark[],
      };
      if (count > 0) {
        foulDraftRef.current = draft;
        setFoulThrowCount(count as 1 | 2 | 3);
        setShowFreeThrowScript(true);
        return;
      }
      void saveFoul(draft);
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
      setFoulKind(kind);
      setFoulStep('situation');
      setBoardNote(t('trke_foul_hint_situation', 'Was there a shot?'));
    });
  }

  function chooseFoulSituation(context: 'no_shot' | 'shot_made' | 'shot_missed') {
    if (!foulSide || !foulKind || !foulOffenderId) return;
    queueFoulChoice(context, () => {
      setFoulContext(context);
      advanceFoul({
        side: foulSide,
        kind: foulKind,
        context,
        offenderId: foulOffenderId,
        coach: false,
      });
    });
  }

  function handleJumpBallConfirm(result: JumpBallResult) {
    setBoardNote(`${t('trke_jump_title', 'Jump ball')}: ${result.label}`);
    setShowJumpBall(false);
    setPossession(result.winner);
    void updateGameState({ possession: result.winner });
  }

  function personalFoulCount(id: string, side: 'home' | 'away') {
    return events.filter((event) => {
      if (event.coach_technical_side) return false;
      const charged = side === 'home' ? event.player_id === id : event.opponent_player_id === id;
      if (!charged) return false;
      if (event.event_type === 'foul' && foulCountsForPlayer(event.foul_type)) return true;
      return event.event_type === 'turnover'
        && (event.turnover_type === 'offensive_foul' || event.turnover_type === 'technical')
        && event.turnover_side === side;
    }).length;
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
        && (event.turnover_type === 'offensive_foul' || event.turnover_type === 'technical')
        && event.turnover_side === side;
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
    const saved = idsForPeriod(currentPeriod, side).filter((id) => !playerIsOut(id, side));
    if (saved.length > 0 || currentPeriod === 1) return saved;
    const previous = side === 'home'
      ? deriveOnCourtPlayers(idsForPeriod(currentPeriod - 1, 'home'), events, currentPeriod - 1)
      : idsForPeriod(currentPeriod - 1, 'away');
    return previous.filter((id) => !playerIsOut(id, side));
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
    return t('trke_opponent_roster_hint', 'Enter up to 12 jerseys. Add the coach with the button. The coach has no jersey.');
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
    const locked = events.length > 0 || clockRemaining < 600000;
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
        if (!created) return t('trke_opponent_roster_hint', 'Enter up to 12 jerseys. Add the coach with the button. The coach has no jersey.');
        player.id = created.id;
      }
    }

    await reloadOpponentRoster();
    setShowOpponentRoster(false);
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
    if (clockRunning) return;
    if (blockUntilReady()) return;
    if (currentPeriod === 1 && !sideChosen) {
      setShowChooseSide(true);
      return;
    }
    clockRunningRef.current = true;
    clockRemainingRef.current = clockRemaining;
    setClockRunning(true);
    await updateGameState({
      clock_running: true,
      clock_remaining_ms: clockRemaining,
    });
  }

  async function toggleClock() {
    if (turnoverStep || foulStep) return;
    if (!clockRunning && currentPeriod === 1 && !periodAlreadyStarted(1)) {
      if (blockUntilReady()) return;
      if (!sideChosen) {
        setShowChooseSide(true);
        return;
      }
      setShowJumpBall(true);
      return;
    }
    if (!clockRunning && blockUntilReady()) return;
    
    const newState = !clockRunning;
    clockRunningRef.current = newState;
    clockRemainingRef.current = clockRemaining;
    setClockRunning(newState);
    await updateGameState({
      clock_running: newState,
      clock_remaining_ms: clockRemaining,
    });
  }

  async function adjustClock(unit: 'minute' | 'second' | 'tenth', delta: number) {
    if (turnoverStep || foulStep) return;
    if (blockUntilReady()) return;
    const step = unit === 'minute' ? 60000 : unit === 'second' ? 1000 : 100;
    const max = getPeriodLengthMs(currentPeriod);
    const next = Math.max(0, Math.min(max, clockRemainingRef.current + delta * step));
    clockRemainingRef.current = next;
    setClockRemaining(next);
    await updateGameState({ clock_remaining_ms: next });
  }

  async function nextPeriod() {
    if (turnoverStep || foulStep) return;
    if (blockUntilReady()) return;
    
    // Check if game should auto-close (end of Q4 or OT with score not tied)
    if (currentPeriod >= 4) {
      const isTied = teamScore === opponentScore;
      
      if (!isTied) {
        // Game finished - set status to 'final', stop clock
        await updateGameState({
          status: 'final',
          clock_running: false,
          clock_remaining_ms: 0,
        });
        
        // Record final period end time
        await supabase.from('game_periods').upsert({
          game_id: gameId,
          period_number: currentPeriod,
          clock_remaining_ms: 0,
          duration_ms: getPeriodLengthMs(currentPeriod),
          is_overtime: currentPeriod > 4,
        }, {
          onConflict: 'game_id,period_number'
        });
        
        setClockRunning(false);
        setClockRemaining(0);
        
        // Show game finished overlay (alert for now, could be a modal)
        alert(`Game Finished!\n\n${game?.teams?.name || 'Team'}: ${teamScore}\n${game?.opponent_name || 'Opponent'}: ${opponentScore}`);
        return;
      }
      
      // If tied after Q4 or OT, continue to next OT
      // OT periods are 5 minutes (300,000 ms)
    }
    
    // Record period end time in game_periods table
    const { error: periodError } = await supabase
      .from('game_periods')
      .upsert({
        game_id: gameId,
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        duration_ms: getPeriodLengthMs(currentPeriod),
        is_overtime: currentPeriod > 4,
      }, {
        onConflict: 'game_id,period_number'
      });

    if (periodError) {
      console.error('Failed to record period end time:', periodError);
      alert(`Error recording period end time: ${periodError.message}`);
      return;
    }

    const newPeriod = currentPeriod + 1;
    const newPeriodLength = getPeriodLengthMs(newPeriod);
    setCurrentPeriod(newPeriod);
    setClockRemaining(newPeriodLength);
    setClockRunning(false);
    await updateGameState({
      current_period: newPeriod,
      clock_remaining_ms: newPeriodLength,
      clock_running: false,
    });
    setShowPeriodLineup(true);
  }

  async function assignPossession(side: 'home' | 'away') {
    if (turnoverStep || foulStep) return;
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
    if (turnoverStep || foulStep) return;
    const newDirection = !attackRightFirst;
    setAttackRightFirst(newDirection);
    await updateGameState({ attack_right_first: newDirection });
  }

  function leaveCapture() {
    router.push(`/team-manager/games/${gameId}`);
  }

  async function handleUndo() {
    if (turnoverStep || foulStep || events.length === 0) return;

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
    const foul = group.find((event) => event.event_type === 'foul');
    const nextTeam = Math.max(0, teamScore - homePoints);
    const nextOpponent = Math.max(0, opponentScore - awayPoints);
    const updates: Partial<Game> = {};
    if (homePoints) updates.team_score = nextTeam;
    if (awayPoints) updates.opponent_score = nextOpponent;
    if (foul?.possession_before) updates.possession = foul.possession_before;
    if (homePoints) setTeamScore(nextTeam);
    if (awayPoints) setOpponentScore(nextOpponent);
    if (foul?.possession_before) setPossession(foul.possession_before);
    if (Object.keys(updates).length) await updateGameState(updates);

    const removeIds = new Set(group.map((event) => event.id));
    const { error } = lastEvent.play_group_id
      ? await supabase.from('game_events').delete().eq('play_group_id', lastEvent.play_group_id)
      : await supabase.from('game_events').delete().eq('id', lastEvent.id);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setEvents((prev) => prev.filter((event) => !removeIds.has(event.id)));
      if (!foul && lastEvent.event_type === 'turnover' && lastEvent.turnover_side) {
        setPossession(lastEvent.turnover_side);
        await updateGameState({ possession: lastEvent.turnover_side });
      }
    }
  }

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

  // Get shot markers for court (transform normalized coords to world coords for display)
  // Include both field shots and free throws
  const shotMarkers = events
    .filter(e => (e.event_type === 'shot' || e.event_type === 'free_throw') && e.coord_x != null && e.coord_y != null)
    .map(e => {
      const world = normalizedToWorld(e.coord_x!, e.coord_y!);
      return {
        id: e.id,
        x: world.x,
        y: world.y,
        made: e.made ?? false,
        points: e.points || 0,
      };
    });

  // Helper functions for lineup management
  const onCourtPlayers = players.filter(p => onCourtPlayerIds.includes(p.id));

  const attacking = isAttackingRight();
  const isOffense = possession === 'home';
  
  // Possession highlight: show which half has possession (not which we're attacking)
  // When we have possession (offense), highlight our attacking half
  // When opponent has possession, highlight their attacking half (opposite of ours)

  const boardClock = scoreboardClock(clockRemaining);
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
  function handleBoardAction(side: 'home' | 'away', action: CaptureBoardAction) {
    if (action === 'made' || action === 'miss') return;
    if (turnoverSavingRef.current || foulSavingRef.current) return;
    if (foulStep) {
      if (action === 'foul' && side === foulSide) cancelFoul();
      return;
    }
    if (turnoverStep) {
      if (action === 'turnover' && side === turnoverSide) cancelTurnover();
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

  const logItems = events.slice(0, 40).map((event) => {
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
      title = event.made ? 'SHOT MADE' : 'SHOT MISSED';
      detail = `${who} · ${event.points ?? 0}P`;
    } else if (event.event_type === 'free_throw') {
      title = 'FREE THROW';
      detail = `${who} · ${event.made ? 'made' : 'missed'}`;
    } else if (event.event_type === 'foul') {
      title = event.coach_technical_side ? 'TECHNICAL' : 'FOUL';
      const coachName = event.coach_technical_side === 'home'
        ? (homeCoachName || 'Coach')
        : event.coach_technical_side === 'away'
          ? (awayCoachName || 'Coach')
          : null;
      detail = coachName
        ? coachName
        : event.foul_type && event.foul_type in foulKindKey
          ? `${who} · ${t(foulKindKey[event.foul_type as FoulKind], foulKindFallback[event.foul_type as FoulKind])}`
          : event.foul_type ? `${who} · ${event.foul_type}` : who;
    } else if (
      event.event_type === 'turnover'
      && (
        event.turnover_type === 'shot_clock'
        || event.turnover_type === 'eight_seconds'
        || (event.turnover_type === 'five_seconds' && !event.player_id && !event.opponent_player_id)
      )
    ) {
      title = event.turnover_type === 'shot_clock'
        ? t('trke_shot_clock_log', '24s')
        : event.turnover_type === 'eight_seconds'
          ? t('trke_eight_seconds_log', '8s')
          : t('trke_five_seconds_log', '5s');
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
    } else if (event.event_type === 'substitution') {
      title = 'SUBSTITUTION';
      detail = `IN #${event.player?.jersey_number ?? '–'} ${event.player?.full_name ?? ''} / OUT #${event.player_out?.jersey_number ?? '–'} ${event.player_out?.full_name ?? ''}`;
    }
    return {
      id: event.id,
      periodLabel: getPeriodLabel(event.period_number),
      clock: formatTime(event.clock_remaining_ms),
      title,
      detail,
    };
  });

  const homePlayingIds = onCourtPlayerIds.length > 0 ? onCourtPlayerIds : suggestedStarterIds('home');
  const awayPlayingIds = awayLineupIds.length > 0 ? awayLineupIds : suggestedStarterIds('away');

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
          clockLeft={boardClock.left}
          clockRight={boardClock.right}
          lastMinute={boardClock.lastMinute}
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
            }))}
          awayBench={opponentPlaying.map((player) => ({
            id: player.id,
            jersey: opponentShirt(player),
            fouls: personalFoulCount(player.id, 'away'),
            name: player.name?.trim() || game.opponent_name || 'Away',
            onCourt: awayPlayingIds.includes(player.id),
          }))}
          homePersonalFouls={homePersonalFouls}
          awayPersonalFouls={awayPersonalFouls}
          timeoutsUsed={0}
          timeoutMax={currentPeriod <= 2 ? 2 : 3}
          cambioLabel={t('trke_cambio', 'Change')}
          stepBackLabel={t('trke_step_back', 'Step back')}
          cancelDeleteLabel={t('trke_cancel_delete', 'Cancel and delete')}
          timeoutLabel={t('trke_timeout_short', 'TO')}
          foulsLabel={t('trke_period_fouls', 'Fouls')}
          clockViolationsEnabled={!turnoverStep && !foulStep}
          onShotClock={(side) => { void recordClockViolation('shot_clock', side); }}
          onEightSeconds={(side) => { void recordClockViolation('eight_seconds', side); }}
          onFiveSeconds={(side) => { void recordClockViolation('five_seconds', side); }}
          activeAction={foulStep ? 'foul' : pendingAction}
          activeSide={foulStep ? foulSide : turnoverSide}
          onAction={handleBoardAction}
          homeActionsEnabled={{
            made: lineupReady,
            miss: lineupReady,
            foul: lineupReady,
            turnover: possession === 'home' && onCourtPlayers.length > 0,
          }}
          awayTurnoverEnabled={possession === 'away' && courtRoster('away').length > 0}
          courtPickSide={
            foulStep === 'player'
              ? foulSide
              : foulStep === 'other' && foulSide
                ? otherCaptureSide(foulSide)
                : turnoverStep === 'player'
                  ? turnoverSide
                  : null
          }
          onCourtPlayer={foulStep ? selectFoulCourtPlayer : selectTurnoverCourtPlayer}
          homeColor={normalizeHexColor(
            game.kit_color === 'secondary' ? game.teams?.clubs?.secondary_color : game.teams?.clubs?.primary_color,
            '#171717',
          )}
          awayColor={normalizeHexColor(game.opponent_color)}
          hint={actionHint}
          logItems={logItems}
          onUndo={() => { void handleUndo(); }}
          canUndo={events.length > 0}
          nextLabel="Next"
          onNextPeriod={() => { void nextPeriod(); }}
          onFlipCourt={() => { void flipCourt(); }}
          onBack={leaveCapture}
          homeCoach={homeCoachName ? { name: homeCoachName } : null}
          awayCoach={awayCoachName ? { name: awayCoachName } : null}
          onHomeCoach={homeCoachName ? () => { armCoachTechnical('home'); } : undefined}
          onAwayCoach={awayCoachName ? () => { armCoachTechnical('away'); } : undefined}
          canSetPossession
          onSetPossession={(side) => { void assignPossession(side); }}
          homeAttacksRight={attacking}
          court={(
            <BasketballCourt
              onCourtTap={handleCourtTap}
              shotMarkers={shotMarkers}
              placement={(turnoverStep || foulStep) && tapCoordinates ? tapCoordinates : null}
              attackingRight={attacking}
              isOffense={isOffense}
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

      {/* Modals */}
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

      {showFreeThrowScript && (
        <FreeThrowSequencePopup
          t={t}
          count={foulThrowCount}
          onConfirm={handleFreeThrowScriptConfirm}
          onClose={cancelFoul}
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
          awayPlayers={awayLineupIds.flatMap((id) => {
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

      {(foulStep === 'type' || foulStep === 'situation') && foulSide && (
        <FoulSituationModal
          choices={
            foulStep === 'type'
              ? foulKinds.map((id) => ({ id, label: t(foulKindKey[id], foulKindFallback[id]) }))
              : [
                { id: 'no_shot' as const, label: t('trke_foul_no_shot', 'No shot') },
                { id: 'shot_made' as const, label: `${t('trke_foul_shot_made', 'Basket made')} · ${shotPointsFor(foulSide)}` },
                { id: 'shot_missed' as const, label: `${t('trke_foul_shot_missed', 'Shot missed')} · ${shotPointsFor(foulSide)}` },
              ]
          }
          cancelLabel={t('trke_foul_cancel', 'Cancel')}
          disabled={foulPick !== null}
          selectedId={foulPick}
          onSelect={(id) => {
            if (foulStep === 'type') chooseFoulKind(id as FoulKind);
            else chooseFoulSituation(id as 'no_shot' | 'shot_made' | 'shot_missed');
          }}
          onClose={cancelFoul}
        />
      )}
    </div>
  );
}
