'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Club, UserRole } from '@/types/database';
import { resetUserPassword } from '@/lib/password-auth';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { createAdminUser, removeProfileAvatar, updateAdminUser, uploadProfileAvatar } from '../actions';
import { FormScreen, errorClass, fieldClass, labelClass, lockedFieldClass, successClass } from '../form-screen';

const availableRoles: UserRole[] = ['admin', 'club_admin', 'team_manager', 'coach', 'parent', 'player'];

export function UserForm({ userId }: { userId?: string }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | undefined>(userId);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    roles: ['player'] as UserRole[],
    club_id: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from('profile_roles')
        .select('role, club_id')
        .eq('profile_id', user.id);

      const platformAdmin = roles?.some((role) => role.role === 'admin' && role.club_id === null) || false;
      const clubAdmin = roles?.find((role) => (role.role === 'club_admin' || role.role === 'admin') && role.club_id !== null);
      const callerClubId = clubAdmin?.club_id || null;

      const clubsQuery = platformAdmin
        ? supabase.from('clubs').select('*').order('name')
        : callerClubId
          ? supabase.from('clubs').select('*').eq('id', callerClubId)
          : Promise.resolve({ data: [] as Club[] });

      const [clubsData, profileData, targetRoles] = await Promise.all([
        clubsQuery,
        userId ? supabase.from('profiles').select('*').eq('id', userId).single() : Promise.resolve({ data: null, error: null }),
        userId
          ? supabase.from('profile_roles').select('role, club_id').eq('profile_id', userId)
          : Promise.resolve({ data: [] as { role: UserRole; club_id: string | null }[] }),
      ]);

      if (cancelled) return;

      setIsPlatformAdmin(platformAdmin);
      setUserClubId(callerClubId);
      if (clubsData.data) setClubs(clubsData.data);

      if (userId) {
        if (profileData.error || !profileData.data) {
          setMissing(true);
        } else {
          const assigned = (targetRoles.data || []) as { role: UserRole; club_id: string | null }[];
          const clubForUser = assigned.find((role) => role.club_id)?.club_id || '';
          setAvatarUrl(profileData.data.avatar_url);
          setFormData({
            email: profileData.data.email,
            full_name: profileData.data.full_name || '',
            roles: assigned.length > 0 ? assigned.map((role) => role.role) : [profileData.data.role],
            club_id: platformAdmin ? clubForUser : (callerClubId || ''),
          });
        }
      } else {
        setFormData((current) => ({ ...current, club_id: callerClubId || '' }));
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  function toggleRole(role: UserRole) {
    setFormData((current) => {
      const roles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role];
      return { ...current, roles };
    });
  }

  const recordId = createdId;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (formData.roles.length === 0) {
      setSaving(false);
      setError('At least one role must be selected');
      return;
    }

    if (recordId) {
      const result = await updateAdminUser({
        id: recordId,
        email: formData.email,
        full_name: formData.full_name,
        roles: formData.roles,
        club_id: formData.club_id || null,
      });
      if (result.error) {
        setSaving(false);
        setError(result.error);
        return;
      }

      if (pendingFile) {
        const upload = await uploadProfileAvatar(recordId, pendingFile);
        if (upload.error) {
          setPendingFile(null);
          setSaving(false);
          setError(upload.error);
          return;
        }
        if ('url' in upload && upload.url) setAvatarUrl(upload.url);
        setPendingFile(null);
      }

      setSaving(false);
      router.push('/admin/users');
      return;
    }

    const result = await createAdminUser({
      email: formData.email,
      full_name: formData.full_name,
      roles: formData.roles,
      club_id: formData.club_id || null,
    });

    if (!('userId' in result) || !result.userId) {
      setSaving(false);
      setError(result.error || 'Could not create the user');
      return;
    }

    if (pendingFile) {
      const upload = await uploadProfileAvatar(result.userId, pendingFile);
      if (upload.error) {
        setCreatedId(result.userId);
        setPendingFile(null);
        setSaving(false);
        setError(upload.error);
        window.history.replaceState(null, '', `/admin/users/${result.userId}`);
        return;
      }
    }

    setSaving(false);
    const emailFailed = 'emailFailed' in result && result.emailFailed;
    router.push(emailFailed ? '/admin/users?emailFailed=1' : '/admin/users');
  }

  function validatePhoto(file: File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return t('trke_admin_invalid_file_type', 'Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      return t('trke_admin_file_too_large', 'File size exceeds 5MB limit.');
    }
    return '';
  }

  async function handleAvatarUpload(file: File) {
    const validationError = validatePhoto(file);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!recordId) {
      setError('');
      setPendingFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setError('');
    const result = await uploadProfileAvatar(recordId, file);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (result.error) {
      setError(result.error);
      return;
    }
    if ('url' in result && result.url) setAvatarUrl(result.url);
  }

  async function handleAvatarRemove() {
    if (pendingFile) {
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!recordId || !avatarUrl) return;
    if (!confirm(t('trke_player_photo_remove_confirm', 'Are you sure you want to remove this avatar?'))) return;
    setError('');
    const result = await removeProfileAvatar(recordId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAvatarUrl(null);
  }

  async function handleResetPassword() {
    if (!recordId) return;
    if (!confirm(t('trke_user_reset_confirm', 'Reset password for this user? They will receive an email with a temporary password.'))) return;
    setError('');
    setSuccess('');
    const result = await resetUserPassword(recordId, formData.club_id || userClubId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(`Password reset email sent to ${formData.email}`);
  }

  const title = recordId ? t('trke_user_edit', 'Edit user') : t('trke_user_new', 'New user');
  const lockedClub = clubs.find((club) => club.id === (formData.club_id || userClubId))?.name || '';
  const shownPhoto = previewUrl || avatarUrl;
  const displayName = formData.full_name || formData.email;

  return (
    <FormScreen title={title} backHref="/admin/users" backLabel={t('trke_back', 'Back')}>
      {loading ? (
        <p>{t('trke_loading', 'Loading...')}</p>
      ) : missing ? (
        <p>{t('trke_not_found', 'This page does not exist')}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className={errorClass}>{error}</div>}
          {success && <div className={successClass}>{success}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>{t('trke_user_email', 'Email')} *</label>
              <input required type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_user_full_name', 'Full name')}</label>
              <input value={formData.full_name} onChange={(event) => setFormData({ ...formData, full_name: event.target.value })} className={fieldClass} />
            </div>
            {isPlatformAdmin ? (
              <div>
                <label className={labelClass}>{t('trke_user_club', 'Club')}</label>
                <select value={formData.club_id} onChange={(event) => setFormData({ ...formData, club_id: event.target.value })} className={fieldClass}>
                  <option value="">{t('trke_user_no_club', 'No club')}</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass}>{t('trke_user_club', 'Club')}</label>
                <input disabled value={lockedClub} className={lockedFieldClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>{t('trke_user_roles', 'Roles')} *</label>
              <div className="space-y-2 rounded border border-gray-300 px-3 py-2 dark:border-gray-700">
                {availableRoles.map((role) => (
                  <label key={role} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={formData.roles.includes(role)} onChange={() => toggleRole(role)} />
                    <span className="text-sm capitalize text-gray-700 dark:text-gray-300">{role.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {previewUrl ? (
              <img src={previewUrl} alt={displayName} className="h-16 w-16 rounded-full object-cover" />
            ) : avatarUrl ? (
              <Image src={avatarUrl} alt={displayName} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-lg font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                {(displayName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                {uploading ? t('trke_loading', 'Loading...') : shownPhoto ? t('trke_player_change_photo', 'Change photo') : t('trke_player_add_photo', 'Add photo')}
              </button>
              {shownPhoto && (
                <button type="button" onClick={handleAvatarRemove} className="rounded bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-700">
                  {t('trke_player_remove_photo', 'Remove photo')}
                </button>
              )}
              {recordId && (
                <button type="button" onClick={handleResetPassword} className="rounded bg-yellow-500 px-4 py-2 text-sm text-white hover:bg-yellow-700">
                  {t('trke_user_reset_password', 'Reset password')}
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {recordId ? t('trke_update', 'Update') : t('trke_create', 'Create')}
            </button>
            <button type="button" onClick={() => router.push('/admin/users')} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">
              {t('trke_cancel', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </FormScreen>
  );
}
