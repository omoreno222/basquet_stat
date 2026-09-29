'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BasketballCourt, calculateShotZone, isInsideThreePointLine } from './components/BasketballCourt';
import { CaptureBoard, type CaptureBoardAction } from './components/CaptureBoard';
import { PlayerSelectionModal } from './components/PlayerSelectionModal';
import { ShotActionModal } from './components/ShotActionModal';
import { SlotBActionModal } from './components/SlotBActionModal';
import { FreeThrowSequencePopup, type FreeThrowSequenceResult } from './components/FreeThrowSequencePopup';
import { JumpBallPopup, type JumpBallResult } from './components/JumpBallPopup';
import { OpponentRosterModal, type OpponentRosterInput } from './components/OpponentRosterModal';
import { SquadPickerModal } from './components/SquadPickerModal';
import { PeriodLineupModal } from './components/PeriodLineupModal';
import { FoulModal } from './components/FoulModal';
import { ChooseSideModal } from './components/ChooseSideModal';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { gameSquadSchema, opponentRosterSchema, periodLineupSchema, schemaError } from '@/lib/form-schemas';
import { canStartPeriod, isEliminated, minimumToStart } from '@/lib/period-lineup';
import { Profile } from '@/lib/types';
import type { GameOpponentPlayer } from '@/types/database';

