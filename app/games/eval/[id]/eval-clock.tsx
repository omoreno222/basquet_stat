'use client';

import { useEffect, useState } from 'react';
import { displayedRemaining, formatGameClock } from '@/lib/capture/clock-run';

export function EvalClock({
  running,
  remainingMs,
  syncedAt,
  asOf,
}: {
  running: boolean;
  remainingMs: number;
  syncedAt: string | null;
  asOf: number;
}) {
  const [now, setNow] = useState(asOf);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  return formatGameClock(displayedRemaining(running, remainingMs, syncedAt, now));
}
