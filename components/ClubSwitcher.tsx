'use client';

import { useState, useRef, useEffect } from 'react';
import { ClubLogo } from './ClubLogo';
import type { Club } from '@/types/database';

interface ClubSwitcherProps {
  currentClubId: string | null; // null = "All clubs" for platform admin
  clubs: Club[];
  isPlatformAdmin: boolean;
  onClubChange: (clubId: string | null) => void;
}

export function ClubSwitcher({ currentClubId, clubs, isPlatformAdmin, onClubChange }: ClubSwitcherProps) {
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

  const currentClub = currentClubId ? clubs.find(c => c.id === currentClubId) : null;

  const handleClubSelect = async (clubId: string | null) => {
    // Store in cookie
    document.cookie = `current_club_id=${clubId || ''}; path=/; max-age=${60 * 60 * 24 * 365}`; // 1 year
    setIsOpen(false);
    onClubChange(clubId);
  };

  if (clubs.length === 0) {
    return null;
  }

  // Don't show switcher if user only has one club and is not platform admin
  if (clubs.length === 1 && !isPlatformAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
        <ClubLogo 
          logoUrl={clubs[0].logo_url} 
          clubName={clubs[0].name} 
          size="xs"
        />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {clubs[0].short_name || clubs[0].name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Switch club"
      >
        {currentClub ? (
          <>
            <ClubLogo 
              logoUrl={currentClub.logo_url} 
              clubName={currentClub.name} 
              size="xs"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[120px]">
              {currentClub.short_name || currentClub.name}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            All clubs
          </span>
        )}
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
          {isPlatformAdmin && (
            <button
              onClick={() => handleClubSelect(null)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                !currentClubId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                All clubs
              </span>
            </button>
          )}
          {clubs.map((club) => (
            <button
              key={club.id}
              onClick={() => handleClubSelect(club.id)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                currentClubId === club.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <ClubLogo 
                logoUrl={club.logo_url} 
                clubName={club.name} 
                size="xs"
              />
              <span className="text-gray-900 dark:text-gray-100 truncate">
                {club.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
