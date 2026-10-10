'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Club } from '@/types/database';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { removePlayerAvatar, savePlayer, uploadPlayerAvatar } from '../actions';
import { FormScreen, errorClass, fieldClass, labelClass, lockedFieldClass } from '../form-screen';

interface TeamOption {
  id: string;
  name: string;
  club_id: string;
  seasons?: { name: string } | { name: string }[] | null;
}

function seasonLabel(seasons: TeamOption['seasons']) {
  if (!seasons) return '';
  return Array.isArray(seasons) ? seasons[0]?.name : seasons.name;
}

type PlayerDraft = {
  full_name: string;
  jersey_number: string;
  team_id: string;
  club_id: string;
  position: string;
  date_of_birth: string;
};

export function PlayerForm({ playerId, startEditing = false }: { playerId?: string; startEditing?: boolean }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!playerId || startEditing);
  const [savedForm, setSavedForm] = useState<PlayerDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [incomingFile, setIncomingFile] = useState<File | null>(null);
  const [incomingPreview, setIncomingPreview] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(playerId);
  const [playerName, setPlayerName] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    jersey_number: '',
    team_id: '',
    club_id: '',
    position: '',
    date_of_birth: '',
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
      const clubId = clubAdmin?.club_id || null;

      let teamsQuery = supabase.from('teams').select('id, name, club_id, seasons(name)').order('name');
      if (!platformAdmin && clubId) teamsQuery = teamsQuery.eq('club_id', clubId);

      const [teamsData, clubsData, playerData] = await Promise.all([
        teamsQuery,
        platformAdmin
          ? supabase.from('clubs').select('*').order('name')
          : clubId
            ? supabase.from('clubs').select('*').eq('id', clubId)
            : Promise.resolve({ data: [] as Club[] }),
        playerId
          ? supabase.from('players').select('*').eq('id', playerId).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelled) return;

      setIsPlatformAdmin(platformAdmin);
      if (teamsData.data) setTeams(teamsData.data);
      if (clubsData.data) setClubs(clubsData.data);

      if (playerId) {
        if (playerData.error || !playerData.data) {
          setMissing(true);
        } else {
          const draft = {
            full_name: playerData.data.full_name,
            jersey_number: String(playerData.data.jersey_number),
            team_id: playerData.data.team_id,
            club_id: playerData.data.club_id || '',
            position: playerData.data.position || '',
            date_of_birth: playerData.data.date_of_birth ? String(playerData.data.date_of_birth).slice(0, 10) : '',
          };
          setFormData(draft);
          setSavedForm(draft);
          setAvatarUrl(playerData.data.avatar_url);
          setPlayerName(playerData.data.full_name);
        }
      } else if (clubId) {
        setFormData((current) => ({ ...current, club_id: clubId }));
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  useEffect(() => {
    if (!incomingFile) {
      setIncomingPreview(null);
      return;
    }
    const url = URL.createObjectURL(incomingFile);
    setIncomingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [incomingFile]);

  const visibleTeams = teams.filter((team) => !formData.club_id || team.club_id === formData.club_id);
  const recordId = savedId;

  function cancelEditing() {
    if (savedForm) setFormData(savedForm);
    setPendingFile(null);
    setIncomingFile(null);
    setError('');
    setEditing(false);
    if (recordId) router.replace(`/admin/players/${recordId}`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (playerId && !editing) return;
    setSaving(true);
    setError('');
    const result = await savePlayer({ ...formData, id: recordId });
    if (result.error || !result.id) {
      setSaving(false);
      setError(result.error || 'Could not save the player');
      return;
    }

    if (pendingFile) {
      const upload = await uploadPlayerAvatar(result.id, pendingFile);
      if (upload.error) {
        setSavedId(result.id);
        setPendingFile(null);
        setSaving(false);
        setError(upload.error);
        window.history.replaceState(null, '', `/admin/players/${result.id}`);
        return;
      }
      if ('url' in upload && upload.url) setAvatarUrl(upload.url);
      setPendingFile(null);
    }

    if (playerId) {
      setSavedForm({ ...formData });
      setPlayerName(formData.full_name);
      setSaving(false);
      setEditing(false);
      router.replace(`/admin/players/${result.id}`);
      return;
    }

    setSaving(false);
    router.push(`/admin/players/${result.id}`);
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

    // Detach the bytes from the file input. Resetting that input can drop the
    // original File, and a later save would send the previous photo again.
    const snapshot = new File([await file.arrayBuffer()], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!recordId) {
      setError('');
      setPendingFile(snapshot);
      return;
    }

    setIncomingFile(snapshot);
    setUploading(true);
    setError('');
    const result = await uploadPlayerAvatar(recordId, snapshot);
    setUploading(false);
    if (result.error) {
      setIncomingFile(null);
      setError(result.error);
      return;
    }
    if ('url' in result && result.url) setAvatarUrl(result.url);
    setIncomingFile(null);
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
    const result = await removePlayerAvatar(recordId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAvatarUrl(null);
  }

  const title = playerId
    ? (formData.full_name || playerName || t('trke_player_edit', 'Edit player'))
    : t('trke_player_new', 'New player');
  const blobPreview = incomingPreview || previewUrl;
  const shownPhoto = blobPreview || avatarUrl;
  const inputClass = editing ? fieldClass : lockedFieldClass;

  return (
    <FormScreen title={title} backHref="/admin/players" backLabel={t('trke_back', 'Back')}>
      {loading ? (
        <p>{t('trke_loading', 'Loading...')}</p>
      ) : missing ? (
        <p>{t('trke_not_found', 'This page does not exist')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="font-sans text-gray-900 dark:text-gray-100">
          {error && <div className={errorClass}>{error}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>{t('trke_player_name', 'Full name')} *</label>
              <input required disabled={!editing} value={formData.full_name} onChange={(event) => setFormData({ ...formData, full_name: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_player_jersey', 'Jersey number')} *</label>
              <input required disabled={!editing} type="number" min={0} max={99} value={formData.jersey_number} onChange={(event) => setFormData({ ...formData, jersey_number: event.target.value })} className={inputClass} />
            </div>
            {isPlatformAdmin && (
              <div>
                <label className={labelClass}>{t('trke_team_club', 'Club')} *</label>
                <select
                  required
                  disabled={!editing}
                  value={formData.club_id}
                  onChange={(event) => setFormData({ ...formData, club_id: event.target.value, team_id: '' })}
                  className={inputClass}
                >
                  <option value="">{t('trke_team_club', 'Club')}</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>{t('trke_player_team', 'Team')} *</label>
              <select required disabled={!editing} value={formData.team_id} onChange={(event) => setFormData({ ...formData, team_id: event.target.value })} className={inputClass}>
                <option value="">{t('trke_player_team', 'Team')}</option>
                {visibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name} ({seasonLabel(team.seasons)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('trke_player_position', 'Position')}</label>
              <input disabled={!editing} value={formData.position} onChange={(event) => setFormData({ ...formData, position: event.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_player_birth', 'Date of birth')}</label>
              <input disabled={!editing} type="date" value={formData.date_of_birth} onChange={(event) => setFormData({ ...formData, date_of_birth: event.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            {blobPreview ? (
              <img src={blobPreview} alt={formData.full_name || playerName} className="h-16 w-16 rounded-full object-cover" />
            ) : avatarUrl ? (
              <Image key={avatarUrl} src={avatarUrl} alt={playerName} width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-lg font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                {(formData.full_name || playerName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            {editing && (
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
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="rounded bg-green-500 px-4 py-2 text-sm font-sans text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading ? t('trke_loading', 'Loading...') : shownPhoto ? t('trke_player_change_photo', 'Change photo') : t('trke_player_add_photo', 'Add photo')}
                </button>
                {shownPhoto && (
                  <button type="button" onClick={handleAvatarRemove} disabled={uploading} className="rounded bg-orange-500 px-4 py-2 text-sm font-sans text-white hover:bg-orange-700 disabled:opacity-50">
                    {t('trke_player_remove_photo', 'Remove photo')}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {playerId && !editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t('trke_edit', 'Edit')}
                title={t('trke_edit', 'Edit')}
                className="inline-flex items-center justify-center rounded bg-blue-500 p-2 text-white hover:bg-blue-700"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-sans font-bold text-white hover:bg-green-700 disabled:opacity-50">
                  {recordId ? t('trke_update', 'Update') : t('trke_create', 'Create')}
                </button>
                <button
                  type="button"
                  onClick={() => (playerId ? cancelEditing() : router.push('/admin/players'))}
                  className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700"
                >
                  {t('trke_cancel', 'Cancel')}
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </FormScreen>
  );
}
