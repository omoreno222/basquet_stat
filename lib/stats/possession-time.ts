/**
 * Clock time the ball was in each team's hands.
 * Only closed possessions count. Stopped-clock gaps add nothing,
 * because the game clock does not move while it is stopped.
 */

export type PossessionSide = 'home' | 'away';

export interface PossessionStamp {
  playGroupId?: string | null;
  periodNumber: number | null;
  clockRemainingMs: number | null;
  possessionBefore: string | null;
  createdAt: string | null;
}

export interface PossessionTimeInput {
  events: readonly PossessionStamp[];
  currentPeriod: number;
  possession: PossessionSide | null;
  final: boolean;
}

export interface PossessionTime {
  homeMs: number;
  awayMs: number;
}

interface Stamp {
  period: number;
  clock: number | null;
  before: PossessionSide | null;
  at: string;
}

function asSide(value: string | null | undefined): PossessionSide | null {
  return value === 'home' || value === 'away' ? value : null;
}

function buildStamps(events: readonly PossessionStamp[]): Stamp[] {
  const groups = new Map<string, PossessionStamp[]>();
  events.forEach((event, index) => {
    const key = event.playGroupId ? `g:${event.playGroupId}` : `e:${index}`;
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  });

  const stamps: Stamp[] = [];
  for (const list of groups.values()) {
    const ordered = [...list].sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? ''));
    const earliest = ordered[0];
    if (!earliest) continue;
    const period = ordered.find((event) => event.periodNumber != null)?.periodNumber;
    if (period == null) continue;
    const clock = earliest.clockRemainingMs ?? ordered.find((event) => event.clockRemainingMs != null)?.clockRemainingMs ?? null;
    stamps.push({
      period,
      clock: typeof clock === 'number' && Number.isFinite(clock) ? clock : null,
      before: asSide(earliest.possessionBefore),
      at: earliest.createdAt ?? '',
    });
  }
  return stamps;
}

function byTime(left: Stamp, right: Stamp): number {
  if (left.period !== right.period) return left.period - right.period;
  return left.at.localeCompare(right.at);
}

function runningDelta(previous: Stamp, current: Stamp): number {
  if (previous.clock == null || current.clock == null) return 0;
  if (current.clock > previous.clock) return 0;
  return previous.clock - current.clock;
}

interface Segment {
  holder: PossessionSide | null;
  ms: number;
}

export function possessionTime(input: PossessionTimeInput): PossessionTime {
  const totals: PossessionTime = { homeMs: 0, awayMs: 0 };
  const stamps = buildStamps(input.events).sort(byTime);
  const periods = new Map<number, Stamp[]>();
  for (const stamp of stamps) {
    const list = periods.get(stamp.period);
    if (list) list.push(stamp);
    else periods.set(stamp.period, [stamp]);
  }

  const add = (side: PossessionSide | null, ms: number) => {
    if (ms <= 0 || side == null) return;
    if (side === 'home') totals.homeMs += ms;
    else totals.awayMs += ms;
  };

  for (const [period, list] of periods) {
    const segments: Segment[] = [];
    for (let index = 1; index < list.length; index += 1) {
      const current = list[index];
      if (!current) continue;
      segments.push({
        holder: current.before,
        ms: runningDelta(list[index - 1]!, current),
      });
    }

    let runSide: PossessionSide | null = null;
    let runMs = 0;
    const commit = () => {
      add(runSide, runMs);
      runSide = null;
      runMs = 0;
    };
    for (const segment of segments) {
      if (segment.holder == null || segment.holder !== runSide) {
        commit();
        runSide = segment.holder;
      }
      runMs += segment.ms;
    }

    const periodClosed = input.final || period < input.currentPeriod;
    const last = list[list.length - 1];
    const stillOpen = !periodClosed && last != null && input.possession === last.before;
    if (!stillOpen) commit();
  }

  return totals;
}

export function formatPossessionTime(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
