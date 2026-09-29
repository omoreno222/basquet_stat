import Link from 'next/link';
import { Eye, Pencil, Trash2 } from 'lucide-react';

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

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`${iconClass} bg-red-500 hover:bg-red-700`}>
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
