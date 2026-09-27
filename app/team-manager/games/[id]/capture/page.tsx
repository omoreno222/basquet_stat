'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BasketballCourt, calculateShotZone } from './components/BasketballCourt';
import { PlayerSelectionModal } from './components/PlayerSelectionModal';
import { ShotActionModal } from './components/ShotActionModal';
import { SlotBActionModal } from './components/SlotBActionModal';
import { StartingLineupModal } from './components/StartingLineupModal';
import { FreeThrowModal } from './components/FreeThrowModal';
import { FoulModal } from './components/FoulModal';
import { SubstitutionModal } from './components/SubstitutionModal';
import { ChooseSideModal } from './components/ChooseSideModal';
import { GuestPlayerModal } from './components/GuestPlayerModal';
import { calculateMinutesPlayed, formatMinutes } from '@/lib/stats/minutes';
import { Profile } from '@/lib/types';
import { ClubLogo } from '@/components/ClubLogo';

type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

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
  clock_running: boolean;
  clock_remaining_ms: number;
  current_period: number;
  possession: 'home' | 'away';
  attack_right_first: boolean;
  created_at?: string;
  updated_at?: string;
  teams?: { 
    name: string; 
    logo_url?: string | null;
    club_id?: string;
  };
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
  recorded_by_user_id: string;
  created_at: string;
  player?: Player;
  player_out?: Player;
}

interface PresenceState {
  [key: string]: Array<{
    presence_ref: string;
    slot?: 'a' | 'b';
    user_id?: string;
  }>;
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
function getPeriodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

export default function GameCapturePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [userSlot, setUserSlot] = useState<'a' | 'b' | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  
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
  const [showEventFeed, setShowEventFeed] = useState(false);
  
