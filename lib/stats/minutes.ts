/**
 * Calculate minutes played per player based on game-clock time.
 * 
 * A player accumulates time only while:
 * 1. They are on the court (in starting lineup or subbed in)
 * 2. The game clock is running
 * 
 * @param startingLineup - Array of player IDs in the starting 5
 * @param events - All game events (substitutions) ordered by occurrence
 * @param currentPeriod - Current period number (1-based)
 * @param clockRemainingMs - Current clock time remaining in period (ms)
 * @param periodLengthMs - Length of one period in ms (default 600000 = 10 min)
 * @returns Object mapping player_id -> seconds played
 */

interface GameEvent {
  period_number: number;
  clock_remaining_ms: number;
  player_id?: string;
  player_out_id?: string;
  event_type: string;
}

export interface MinutesPlayed {
  [playerId: string]: number; // seconds
}

export function calculateMinutesPlayed(
  startingLineup: string[],
  events: GameEvent[],
  currentPeriod: number,
  clockRemainingMs: number,
  periodLengthMs: number = 600000
): MinutesPlayed {
  const minutesPlayed: MinutesPlayed = {};
  
  // Track who is currently on court
  let onCourt = new Set<string>(startingLineup);
  
  // Initialize all starting players
  startingLineup.forEach(playerId => {
    minutesPlayed[playerId] = 0;
  });
  
  // Get substitution events only, ordered by period and clock descending
  const substitutions = events
    .filter(e => e.event_type === 'substitution' && e.player_id && e.player_out_id)
    .sort((a, b) => {
      if (a.period_number !== b.period_number) {
        return a.period_number - b.period_number;
      }
      // Higher clock_remaining_ms = earlier in period
      return b.clock_remaining_ms - a.clock_remaining_ms;
    });
  
  let currentLineup = [...onCourt];
  let lastEventPeriod = 1;
  let lastEventClockMs = periodLengthMs;
  
  // Process each substitution
  for (const sub of substitutions) {
    const period = sub.period_number;
    const clockMs = sub.clock_remaining_ms;
    
    // Calculate time played for current lineup from last event to this one
    if (period === lastEventPeriod) {
      // Same period: time elapsed = lastEventClockMs - clockMs
      const elapsedMs = lastEventClockMs - clockMs;
      if (elapsedMs > 0) {
        currentLineup.forEach(playerId => {
          minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedMs / 1000;
        });
      }
    } else {
      // Period changed: current lineup played rest of last period
      // Plus any full intermediate periods, plus start of new period
      
      // Finish last period (to 0:00)
      const elapsedLastPeriod = lastEventClockMs;
      currentLineup.forEach(playerId => {
        minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedLastPeriod / 1000;
      });
      
      // Full intermediate periods (if any)
      const fullPeriods = period - lastEventPeriod - 1;
      if (fullPeriods > 0) {
        const fullPeriodSeconds = periodLengthMs / 1000;
        currentLineup.forEach(playerId => {
          minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + fullPeriodSeconds * fullPeriods;
        });
      }
      
      // Start of new period (from period start to this sub)
      const elapsedNewPeriod = periodLengthMs - clockMs;
      currentLineup.forEach(playerId => {
        minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedNewPeriod / 1000;
      });
    }
    
    // Apply substitution
    if (sub.player_out_id && sub.player_id) {
      onCourt.delete(sub.player_out_id);
      onCourt.add(sub.player_id);
      
      // Initialize incoming player if not already tracked
      if (minutesPlayed[sub.player_id] === undefined) {
        minutesPlayed[sub.player_id] = 0;
      }
      if (minutesPlayed[sub.player_out_id] === undefined) {
        minutesPlayed[sub.player_out_id] = 0;
      }
    }
    
    currentLineup = Array.from(onCourt);
    lastEventPeriod = period;
    lastEventClockMs = clockMs;
  }
  
  // Calculate time from last event/start to current moment
  if (currentPeriod === lastEventPeriod) {
    // Same period: time elapsed = lastEventClockMs - clockRemainingMs
    const elapsedMs = lastEventClockMs - clockRemainingMs;
    if (elapsedMs > 0) {
      currentLineup.forEach(playerId => {
        minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedMs / 1000;
      });
    }
  } else {
    // Period changed: finish last period + intermediate periods + current period
    
    // Finish last period
    const elapsedLastPeriod = lastEventClockMs;
    currentLineup.forEach(playerId => {
      minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedLastPeriod / 1000;
    });
    
    // Full intermediate periods
    const fullPeriods = currentPeriod - lastEventPeriod - 1;
    if (fullPeriods > 0) {
      const fullPeriodSeconds = periodLengthMs / 1000;
      currentLineup.forEach(playerId => {
        minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + fullPeriodSeconds * fullPeriods;
      });
    }
    
    // Current period elapsed time
    const elapsedCurrentPeriod = periodLengthMs - clockRemainingMs;
    currentLineup.forEach(playerId => {
      minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedCurrentPeriod / 1000;
    });
  }
  
  return minutesPlayed;
}

/**
 * Format seconds as mm:ss for display
 */
export function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
