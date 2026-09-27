'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
}

export function UserMenu({ profile, roles, translations, compact = false }: UserMenuProps) {
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
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

        {/* Name and roles - hidden on compact mode */}
        <div className={`flex flex-col items-start gap-1 ${compact ? 'hidden md:flex' : ''}`}>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {displayName}
          </span>
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <span key={role} className={getRoleBadgeClasses(role)}>
                {translations[getRoleTranslationKey(role)] || role}
              </span>
            ))}
          </div>
        </div>

        {/* Role pills only on compact mode */}
        <div className={`flex flex-wrap gap-1 ${compact ? 'flex md:hidden' : 'hidden'}`}>
          {roles.map((role) => (
            <span key={role} className={getRoleBadgeClasses(role)}>
              {translations[getRoleTranslationKey(role)] || role}
            </span>
          ))}
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
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsOpen(false)}
          >
            {translations.trke_my_profile || 'My Profile'}
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {translations.trke_sign_out || 'Sign Out'}
          </button>
        </div>
      )}
    </div>
  );
}
