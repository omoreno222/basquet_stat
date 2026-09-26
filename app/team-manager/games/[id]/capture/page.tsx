'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [shotMode, setShotMode] = useState(false);

  // Refs to track channel and cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    const cleanup = setupRealtimeSubscription();

    return () => {
      cleanup();
    };
  }, [gameId]);

  // Clock ticker - ONLY for Slot A (clock authority)
  // Slot B receives clock updates via Realtime only
  useEffect(() => {
    // Clear any existing interval
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }

    // Only Slot A runs the clock ticker and writes to DB
    if (userSlot !== 'a' || !clockRunning) return;

    clockIntervalRef.current = setInterval(() => {
      setClockRemaining(prev => {
        const newTime = Math.max(0, prev - 100);
        if (newTime === 0) {
          setClockRunning(false);
          handlePeriodEnd();
          // Write final state immediately
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

  // Periodic clock sync to DB - ONLY for Slot A as safety net
  // Primary writes happen immediately on user actions
  useEffect(() => {
    if (userSlot !== 'a' || !clockRunning || !game) return;

    const interval = setInterval(() => {
      // Light safety sync - main writes are immediate
      supabase
        .from('games')
        .update({
          clock_remaining_ms: clockRemaining,
        })
        .eq('id', gameId)
        .then();
    }, 3000); // Every 3 seconds as safety net only

    return () => clearInterval(interval);
  }, [userSlot, clockRunning, clockRemaining, game, gameId]);

  // Helper to update game state immediately (for Slot A actions)
  async function updateGameState(updates: any) {
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);

    if (error) {
      console.error('Failed to update game state:', error);
    }
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

    // Fetch user roles for multi-role support
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

      // Determine user slot and re-evaluate on slot changes
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
        .limit(20);

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
      // Presence tracking for connection indicator
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
      // Game events: INSERT, UPDATE, DELETE
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          // Fetch the full event with player data
          const { data } = await supabase
            .from('game_events')
            .select('*, players(full_name, jersey_number)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setEvents(prev => [data, ...prev].slice(0, 20));
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
          // Remove deleted event from local state
          setEvents(prev => prev.filter(e => e.id !== payload.old.id));
        }
      )
      // Game state updates
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
            
            // Update all game state from remote
            setClockRemaining(newData.clock_remaining_ms);
            setClockRunning(newData.clock_running);
            setCurrentPeriod(newData.current_period);
            setPossession(newData.possession);
            setTeamScore(newData.team_score);
            setOpponentScore(newData.opponent_score);

            // Handle slot swap: re-evaluate user slot without page reload
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
              
              // Stop clock ticker if we lost Slot A authority
              if (newSlot !== 'a' && clockIntervalRef.current) {
                clearInterval(clockIntervalRef.current);
                clockIntervalRef.current = null;
              }
            }

            // Update game object for reference
            setGame((prev: any) => ({ ...prev, ...newData }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          // Track presence
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

    // Cleanup function
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

  async function toggleClock() {
    if (userSlot !== 'a') return;
    
    const newState = !clockRunning;
    setClockRunning(newState);
    
    // Immediate write to DB
    await updateGameState({
      clock_running: newState,
      clock_remaining_ms: clockRemaining,
    });
  }

  async function adjustClock(ms: number) {
    if (userSlot !== 'a') return;
    
    const newTime = Math.max(0, Math.min(600000, clockRemaining + ms));
    setClockRemaining(newTime);
    
    // Immediate write to DB
    await updateGameState({
      clock_remaining_ms: newTime,
    });
  }

  async function nextPeriod() {
    if (userSlot !== 'a') return;
    
    const newPeriod = currentPeriod + 1;
    setCurrentPeriod(newPeriod);
    setClockRemaining(600000);
    setClockRunning(false);
    
    // Immediate write to DB
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
    
    // Immediate write to DB
    await updateGameState({
      possession: newPossession,
    });
  }

  async function updateOpponentScore(newScore: number) {
    if (userSlot !== 'a') return;
    
    setOpponentScore(newScore);
    
    // Immediate write to DB
    await updateGameState({
      opponent_score: newScore,
    });
  }

  async function recordShot(coordX: number, coordY: number, made: boolean, points: number) {
    if (!selectedPlayer) {
      alert('Please select a player first');
      return;
    }

    // Calculate zone based on coordinates
    let zone = 1;
    const distance = Math.sqrt(coordX * coordX + coordY * coordY);
    if (distance < 0.3) zone = 1; // Paint
    else if (coordX > 0.5 && distance < 0.7) zone = 2; // Right inside arc
    else if (coordX <= 0.5 && distance < 0.7) zone = 3; // Left inside arc
    else zone = 4; // Beyond 3

    const elapsed = 600000 - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: selectedPlayer,
        event_type: points === 1 ? 'free_throw' : 'shot',
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        points,
        made,
        coord_x: coordX,
        coord_y: coordY,
        zone,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      // Update local state
      const newTeamScore = made ? teamScore + points : teamScore;
      const newPossession = 'away'; // Possession changes after any shot attempt
      
      setTeamScore(newTeamScore);
      setPossession(newPossession);
      setShotMode(false);
      setSelectedPlayer(null);

      // Immediate write to DB (Slot A only, but recordShot is Slot A action)
      if (userSlot === 'a') {
        await updateGameState({
          team_score: newTeamScore,
          possession: newPossession,
        });
      }
    }
  }

  async function recordEvent(type: string, playerId?: string) {
    const elapsed = 600000 - clockRemaining;

    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        player_id: playerId || null,
        event_type: type,
        period_number: currentPeriod,
        clock_remaining_ms: clockRemaining,
        elapsed_ms: elapsed,
        is_offensive: possession === 'home',
        recorded_by_user_id: currentUser.id,
      });

    if (error) {
      alert(`Error: ${error.message}`);
    }
    // Event will be added via Realtime INSERT subscription
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

    // If it was a made shot, revert the score
    if (lastEvent.made && lastEvent.points > 0 && userSlot === 'a') {
      const newTeamScore = Math.max(0, teamScore - lastEvent.points);
      setTeamScore(newTeamScore);
      await updateGameState({
        team_score: newTeamScore,
      });
    }

    const { error } = await supabase
      .from('game_events')
      .delete()
      .eq('id', lastEvent.id);

    if (error) {
      alert(`Error: ${error.message}`);
    }
    // Event will be removed via Realtime DELETE subscription
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!game || !userSlot) {
    return (
      <div className="p-8">
        <p>You are not assigned to this game.</p>
        <Link href={`/team-manager/games/${gameId}`} className="text-blue-500">
          Go to game management
        </Link>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Count connected users from presence
  const presenceUsers = Object.keys(presenceState);
  const connectedCount = presenceUsers.length;
  
  // Connection status display
  const connectionColor = 
    connectionStatus === 'connected' ? 'text-green-400' :
    connectionStatus === 'reconnecting' ? 'text-yellow-400' :
    'text-red-400';
  
  const connectionText =
    connectionStatus === 'connected' ? 'Connected' :
    connectionStatus === 'reconnecting' ? 'Reconnecting...' :
    'Offline';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">{game.teams?.name} vs {game.opponent_name}</h1>
            <p className="text-sm text-gray-400">Slot {userSlot.toUpperCase()} {userSlot === 'a' ? '(Clock Authority)' : '(View Only)'}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {teamScore} - {opponentScore}
            </div>
            <div className="text-sm">
              <span className={connectionColor}>● {connectionText}</span>
              {connectedCount > 0 && (
                <span className="ml-2 text-gray-400">
                  {connectedCount} online
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Game Clock */}
      <div className="bg-gray-800 px-4 py-6 text-center border-b border-gray-700">
        <div className="text-6xl font-bold mb-2">{formatTime(clockRemaining)}</div>
        <div className="text-xl mb-4">Period {currentPeriod}</div>
        
        {userSlot === 'a' && (
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={toggleClock}
              className={`px-6 py-3 rounded text-lg font-bold ${
                clockRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {clockRunning ? 'PAUSE' : 'START'}
            </button>
            <button
              onClick={() => adjustClock(-10000)}
              className="px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded"
            >
              -10s
            </button>
            <button
              onClick={() => adjustClock(10000)}
              className="px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded"
            >
              +10s
            </button>
            <button
              onClick={nextPeriod}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded"
            >
              Next Period
            </button>
          </div>
        )}

        <div className="text-sm">
          Possession: <span className="font-bold">{possession === 'home' ? game.teams?.name : game.opponent_name}</span>
          {userSlot === 'a' && (
            <>
              {' | '}
              <button
                onClick={flipPossession}
                className="text-blue-400 hover:text-blue-300"
              >
                Switch
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        
        {/* Main Area - Slot Specific */}
        <div className="lg:col-span-2">
          
          {userSlot === 'a' && (
            <SlotAInterface
              players={players}
              selectedPlayer={selectedPlayer}
              setSelectedPlayer={setSelectedPlayer}
              shotMode={shotMode}
              setShotMode={setShotMode}
              recordShot={recordShot}
              recordEvent={recordEvent}
              opponentScore={opponentScore}
              updateOpponentScore={updateOpponentScore}
            />
          )}

          {userSlot === 'b' && (
            <SlotBInterface
              players={players}
              recordEvent={recordEvent}
              lastEvent={events[0]}
            />
          )}

        </div>

        {/* Event Feed */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Event Feed</h3>
            <button
              onClick={handleUndo}
              disabled={events.length === 0}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm disabled:bg-gray-600"
            >
              Undo Last
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="text-sm p-2 bg-gray-700 rounded">
                <div className="font-medium">
                  {event.players?.jersey_number && `#${event.players.jersey_number} `}
                  {event.players?.full_name || 'Team'}
                </div>
                <div className="text-gray-400 text-xs">
                  {event.event_type}
                  {event.made !== null && ` - ${event.made ? 'Made' : 'Miss'}`}
                  {event.points > 0 && ` (${event.points}pts)`}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// Slot A Component
function SlotAInterface({ players, selectedPlayer, setSelectedPlayer, shotMode, setShotMode, recordShot, recordEvent, opponentScore, updateOpponentScore }: any) {
  const [shotPoints, setShotPoints] = useState(2);

  return (
    <div className="space-y-4">
      
      {/* Player Selection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold mb-2">Select Player</h3>
        <div className="grid grid-cols-3 gap-2">
          {players.map((player: any) => (
            <button
              key={player.id}
              onClick={() => {
                setSelectedPlayer(player.id);
                setShotMode(false);
              }}
              className={`px-3 py-2 rounded ${
                selectedPlayer === player.id
                  ? 'bg-blue-500'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              #{player.jersey_number} {player.full_name}
            </button>
          ))}
        </div>
      </div>

      {/* Shot Entry */}
      {selectedPlayer && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-2">Record Shot</h3>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setShotPoints(2);
                setShotMode(true);
              }}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded"
            >
              2-Point Shot
            </button>
            <button
              onClick={() => {
                setShotPoints(3);
                setShotMode(true);
              }}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded"
            >
              3-Point Shot
            </button>
            <button
              onClick={() => recordShot(0.5, 0.1, true, 1)}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded"
            >
              Free Throw
            </button>
          </div>

          {shotMode && (
            <div className="relative bg-orange-100 rounded-lg p-4" style={{ aspectRatio: '1/1' }}>
              <p className="text-gray-800 text-center mb-2">Tap where shot was taken</p>
              <div
                className="w-full h-full bg-orange-200 rounded cursor-crosshair relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  
                  if (confirm(`Shot ${shotPoints === 2 ? '2PT' : '3PT'}: Made or Miss?`)) {
                    recordShot(x, y, true, shotPoints);
                  } else {
                    recordShot(x, y, false, 0);
                  }
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                  Half Court
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fouls & Subs */}
      {selectedPlayer && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-2">Other Actions</h3>
          <div className="flex gap-2">
            <button
              onClick={() => recordEvent('foul', selectedPlayer)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded"
            >
              Foul
            </button>
            <button
              onClick={() => recordEvent('turnover', selectedPlayer)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded"
            >
              Turnover
            </button>
          </div>
        </div>
      )}

      {/* Opponent Score */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold mb-2">Opponent Score</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => updateOpponentScore(Math.max(0, opponentScore - 1))}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-2xl"
          >
            -
          </button>
          <div className="text-4xl font-bold">{opponentScore}</div>
          <button
            onClick={() => updateOpponentScore(opponentScore + 1)}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-2xl"
          >
            +
          </button>
        </div>
      </div>

    </div>
  );
}

// Slot B Component
function SlotBInterface({ players, recordEvent, lastEvent }: any) {
  const [showReboundOverlay, setShowReboundOverlay] = useState(false);
  const [showAssistOverlay, setShowAssistOverlay] = useState(false);

  useEffect(() => {
    if (lastEvent) {
      if (lastEvent.event_type === 'shot' && !lastEvent.made) {
        setShowReboundOverlay(true);
        setShowAssistOverlay(false);
      } else if (lastEvent.event_type === 'shot' && lastEvent.made && lastEvent.points > 1) {
        setShowAssistOverlay(true);
        setShowReboundOverlay(false);
      } else {
        setShowReboundOverlay(false);
        setShowAssistOverlay(false);
      }
    }
  }, [lastEvent]);

  async function handleRebound(playerId?: string, isOffensive?: boolean) {
    await recordEvent('rebound', playerId);
    setShowReboundOverlay(false);
  }

  async function handleAssist(playerId?: string) {
    if (playerId) {
      await recordEvent('assist', playerId);
    }
    setShowAssistOverlay(false);
  }

  return (
    <div className="space-y-4">
      
      {/* Rebound Overlay */}
      {showReboundOverlay && (
        <div className="bg-yellow-900 border-2 border-yellow-500 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-2">Rebound?</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {players.slice(0, 5).map((player: any) => (
              <button
                key={player.id}
                onClick={() => handleRebound(player.id, true)}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded"
              >
                #{player.jersey_number} {player.full_name.split(' ')[0]}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleRebound(undefined, false)}
            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Opponent Rebound
          </button>
        </div>
      )}

      {/* Assist Overlay */}
      {showAssistOverlay && (
        <div className="bg-blue-900 border-2 border-blue-500 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-2">Assist?</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {players.filter((p: any) => p.id !== lastEvent?.player_id).slice(0, 4).map((player: any) => (
              <button
                key={player.id}
                onClick={() => handleAssist(player.id)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                #{player.jersey_number} {player.full_name.split(' ')[0]}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleAssist(undefined)}
            className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded"
          >
            No Assist
          </button>
        </div>
      )}

      {/* Manual Actions */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-bold mb-2">Quick Actions</h3>
        <div className="space-y-2">
          {players.slice(0, 5).map((player: any) => (
            <div key={player.id} className="flex gap-2">
              <span className="w-32 py-2">#{player.jersey_number} {player.full_name.split(' ')[0]}</span>
              <button
                onClick={() => recordEvent('steal', player.id)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                Steal
              </button>
              <button
                onClick={() => recordEvent('turnover', player.id)}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm"
              >
                TO
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-700 rounded-lg p-4 text-sm text-gray-300">
        <p>Slot B: After miss → Rebound overlay</p>
        <p>After make → Assist prompt</p>
        <p>Manual: Steals, Turnovers</p>
      </div>

    </div>
  );
}