function opponentShirt(player: GameOpponentPlayer) {
  return player.jersey_number ?? 0;
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
  opponent_score: number;
  team_score: number;
  is_home: boolean;
  venue?: string;
  game_date: string;
  status: string;
  official?: boolean;
  slot_a_user_id: string | null;
  slot_b_user_id: string | null;
  single_recorder?: boolean;
  clock_running: boolean;
  clock_remaining_ms: number;
  current_period: number;
  possession: 'home' | 'away';
  attack_right_first: boolean;
  created_at?: string;
  updated_at?: string;
  teams?: {
    name: string;
    club_id?: string;
    coach_id?: string | null;
    clubs?: { name?: string; logo_url?: string | null } | null;
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
  opponent_player_id?: string | null;
  coach_technical_side?: 'home' | 'away' | null;
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

export default function GameCapturePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [userSlot, setUserSlot] = useState<'a' | 'b' | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  
  // Game state
  const [clockRunning, setClockRunning] = useState(false);
  const [clockRemaining, setClockRemaining] = useState(600000);
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const [possession, setPossession] = useState<'home' | 'away'>('home');
  const [teamScore, setTeamScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [attackRightFirst, setAttackRightFirst] = useState(true);

  // UI state
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [showShotActions, setShowShotActions] = useState(false);
  const [showSlotBActions, setShowSlotBActions] = useState(false);
  const [tapCoordinates, setTapCoordinates] = useState<{ x: number; y: number } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pendingAction, setPendingAction] = useState<CaptureBoardAction | null>(null);
  const [boardNote, setBoardNote] = useState<string | null>(null);
  
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
  const [showOpponentFoul, setShowOpponentFoul] = useState(false);
  const [pendingFoulPlayer, setPendingFoulPlayer] = useState<Player | null>(null);
  const [showFoul, setShowFoul] = useState(false);
  const [showChooseSide, setShowChooseSide] = useState(false);
  const [sideChosen, setSideChosen] = useState(false);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameRef = useRef<Game | null>(null);
  const userSlotRef = useRef<'a' | 'b' | null>(null);
  const clockRunningRef = useRef(false);
  const clockRemainingRef = useRef(600000);
  const staleClockHandled = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    userSlotRef.current = userSlot;
  }, [userSlot]);

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
      .select('*, teams(name, club_id, coach_id, clubs(name, logo_url))')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      setLoadError(gameError?.message || 'Game not found');
      setLoading(false);
      return;
    }

    if (gameData) {
      setLoadError(null);
      setGame(gameData);
      const remaining = gameData.clock_remaining_ms ?? getPeriodLengthMs(gameData.current_period || 1);
      const actorId = profile?.id ?? user.id;
      const newSlot =
        actorId === gameData.slot_a_user_id ? 'a' :
        actorId === gameData.slot_b_user_id ? 'b' :
        null;
      let running = Boolean(gameData.clock_running);
      if (!staleClockHandled.current) {
        staleClockHandled.current = true;
        if (newSlot === 'a' && running) {
          running = false;
          await supabase.from('games').update({
            clock_running: false,
            clock_remaining_ms: remaining,
          }).eq('id', gameId);
        }
      }
      clockRemainingRef.current = remaining;
      clockRunningRef.current = running;
      setClockRemaining(remaining);
      setClockRunning(running);
      setUserSlot(newSlot);
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
      if (!started && regularPlayers.length <= 12) {
        const desired = regularPlayers.map((player) => player.id);
        const same = desired.length === nextSquad.length && desired.every((id) => nextSquad.includes(id));
        if (!same) {
          const { error: clearError } = nextSquad.length > 0
            ? await supabase.from('game_squads').delete().eq('game_id', gameId)
            : { error: null };
          if (!clearError) {
            const { error: insertError } = desired.length > 0
              ? await supabase.from('game_squads').insert(desired.map((playerId) => ({ game_id: gameId, player_id: playerId })))
              : { error: null };
            if (!insertError) nextSquad = desired;
          }
        }
      }
      setSquadIds(nextSquad);

      let nextLineups = (periodData || []) as PeriodLineupRow[];
      if (nextLineups.length === 0) {
        nextLineups = [
          ...(legacyHome || []).map((row) => ({
            period_number: 1,
            side: 'home' as const,
            position_index: row.position_index,
            player_id: row.player_id,
            opponent_player_id: null,
          })),
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
              const newEvents = [data, ...prev];
              // On-court lineup automatically re-derived via useMemo when events change
              return newEvents;
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
        async (payload: { new: Game }) => {
          if (payload.new) {
            const newData = payload.new;
            
            setClockRemaining(newData.clock_remaining_ms);
            setClockRunning(newData.clock_running);
            setCurrentPeriod(newData.current_period);
            setPossession(newData.possession);
            setTeamScore(newData.team_score);
            setOpponentScore(newData.opponent_score);
            if (newData.attack_right_first !== undefined) {
              setAttackRightFirst(newData.attack_right_first);
            }

            if (
              newData.slot_a_user_id !== gameRef.current?.slot_a_user_id ||
              newData.slot_b_user_id !== gameRef.current?.slot_b_user_id
            ) {
              const { data: { user } } = await supabase.auth.getUser();
              const newSlot =
                user?.id === newData.slot_a_user_id ? 'a' :
                user?.id === newData.slot_b_user_id ? 'b' :
                null;

              setUserSlot(newSlot);

              if (newSlot !== 'a' && clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
                clockIntervalRef.current = null;
              }
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
    if (loading || userSlot !== 'a' || opponentLineupLocked || opponentPlaying.length > 0) return;
    setShowOpponentRoster(true);
  }, [loading, userSlot, opponentLineupLocked, opponentPlaying.length]);

  // Clock ticker - ONLY for Slot A
  useEffect(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }

    if (userSlot !== 'a' || !clockRunning) return;

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
  }, [clockRunning, userSlot, handlePeriodEnd, updateGameState]);

  // Periodic clock sync - Slot A safety net
  useEffect(() => {
    if (userSlot !== 'a' || !clockRunning || !game) return;

    const interval = setInterval(() => {
      supabase
        .from('games')
        .update({ clock_remaining_ms: clockRemaining })
        .eq('id', gameId)
        .then();
    }, 3000);

    return () => clearInterval(interval);
  }, [userSlot, clockRunning, clockRemaining, game, gameId]);

  const stopClock = useCallback(async () => {
    if (userSlotRef.current !== 'a' || !clockRunningRef.current) return;
    const remaining = clockRemainingRef.current;
    clockRunningRef.current = false;
    setClockRunning(false);
    await supabase.from('games').update({
      clock_running: false,
      clock_remaining_ms: remaining,
    }).eq('id', gameId);
  }, [gameId]);

  useEffect(() => {
    clockRunningRef.current = clockRunning;
  }, [clockRunning]);

  useEffect(() => {
    clockRemainingRef.current = clockRemaining;
  }, [clockRemaining]);

  useEffect(() => {
    function onPageHide() {
      void stopClock();
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') void stopClock();
    }
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      void stopClock();
    };
  }, [stopClock]);

  function handleCourtTap(worldX: number, worldY: number) {
    setTapCoordinates({ x: worldX, y: worldY });
    setShowPlayerPicker(true);
  }

  function handlePlayerSelected(playerId: string) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    setShowPlayerPicker(false);

    if (tapCoordinates && (pendingAction === 'made' || pendingAction === 'miss') && userSlot === 'a') {
      const inside = isInsideThreePointLine(tapCoordinates.x, tapCoordinates.y, isAttackingRight());
      const points = inside ? 2 : 3;
      const coords = tapCoordinates;
      const made = pendingAction === 'made';
      setPendingAction(null);
      setSelectedPlayer(null);
      setTapCoordinates(null);
      void handleShotAction(made, points, player, coords);
      return;
    }

    if (tapCoordinates && pendingAction === 'turnover') {
      const coords = tapCoordinates;
      setPendingAction(null);
      setSelectedPlayer(null);
      setTapCoordinates(null);
      void recordTurnover(player, coords);
      return;
    }

    setSelectedPlayer(player);
    if (userSlot === 'a') {
      setShowShotActions(true);
    } else if (userSlot === 'b') {
      setShowSlotBActions(true);
    }
  }

  async function handleShotAction(
    made: boolean,
    points: number,
    playerOverride?: Player,
    coordsOverride?: { x: number; y: number },
  ) {
    const player = playerOverride ?? selectedPlayer;
    const coords = coordsOverride ?? tapCoordinates;
    if (!player || !coords) return;

    // Transform world coordinates to normalized attacking coordinates
    const normalized = worldToNormalized(coords.x, coords.y);

    // Calculate zone using shared FIBA geometry helper
    const zone = calculateShotZone(normalized.x, normalized.y, true); // Always normalized to attacking right

    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: player.id,
        event_type: 'shot',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        points,
        made,
        coord_x: normalized.x,
        coord_y: normalized.y,
        zone,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser!.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      const newTeamScore = made ? teamScore + points : teamScore;
      const newPossession = 'away';
      
      setTeamScore(newTeamScore);
      setPossession(newPossession);

      if (userSlot === 'a') {
        await updateGameState({
          team_score: newTeamScore,
          possession: newPossession,
        });
      }
    }

    setShowShotActions(false);
    setSelectedPlayer(null);
    setTapCoordinates(null);
  }

  async function handleSlotBAction(actionType: string) {
    if (!selectedPlayer || !tapCoordinates) return;

    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;
    
    let eventType = actionType;
    if (actionType === 'rebound_off' || actionType === 'rebound_def') {
      eventType = 'rebound';
    }

    // Transform world coordinates to normalized
    const normalized = worldToNormalized(tapCoordinates.x, tapCoordinates.y);

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
        event_type: eventType,
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        coord_x: normalized.x,
        coord_y: normalized.y,
        is_offensive: actionType === 'rebound_off' || actionType === 'steal' || actionType === 'assist',
        recorded_by_user_id: currentUser!.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }

    setShowSlotBActions(false);
    setSelectedPlayer(null);
    setTapCoordinates(null);
  }

  async function recordTurnover(player: Player, coords: { x: number; y: number }) {
    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;
    const normalized = worldToNormalized(coords.x, coords.y);

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: player.id,
        event_type: 'turnover',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        coord_x: normalized.x,
        coord_y: normalized.y,
        is_offensive: true,
        recorded_by_user_id: currentUser!.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }
  }

  function handlePersonalFoul(player: Player) {
    setPendingFoulPlayer(player);
    setShowFoul(false);
    setShowFreeThrowScript(true);
  }

  function handleFreeThrowScriptConfirm(result: FreeThrowSequenceResult) {
    const summary = result.shots
      .map((shot, index) => `${index + 1} ${shot === 'made' ? t('trke_ft_sequence_made', 'made') : t('trke_ft_sequence_miss', 'miss')}`)
      .join(' · ');
    setBoardNote(`${t('trke_ft_sequence_title', 'Free throws')} (${result.count}): ${summary}`);
    setShowFreeThrowScript(false);
    if (pendingFoulPlayer) {
      const player = pendingFoulPlayer;
      setPendingFoulPlayer(null);
      void handleFoulSubmit(player, 'personal', result.count);
    }
  }

  function handleJumpBallConfirm(result: JumpBallResult) {
    setBoardNote(`${t('trke_jump_title', 'Jump ball')}: ${result.label}`);
    setShowJumpBall(false);
    if (userSlot !== 'a') return;
    setPossession(result.winner);
    void updateGameState({ possession: result.winner });
  }

  function personalFoulCount(id: string, side: 'home' | 'away') {
    return events.filter((event) =>
      event.event_type === 'foul'
      && event.foul_type === 'personal'
      && (side === 'home' ? event.player_id === id : event.opponent_player_id === id)
    ).length;
  }

  function periodAlreadyStarted(period: number) {
    if (currentPeriod > period) return true;
    if (events.some((event) => event.period_number === period)) return true;
    return currentPeriod === period && (clockRunning || clockRemaining < getPeriodLengthMs(period));
  }

  function dressedPlayers() {
    const teamPlayers = players.filter((player) => !player.is_guest);
    if (squadIds.length > 0) return teamPlayers.filter((player) => squadIds.includes(player.id));
    return teamPlayers.length <= 12 ? teamPlayers : [];
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
    const saved = idsForPeriod(currentPeriod, side).filter((id) => !isEliminated(personalFoulCount(id, side)));
    if (saved.length > 0 || currentPeriod === 1) return saved;
    const previous = side === 'home'
      ? deriveOnCourtPlayers(idsForPeriod(currentPeriod - 1, 'home'), events, currentPeriod - 1)
      : idsForPeriod(currentPeriod - 1, 'away');
    return previous.filter((id) => !isEliminated(personalFoulCount(id, side)));
  }

  function eliminatedCount(side: 'home' | 'away') {
    const pool = side === 'home'
      ? dressedPlayers()
      : opponentPlayers.filter((player) => !player.is_coach);
    return pool.filter((player) => isEliminated(personalFoulCount(player.id, side))).length;
  }

  function blockUntilReady() {
    if (userSlot !== 'a' || periodAlreadyStarted(currentPeriod)) return false;
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
    const parsed = opponentRosterSchema.safeParse({ game_id: gameId, players });
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
    if (error) return error.message;
    setSquadIds(parsed.data.player_ids);
    setShowSquad(false);
    setShowPeriodLineup(true);
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
    return error ? error.message : null;
  }

  async function savePeriodLineup(homeIds: string[], awayIds: string[]) {
    const parsed = periodLineupSchema.safeParse({
      game_id: gameId,
      period_number: currentPeriod,
      home_player_ids: homeIds,
      away_player_ids: awayIds,
    });
    if (!parsed.success) return schemaError(parsed.error);

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

  async function recordCoachTechnical(side: 'home' | 'away') {
    if (userSlot !== 'a' || !currentUser) return;
    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;
    const { error } = await supabase.from('game_events').insert({
      game_id: gameId,
      event_type: 'foul',
      foul_type: 'technical',
      coach_technical_side: side,
      period_number: currentPeriod,
      clock_remaining_ms: clockRemaining,
      elapsed_ms: elapsed,
      recorded_by_user_id: currentUser.id,
    });
    setBoardNote(error ? error.message : t('trke_coach_technical', 'Technical on the coach'));
  }

  async function recordOpponentFoul(opponentPlayerId: string) {
    if (userSlot !== 'a' || !currentUser) return;
    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;
    const { error } = await supabase.from('game_events').insert({
      game_id: gameId,
      opponent_player_id: opponentPlayerId,
      event_type: 'foul',
      foul_type: 'personal',
      period_number: currentPeriod,
      clock_remaining_ms: clockRemaining,
      elapsed_ms: elapsed,
      recorded_by_user_id: currentUser.id,
    });
    setShowOpponentFoul(false);
    if (error) setBoardNote(error.message);
  }

  async function startClock() {
    if (userSlot !== 'a' || clockRunning) return;
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

  async function handleFoulSubmit(player: Player, foulType: string, freeThrowsAwarded: number) {
    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: player.id,
        event_type: 'foul',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        foul_type: foulType,
        free_throws_awarded: freeThrowsAwarded,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser!.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }

    setShowFoul(false);
  }

  async function toggleClock() {
    if (userSlot !== 'a') return;
    if (!clockRunning && blockUntilReady()) return;
    
    // If trying to start clock for the first time (Q1) and side hasn't been chosen yet
    if (!clockRunning && currentPeriod === 1 && !sideChosen) {
      setShowChooseSide(true);
      return;
    }
    
    const newState = !clockRunning;
    clockRunningRef.current = newState;
    clockRemainingRef.current = clockRemaining;
    setClockRunning(newState);
    await updateGameState({
      clock_running: newState,
      clock_remaining_ms: clockRemaining,
    });
  }

  async function adjustClock(unit: 'minute' | 'second', delta: number) {
    if (userSlot !== 'a') return;
    if (blockUntilReady()) return;
    const step = unit === 'minute' ? 60000 : 1000;
    const max = getPeriodLengthMs(currentPeriod);
    const next = Math.max(0, Math.min(max, clockRemainingRef.current + delta * step));
    clockRemainingRef.current = next;
    setClockRemaining(next);
    await updateGameState({ clock_remaining_ms: next });
  }

  async function swapTablets() {
    if (!game?.slot_a_user_id || !game.slot_b_user_id || game.single_recorder) return;
    const { error } = await supabase.from('games').update({
      slot_a_user_id: game.slot_b_user_id,
      slot_b_user_id: game.slot_a_user_id,
    }).eq('id', gameId);
    if (error) alert(error.message);
  }

  async function nextPeriod() {
    if (userSlot !== 'a') return;
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
    if (userSlot !== 'a' || possession === side) return;
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
    if (userSlot !== 'a') return;
    const newDirection = !attackRightFirst;
    setAttackRightFirst(newDirection);
    await updateGameState({ attack_right_first: newDirection });
  }

  function leaveCapture() {
    if (clockRunning && !confirm(t('trke_clock_leave_confirm', 'The clock will stop when you leave. Continue?'))) {
      return;
    }
    void stopClock().finally(() => {
      router.push(`/team-manager/games/${gameId}`);
    });
  }

  async function handleUndo() {
    if (events.length === 0) return;

    const lastEvent = events[0];
    const isOwnEvent = lastEvent.recorded_by_user_id === currentUser?.id;

    if (!isOwnEvent) {
      if (!confirm('This event was recorded by another user. Undo anyway?')) {
        return;
      }
    }

    if (lastEvent.made && lastEvent.points && lastEvent.points > 0 && userSlot === 'a') {
      const newTeamScore = Math.max(0, teamScore - lastEvent.points);
      setTeamScore(newTeamScore);
      await updateGameState({ team_score: newTeamScore });
    }

    const { error } = await supabase
      .from('game_events')
      .delete()
      .eq('id', lastEvent.id);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      // On-court lineup automatically re-derived via useMemo when events change (after delete)
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

  if (!game || !userSlot) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-8">
        <div className="text-center">
          <p className="mb-4">You are not assigned to this game.</p>
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
  
  // Calculate foul counts for each player
  const playerFoulCounts: Record<string, number> = {};
  events.forEach(e => {
    if (e.event_type === 'foul' && e.player_id) {
      playerFoulCounts[e.player_id] = (playerFoulCounts[e.player_id] || 0) + 1;
    }
  });

  // Get players for pickers (on-court only, or all if lineup not set)
  const availablePlayers = onCourtPlayers.length > 0 ? onCourtPlayers : dressedPlayers();

  const attacking = isAttackingRight();
  const isOffense = possession === 'home';
  
  // Possession highlight: show which half has possession (not which we're attacking)
  // When we have possession (offense), highlight our attacking half
  // When opponent has possession, highlight their attacking half (opposite of ours)

  const totalClockSeconds = Math.ceil(clockRemaining / 1000);
  const clockMinutes = Math.floor(totalClockSeconds / 60).toString().padStart(2, '0');
  const clockSeconds = (totalClockSeconds % 60).toString().padStart(2, '0');
  const lineupReady = onCourtPlayers.length > 0;
  const homePersonalFouls = events.filter((event) =>
    event.period_number === currentPeriod && (
      (event.event_type === 'foul' && event.foul_type === 'personal' && event.player_id)
      || event.coach_technical_side === 'home'
    )
  ).length;
  const awayPersonalFouls = events.filter((event) =>
    event.period_number === currentPeriod && (
      (event.event_type === 'foul' && event.foul_type === 'personal' && event.opponent_player_id)
      || event.coach_technical_side === 'away'
    )
  ).length;

  function handleBoardAction(side: 'home' | 'away', action: CaptureBoardAction) {
    if (side === 'away') {
      setPendingAction(null);
      if (action === 'foul' && userSlot === 'a') {
        setShowOpponentFoul(true);
        return;
      }
      setBoardNote('Opponent numbers will sit in the gray column. This tablet records your team.');
      return;
    }
    if (!lineupReady) {
      setBoardNote('Set the starting lineup before recording actions.');
      return;
    }
    if (action === 'foul') {
      if (userSlot !== 'a') return;
      setPendingAction(null);
      setBoardNote(null);
      setShowFoul(true);
      return;
    }
    if ((action === 'made' || action === 'miss') && userSlot !== 'a') return;
    setBoardNote(null);
    setPendingAction((current) => (current === action ? null : action));
  }

  const actionHint = boardNote
    ?? (pendingAction === 'made'
      ? 'Tap the court for a made basket, then pick the player'
      : pendingAction === 'miss'
        ? 'Tap the court for a missed basket, then pick the player'
        : pendingAction === 'turnover'
          ? 'Tap the court, then pick the player who turned it over'
          : 'Tap the court to record a play');

  const logItems = events.slice(0, 40).map((event) => {
    const who = event.player
      ? `#${event.player.jersey_number} ${event.player.full_name}`
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
        : event.foul_type ? `${who} · ${event.foul_type}` : who;
    } else if (event.event_type === 'turnover') {
      title = 'TURNOVER';
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

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden">
      {game.slot_a_user_id && game.slot_b_user_id && !game.single_recorder && (
        <div className="flex flex-shrink-0 items-center bg-gray-800 border-b-2 border-orange-500 px-3 py-2">
          <button
            type="button"
            onClick={swapTablets}
            className="px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-xs font-medium"
            style={{ minHeight: '44px' }}
          >
            {t('trke_swap_slots', 'Swap tablets')}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <CaptureBoard
          homeName={game.teams?.name || 'Home'}
          awayName={game.opponent_name || 'Away'}
          homeScore={teamScore}
          awayScore={opponentScore}
          possession={possession}
          periodLabel={getPeriodLabel(currentPeriod)}
          clockMinutes={clockMinutes}
          clockSeconds={clockSeconds}
          clockRunning={clockRunning}
          canControlClock={userSlot === 'a'}
          onAdjustClock={(unit, delta) => { void adjustClock(unit, delta); }}
          onToggleClock={() => { void toggleClock(); }}
          homePlayers={[...onCourtPlayers]
            .sort((a, b) => a.jersey_number - b.jersey_number)
            .map((player) => ({
              id: player.id,
              jersey: player.jersey_number,
              fouls: playerFoulCounts[player.id] || 0,
              name: player.full_name,
              avatarUrl: player.avatar_url,
            }))}
          awayPlayers={awayLineupIds.flatMap((id) => {
            const player = opponentPlayers.find((item) => item.id === id && !item.is_coach);
            if (!player) return [];
            return [{
              id: player.id,
              jersey: opponentShirt(player),
              fouls: personalFoulCount(player.id, 'away'),
              name: player.name?.trim() || game.opponent_name || 'Away',
              avatarUrl: null,
            }];
          })}
          homeBench={[...dressedPlayers()]
            .sort((a, b) => a.jersey_number - b.jersey_number)
            .map((player) => ({
              id: player.id,
              jersey: player.jersey_number,
              fouls: playerFoulCounts[player.id] || 0,
              name: player.full_name,
              avatarUrl: player.avatar_url,
              onCourt: onCourtPlayerIds.includes(player.id),
            }))}
          awayBench={opponentPlaying.map((player) => ({
            id: player.id,
            jersey: opponentShirt(player),
            fouls: personalFoulCount(player.id, 'away'),
            name: player.name?.trim() || game.opponent_name || 'Away',
            avatarUrl: null,
            onCourt: awayLineupIds.includes(player.id),
          }))}
          homePersonalFouls={homePersonalFouls}
          awayPersonalFouls={awayPersonalFouls}
          activeAction={pendingAction}
          onAction={handleBoardAction}
          homeActionsEnabled={{
            made: userSlot === 'a' && lineupReady,
            miss: userSlot === 'a' && lineupReady,
            foul: userSlot === 'a' && lineupReady,
            turnover: lineupReady,
          }}
          hint={actionHint}
          logItems={logItems}
          onUndo={() => { void handleUndo(); }}
          canUndo={events.length > 0}
          jumpBallLabel={t('trke_jump_button', 'Jump ball')}
          onJumpBall={() => {
            if (blockUntilReady()) return;
            setShowJumpBall(true);
          }}
          nextLabel="Next"
          onNextPeriod={userSlot === 'a' ? () => { void nextPeriod(); } : undefined}
          onFlipCourt={userSlot === 'a' ? () => { void flipCourt(); } : undefined}
          onBack={leaveCapture}
          onAddAwayPlayer={userSlot === 'a' ? () => setShowOpponentRoster(true) : undefined}
          addAwayPlayerLabel={t('trke_opponent_roster_add', 'Add jersey')}
          homeCoach={homeCoachName ? { name: homeCoachName } : null}
          awayCoach={awayCoachName ? { name: awayCoachName } : null}
          onHomeCoach={homeCoachName && userSlot === 'a' ? () => { void recordCoachTechnical('home'); } : undefined}
          onAwayCoach={awayCoachName && userSlot === 'a' ? () => { void recordCoachTechnical('away'); } : undefined}
          possessionLabel={t('trke_possession_badge', 'posesión')}
          canSetPossession={userSlot === 'a'}
          onSetPossession={(side) => { void assignPossession(side); }}
          court={(
            <BasketballCourt
              onCourtTap={handleCourtTap}
              shotMarkers={shotMarkers}
              attackingRight={attacking}
              isOffense={isOffense}
              opponentCode={opponentMark(game.opponent_name || '')}
              teamLogoUrl={game.teams?.clubs?.logo_url || null}
            />
          )}
        />
      </div>

      {/* Modals */}
      {showChooseSide && userSlot === 'a' && (
        <ChooseSideModal onChoose={handleChooseSide} />
      )}

      {showPlayerPicker && (
        <PlayerSelectionModal
          players={availablePlayers}
          onSelectPlayer={handlePlayerSelected}
          onClose={() => {
            setShowPlayerPicker(false);
            setTapCoordinates(null);
          }}
          title="Select Player"
        />
      )}

      {showShotActions && selectedPlayer && tapCoordinates && (
        <ShotActionModal
          playerName={selectedPlayer.full_name}
          playerJersey={selectedPlayer.jersey_number}
          coordinateX={tapCoordinates.x}
          coordinateY={tapCoordinates.y}
          attackingRight={attacking}
          onAction={handleShotAction}
          onClose={() => {
            setShowShotActions(false);
            setSelectedPlayer(null);
            setTapCoordinates(null);
          }}
        />
      )}

      {showSlotBActions && selectedPlayer && (
        <SlotBActionModal
          playerName={selectedPlayer.full_name}
          playerJersey={selectedPlayer.jersey_number}
          onAction={handleSlotBAction}
          onClose={() => {
            setShowSlotBActions(false);
            setSelectedPlayer(null);
            setTapCoordinates(null);
          }}
        />
      )}

      {showFreeThrowScript && (
        <FreeThrowSequencePopup
          t={t}
          onConfirm={handleFreeThrowScriptConfirm}
          onClose={() => {
            setShowFreeThrowScript(false);
            setPendingFoulPlayer(null);
          }}
        />
      )}

      {showOpponentRoster && userSlot === 'a' && (
        <OpponentRosterModal
          t={t}
          lineupLocked={opponentLineupLocked}
          canClose={opponentPlaying.length > 0 || opponentLineupLocked}
          initialPlayers={opponentRosterDraft}
          onSave={saveOpponentRoster}
          onClose={() => setShowOpponentRoster(false)}
        />
      )}

      {showSquad && userSlot === 'a' && (
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

      {showPeriodLineup && userSlot === 'a' && (
        <PeriodLineupModal
          t={t}
          periodLabel={getPeriodLabel(currentPeriod)}
          homeName={game.teams?.name || 'Home'}
          awayName={game.opponent_name || 'Away'}
          homePlayers={dressedPlayers().map((player) => ({
            id: player.id,
            jersey: player.jersey_number,
            name: player.full_name,
            eliminated: isEliminated(personalFoulCount(player.id, 'home')),
          }))}
          awayPlayers={opponentPlaying.map((player) => ({
            id: player.id,
            jersey: opponentShirt(player),
            name: player.name?.trim() || game.opponent_name || 'Away',
            eliminated: isEliminated(personalFoulCount(player.id, 'away')),
          }))}
          initialHomeIds={suggestedStarterIds('home')}
          initialAwayIds={suggestedStarterIds('away')}
          homeRequired={minimumToStart(eliminatedCount('home'))}
          awayRequired={minimumToStart(eliminatedCount('away'))}
          onSave={savePeriodLineup}
          onClose={() => setShowPeriodLineup(false)}
        />
      )}

      {showOpponentFoul && (
        <PlayerSelectionModal
          players={awayLineupIds.flatMap((id) => {
            const player = opponentPlayers.find((item) => item.id === id);
            if (!player) return [];
            return [{
              id: player.id,
              full_name: player.name?.trim() || game.opponent_name || 'Away',
              jersey_number: opponentShirt(player),
              avatar_url: null,
            }];
          })}
          onSelectPlayer={(playerId) => { void recordOpponentFoul(playerId); }}
          onClose={() => setShowOpponentFoul(false)}
          title={t('trke_opponent_foul_pick', 'Who fouled?')}
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
          onStartClock={() => { void startClock(); }}
          onConfirm={handleJumpBallConfirm}
          onClose={() => setShowJumpBall(false)}
        />
      )}

      {showFoul && (
        <FoulModal
          players={onCourtPlayers}
          playerFoulCounts={playerFoulCounts}
          onConfirm={handleFoulSubmit}
          onPersonalFoul={handlePersonalFoul}
          onClose={() => setShowFoul(false)}
        />
      )}
    </div>
  );
}
