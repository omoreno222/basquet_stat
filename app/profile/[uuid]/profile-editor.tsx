'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Baby, BarChart3, ClipboardList, Save, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getInitials, getRoleBadgeClasses, getRoleTranslationKey, type UserRole } from '@/lib/profile-utils';
import { changeOwnEmail, changeOwnPassword, removeProfileAvatar, saveProfileFields, saveProfileTheme, uploadProfileAvatar } from '@/app/admin/actions';
import { AdminNavbar } from '@/components/AdminNavbar';
import { SeasonMathLogo } from '@/components/SeasonMathLogo';
import { ClubLogo } from '@/components/ClubLogo';
import { NavPills, type NavPillItem } from '@/components/NavPills';
import { UserMenu } from '@/components/UserMenu';
import { Club } from '@/types/database';

interface Profile {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  locale?: string;
  phone?: string | null;
}

interface Team {
  id: string;
  name: string;
  category: string;
  logo_url?: string | null;
  clubs?: Club;
}

interface LinkedPlayer {
  id: string;
  full_name: string;
  jersey_number: number;
  team: Team;
}

function homeHref(roles: UserRole[]) {
  if (roles.includes('admin') || roles.includes('club_admin')) return '/admin';
  if (roles.includes('team_manager')) return '/team-manager';
  if (roles.includes('coach')) return '/coach';
  if (roles.includes('parent')) return '/parent';
  if (roles.includes('player')) return '/player';
  return '/profile';
}

function rolePills(roles: UserRole[]): NavPillItem[] {
  const items: NavPillItem[] = [];
  if (roles.includes('team_manager')) items.push({ href: '/team-manager', label: 'Games', icon: Trophy, match: 'prefix' });
  if (roles.includes('coach')) items.push({ href: '/coach', label: 'Roster', icon: ClipboardList, match: 'exact' });
  if (roles.includes('parent')) items.push({ href: '/parent', label: 'Children', icon: Baby, match: 'exact' });
  if (roles.includes('player')) items.push({ href: '/player', label: 'My stats', icon: BarChart3, match: 'exact' });
  return items;
}

function ProfileChrome({
  viewerRoles,
  viewerProfile,
  translations,
  children,
}: {
  viewerRoles: UserRole[];
  viewerProfile: Profile | null;
  translations: Record<string, string>;
  children: ReactNode;
}) {
  const isAdmin = viewerRoles.includes('admin') || viewerRoles.includes('club_admin');
  const pills = rolePills(viewerRoles);

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 dark:bg-gray-800 dark:text-gray-100">
      {isAdmin ? (
        <AdminNavbar />
      ) : viewerProfile ? (
        <>
          <header className="sticky top-0 z-40 bg-brand text-white dark:bg-brand-dark">
            <div className="flex h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Link href={homeHref(viewerRoles)} className="flex shrink-0 items-center">
                <SeasonMathLogo
                  width={188}
                  height={188}
                  className="h-[62.5px] w-auto"
                  priority
                />
              </Link>
              <div className="ml-auto flex min-w-0 items-center">
                <UserMenu profile={viewerProfile} roles={viewerRoles} translations={translations} onBrand />
              </div>
            </div>
          </header>
          {pills.length > 0 && <NavPills items={pills} label="Sections" />}
        </>
      ) : null}
      <div className={isAdmin ? 'lg:pl-56' : undefined}>{children}</div>
    </div>
  );
}

