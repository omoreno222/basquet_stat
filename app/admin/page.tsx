'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Profile } from '@/lib/types';
import { Club } from '@/types/database';
import { UserMenu } from '@/components/UserMenu';
import { ClubSwitcher } from '@/components/ClubSwitcher';
import { AdminNavPills } from '@/components/NavPills';
import { type UserRole } from '@/lib/profile-utils';

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [currentClubId, setCurrentClubId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profileData) {
      router.push('/login');
      return;
    }

    // Check if user has admin role (multi-role support)
    const { data: userRoles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      console.error('Error loading roles:', rolesError);
      router.push('/login');
      return;
    }

    const roles = userRoles?.map(r => r.role) || [profileData.role];
    const hasAdminRole = roles.includes('admin') || roles.includes('club_admin');

    if (!hasAdminRole) {
      router.push('/login');
      return;
    }

    // Determine admin type
    const platformAdmin = userRoles?.some(r => r.role === 'admin' && r.club_id === null) || false;
    const clubAdmin = userRoles?.some(r => r.role === 'club_admin' || (r.role === 'admin' && r.club_id !== null)) || false;

    setProfile(profileData);
    setRoles(roles as UserRole[]);
    setIsPlatformAdmin(platformAdmin);

    // Load clubs
    const clubsQuery = platformAdmin
      ? supabase.from('clubs').select('*').order('name')
      : clubAdmin && userRoles
        ? supabase.from('clubs').select('*').eq('id', userRoles.find(r => r.club_id)?.club_id)
        : null;

    if (clubsQuery) {
      const { data: clubsData } = await clubsQuery;
      if (clubsData) {
        setClubs(clubsData);

        // Load current club from cookie
        const cookieClubId = document.cookie
          .split('; ')
          .find(row => row.startsWith('current_club_id='))
          ?.split('=')[1];

        if (platformAdmin && cookieClubId === '') {
          // "All clubs" option
          setCurrentClubId(null);
        } else if (cookieClubId && clubsData.find(c => c.id === cookieClubId)) {
          setCurrentClubId(cookieClubId);
        } else if (clubsData.length > 0 && !platformAdmin) {
          // Default to first club for non-platform admins
          setCurrentClubId(clubsData[0].id);
        } else if (platformAdmin) {
          // Default to "All clubs" for platform admins
          setCurrentClubId(null);
        }
      }
    }

    // Load translations
    const locale = profileData.locale || profileData.language || 'en';
    const { data: translationsData } = await supabase
      .from('translations')
      .select('key, value')
      .eq('locale', locale);

    if (translationsData) {
      const t: Record<string, string> = {};
      translationsData.forEach(tr => {
        t[tr.key] = tr.value;
      });
      setTranslations(t);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-brand dark:bg-brand-dark text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center space-x-3">
                <Image 
                  src="/images/seasonmath-logo.png" 
                  alt="SeasonMath" 
                  width={120} 
                  height={120}
                  className="h-10 w-auto"
                />
                <span className="font-display text-lg font-semibold text-white">Admin</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {clubs.length > 0 && (
                <ClubSwitcher 
                  currentClubId={currentClubId}
                  clubs={clubs}
                  isPlatformAdmin={isPlatformAdmin}
                  onClubChange={setCurrentClubId}
                />
              )}
              {profile && <UserMenu profile={profile} roles={roles} translations={translations} />}
            </div>
          </div>
        </div>
      </nav>
      <AdminNavPills />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Administration</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Choose a section above. Clubs is for platform admins; My Club is for club admins.
          </p>
        </div>
      </div>
    </div>
  );
}
