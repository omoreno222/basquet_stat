/**
 * Calculate minutes played per player based on game-clock time.
 * 
 * A player accumulates time only while:
 * 1. They are on the court (in starting lineup or subbed in)
 * 2. The game clock is running
 * 
 * FIBA Rules:
 * - Regulation periods (Q1-Q4): 10 minutes each (600,000 ms)
 * - Overtime periods (Q5+): 5 minutes each (300,000 ms)
 * 
 * @param startingLineup - Array of player IDs in the starting 5
 * @param events - All game events (substitutions) ordered by occurrence
 * @param currentPeriod - Current period number (1-based)
 * @param clockRemainingMs - Current clock time remaining in period (ms)
 * @param periodEndTimes - Optional map of period -> clock_remaining_ms when period ended (defaults to 0)
 * @returns Object mapping player_id -> seconds played
 */

interface GameEvent {
  period_number: number;
  clock_remaining_ms: number;
  player_id?: string;
  player_out_id?: string;
  event_type: string;
  created_at?: string;
}

export interface MinutesPlayed {
  [playerId: string]: number; // seconds
}

/**
 * Get the regulation period length in milliseconds
 * Q1-Q4: 10 minutes (600,000 ms)
 * Q5+: 5 minutes (300,000 ms) overtime
 */
function getPeriodLengthMs(period: number): number {
  return period <= 4 ? 600000 : 300000;
}

export function calculateMinutesPlayed(
  startingLineup: string[],
  events: GameEvent[],
  currentPeriod: number,
  clockRemainingMs: number,
  periodEndTimes: Record<number, number> = {}
): MinutesPlayed {
  const minutesPlayed: MinutesPlayed = {};
  
  // Initialize all starting players
  startingLineup.forEach(playerId => {
    minutesPlayed[playerId] = 0;
  });
  
  // Get substitution events only, ordered by period, clock descending, then created_at ASC for ties
  const substitutions = events
    .filter(e => e.event_type === 'substitution' && e.player_id && e.player_out_id)
    .sort((a, b) => {
      if (a.period_number !== b.period_number) {
        return a.period_number - b.period_number;
      }
      // Higher clock_remaining_ms = earlier in period
      if (a.clock_remaining_ms !== b.clock_remaining_ms) {
        return b.clock_remaining_ms - a.clock_remaining_ms;
      }
      // Tie-breaker: sort by created_at ASC (earlier insertions first)
      if (a.created_at && b.created_at) {
        return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
      }
      return 0;
    });
  
  const currentLineup = [...startingLineup];
  let lastEventPeriod = 1;
  let lastEventClockMs = getPeriodLengthMs(1);
  
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
      
      // Finish last period (to actual period end time, or 0:00)
      const periodEndClock = periodEndTimes[lastEventPeriod] !== undefined 
        ? periodEndTimes[lastEventPeriod] 
        : 0;
      const elapsedLastPeriod = lastEventClockMs - periodEndClock;
      if (elapsedLastPeriod > 0) {
        currentLineup.forEach(playerId => {
          minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedLastPeriod / 1000;
        });
      }
      
      // Full intermediate periods (if any)
      for (let p = lastEventPeriod + 1; p < period; p++) {
        const fullPeriodMs = getPeriodLengthMs(p);
        const actualEndClock = periodEndTimes[p] !== undefined ? periodEndTimes[p] : 0;
        const periodDurationMs = fullPeriodMs - actualEndClock;
        if (periodDurationMs > 0) {
          currentLineup.forEach(playerId => {
            minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + periodDurationMs / 1000;
          });
        }
      }
      
      // Start of new period (from period start to this sub)
      const newPeriodLength = getPeriodLengthMs(period);
      const elapsedNewPeriod = newPeriodLength - clockMs;
      if (elapsedNewPeriod > 0) {
        currentLineup.forEach(playerId => {
          minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedNewPeriod / 1000;
        });
      }
    }
    
    // Apply substitution
    if (sub.player_out_id && sub.player_id) {
      const outIndex = currentLineup.indexOf(sub.player_out_id);
      if (outIndex !== -1) {
        currentLineup[outIndex] = sub.player_id;
      }
      
      // Initialize incoming player if not already tracked
      if (minutesPlayed[sub.player_id] === undefined) {
        minutesPlayed[sub.player_id] = 0;
      }
      if (minutesPlayed[sub.player_out_id] === undefined) {
        minutesPlayed[sub.player_out_id] = 0;
      }
    }
    
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
    const periodEndClock = periodEndTimes[lastEventPeriod] !== undefined 
      ? periodEndTimes[lastEventPeriod] 
      : 0;
    const elapsedLastPeriod = lastEventClockMs - periodEndClock;
    if (elapsedLastPeriod > 0) {
      currentLineup.forEach(playerId => {
        minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedLastPeriod / 1000;
      });
    }
    
    // Full intermediate periods
    for (let p = lastEventPeriod + 1; p < currentPeriod; p++) {
      const fullPeriodMs = getPeriodLengthMs(p);
      const actualEndClock = periodEndTimes[p] !== undefined ? periodEndTimes[p] : 0;
      const periodDurationMs = fullPeriodMs - actualEndClock;
      if (periodDurationMs > 0) {
        currentLineup.forEach(playerId => {
          minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + periodDurationMs / 1000;
        });
      }
    }
    
    // Current period elapsed time
    const currentPeriodLength = getPeriodLengthMs(currentPeriod);
    const elapsedCurrentPeriod = currentPeriodLength - clockRemainingMs;
    if (elapsedCurrentPeriod > 0) {
      currentLineup.forEach(playerId => {
        minutesPlayed[playerId] = (minutesPlayed[playerId] || 0) + elapsedCurrentPeriod / 1000;
      });
    }
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
