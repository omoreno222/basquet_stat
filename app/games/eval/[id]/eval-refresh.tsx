'use client';

import { RotateCw } from 'lucide-react';

export function EvalRefresh({
  updatedAt,
  updatedLabel,
  reloadLabel,
}: {
  updatedAt: string;
  updatedLabel: string;
  reloadLabel: string;
}) {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(updatedAt));

  return (
    <div className="flex items-center justify-end gap-1">
      <p className="text-right text-sm leading-none text-white/70" suppressHydrationWarning>
        {updatedLabel.replace('{time}', time)}
      </p>
      <button
        type="button"
        aria-label={reloadLabel}
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center text-white/80 hover:text-white"
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
