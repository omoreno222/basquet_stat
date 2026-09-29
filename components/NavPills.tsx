'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Trophy,
  ClipboardList,
  Baby,
  BarChart3,
} from 'lucide-react';

export interface NavPillItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** exact: only this path. prefix: this path and its children. */
  match?: 'exact' | 'prefix';
}

function isActive(pathname: string, item: NavPillItem) {
  if (item.match === 'exact') {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavPills({ items, label }: { items: NavPillItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="border-b border-brand/15 bg-gray-100 dark:border-white/10 dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto py-3">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-brand px-4 font-display text-sm text-white shadow-sm ring-2 ring-white/70'
                    : 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-brand/25 bg-white px-4 font-display text-sm text-brand shadow-sm hover:bg-brand/10 dark:border-white/50 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500'
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function TeamManagerNavPills() {
  return (
    <NavPills
      label="Team manager sections"
      items={[{ href: '/team-manager', label: 'Games', icon: Trophy, match: 'prefix' }]}
    />
  );
}

export function CoachNavPills() {
  return (
    <NavPills
      label="Coach sections"
      items={[{ href: '/coach', label: 'Roster', icon: ClipboardList, match: 'exact' }]}
    />
  );
}

export function ParentNavPills() {
  return (
    <NavPills
      label="Parent sections"
      items={[{ href: '/parent', label: 'Children', icon: Baby, match: 'exact' }]}
    />
  );
}

export function PlayerNavPills() {
  return (
    <NavPills
      label="Player sections"
      items={[{ href: '/player', label: 'My stats', icon: BarChart3, match: 'exact' }]}
    />
  );
}