export function ProfileEditor({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [viewerProfile, setViewerProfile] = useState<Profile | null>(null);
  const [viewerRoles, setViewerRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [locale, setLocale] = useState('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Teams and players
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([]);

  // Error/success states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProfileData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setSessionUserId(user.id);

      const [{ data: viewerProfileData }, { data: viewerRoleRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, first_name, last_name, full_name, avatar_url, locale, language')
          .eq('id', user.id)
          .single(),
        supabase
          .from('profile_roles')
          .select('role')
          .eq('profile_id', user.id),
      ]);

      if (viewerProfileData) setViewerProfile(viewerProfileData);
      setViewerRoles((viewerRoleRows?.map((row) => row.role as UserRole) || []) as UserRole[]);

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (!profileData) {
        const { data: viewer } = await supabase
          .from('profiles')
          .select('locale, language')
          .eq('id', user.id)
          .single();
        const viewerLocale = viewer?.locale || viewer?.language || 'en';
        const { data: translationsData } = await supabase
          .from('translations')
          .select('key, value')
          .eq('locale', viewerLocale);
        if (translationsData) {
          const next: Record<string, string> = {};
          translationsData.forEach((row) => {
            next[row.key] = row.value;
          });
          setTranslations(next);
        }
        setMissing(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setFirstName(profileData.first_name || '');
      setLastName(profileData.last_name || '');
      setLocale(profileData.locale || profileData.language || 'en');
      setTheme(profileData.theme || 'light');
      setPhone(profileData.phone || '');

      // Load roles
      const { data: rolesData } = await supabase
        .from('profile_roles')
        .select('role')
        .eq('profile_id', profileId);

      if (rolesData) {
        setRoles(rolesData.map(r => r.role as UserRole));
      }

      // Load translations for current locale
      const currentLocale = profileData?.locale || profileData?.language || 'en';
      const { data: translationsData } = await supabase
        .from('translations')
        .select('key, value')
        .eq('locale', currentLocale);

      if (translationsData) {
        const t: Record<string, string> = {};
        translationsData.forEach(tr => {
          t[tr.key] = tr.value;
        });
        setTranslations(t);
      }

      // Load linked data based on roles
      await loadLinkedData(profileId, rolesData?.map(r => r.role) || []);

      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  }, [router, profileId]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  async function loadLinkedData(userId: string, userRoles: string[]) {
    try {
      // For parents: load linked children
      if (userRoles.includes('parent')) {
        const { data: links } = await supabase
          .from('parent_player_links')
          .select('player_id, players(id, full_name, jersey_number, team_id, teams(id, name, category, logo_url, clubs(id, name, short_name, logo_url, primary_color, secondary_color, created_at, updated_at)))')
          .eq('parent_id', userId);

        if (links) {
          const players: LinkedPlayer[] = [];
          links.forEach((link) => {
            const player = link.players as unknown as {
              id: string;
              full_name: string;
              jersey_number: number;
              teams: {
                id: string;
                name: string;
                category: string;
                logo_url?: string | null;
                clubs?: Club | Club[];
              };
            };
            if (player) {
              const team: Team = {
                id: player.teams.id,
                name: player.teams.name,
                category: player.teams.category,
                logo_url: player.teams.logo_url,
                clubs: Array.isArray(player.teams.clubs) ? player.teams.clubs[0] : player.teams.clubs,
              };
              players.push({
                id: player.id,
                full_name: player.full_name,
                jersey_number: player.jersey_number,
                team,
              });
            }
          });
          setLinkedPlayers(players);
        }
      }

      // For players: load own player record and team
      if (userRoles.includes('player')) {
        const { data: playerData } = await supabase
          .from('players')
          .select('id, full_name, jersey_number, team_id, teams(id, name, category, logo_url, clubs(id, name, short_name, logo_url, primary_color, secondary_color, created_at, updated_at))')
          .eq('user_id', userId)
          .maybeSingle();

        if (playerData && playerData.teams) {
          const team = Array.isArray(playerData.teams) ? playerData.teams[0] : playerData.teams;
          const teamWithClub: Team = {
            id: team.id,
            name: team.name,
            category: team.category,
            logo_url: team.logo_url,
            clubs: Array.isArray(team.clubs) ? team.clubs[0] : team.clubs,
          };
          setLinkedPlayers([{
            id: playerData.id,
            full_name: playerData.full_name,
            jersey_number: playerData.jersey_number,
            team: teamWithClub,
          }]);
        }
      }
    } catch (err) {
      console.error('Error loading linked data:', err);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0 || !profile) return;

    const file = e.target.files[0];

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(translations.trke_admin_invalid_file_type || 'Invalid file type');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(translations.trke_admin_file_too_large || 'File too large');
      return;
    }

    setUploading(true);
    setError('');

    if (sessionUserId && sessionUserId !== profile.id) {
      const result = await uploadProfileAvatar(profile.id, file);
      setUploading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if ('url' in result && result.url) {
        setProfile({ ...profile, avatar_url: result.url });
      }
      setSuccess(translations.trke_admin_avatar_uploaded || 'Avatar uploaded successfully');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `profiles/${profile.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      setSuccess(translations.trke_admin_avatar_uploaded || 'Avatar uploaded successfully');
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!profile || !profile.avatar_url) return;

    if (!confirm(translations.trke_admin_remove_avatar_confirm || 'Remove avatar?')) return;

    if (sessionUserId && sessionUserId !== profile.id) {
      const result = await removeProfileAvatar(profile.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setProfile({ ...profile, avatar_url: null });
      setSuccess(translations.trke_admin_avatar_removed || 'Avatar removed');
      return;
    }

    try {
      // Extract path from URL
      const url = profile.avatar_url;
      const path = url.split('/avatars/')[1];

      if (path) {
        // Delete from storage
        await supabase.storage.from('avatars').remove([path]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, avatar_url: null });
      setSuccess(translations.trke_admin_avatar_removed || 'Avatar removed');
    } catch (err) {
      console.error('Error removing avatar:', err);
      setError(err instanceof Error ? err.message : 'Remove failed');
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await saveProfileFields(profile.id, {
        first_name: firstName,
        last_name: lastName,
        locale,
        phone,
      });

      if (result.error) throw new Error(result.error);

      setSuccess(translations.trke_profile_updated || 'Profile updated successfully');
      
      // Reload to apply locale change
      if (locale !== profile.locale) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleThemeChange(newTheme: 'light' | 'dark') {
    if (!profile) return;

    setTheme(newTheme);

    try {
      const result = await saveProfileTheme(profile.id, { theme: newTheme });
      if (result.error) throw new Error(result.error);

      // Update HTML class immediately for instant feedback
      document.documentElement.className = newTheme;
      
      // Set cookie for logged-out fallback
      document.cookie = `theme=${newTheme}; path=/; max-age=${60 * 60 * 24 * 365}`; // 1 year

      setSuccess(translations.trke_theme_updated || 'Theme updated successfully');
    } catch (err) {
      console.error('Error updating theme:', err);
      setError(err instanceof Error ? err.message : 'Theme update failed');
    }
  }

  async function handleChangeEmail() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await changeOwnEmail({ currentPassword, newEmail });
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(translations.trke_email_changed_success || 'Email changed successfully. Confirmation emails sent to both addresses.');
        setNewEmail('');
        setCurrentPassword('');
      }
    } catch (err) {
      console.error('Error changing email:', err);
      setError(err instanceof Error ? err.message : 'Email change failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await changeOwnPassword({ currentPassword, newPassword, confirmPassword });
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(translations.trke_password_changed_success || 'Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOutAll() {
    if (!confirm(translations.trke_sign_out_all_confirm || 'Sign out from all devices?')) return;

    try {
      await supabase.auth.signOut({ scope: 'global' });
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      router.push('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  }

  if (loading) {
    return (
      <ProfileChrome viewerRoles={viewerRoles} viewerProfile={viewerProfile} translations={translations}>
        <div className="flex min-h-[50vh] items-center justify-center font-sans text-gray-600 dark:text-gray-400">
          {translations.trke_loading || 'Loading...'}
        </div>
      </ProfileChrome>
    );
  }

  if (missing || !profile) {
    return (
      <ProfileChrome viewerRoles={viewerRoles} viewerProfile={viewerProfile} translations={translations}>
        <div className="flex min-h-[50vh] items-center justify-center font-sans text-gray-600 dark:text-gray-400">
          {translations.trke_not_found || 'This page does not exist'}
        </div>
      </ProfileChrome>
    );
  }

  const initials = getInitials(profile.first_name || profile.full_name, profile.last_name);
  const isOwner = sessionUserId === profile.id;

  return (
    <ProfileChrome viewerRoles={viewerRoles} viewerProfile={viewerProfile} translations={translations}>
      <div className="mx-auto max-w-4xl px-4 py-8 font-sans sm:px-6 lg:px-8">
        <div className="sticky top-20 z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 bg-gray-100/95 px-4 py-3 backdrop-blur dark:bg-gray-800/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {translations.trke_my_profile || 'My Profile'}
          </h1>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-green-500 px-4 font-display text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
            {translations.trke_save || 'Save'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Photo */}
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_profile_photo || 'Profile Photo'}
            </h2>
            
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              <div className="flex gap-2">
                <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                  {uploading ? (translations.trke_admin_uploading || 'Uploading...') : (profile.avatar_url ? (translations.trke_replace_photo || 'Replace Photo') : (translations.trke_upload_photo || 'Upload Photo'))}
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>

                {profile.avatar_url && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    {translations.trke_admin_remove_photo || 'Remove Photo'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_full_name || 'Full Name'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_first_name || 'First Name'}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_last_name || 'Last Name'}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

          </div>

          {/* Language */}
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_language_preference || 'Language Preference'}
            </h2>
            
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ca">Català</option>
            </select>

          </div>

          {/* Theme */}
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_theme || 'Theme'}
            </h2>
            
            <div className="flex gap-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`px-6 py-3 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                ☀️ {translations.trke_light_theme || 'Light'}
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`px-6 py-3 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                }`}
              >
                🌙 {translations.trke_dark_theme || 'Dark'}
              </button>
            </div>
          </div>

          {/* Phone */}
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_phone_optional || 'Phone (optional)'}
            </h2>
            
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="w-full md:w-64 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />

          </div>

          {isOwner && (
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_email_address || 'Email Address'}
            </h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {translations.trke_email || 'Email'}: <span className="font-medium text-gray-900 dark:text-gray-100">{profile.email}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_current_password || 'Current Password'}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_new_email || 'New Email'}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={translations.trke_new_email || 'New Email'}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                onClick={handleChangeEmail}
                disabled={saving || !newEmail || !currentPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {translations.trke_change_email || 'Change Email'}
              </button>
            </div>
          </div>
          )}

          {isOwner && (
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_change_password || 'Change Password'}
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_current_password || 'Current Password'}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_new_password || 'New Password'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {translations.trke_password_requirements || 'Password must be at least 6 characters'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_confirm_password || 'Confirm Password'}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 font-sans dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {translations.trke_change_password || 'Change Password'}
              </button>
            </div>
          </div>
          )}

          {/* My Teams / Linked Players */}
          {linkedPlayers.length > 0 && (
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
              <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
                {roles.includes('parent') ? (translations.trke_linked_players || 'Linked Players') : (translations.trke_my_teams || 'My Teams')}
              </h2>
              
              <div className="space-y-3">
                {linkedPlayers.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    {player.team.clubs ? (
                      <ClubLogo 
                        logoUrl={player.team.clubs.logo_url} 
                        clubName={player.team.clubs.name} 
                        size="sm"
                      />
                    ) : player.team.logo_url ? (
                      <ClubLogo 
                        logoUrl={player.team.logo_url} 
                        clubName={player.team.name} 
                        size="sm"
                      />
                    ) : null}
                    <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                      {player.jersey_number}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{player.full_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {player.team.clubs?.name && <span>{player.team.clubs.name} • </span>}
                        {player.team.name} ({player.team.category})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles */}
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_user_roles || 'Roles'}
            </h2>
            
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <span key={role} className={getRoleBadgeClasses(role)}>
                  {translations[getRoleTranslationKey(role)] || role}
                </span>
              ))}
            </div>
          </div>

          {isOwner && (
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow ring-1 ring-black/5 dark:ring-white/15">
            <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
              {translations.trke_sign_out_all_devices || 'Sign Out All Devices'}
            </h2>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will sign you out from all devices and browsers. You will need to sign in again.
            </p>

            <button
              onClick={handleSignOutAll}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              {translations.trke_sign_out_all_devices || 'Sign Out All Devices'}
            </button>
          </div>
          )}
        </div>
      </div>
    </ProfileChrome>
  );
}
