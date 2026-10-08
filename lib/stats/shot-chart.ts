import { z } from 'zod';

/**
 * Field-goal dots for one half court.
 * Stored x/y are 0–1 on the full court, already in the frame where the home
 * basket is on the right. A mark on the other half folds across midcourt.
 */

export interface ShotMark {
  x: number;
  y: number;
  made: boolean;
}

export interface ShotChart {
  home: ShotMark[];
  away: ShotMark[];
}

const unit = z.preprocess((value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}, z.number().gte(0).lte(1));

const shotSchema = z.object({
  event_type: z.literal('shot'),
  coord_x: unit,
  coord_y: unit,
  made: z.boolean(),
  player_id: z.string().min(1).nullish(),
  opponent_player_id: z.string().min(1).nullish(),
}).superRefine((row, context) => {
  const home = row.player_id != null;
  const away = row.opponent_player_id != null;
  if (home === away) {
    context.addIssue({ code: 'custom', message: 'side', path: ['player_id'] });
  }
  if (row.coord_x === 0.5) {
    context.addIssue({ code: 'custom', message: 'midcourt', path: ['coord_x'] });
  }
});

function placedShot(event: unknown): { side: 'home' | 'away'; mark: ShotMark } | null {
  if (!event || typeof event !== 'object') return null;
  const row = event as { event_type?: unknown };
  if (row.event_type !== 'shot') return null;
  const parsed = shotSchema.safeParse(event);
  if (!parsed.success) return null;
  const rawX = parsed.data.coord_x > 0.5 ? parsed.data.coord_x : 1 - parsed.data.coord_x;
  return {
    side: parsed.data.player_id != null ? 'home' : 'away',
    mark: {
      x: Math.round(rawX * 10000) / 10000,
      y: Math.round(parsed.data.coord_y * 10000) / 10000,
      made: parsed.data.made,
    },
  };
}

export function shotChart(events: readonly unknown[]): ShotChart {
  const home: ShotMark[] = [];
  const away: ShotMark[] = [];
  for (const event of events) {
    const placed = placedShot(event);
    if (!placed) continue;
    (placed.side === 'home' ? home : away).push(placed.mark);
  }
  return { home, away };
}
