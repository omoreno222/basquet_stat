'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getInitials, validatePhone, validateEmail, validatePassword, getRoleBadgeClasses, getRoleTranslationKey, type UserRole } from '@/lib/profile-utils';
import { ClubLogo } from '@/components/ClubLogo';

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
}

interface LinkedPlayer {
  id: string;
  full_name: string;
  jersey_number: number;
  team: Team;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [locale, setLocale] = useState('en');
  const [phone, setPhone] = useState('');
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

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setLocale(profileData.locale || profileData.language || 'en');
        setPhone(profileData.phone || '');
      }

      // Load roles
      const { data: rolesData } = await supabase
        .from('profile_roles')
        .select('role')
        .eq('profile_id', user.id);

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
      await loadLinkedData(user.id, rolesData?.map(r => r.role) || []);

      setLoading(false);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  async function loadLinkedData(userId: string, userRoles: string[]) {
    try {
      // For parents: load linked children
      if (userRoles.includes('parent')) {
        const { data: links } = await supabase
          .from('parent_player_links')
          .select('player_id, players(id, full_name, jersey_number, team_id, teams(id, name, category, logo_url))')
          .eq('parent_id', userId);

        if (links) {
          const players: LinkedPlayer[] = [];
          links.forEach((link) => {
            const player = link.players as unknown as {
              id: string;
              full_name: string;
              jersey_number: number;
              teams: Team;
            };
            if (player) {
              players.push({
                id: player.id,
                full_name: player.full_name,
                jersey_number: player.jersey_number,
                team: player.teams,
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
          .select('id, full_name, jersey_number, team_id, teams(id, name, category, logo_url)')
          .eq('user_id', userId)
          .maybeSingle();

        if (playerData && playerData.teams) {
          const team = Array.isArray(playerData.teams) ? playerData.teams[0] : playerData.teams;
          setLinkedPlayers([{
            id: playerData.id,
            full_name: playerData.full_name,
            jersey_number: playerData.jersey_number,
            team: team as Team,
          }]);
        }
      }

      // For coach/team_manager: load their teams
      // (This requires a teams.coach_id or similar column that may not exist)
      // Skipping for now as the schema doesn't have this relation clearly defined
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

    // Validate
    if (!validatePhone(phone)) {
      setError('Invalid phone number');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          locale,
          phone,
        })
        .eq('id', profile.id);

      if (error) throw error;

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

  async function handleChangeEmail() {
    if (!validateEmail(newEmail)) {
      setError('Invalid email address');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;

      setSuccess(translations.trke_email_updated || 'Email update sent. Check your inbox to confirm.');
      setNewEmail('');
    } catch (err) {
      console.error('Error changing email:', err);
      setError(err instanceof Error ? err.message : 'Email change failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setError(validation.message || 'Invalid password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(translations.trke_passwords_must_match || 'Passwords must match');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setSuccess(translations.trke_password_updated || 'Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
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
      router.push('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Profile not found</div>
      </div>
    );
  }

  const initials = getInitials(profile.first_name || profile.full_name, profile.last_name);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          {translations.trke_my_profile || 'My Profile'}
        </h1>

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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (translations.trke_save || 'Save')}
            </button>
          </div>

          {/* Language */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {translations.trke_language_preference || 'Language Preference'}
            </h2>
            
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ca">Català</option>
            </select>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (translations.trke_save || 'Save')}
            </button>
          </div>

          {/* Phone */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {translations.trke_phone_optional || 'Phone (optional)'}
            </h2>
            
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (translations.trke_save || 'Save')}
            </button>
          </div>

          {/* Email */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {translations.trke_email_address || 'Email Address'}
            </h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {translations.trke_email || 'Email'}: <span className="font-medium text-gray-900 dark:text-gray-100">{profile.email}</span>
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={translations.trke_new_email || 'New Email'}
                className="w-full md:w-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {translations.trke_email_change_info || 'You will receive a confirmation email. The change will apply after you confirm.'}
              </p>
              <button
                onClick={handleChangeEmail}
                disabled={saving || !newEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {translations.trke_change_email || 'Change Email'}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {translations.trke_change_password || 'Change Password'}
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {translations.trke_new_password || 'New Password'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {translations.trke_password_min_length || 'Password must be at least 8 characters'}
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
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={saving || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {translations.trke_change_password || 'Change Password'}
              </button>
            </div>
          </div>

          {/* My Teams / Linked Players */}
          {linkedPlayers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {roles.includes('parent') ? (translations.trke_linked_players || 'Linked Players') : (translations.trke_my_teams || 'My Teams')}
              </h2>
              
              <div className="space-y-3">
                {linkedPlayers.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <ClubLogo 
                      logoUrl={player.team.logo_url} 
                      clubName={player.team.name} 
                      size="sm"
                    />
                    <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                      {player.jersey_number}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{player.full_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {player.team.name} ({player.team.category})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Your Roles
            </h2>
            
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <span key={role} className={getRoleBadgeClasses(role)}>
                  {translations[getRoleTranslationKey(role)] || role}
                </span>
              ))}
            </div>
          </div>

          {/* Sign Out All Devices */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
        </div>
      </div>
    </div>
  );
}
