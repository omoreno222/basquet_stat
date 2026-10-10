import Link from 'next/link';
import { Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';

const iconClass = 'inline-flex items-center justify-center rounded p-2 text-white';

export function HoverLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 z-30 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-sm group-hover/tip:block group-focus-within/tip:block dark:bg-gray-100 dark:text-gray-900"
      >
        {label}
      </span>
    </span>
  );
}

export function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <HoverLabel label={label}>
      <Link href={href} aria-label={label} className={`${iconClass} bg-slate-600 hover:bg-slate-800`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
    </HoverLabel>
  );
}

export function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <HoverLabel label={label}>
      <Link href={href} aria-label={label} className={`${iconClass} bg-blue-500 hover:bg-blue-700`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>
    </HoverLabel>
  );
}

export function ResetButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <HoverLabel label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`${iconClass} bg-amber-500 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>
    </HoverLabel>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <HoverLabel label={label}>
      <button type="button" onClick={onClick} aria-label={label} className={`${iconClass} bg-red-500 hover:bg-red-700`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </HoverLabel>
  );
}
