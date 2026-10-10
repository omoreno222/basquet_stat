import { describe, it, expect } from 'vitest';
import { calculateMinutesPlayed, formatMinutes } from './minutes';

interface GameEvent {
  period_number: number;
  clock_remaining_ms: number;
  player_id?: string;
  player_out_id?: string;
  event_type: string;
  created_at?: string;
}

describe('calculateMinutesPlayed', () => {
  it('should calculate minutes for starting lineup with no substitutions', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events: GameEvent[] = [];
    const currentPeriod = 1;
    const clockRemainingMs = 300000; // 5 minutes remaining = 5 minutes elapsed

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // All starting players should have 5 minutes (300 seconds)
    expect(result.player1).toBe(300);
    expect(result.player2).toBe(300);
    expect(result.player3).toBe(300);
    expect(result.player4).toBe(300);
    expect(result.player5).toBe(300);
  });

  it('should calculate minutes with a substitution in same period', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events = [
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 300000, // Sub at 5:00 mark
        player_id: 'player6', // IN
        player_out_id: 'player1', // OUT
      },
    ];
    const currentPeriod = 1;
    const clockRemainingMs = 0; // Period ended

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // player1 played 5 minutes (start to 5:00 mark)
    expect(result.player1).toBe(300);
    
    // player6 played 5 minutes (5:00 mark to end)
    expect(result.player6).toBe(300);
    
    // Other starters played full 10 minutes
    expect(result.player2).toBe(600);
    expect(result.player3).toBe(600);
    expect(result.player4).toBe(600);
    expect(result.player5).toBe(600);
  });

  it('should handle multiple substitutions in same period', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events = [
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 480000, // Sub at 8:00 mark (2 min elapsed)
        player_id: 'player6',
        player_out_id: 'player1',
      },
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 240000, // Sub at 4:00 mark (6 min elapsed)
        player_id: 'player7',
        player_out_id: 'player2',
      },
    ];
    const currentPeriod = 1;
    const clockRemainingMs = 0;

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // player1 played 2 minutes (start to 8:00)
    expect(result.player1).toBe(120);
    
    // player6 played 8 minutes (8:00 to end)
    expect(result.player6).toBe(480);
    
    // player2 played 6 minutes (start to 4:00)
    expect(result.player2).toBe(360);
    
    // player7 played 4 minutes (4:00 to end)
    expect(result.player7).toBe(240);
    
    // Other starters played full 10 minutes
    expect(result.player3).toBe(600);
    expect(result.player4).toBe(600);
    expect(result.player5).toBe(600);
  });

  it('should handle lineup carrying over to next period', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events: GameEvent[] = [];
    const currentPeriod = 2;
    const clockRemainingMs = 300000; // 5 minutes into period 2

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // All starters played full period 1 (10 min) + 5 min of period 2 = 15 min
    expect(result.player1).toBe(900);
    expect(result.player2).toBe(900);
    expect(result.player3).toBe(900);
    expect(result.player4).toBe(900);
    expect(result.player5).toBe(900);
  });

  it('should handle substitution at period boundary', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events = [
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 300000, // Sub at 5:00 in period 1
        player_id: 'player6',
        player_out_id: 'player1',
      },
    ];
    const currentPeriod = 2;
    const clockRemainingMs = 300000; // 5 minutes into period 2

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // player1: 5 min in period 1
    expect(result.player1).toBe(300);
    
    // player6: 5 min in period 1 + 10 min period 2 (full) + 5 min = 20 min total
    // Wait, that's wrong. Let me recalculate:
    // player6 subbed in at 5:00 remaining in period 1
    // Period 1: played from 5:00 to 0:00 = 5 minutes (300s)
    // Period 2: played from 10:00 to 5:00 = 5 minutes (300s)
    // Total: 10 minutes (600s)
    expect(result.player6).toBe(600);
    
    // Other starters: 10 min period 1 + 5 min period 2 = 15 min
    expect(result.player2).toBe(900);
    expect(result.player3).toBe(900);
    expect(result.player4).toBe(900);
    expect(result.player5).toBe(900);
  });

  it('should handle player returning after being subbed out', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events = [
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 480000, // Sub OUT at 8:00
        player_id: 'player6',
        player_out_id: 'player1',
      },
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 240000, // Sub back IN at 4:00
        player_id: 'player1',
        player_out_id: 'player6',
      },
    ];
    const currentPeriod = 1;
    const clockRemainingMs = 0;

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // player1: 2 min (start to 8:00) + 4 min (4:00 to end) = 6 min
    expect(result.player1).toBe(360);
    
    // player6: 4 min (8:00 to 4:00)
    expect(result.player6).toBe(240);
  });

  it('should ignore non-substitution events', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events = [
      {
        event_type: 'shot',
        period_number: 1,
        clock_remaining_ms: 480000,
        player_id: 'player1',
      },
      {
        event_type: 'foul',
        period_number: 1,
        clock_remaining_ms: 360000,
        player_id: 'player2',
      },
    ];
    const currentPeriod = 1;
    const clockRemainingMs = 300000;

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // All should have 5 minutes (no subs processed)
    expect(result.player1).toBe(300);
    expect(result.player2).toBe(300);
    expect(result.player3).toBe(300);
    expect(result.player4).toBe(300);
    expect(result.player5).toBe(300);
  });

  it('should handle clock stopped at non-zero time', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events = [
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 300000, // Sub at 5:00 (clock stopped)
        player_id: 'player6',
        player_out_id: 'player1',
      },
    ];
    const currentPeriod = 1;
    const clockRemainingMs = 300000; // Clock still at 5:00 (stopped)

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // player1 played 5 minutes before sub
    expect(result.player1).toBe(300);
    
    // player6 has 0 minutes (subbed in but clock hasn't run)
    expect(result.player6).toBe(0);
    
    // Others played 5 minutes
    expect(result.player2).toBe(300);
  });

  it('should handle multiple subs at the same clock time (created_at ordering)', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events: GameEvent[] = [
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 300000, // Same clock
        player_id: 'player6',
        player_out_id: 'player1',
        created_at: '2024-01-01T10:00:00Z',
      },
      {
        event_type: 'substitution',
        period_number: 1,
        clock_remaining_ms: 300000, // Same clock
        player_id: 'player7',
        player_out_id: 'player2',
        created_at: '2024-01-01T10:00:01Z', // 1 second later
      },
    ];
    const currentPeriod = 1;
    const clockRemainingMs = 0;

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // Both players out should have same time (5 min)
    expect(result.player1).toBe(300);
    expect(result.player2).toBe(300);
    
    // Both subs happened at same clock, so both incoming players get 5 min
    expect(result.player6).toBe(300);
    expect(result.player7).toBe(300);
    
    // Others played full 10 minutes
    expect(result.player3).toBe(600);
  });

  it('should handle early period end (period ended before 0:00)', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events: GameEvent[] = [];
    const currentPeriod = 2;
    const clockRemainingMs = 540000; // 9 minutes into period 2
    const periodEndTimes = { 1: 30000 }; // Period 1 ended at 0:30 remaining (9:30 played)

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs,
      periodEndTimes
    );

    // All starters: 9.5 min in period 1 + 1 min in period 2 = 10.5 min = 630s
    expect(result.player1).toBe(630);
    expect(result.player2).toBe(630);
    expect(result.player3).toBe(630);
    expect(result.player4).toBe(630);
    expect(result.player5).toBe(630);
  });

  it('should handle overtime periods (5 minutes instead of 10)', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events: GameEvent[] = [];
    // We're in Q5 (first overtime), 2 minutes elapsed
    const currentPeriod = 5;
    const clockRemainingMs = 180000; // 3 minutes remaining in OT1 = 2 minutes elapsed

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // All starters: 4 regulation periods (10 min each) + 2 min of OT = 42 min = 2520s
    expect(result.player1).toBe(2520);
    expect(result.player2).toBe(2520);
    expect(result.player3).toBe(2520);
    expect(result.player4).toBe(2520);
    expect(result.player5).toBe(2520);
  });

  it('should handle overtime with substitution', () => {
    const startingLineup = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const events: GameEvent[] = [
      {
        event_type: 'substitution',
        period_number: 5, // Overtime
        clock_remaining_ms: 180000, // Sub at 3:00 remaining in OT
        player_id: 'player6',
        player_out_id: 'player1',
      },
    ];
    const currentPeriod = 5;
    const clockRemainingMs = 0; // OT ended

    const result = calculateMinutesPlayed(
      startingLineup,
      events,
      currentPeriod,
      clockRemainingMs
    );

    // player1: 4 regulation (40 min) + 2 min OT = 42 min = 2520s
    expect(result.player1).toBe(2520);
    
    // player6: 3 min of OT = 180s
    expect(result.player6).toBe(180);
    
    // Others: 4 regulation + 5 min OT = 45 min = 2700s
    expect(result.player2).toBe(2700);
    expect(result.player3).toBe(2700);
    expect(result.player4).toBe(2700);
    expect(result.player5).toBe(2700);
  });
});

describe('formatMinutes', () => {
  it('should format zero seconds', () => {
    expect(formatMinutes(0)).toBe('0:00');
  });

  it('should format seconds less than a minute', () => {
    expect(formatMinutes(30)).toBe('0:30');
    expect(formatMinutes(59)).toBe('0:59');
  });

  it('should format minutes and seconds', () => {
    expect(formatMinutes(90)).toBe('1:30');
    expect(formatMinutes(300)).toBe('5:00');
    expect(formatMinutes(665)).toBe('11:05');
  });

  it('should handle large minute values', () => {
    expect(formatMinutes(3661)).toBe('61:01');
  });

  it('should pad seconds with leading zero', () => {
    expect(formatMinutes(125)).toBe('2:05');
    expect(formatMinutes(601)).toBe('10:01');
  });
});
