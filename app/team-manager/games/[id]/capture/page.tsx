'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  
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

  useEffect(() => {
    loadData();
    setupRealtimeSubscription();

    return () => {
      // Cleanup realtime subscription
    };
  }, [gameId]);

  // Clock ticker
  useEffect(() => {
    if (!clockRunning) return;

    const interval = setInterval(() => {
      setClockRemaining(prev => {
        const newTime = Math.max(0, prev - 100);
        if (newTime === 0) {
          setClockRunning(false);
          handlePeriodEnd();
        }
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [clockRunning]);

  // Sync clock to database periodically
  useEffect(() => {
    if (!game) return;

    const interval = setInterval(() => {
      supabase
        .from('games')
        .update({
          clock_running: clockRunning,
          clock_remaining_ms: clockRemaining,
          current_period: currentPeriod,
          possession,
          team_score: teamScore,
          opponent_score: opponentScore,
        })
        .eq('id', gameId)
        .then();
    }, 2000);

    return () => clearInterval(interval);
  }, [game, clockRunning, clockRemaining, currentPeriod, possession, teamScore, opponentScore]);

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

    const { data: gameData } = await supabase
      .from('games')
      .select('*, teams(name)')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData);
      setClockRemaining(gameData.clock_remaining_ms || 600000);
      setCurrentPeriod(gameData.current_period || 1);
      setPossession(gameData.possession || 'home');
      setTeamScore(gameData.team_score || 0);
      setOpponentScore(gameData.opponent_score || 0);

      // Determine user slot
      if (profile.id === gameData.slot_a_user_id) {
        setUserSlot('a');
      } else if (profile.id === gameData.slot_b_user_id) {
        setUserSlot('b');
      } else if (profile.role === 'admin') {
        setUserSlot('a'); // Admin defaults to A
      }

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
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadData();
          }
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
        (payload: any) => {
          if (payload.new) {
            setClockRemaining(payload.new.clock_remaining_ms);
            setClockRunning(payload.new.clock_running);
            setCurrentPeriod(payload.new.current_period);
            setPossession(payload.new.possession);
            setTeamScore(payload.new.team_score);
            setOpponentScore(payload.new.opponent_score);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function handlePeriodEnd() {
    alert(`Period ${currentPeriod} ended`);
  }

  function toggleClock() {
    setClockRunning(!clockRunning);
  }

  function adjustClock(ms: number) {
    setClockRemaining(prev => Math.max(0, Math.min(600000, prev + ms)));
  }

  function nextPeriod() {
    setCurrentPeriod(prev => prev + 1);
    setClockRemaining(600000);
    setClockRunning(false);
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
      if (made) {
        setTeamScore(prev => prev + points);
        setPossession('away');
      } else {
        setPossession('away');
      }
      setShotMode(false);
      setSelectedPlayer(null);
      loadData();
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
    } else {
      loadData();
    }
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

    const { error } = await supabase
      .from('game_events')
      .delete()
      .eq('id', lastEvent.id);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      loadData();
    }
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">{game.teams?.name} vs {game.opponent_name}</h1>
            <p className="text-sm text-gray-400">Slot {userSlot.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {teamScore} - {opponentScore}
            </div>
            <div className="text-sm text-gray-400">
              {connectedUsers.length > 0 && `${connectedUsers.length + 1} connected`}
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
                onClick={() => setPossession(possession === 'home' ? 'away' : 'home')}
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
              setOpponentScore={setOpponentScore}
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
function SlotAInterface({ players, selectedPlayer, setSelectedPlayer, shotMode, setShotMode, recordShot, recordEvent, opponentScore, setOpponentScore }: any) {
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
            onClick={() => setOpponentScore((prev: number) => Math.max(0, prev - 1))}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-2xl"
          >
            -
          </button>
          <div className="text-4xl font-bold">{opponentScore}</div>
          <button
            onClick={() => setOpponentScore((prev: number) => prev + 1)}
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
