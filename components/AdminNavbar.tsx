'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  LayoutDashboard,
  CalendarRange,
  Users,
  UserRound,
  UserCog,
  Trophy,
  Languages,
  Settings,
  Trash2,
  Menu,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserMenu } from '@/components/UserMenu';
import { type UserRole } from '@/lib/profile-utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminItems: NavItem[] = [
  { href: '/admin/my-club', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clubs', label: 'Clubs', icon: Building2 },
  { href: '/admin/seasons', label: 'Seasons', icon: CalendarRange },
  { href: '/admin/teams', label: 'Teams', icon: Users },
  { href: '/admin/players', label: 'Players', icon: UserRound },
  { href: '/admin/games', label: 'Games', icon: Trophy },
];

const footerItems: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: UserCog },
  { href: '/admin/translations', label: 'Translations', icon: Languages },
  { href: '/profile', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClass(active: boolean) {
  return active
    ? 'flex items-center gap-2.5 rounded-lg bg-white/20 px-3 py-2.5 text-sm font-semibold text-white'
    : 'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white';
}

interface NavbarUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {items.map(item => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={linkClass(active)}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function SideNav({
  items,
  footer,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  footer: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Admin sections">
        <NavLinks items={items} pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <nav className="flex shrink-0 flex-col gap-1 border-t border-white/15 p-3" aria-label="Admin settings">
        <NavLinks items={footer} pathname={pathname} onNavigate={onNavigate} />
      </nav>
    </>
  );
}

export function AdminNavbar({ accessory }: { accessory?: ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<NavbarUser | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [purgeLabel, setPurgeLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [{ data: profileData }, { data: userRoles }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, full_name, avatar_url, locale, language')
          .eq('id', user.id)
          .single(),
        supabase
          .from('profile_roles')
          .select('role, club_id')
          .eq('profile_id', user.id),
      ]);

      if (!profileData || cancelled) return;

      const locale = profileData.locale || profileData.language || 'en';
      const isPlatformAdmin = userRoles?.some(role => role.role === 'admin' && role.club_id === null) || false;

      const { data: translationsData } = await supabase
        .from('translations')
        .select('key, value')
        .eq('locale', locale);

      if (cancelled) return;

      const nextTranslations: Record<string, string> = {};
      translationsData?.forEach(row => {
        nextTranslations[row.key] = row.value;
      });

      setProfile(profileData);
      setRoles((userRoles?.map(role => role.role) || []) as UserRole[]);
      setTranslations(nextTranslations);
      setPurgeLabel(isPlatformAdmin ? (nextTranslations.trke_purge_nav || 'Borrar datos') : null);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const footer: NavItem[] = purgeLabel
    ? [...footerItems, { href: '/admin/purge', label: purgeLabel, icon: Trash2 }]
    : footerItems;

  return (
    <>
      <header className="sticky top-0 z-40 bg-brand text-white dark:bg-brand-dark">
        <div className="flex h-24 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="admin-section-drawer"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
          <Link href="/admin/my-club" className="flex shrink-0 items-center">
            <Image
              src="/images/seasonmath-logo.png"
              alt="SeasonMath"
              width={188}
              height={188}
              className="h-[78.125px] w-auto"
              priority
            />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {accessory}
            {profile && (
              <UserMenu profile={profile} roles={roles} translations={translations} onBrand />
            )}
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-24 z-30 hidden w-56 flex-col border-r border-white/10 bg-blue-600 text-white dark:bg-indigo-800 lg:flex">
        <SideNav items={adminItems} footer={footer} pathname={pathname} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="admin-section-drawer"
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-blue-600 text-white shadow-xl dark:bg-indigo-800"
          >
            <div className="flex h-24 items-center justify-between px-4">
              <span className="text-sm font-semibold">Menú</span>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SideNav items={adminItems} footer={footer} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
