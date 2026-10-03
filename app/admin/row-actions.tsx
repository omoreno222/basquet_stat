import Link from 'next/link';
import { Eye, Pencil, TestTube, Trash2 } from 'lucide-react';

const iconClass = 'inline-flex items-center justify-center rounded p-2 text-white';

export function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={`${iconClass} bg-slate-600 hover:bg-slate-800`}>
      <Eye className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={`${iconClass} bg-blue-500 hover:bg-blue-700`}>
      <Pencil className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function ResetButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <TestTube className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`${iconClass} bg-red-500 hover:bg-red-700`}>
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