  // New lineup and action modals
  const [showStartingLineup, setShowStartingLineup] = useState(false);
  const [showFreeThrow, setShowFreeThrow] = useState(false);
  const [showFoul, setShowFoul] = useState(false);
  const [showSubstitution, setShowSubstitution] = useState(false);
  const [showChooseSide, setShowChooseSide] = useState(false);
  const [showGuestPlayer, setShowGuestPlayer] = useState(false);
  const [sideChosen, setSideChosen] = useState(false);
  const [startingLineupIds, setStartingLineupIds] = useState<string[]>([]); // Immutable starting 5
  const [startingLineupSet, setStartingLineupSet] = useState(false);
  const [showBoxScore, setShowBoxScore] = useState(false);
  const [draftLineupIds, setDraftLineupIds] = useState<string[]>([]); // Draft state for lineup modal
  const [periodEndTimes, setPeriodEndTimes] = useState<Record<number, number>>({}); // Period -> clock_remaining_ms at end

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameRef = useRef<Game | null>(null);
  const userSlotRef = useRef<'a' | 'b' | null>(null);
  const currentUserRef = useRef<Profile | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    userSlotRef.current = userSlot;
  }, [userSlot]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Derive on-court players from starting lineup + substitution events using useMemo
  // This ensures it's always up-to-date and avoids stale closure issues
  const onCourtPlayerIds = useMemo(() => {
    return deriveOnCourtPlayers(startingLineupIds, events);
  }, [startingLineupIds, events]);

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
  function deriveOnCourtPlayers(startingIds: string[], allEvents: GameEvent[]): string[] {
    const subs = allEvents
      .filter(e => e.event_type === 'substitution' && e.player_id && e.player_out_id)
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

    const { data: userRoles } = await supabase
      .from('profile_roles')
      .select('role')
      .eq('profile_id', user.id);

    const roles = userRoles?.map(r => r.role) || [profile?.role];
    const isAdmin = roles.includes('admin');

    const { data: gameData } = await supabase
      .from('games')
      .select('*, teams(name, logo_url, club_id)')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData);
      setClockRemaining(gameData.clock_remaining_ms ?? getPeriodLengthMs(gameData.current_period || 1));
      setClockRunning(gameData.clock_running || false);
      setCurrentPeriod(gameData.current_period || 1);
      setPossession(gameData.possession || 'home');
      setTeamScore(gameData.team_score || 0);
      setOpponentScore(gameData.opponent_score || 0);
      setAttackRightFirst(gameData.attack_right_first ?? true);
      
      // Check if side has been chosen (if game has started or events exist, side was chosen)
      const hasStarted = gameData.current_period > 0 || (gameData.team_score + gameData.opponent_score) > 0;
      setSideChosen(hasStarted);

      const newSlot = 
        profile.id === gameData.slot_a_user_id ? 'a' :
        profile.id === gameData.slot_b_user_id ? 'b' :
        isAdmin ? 'a' : null;
      
      setUserSlot(newSlot);

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
      
      // Load starting lineup
      const { data: lineupData } = await supabase
        .from('starting_lineups')
        .select('player_id')
        .eq('game_id', gameId)
        .order('position_index');

      if (lineupData && lineupData.length > 0) {
        const startingIds = lineupData.map(sl => sl.player_id);
        setStartingLineupIds(startingIds);
        setStartingLineupSet(true);
        
        // On-court players are now derived via useMemo, no need to set state
      }

      // Load period end times for accurate minutes calculation
      const { data: periodData } = await supabase
        .from('game_periods')
        .select('period_number, clock_remaining_ms')
        .eq('game_id', gameId);

      if (periodData) {
        const endTimes: Record<number, number> = {};
        periodData.forEach(p => {
          if (p.clock_remaining_ms !== null) {
            endTimes[p.period_number] = p.clock_remaining_ms;
          }
        });
        setPeriodEndTimes(endTimes);
      }
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
          presence: { key: currentUserRef.current?.id || 'anonymous' },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceState(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
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
              const { data: userRoles } = await supabase
                .from('profile_roles')
                .select('role')
                .eq('profile_id', user?.id || '');
              
              const roles = userRoles?.map(r => r.role) || [];
              const isAdmin = roles.includes('admin');

              const newSlot = 
                user?.id === newData.slot_a_user_id ? 'a' :
                user?.id === newData.slot_b_user_id ? 'b' :
                isAdmin ? 'a' : null;
              
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
          table: 'starting_lineups',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          // Reload lineup when it changes
          const { data: lineupData } = await supabase
            .from('starting_lineups')
            .select('player_id')
            .eq('game_id', gameId)
            .order('position_index');

          if (lineupData && lineupData.length > 0) {
            const startingIds = lineupData.map(sl => sl.player_id);
            setStartingLineupIds(startingIds);
            setStartingLineupSet(true);
            
            // On-court lineup automatically re-derived via useMemo when startingLineupIds change
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_periods',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          // Reload period end times when they change
          const { data: periodData } = await supabase
            .from('game_periods')
            .select('period_number, clock_remaining_ms')
            .eq('game_id', gameId);

          if (periodData) {
            const endTimes: Record<number, number> = {};
            periodData.forEach(p => {
              if (p.clock_remaining_ms !== null) {
                endTimes[p.period_number] = p.clock_remaining_ms;
              }
            });
            setPeriodEndTimes(endTimes);
          }
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          channel.track({
            user_id: currentUserRef.current?.id,
            slot: userSlotRef.current,
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting');
        } else if (status === 'CLOSED') {
          setConnectionStatus('offline');
        }
      });

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
        if (newTime === 0) {
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

  function handleCourtTap(worldX: number, worldY: number) {
    setTapCoordinates({ x: worldX, y: worldY });
    setShowPlayerPicker(true);
  }

  function handlePlayerSelected(playerId: string) {
    const player = players.find(p => p.id === playerId);
    setSelectedPlayer(player || null);
    setShowPlayerPicker(false);
    
    if (userSlot === 'a') {
      setShowShotActions(true);
    } else if (userSlot === 'b') {
      setShowSlotBActions(true);
    }
  }

  async function handleShotAction(made: boolean, points: number) {
    if (!selectedPlayer || !tapCoordinates) return;

    // Transform world coordinates to normalized attacking coordinates
    const normalized = worldToNormalized(tapCoordinates.x, tapCoordinates.y);

    // Calculate zone using shared FIBA geometry helper
    const zone = calculateShotZone(normalized.x, normalized.y, true); // Always normalized to attacking right

    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
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

  async function handleFreeThrowSubmit(player: Player, shots: boolean[]) {
    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;
    const attacking = isAttackingRight();
    
    // FIBA FT line constants (same as BasketballCourt.tsx)
    // FT line at 5.8m from baseline, centered at y=7.5m (750cm)
    // For multiple shots, spread along y: 690, 750, 810 (in court cm)
    const COURT_LENGTH_M = 28;
    const COURT_WIDTH_CM = 1500;
    const FT_LINE_FROM_BASELINE_M = 5.8;
    const FT_Y_POSITIONS_CM = [690, 750, 810]; // spread for 1-3 shots
    
    // Calculate FT x position (normalized 0-1)
    const ftWorldX = attacking 
      ? (COURT_LENGTH_M - FT_LINE_FROM_BASELINE_M) / COURT_LENGTH_M  // 0.793 (right basket)
      : FT_LINE_FROM_BASELINE_M / COURT_LENGTH_M;  // 0.207 (left basket)
    
    // Spread Y positions based on shot count
    const yPositions = shots.length === 1 
      ? [FT_Y_POSITIONS_CM[1]]  // Single shot: center (750)
      : shots.length === 2
      ? [FT_Y_POSITIONS_CM[0], FT_Y_POSITIONS_CM[2]]  // Two shots: top and bottom (690, 810)
      : FT_Y_POSITIONS_CM;  // Three shots: all three (690, 750, 810)

    // Insert one event per shot with individual Y positions
    for (let i = 0; i < shots.length; i++) {
      const made = shots[i];
      const ftWorldY = yPositions[i] / COURT_WIDTH_CM;  // Normalize y position
      const ftNormalized = worldToNormalized(ftWorldX, ftWorldY);
      
      const { error } = await supabase
        .from('game_events')
        .insert({
          game_id: gameId,
          player_id: player.id,
          event_type: 'free_throw',
          period_number: currentPeriod,
          clock_remaining_ms: clockRemaining,
          elapsed_ms: elapsed,
          points: made ? 1 : 0,
          made,
          coord_x: ftNormalized.x,
          coord_y: ftNormalized.y,
          is_offensive: possession === 'home',
          recorded_by_user_id: currentUser!.id,
        });

      if (error) {
        alert(`Error recording FT ${i + 1}: ${error.message}`);
        return;
      }
    }

    // Update score for made FTs (Slot A authority)
    if (userSlot === 'a') {
      const madeCount = shots.filter(s => s).length;
      if (madeCount > 0) {
        const newTeamScore = teamScore + madeCount;
        setTeamScore(newTeamScore);
        await updateGameState({ team_score: newTeamScore });
      }
    }

    setShowFreeThrow(false);
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

  async function handleSubstitutionSubmit(playersOut: Player[], playersIn: Player[]) {
    const elapsed = getPeriodLengthMs(currentPeriod) - clockRemaining;

    // Create array of substitution events for atomic insert
    const substitutionEvents = playersOut.map((playerOut, i) => ({
      game_id: gameId,
      player_id: playersIn[i].id,
      player_out_id: playerOut.id,
      event_type: 'substitution',
      period_number: currentPeriod,
      clock_remaining_ms: clockRemaining,
      elapsed_ms: elapsed,
      recorded_by_user_id: currentUser!.id,
    }));

    // Insert all substitutions atomically
    const { error } = await supabase
      .from('game_events')
      .insert(substitutionEvents);

    if (error) {
      alert(`Error recording substitution: ${error.message}`);
      return;
    }

    // On-court lineup automatically re-derived via useMemo when events change
    setShowSubstitution(false);
  }

  async function handleStartingLineupSubmit(selectedPlayers: Player[]) {
    // Block lineup changes if game has started:
    // - Any events have been recorded (not just subs)
    // - Clock has run from initial period length
    const hasEvents = events.length > 0;
    const initialPeriodLength = getPeriodLengthMs(currentPeriod);
    const clockHasRun = clockRemaining < initialPeriodLength;
    
    if (hasEvents || clockHasRun) {
      alert('Cannot change starting lineup after the game has started. Use Sub button instead.');
      setShowStartingLineup(false);
      return;
    }

    // Use upsert approach: delete and re-insert in a single operation
    const { error: deleteError } = await supabase
      .from('starting_lineups')
      .delete()
      .eq('game_id', gameId);

    if (deleteError) {
      alert(`Error clearing lineup: ${deleteError.message}`);
      return;
    }

    const lineupInserts = selectedPlayers.map((player, index) => ({
      game_id: gameId,
      player_id: player.id,
      position_index: index,
    }));

    const { error: insertError } = await supabase
      .from('starting_lineups')
      .insert(lineupInserts);

    if (insertError) {
      alert(`Error saving lineup: ${insertError.message}`);
      return;
    }

    const startingIds = selectedPlayers.map(p => p.id);
    setStartingLineupIds(startingIds);
    // On-court lineup automatically derived via useMemo
    setStartingLineupSet(true);
    setShowStartingLineup(false);
  }

  async function toggleClock() {
    if (userSlot !== 'a') return;
    
    // If trying to start clock for the first time (Q1) and side hasn't been chosen yet
    if (!clockRunning && currentPeriod === 1 && startingLineupSet && !sideChosen) {
      setShowChooseSide(true);
      return;
    }
    
    const newState = !clockRunning;
    setClockRunning(newState);
    await updateGameState({
      clock_running: newState,
      clock_remaining_ms: clockRemaining,
    });
  }

  async function nextPeriod() {
    if (userSlot !== 'a') return;
    
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

    // Update local period end times
    setPeriodEndTimes(prev => ({
      ...prev,
      [currentPeriod]: clockRemaining
    }));

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
  }

  async function flipPossession() {
    if (userSlot !== 'a') return;
    const newPossession = possession === 'home' ? 'away' : 'home';
    setPossession(newPossession);
    await updateGameState({ possession: newPossession });
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

  async function updateOpponentScore(delta: number) {
    if (userSlot !== 'a') return;
    const newScore = Math.max(0, opponentScore + delta);
    setOpponentScore(newScore);
    await updateGameState({ opponent_score: newScore });
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

  const presenceUsers = Object.keys(presenceState);
  const connectedCount = presenceUsers.length;
  
  const connectionText =
    connectionStatus === 'connected' ? 'Connected' :
    connectionStatus === 'reconnecting' ? 'Reconnecting...' :
    'Offline';

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
  const benchPlayers = players.filter(p => !onCourtPlayerIds.includes(p.id));
  
  // Calculate foul counts for each player
  const playerFoulCounts: Record<string, number> = {};
  events.forEach(e => {
    if (e.event_type === 'foul' && e.player_id) {
      playerFoulCounts[e.player_id] = (playerFoulCounts[e.player_id] || 0) + 1;
    }
  });

  // Get players for pickers (on-court only, or all if lineup not set)
  const availablePlayers = startingLineupSet && onCourtPlayers.length > 0 ? onCourtPlayers : players;

  // Calculate minutes played for all players (use starting lineup, not current on-court)
  const playerMinutes = calculateMinutesPlayed(
    startingLineupIds,
    events,
    currentPeriod,
    clockRemaining,
    periodEndTimes
  );

  const attacking = isAttackingRight();
  const isOffense = possession === 'home';
  
  // Possession highlight: show which half has possession (not which we're attacking)
  // When we have possession (offense), highlight our attacking half
  // When opponent has possession, highlight their attacking half (opposite of ours)

  const connectionColor = connectedCount > 0
    ? 'text-green-400'
    : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Single Compact Top Bar - Clock (Left) & Score (Right) */}
      <div className="flex items-center justify-between bg-gray-800 border-b-2 border-orange-500 px-3 py-2 flex-shrink-0 gap-4" style={{ minHeight: '56px' }}>
        {/* LEFT: Clock Block (Horizontal Layout) */}
        {userSlot === 'a' ? (
          <div className="flex items-center gap-2 flex-wrap-0 whitespace-nowrap">
            {/* Menu Button */}
            <button
              onClick={() => {
                if (clockRunning) {
                  if (confirm('The clock will be paused when you leave. Continue?')) {
                    router.push(`/team-manager/games/${gameId}`);
                  }
                } else {
                  router.push(`/team-manager/games/${gameId}`);
                }
              }}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded text-lg"
              title="Back to Game"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              ☰
            </button>
            
            {/* Time & Period */}
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold leading-none">{formatTime(clockRemaining)}</div>
              <div className="text-xs text-gray-400">{getPeriodLabel(currentPeriod)}</div>
            </div>
            
            {/* START/STOP */}
            <button
              onClick={toggleClock}
              className={`px-3 py-2 rounded-lg font-bold text-sm ${
                clockRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
              style={{ minWidth: '70px', minHeight: '44px' }}
            >
              {clockRunning ? 'STOP' : 'START'}
            </button>
            
            {/* Next Period */}
            <button 
              onClick={nextPeriod} 
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs font-medium whitespace-nowrap" 
              style={{ minHeight: '44px' }}
            >
              Next
            </button>
            
            {/* Flip Court */}
            <button 
              onClick={flipCourt} 
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-xs font-medium" 
              title="Flip which basket we attack"
              style={{ minHeight: '44px' }}
            >
              ↔
            </button>
            
            {/* Possession - Compact */}
            <div className="flex items-center gap-1 text-xs border-l border-gray-600 pl-2">
              <span className="text-gray-400">Poss:</span>
              <span className="font-medium max-w-[100px] truncate">{possession === 'home' ? game.teams?.name : game.opponent_name}</span>
              <button onClick={flipPossession} className="text-orange-400 hover:text-orange-300 font-medium">
                Switch
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 whitespace-nowrap">
            {/* Time & Period */}
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold leading-none">{formatTime(clockRemaining)}</div>
              <div className="text-xs text-gray-400">{getPeriodLabel(currentPeriod)}</div>
            </div>
            
            {/* Possession (View Only) - Compact */}
            <div className="text-xs text-gray-400">
              Poss: <span className="font-medium text-white max-w-[100px] truncate inline-block">{possession === 'home' ? game.teams?.name : game.opponent_name}</span>
            </div>
          </div>
        )}
        
        {/* RIGHT: Score + Connection + Opponent Control */}
        <div className="flex items-center gap-3 whitespace-nowrap">
          {/* Team Names & Score with Logos */}
          <div className="flex items-center gap-2 text-base font-bold">
            <ClubLogo 
              logoUrl={game.teams?.logo_url} 
              clubName={game.teams?.name || 'Team'} 
              size="xs"
            />
            <span className="hidden sm:inline">{game.teams?.name}</span>
            <span className="sm:hidden">{game.teams?.name?.substring(0, 8)}</span>
            <span className="text-2xl text-orange-400">{teamScore}</span>
            <span className="text-gray-400">-</span>
            <span className="text-2xl text-blue-400">{opponentScore}</span>
            <span className="hidden sm:inline">{game.opponent_name}</span>
            <span className="sm:hidden">{game.opponent_name?.substring(0, 8)}</span>
          </div>
          
          {/* Connection Status */}
          <div className="text-xs">
            <span className={connectionColor}>● {connectionText}</span>
            {connectedCount > 0 && <span className="ml-1 text-gray-400">({connectedCount})</span>}
          </div>
          
          {/* Opponent Score Control (Slot A only) - No duplicate number */}
          {userSlot === 'a' && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => updateOpponentScore(-1)} 
                className="w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-lg text-lg font-bold flex items-center justify-center"
                style={{ minWidth: '44px', minHeight: '44px' }}
                title="Decrease opponent score"
              >
                -
              </button>
              <button 
                onClick={() => updateOpponentScore(1)} 
                className="w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-lg text-lg font-bold flex items-center justify-center"
                style={{ minWidth: '44px', minHeight: '44px' }}
                title="Increase opponent score"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Court Area - Maintains 28:15 Aspect Ratio */}
      <div className="flex-1 relative overflow-hidden bg-gray-950 flex items-center justify-center">
        <div className="w-full h-full">
          <BasketballCourt
            onCourtTap={handleCourtTap}
            shotMarkers={shotMarkers}
            attackingRight={attacking}
            isOffense={isOffense}
          />
        </div>
      </div>

      {/* Bottom Bar - Compact Actions & Slot Info */}
      <div className="flex items-center justify-between bg-gray-800 border-t-2 border-orange-500 px-3 py-2 flex-shrink-0 gap-3" style={{ minHeight: '50px' }}>
        {/* Left: Slot A Action Buttons */}
        {userSlot === 'a' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-orange-400 font-bold">Slot A</span>
            
            {/* Lineup Button */}
            <button
              onClick={() => {
                setDraftLineupIds(startingLineupSet ? startingLineupIds : []);
                setShowStartingLineup(true);
              }}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-xs"
              style={{ minHeight: '44px' }}
            >
              {startingLineupSet ? 'Lineup' : 'Set Lineup'}
            </button>
            
            {/* FT Button */}
            <button
              onClick={() => setShowFreeThrow(true)}
              disabled={!startingLineupSet || onCourtPlayers.length === 0}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:opacity-50 rounded-lg font-bold text-xs"
              style={{ minHeight: '44px' }}
            >
              FT
            </button>
            
            {/* Foul Button */}
            <button
              onClick={() => setShowFoul(true)}
              disabled={!startingLineupSet || onCourtPlayers.length === 0}
              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:opacity-50 rounded-lg font-bold text-xs"
              style={{ minHeight: '44px' }}
            >
              Foul
            </button>
            
            {/* Add Guest Button */}
            <button
              onClick={() => setShowGuestPlayer(true)}
              disabled={!game}
              className="px-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:opacity-50 rounded-lg font-bold text-xs"
              title="Add guest player from another team"
              style={{ minHeight: '44px' }}
            >
              +G
            </button>
            
            {/* Sub Button */}
            <button
              onClick={() => setShowSubstitution(true)}
              disabled={!startingLineupSet || onCourtPlayers.length === 0 || benchPlayers.length === 0}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 rounded-lg font-bold text-xs"
              style={{ minHeight: '44px' }}
            >
              Sub
            </button>
            
            {/* Box Score Button */}
            <button
              onClick={() => setShowBoxScore(!showBoxScore)}
              disabled={!startingLineupSet}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg font-bold text-xs border border-gray-600"
              style={{ minHeight: '44px' }}
            >
              {showBoxScore ? 'Hide' : 'Box'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400 font-bold">Slot B</span>
            <span className="text-xs text-gray-400">Tap court for rebounds/assists/steals/turnovers</span>
          </div>
        )}

        {/* Right: Event Feed Toggle */}
        <button
          onClick={() => setShowEventFeed(!showEventFeed)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold text-xs border border-gray-600"
          style={{ minHeight: '44px' }}
        >
          {showEventFeed ? 'Hide Events' : 'Show Events'}
        </button>
      </div>

      {/* Box Score Panel */}
      {showBoxScore && startingLineupSet && (
        <div className="absolute top-16 left-4 bg-gray-800 bg-opacity-95 rounded-lg shadow-2xl border-2 border-orange-500 p-4 z-40 max-w-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-white">Box Score</h3>
            <button
              onClick={() => setShowBoxScore(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {/* On Court Players */}
            <div className="text-xs text-orange-400 font-bold mb-1">On Court</div>
            {onCourtPlayers.map(player => (
              <div key={player.id} className="flex justify-between items-center text-sm bg-gray-700 px-2 py-1 rounded">
                <span className="text-white">
                  <span className="text-gray-400">#{player.jersey_number}</span> {player.full_name}
                </span>
                <span className="font-mono text-green-400 font-bold">
                  {formatMinutes(playerMinutes[player.id] || 0)}
                </span>
              </div>
            ))}
            
            {/* Bench Players */}
            {benchPlayers.length > 0 && (
              <>
                <div className="text-xs text-blue-400 font-bold mt-3 mb-1">Bench</div>
                {benchPlayers.map(player => (
                  <div key={player.id} className="flex justify-between items-center text-sm bg-gray-700 px-2 py-1 rounded">
                    <span className="text-white">
                      <span className="text-gray-400">#{player.jersey_number}</span> {player.full_name}
                    </span>
                    <span className="font-mono text-gray-400">
                      {formatMinutes(playerMinutes[player.id] || 0)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Event Feed Drawer */}
      {showEventFeed && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-gray-800 bg-opacity-98 shadow-2xl border-l-2 border-orange-500 flex flex-col z-40">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-lg">Event Feed</h3>
            <button
              onClick={() => setShowEventFeed(false)}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {events.map(event => (
              <div key={event.id} className="text-sm p-3 bg-gray-700 rounded-lg">
                <div className="font-medium text-white">
                  {event.event_type === 'substitution' ? (
                    <>
                      IN #{event.player?.jersey_number} {event.player?.full_name} / OUT #{event.player_out?.jersey_number} {event.player_out?.full_name}
                    </>
                  ) : (
                    <>
                      {event.player?.jersey_number && `#${event.player.jersey_number} `}
                      {event.player?.full_name || 'Team'}
                    </>
                  )}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {event.event_type === 'shot' && event.made === false 
                    ? `${event.points}P miss`
                    : event.event_type === 'shot' && event.made === true
                    ? `${event.points}P made`
                    : event.event_type
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-700">
            <button
              onClick={handleUndo}
              disabled={events.length === 0}
              className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 rounded-lg font-bold"
            >
              Undo Last Event
            </button>
          </div>
        </div>
      )}

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

      {/* New lineup and action modals */}
      {showStartingLineup && (
        <StartingLineupModal
          players={players}
          selectedPlayers={players.filter(p => draftLineupIds.includes(p.id))}
          onTogglePlayer={(player) => {
            if (draftLineupIds.includes(player.id)) {
              setDraftLineupIds(draftLineupIds.filter(id => id !== player.id));
            } else {
              if (draftLineupIds.length < 5) {
                setDraftLineupIds([...draftLineupIds, player.id]);
              }
            }
          }}
          onConfirm={async () => {
            const selectedPlayers = players.filter(p => draftLineupIds.includes(p.id));
            await handleStartingLineupSubmit(selectedPlayers);
          }}
          onClose={() => {
            setShowStartingLineup(false);
            setDraftLineupIds([]); // Clear draft on close
          }}
        />
      )}

      {showFreeThrow && (
        <FreeThrowModal
          players={onCourtPlayers}
          onConfirm={handleFreeThrowSubmit}
          onClose={() => setShowFreeThrow(false)}
        />
      )}

      {showFoul && (
        <FoulModal
          players={onCourtPlayers}
          playerFoulCounts={playerFoulCounts}
          onConfirm={handleFoulSubmit}
          onClose={() => setShowFoul(false)}
        />
      )}

      {showSubstitution && (
        <SubstitutionModal
          onCourtPlayers={onCourtPlayers}
          benchPlayers={benchPlayers}
          playerMinutes={playerMinutes}
          onConfirm={handleSubstitutionSubmit}
          onClose={() => setShowSubstitution(false)}
        />
      )}

      {showGuestPlayer && game && (
        <GuestPlayerModal
          gameId={gameId}
          clubId={game.teams?.club_id || ''}
          currentTeamId={game.team_id}
          onClose={() => setShowGuestPlayer(false)}
          onGuestAdded={() => loadData()}
        />
      )}
    </div>
  );
}
