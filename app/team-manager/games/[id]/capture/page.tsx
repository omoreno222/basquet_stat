'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BasketballCourt } from './components/BasketballCourt';
import { PlayerSelectionModal } from './components/PlayerSelectionModal';
import { ShotActionModal } from './components/ShotActionModal';
import { SlotBActionModal } from './components/SlotBActionModal';

type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export default function GameCapturePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userSlot, setUserSlot] = useState<'a' | 'b' | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [presenceState, setPresenceState] = useState<any>({});
  
  // Game state
  const [clockRunning, setClockRunning] = useState(false);
  const [clockRemaining, setClockRemaining] = useState(600000);
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const [possession, setPossession] = useState<'home' | 'away'>('home');
  const [teamScore, setTeamScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);

  // UI state
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [showShotActions, setShowShotActions] = useState(false);
  const [showSlotBActions, setShowSlotBActions] = useState(false);
  const [tapCoordinates, setTapCoordinates] = useState<{ x: number; y: number } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [showSlotAMenu, setShowSlotAMenu] = useState(false);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    const cleanup = setupRealtimeSubscription();
    return () => cleanup();
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
  }, [clockRunning, userSlot]);

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

  async function updateGameState(updates: any) {
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);

    if (error) console.error('Failed to update game state:', error);
    return !error;
  }

  async function loadData() {
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
      .select('*, teams(name)')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData);
      setClockRemaining(gameData.clock_remaining_ms || 600000);
      setClockRunning(gameData.clock_running || false);
      setCurrentPeriod(gameData.current_period || 1);
      setPossession(gameData.possession || 'home');
      setTeamScore(gameData.team_score || 0);
      setOpponentScore(gameData.opponent_score || 0);

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

      setPlayers(playersData || []);

      const { data: eventsData } = await supabase
        .from('game_events')
        .select('*, players(full_name, jersey_number)')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(50);

      setEvents(eventsData || []);
    }

    setLoading(false);
  }

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel(`game:${gameId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: currentUser?.id || 'anonymous' },
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
            .select('*, players(full_name, jersey_number)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setEvents(prev => [data, ...prev].slice(0, 50));
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
          setEvents(prev => prev.filter(e => e.id !== payload.old.id));
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
        async (payload: any) => {
          if (payload.new) {
            const newData = payload.new;
            
            setClockRemaining(newData.clock_remaining_ms);
            setClockRunning(newData.clock_running);
            setCurrentPeriod(newData.current_period);
            setPossession(newData.possession);
            setTeamScore(newData.team_score);
            setOpponentScore(newData.opponent_score);

            if (
              newData.slot_a_user_id !== game?.slot_a_user_id ||
              newData.slot_b_user_id !== game?.slot_b_user_id
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

            setGame((prev: any) => ({ ...prev, ...newData }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          channel.track({
            user_id: currentUser?.id,
            slot: userSlot,
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
  }

  function handlePeriodEnd() {
    alert(`Period ${currentPeriod} ended`);
  }

  function handleCourtTap(x: number, y: number) {
    setTapCoordinates({ x, y });
    setShowPlayerPicker(true);
  }

  function handlePlayerSelected(playerId: string) {
    const player = players.find(p => p.id === playerId);
    setSelectedPlayer(player);
    setShowPlayerPicker(false);
    
    if (userSlot === 'a') {
      setShowShotActions(true);
    } else if (userSlot === 'b') {
      setShowSlotBActions(true);
    }
  }

  async function handleShotAction(made: boolean, points: number) {
    if (!selectedPlayer || !tapCoordinates) return;

    // Calculate zone
    let zone = 1;
    const distance = Math.sqrt(tapCoordinates.x * tapCoordinates.x + tapCoordinates.y * tapCoordinates.y);
    if (distance < 0.3) zone = 1;
    else if (tapCoordinates.x > 0.5 && distance < 0.7) zone = 2;
    else if (tapCoordinates.x <= 0.5 && distance < 0.7) zone = 3;
    else zone = 4;

    const elapsed = 600000 - clockRemaining;

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
        coord_x: tapCoordinates.x,
        coord_y: tapCoordinates.y,
        zone,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser.id,
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

    const elapsed = 600000 - clockRemaining;
    
    let eventType = actionType;
    if (actionType === 'rebound_off' || actionType === 'rebound_def') {
      eventType = 'rebound';
    }

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
        event_type: eventType,
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        coord_x: tapCoordinates.x,
        coord_y: tapCoordinates.y,
        is_offensive: actionType === 'rebound_off' || actionType === 'steal' || actionType === 'assist',
        recorded_by_user_id: currentUser.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }

    setShowSlotBActions(false);
    setSelectedPlayer(null);
    setTapCoordinates(null);
  }

  async function handleFreeThrow(made: boolean) {
    if (!selectedPlayer) {
      alert('Please select a player from the court');
      return;
    }

    const elapsed = 600000 - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
        event_type: 'free_throw',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        points: made ? 1 : 0,
        made,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      if (made && userSlot === 'a') {
        const newTeamScore = teamScore + 1;
        setTeamScore(newTeamScore);
        await updateGameState({ team_score: newTeamScore });
      }
    }

    setShowSlotAMenu(false);
  }

  async function handleFoul() {
    if (!selectedPlayer) {
      alert('Please select a player from the court');
      return;
    }

    const elapsed = 600000 - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
        event_type: 'foul',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }

    setShowSlotAMenu(false);
  }

  async function handleSubstitution() {
    if (!selectedPlayer) {
      alert('Please select a player from the court');
      return;
    }

    const elapsed = 600000 - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer.id,
        event_type: 'substitution',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        recorded_by_user_id: currentUser.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }

    setShowSlotAMenu(false);
  }

  async function toggleClock() {
    if (userSlot !== 'a') return;
    const newState = !clockRunning;
    setClockRunning(newState);
    await updateGameState({
      clock_running: newState,
      clock_remaining_ms: clockRemaining,
    });
  }

  async function adjustClock(ms: number) {
    if (userSlot !== 'a') return;
    const newTime = Math.max(0, Math.min(600000, clockRemaining + ms));
    setClockRemaining(newTime);
    await updateGameState({ clock_remaining_ms: newTime });
  }

  async function nextPeriod() {
    if (userSlot !== 'a') return;
    const newPeriod = currentPeriod + 1;
    setCurrentPeriod(newPeriod);
    setClockRemaining(600000);
    setClockRunning(false);
    await updateGameState({
      current_period: newPeriod,
      clock_remaining_ms: 600000,
      clock_running: false,
    });
  }

  async function flipPossession() {
    if (userSlot !== 'a') return;
    const newPossession = possession === 'home' ? 'away' : 'home';
    setPossession(newPossession);
    await updateGameState({ possession: newPossession });
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
    const isOwnEvent = lastEvent.recorded_by_user_id === currentUser.id;

    if (!isOwnEvent) {
      if (!confirm('This event was recorded by another user. Undo anyway?')) {
        return;
      }
    }

    if (lastEvent.made && lastEvent.points > 0 && userSlot === 'a') {
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
  
  const connectionColor = 
    connectionStatus === 'connected' ? 'text-green-400' :
    connectionStatus === 'reconnecting' ? 'text-yellow-400' :
    'text-red-400';
  
  const connectionText =
    connectionStatus === 'connected' ? 'Connected' :
    connectionStatus === 'reconnecting' ? 'Reconnecting...' :
    'Offline';

  // Get shot markers for court
  const shotMarkers = events
    .filter(e => e.event_type === 'shot' && e.coord_x != null && e.coord_y != null)
    .map(e => ({
      id: e.id,
      x: e.coord_x,
      y: e.coord_y,
      made: e.made,
      points: e.points || 0,
    }));

  return (
    <div className="fixed inset-0 bg-gray-900 text-white overflow-hidden">
      {/* Basketball Court - Full Viewport */}
      <div className="absolute inset-0">
        <BasketballCourt
          onCourtTap={handleCourtTap}
          shotMarkers={shotMarkers}
        />
      </div>

      {/* Top-Left: Clock Controls (Slot A only) */}
      {userSlot === 'a' && (
        <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-95 rounded-lg p-4 shadow-2xl border-2 border-orange-500 max-w-xs">
          <div className="text-4xl font-bold text-center mb-2">{formatTime(clockRemaining)}</div>
          <div className="text-sm text-center text-gray-400 mb-3">Period {currentPeriod}</div>
          
          <div className="flex gap-2 mb-3">
            <button
              onClick={toggleClock}
              className={`flex-1 px-4 py-2 rounded font-bold text-sm ${
                clockRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {clockRunning ? 'STOP' : 'START'}
            </button>
            <button
              onClick={() => adjustClock(-10000)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              -10s
            </button>
            <button
              onClick={() => adjustClock(10000)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              +10s
            </button>
          </div>

          <button
            onClick={nextPeriod}
            className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium mb-3"
          >
            Next Period
          </button>

          <div className="text-xs text-center">
            <span className="text-gray-400">Possession:</span>{' '}
            <span className="font-medium">{possession === 'home' ? game.teams?.name : game.opponent_name}</span>
            {' | '}
            <button
              onClick={flipPossession}
              className="text-orange-400 hover:text-orange-300"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      {/* Top-Right: Scores & Connection */}
      <div className="absolute top-4 right-4 space-y-3">
        {/* Game Score */}
        <div className="bg-gray-800 bg-opacity-95 rounded-lg p-4 shadow-2xl border-2 border-orange-500 text-center">
          <div className="text-xs text-gray-400 mb-1">{game.teams?.name} vs {game.opponent_name}</div>
          <div className="text-4xl font-bold">{teamScore} - {opponentScore}</div>
          <div className="text-xs mt-1">
            <span className={connectionColor}>● {connectionText}</span>
            {connectedCount > 0 && (
              <span className="ml-1 text-gray-400">({connectedCount})</span>
            )}
          </div>
        </div>

        {/* Opponent Score (Slot A only) */}
        {userSlot === 'a' && (
          <div className="bg-gray-800 bg-opacity-95 rounded-lg p-4 shadow-2xl border-2 border-blue-500 text-center">
            <div className="text-xs text-gray-400 mb-2">Opponent Score</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => updateOpponentScore(-1)}
                className="w-12 h-12 bg-gray-600 hover:bg-gray-700 rounded-lg text-2xl font-bold"
              >
                -
              </button>
              <div className="text-3xl font-bold min-w-[3rem]">{opponentScore}</div>
              <button
                onClick={() => updateOpponentScore(1)}
                className="w-12 h-12 bg-gray-600 hover:bg-gray-700 rounded-lg text-2xl font-bold"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left: Slot A Additional Actions */}
      {userSlot === 'a' && (
        <div className="absolute bottom-4 left-4">
          <button
            onClick={() => setShowSlotAMenu(!showSlotAMenu)}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-bold shadow-2xl"
          >
            {showSlotAMenu ? 'Close Menu' : 'FT / Foul / Sub'}
          </button>

          {showSlotAMenu && (
            <div className="absolute bottom-16 left-0 bg-gray-800 bg-opacity-95 rounded-lg p-4 shadow-2xl border-2 border-orange-500 space-y-2 min-w-[200px]">
              <p className="text-xs text-gray-400 mb-2">
                {selectedPlayer ? `Player: #${selectedPlayer.jersey_number} ${selectedPlayer.full_name}` : 'Tap court to select player'}
              </p>
              <button
                onClick={() => handleFreeThrow(true)}
                disabled={!selectedPlayer}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded"
              >
                FT Made
              </button>
              <button
                onClick={() => handleFreeThrow(false)}
                disabled={!selectedPlayer}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded"
              >
                FT Miss
              </button>
              <button
                onClick={handleFoul}
                disabled={!selectedPlayer}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 rounded"
              >
                Foul
              </button>
              <button
                onClick={handleSubstitution}
                disabled={!selectedPlayer}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded"
              >
                Substitution
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom-Right: Event Feed Toggle */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={() => setShowEventFeed(!showEventFeed)}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold shadow-2xl border-2 border-gray-600"
        >
          {showEventFeed ? 'Hide Events' : 'Show Events'}
        </button>
      </div>

      {/* Event Feed Drawer */}
      {showEventFeed && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-gray-800 bg-opacity-98 shadow-2xl border-l-2 border-orange-500 flex flex-col">
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
                  {event.players?.jersey_number && `#${event.players.jersey_number} `}
                  {event.players?.full_name || 'Team'}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {event.event_type}
                  {event.made !== null && ` - ${event.made ? 'Made' : 'Miss'}`}
                  {event.points > 0 && ` (${event.points}pts)`}
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

      {/* Slot indicator (bottom center) */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-90 px-4 py-2 rounded-full text-sm border border-gray-600">
        <span className="text-gray-400">Slot {userSlot.toUpperCase()}</span>
        {userSlot === 'a' && <span className="text-orange-400 ml-2">(Authority)</span>}
      </div>

      {/* Modals */}
      {showPlayerPicker && (
        <PlayerSelectionModal
          players={players}
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
          onAction={handleShotAction}
          onClose={() => {
            setShowShotActions(false);
            setSelectedPlayer(null);
            setTapCoordinates(null);
          }}
        />
      )}

      {showSlotBActions && selectedPlayer && tapCoordinates && (
        <SlotBActionModal
          playerName={selectedPlayer.full_name}
          playerJersey={selectedPlayer.jersey_number}
          coordinateX={tapCoordinates.x}
          coordinateY={tapCoordinates.y}
          onAction={handleSlotBAction}
          onClose={() => {
            setShowSlotBActions(false);
            setSelectedPlayer(null);
            setTapCoordinates(null);
          }}
        />
      )}
    </div>
  );
}
