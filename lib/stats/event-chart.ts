import { z } from 'zod';

/**
 * Foul and turnover marks for the same half court as the shot chart.
 * Stored x/y are 0–1 on the full court, in the frame where the home basket
 * is on the right. A mark on the other half folds across midcourt.
 */

export interface EventMark {
  x: number;
  y: number;
  kind: 'foul' | 'turnover';
}

export interface EventChart {
  home: EventMark[];
  away: EventMark[];
}

const unit = z.preprocess((value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}, z.number().gte(0).lte(1));

const side = z.enum(['home', 'away']);

function rejectMidcourt(row: { coord_x: number }, context: z.RefinementCtx) {
  if (row.coord_x === 0.5) {
    context.addIssue({ code: 'custom', message: 'midcourt', path: ['coord_x'] });
  }
}

const foulSchema = z.object({
  event_type: z.literal('foul'),
  coord_x: unit,
  coord_y: unit,
  foul_side: side,
}).superRefine(rejectMidcourt);

const turnoverSchema = z.object({
  event_type: z.literal('turnover'),
  coord_x: unit,
  coord_y: unit,
  turnover_side: side,
}).superRefine(rejectMidcourt);

const eventSchema = z.discriminatedUnion('event_type', [foulSchema, turnoverSchema]);

function placedEvent(event: unknown): { side: 'home' | 'away'; mark: EventMark } | null {
  if (!event || typeof event !== 'object') return null;
  const row = event as { event_type?: unknown };
  if (row.event_type !== 'foul' && row.event_type !== 'turnover') return null;
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) return null;
  const rawX = parsed.data.coord_x > 0.5 ? parsed.data.coord_x : 1 - parsed.data.coord_x;
  const team = parsed.data.event_type === 'foul' ? parsed.data.foul_side : parsed.data.turnover_side;
  return {
    side: team,
    mark: {
      x: Math.round(rawX * 10000) / 10000,
      y: Math.round(parsed.data.coord_y * 10000) / 10000,
      kind: parsed.data.event_type === 'foul' ? 'foul' : 'turnover',
    },
  };
}

export function eventChart(events: readonly unknown[]): EventChart {
  const home: EventMark[] = [];
  const away: EventMark[] = [];
  for (const event of events) {
    const placed = placedEvent(event);
    if (!placed) continue;
    (placed.side === 'home' ? home : away).push(placed.mark);
  }
  return { home, away };
}
