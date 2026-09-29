'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getInitials, getRoleBadgeClasses, getRoleTranslationKey, type UserRole } from '@/lib/profile-utils';

interface UserMenuProps {
  profile: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  roles: UserRole[];
  translations: Record<string, string>;
  compact?: boolean; // Hide name on small screens
  /** White text for the brand-colored navbar. */
  onBrand?: boolean;
}

export function UserMenu({ profile, roles, translations, compact = false, onBrand = false }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  };

  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.full_name || 'User';
  
  const initials = getInitials(profile.first_name || profile.full_name, profile.last_name);

  const signOutLabel = translations.trke_sign_out || 'Cerrar sesión';

  return (
    <div className="flex items-center gap-3" ref={menuRef}>
      <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 hover:opacity-80 transition-opacity ${onBrand ? 'text-white' : ''}`}
        aria-label="User menu"
      >
        {/* Avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className={`hidden min-w-0 truncate text-sm font-medium sm:inline ${onBrand ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
            {displayName}
          </span>
          <div className={`flex flex-wrap items-center gap-1 ${compact ? 'md:flex' : ''}`}>
            {roles.map((role) => (
              <span key={role} className={getRoleBadgeClasses(role)}>
                {translations[getRoleTranslationKey(role)] || role}
              </span>
            ))}
          </div>
        </div>

        {/* Dropdown indicator */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${compact ? 'hidden md:block' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-white/20">
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsOpen(false)}
          >
            {translations.trke_my_profile || 'My Profile'}
          </Link>
        </div>
      )}
      </div>
      <Link
        href="/login"
        onClick={(event) => {
          event.preventDefault();
          void handleSignOut();
        }}
        className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
          onBrand
            ? 'text-white/90 hover:bg-white/10 hover:text-white'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white'
        }`}
        aria-label={signOutLabel}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{signOutLabel}</span>
      </Link>
    </div>
  );
}
