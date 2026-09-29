import Link from 'next/link';
import { AdminNavbar } from '@/components/AdminNavbar';

export const fieldClass =
  'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 scheme-light dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:scheme-dark';

export const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

export const hintClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

export const errorClass = 'mb-4 rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200';

export const successClass = 'mb-4 rounded bg-green-100 p-3 text-green-700 dark:bg-green-950 dark:text-green-200';

export const lockedFieldClass =
  'w-full cursor-not-allowed rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';

export const checkTextClass = 'text-sm font-medium text-gray-700 dark:text-gray-300';

export function FormScreen({
  title,
  backHref,
  backLabel,
  wide = false,
  children,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <AdminNavbar />
      <div className="lg:pl-56">
        <div className={`mx-auto px-4 py-6 sm:px-6 lg:px-8 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
            <Link href={backHref} className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200">
              {backLabel}
            </Link>
          </div>
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-900 dark:text-gray-100 dark:ring-1 dark:ring-white/10">{children}</div>
        </div>
      </div>
    </div>
  );
}
