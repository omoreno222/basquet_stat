'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Shield,
  CalendarRange,
  Users,
  UserRound,
  UserCog,
  Trophy,
  Languages,
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
    <nav aria-label={label} className="bg-gray-100 dark:bg-gray-950 border-b border-brand/15 dark:border-white/10">
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
                    ? 'inline-flex items-center gap-2 shrink-0 rounded-full bg-brand text-white px-4 min-h-11 font-display text-sm shadow-sm'
                    : 'inline-flex items-center gap-2 shrink-0 rounded-full bg-white text-brand border border-brand/25 px-4 min-h-11 font-display text-sm hover:bg-brand/10 dark:bg-gray-900 dark:text-white dark:border-white/25 dark:hover:bg-brand-dark'
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

const adminPills: NavPillItem[] = [
  { href: '/admin/clubs', label: 'Clubs', icon: Building2 },
  { href: '/admin/my-club', label: 'My Club', icon: Shield },
  { href: '/admin/seasons', label: 'Seasons', icon: CalendarRange },
  { href: '/admin/teams', label: 'Teams', icon: Users },
  { href: '/admin/players', label: 'Players', icon: UserRound },
  { href: '/admin/users', label: 'Users', icon: UserCog },
  { href: '/admin/games', label: 'Games', icon: Trophy },
  { href: '/admin/translations', label: 'Translations', icon: Languages },
];

export function AdminNavPills() {
  return <NavPills label="Admin sections" items={adminPills} />;
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
