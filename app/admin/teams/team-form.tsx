'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClubLogo } from '@/components/ClubLogo';
import { Club, Season, TeamCategory, TeamGender } from '@/types/database';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { savePlayer, saveTeam } from '../actions';
import { FormScreen, errorClass, fieldClass, hintClass, labelClass, lockedFieldClass } from '../form-screen';
import { ViewLink } from '../row-actions';

type TeamDraft = {
  name: string;
  fiba_short_name: string;
  season_id: string;
  club_id: string;
  coach_id: string;
  category: TeamCategory;
  gender: TeamGender;
};

type RosterPlayer = {
  id: string;
  full_name: string;
  jersey_number: number;
  position: string;
  date_of_birth: string;
  avatar_url: string | null;
};

function formatBirth(value: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function samePlayer(left: RosterPlayer, right: RosterPlayer) {
  return left.full_name === right.full_name
    && left.jersey_number === right.jersey_number
    && left.position === right.position
    && left.date_of_birth === right.date_of_birth;
}

const TEAM_CATEGORIES: { value: TeamCategory; label: string }[] = [
  { value: 'premini', label: 'PreMini' },
  { value: 'mini', label: 'Mini' },
  { value: 'infantil', label: 'Infantil' },
  { value: 'cadete', label: 'Cadete' },
  { value: 'junior', label: 'Junior' },
  { value: 'sub22', label: 'Sub-22' },
  { value: 'senior', label: 'Senior' },
];

const TEAM_GENDERS: { value: TeamGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'mixed', label: 'Mixed' },
];

export function TeamForm({ teamId, startEditing = false }: { teamId?: string; startEditing?: boolean }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!teamId || startEditing);
  const blockSubmit = useRef(false);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [savedPlayers, setSavedPlayers] = useState<RosterPlayer[]>([]);
  const [playersError, setPlayersError] = useState(false);
  const [savedForm, setSavedForm] = useState<TeamDraft | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<{ id: string; label: string }[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    fiba_short_name: '',
    season_id: '',
    club_id: '',
    coach_id: '',
    category: 'senior' as TeamCategory,
    gender: 'mixed' as TeamGender,
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

      const [seasonsData, clubsData, teamData, rosterData] = await Promise.all([
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
        platformAdmin
          ? supabase.from('clubs').select('*').order('name')
          : clubId
            ? supabase.from('clubs').select('*').eq('id', clubId)
            : Promise.resolve({ data: [] as Club[] }),
        teamId
          ? supabase.from('teams').select('*').eq('id', teamId).single()
          : Promise.resolve({ data: null, error: null }),
        teamId
          ? supabase.from('players').select('id, full_name, jersey_number, position, date_of_birth, avatar_url').eq('team_id', teamId).order('jersey_number')
          : Promise.resolve({ data: [] as RosterPlayer[], error: null }),
      ]);

      if (cancelled) return;

      setIsPlatformAdmin(platformAdmin);
      setUserClubId(clubId);
      if (seasonsData.data) setSeasons(seasonsData.data);
      if (clubsData.data) setClubs(clubsData.data);

      if (teamId) {
        if (teamData.error || !teamData.data) {
          setMissing(true);
        } else {
          const draft: TeamDraft = {
            name: teamData.data.name,
            fiba_short_name: teamData.data.fiba_short_name || '',
            season_id: teamData.data.season_id,
            club_id: teamData.data.club_id || '',
            coach_id: teamData.data.coach_id || '',
            category: teamData.data.category || 'senior',
            gender: teamData.data.gender || 'mixed',
          };
          setFormData(draft);
          setSavedForm(draft);
        }
        if (rosterData.error) {
          setPlayersError(true);
        } else {
          const roster = (rosterData.data || []).map((player) => ({
            id: player.id,
            full_name: player.full_name,
            jersey_number: player.jersey_number,
            position: player.position || '',
            date_of_birth: player.date_of_birth ? String(player.date_of_birth).slice(0, 10) : '',
            avatar_url: player.avatar_url,
          }));
          setPlayers(roster);
          setSavedPlayers(roster);
        }
      } else {
        setFormData((current) => ({ ...current, club_id: clubId || '', coach_id: '' }));
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    const clubId = formData.club_id || userClubId;
    if (!clubId || loading) return;
    let cancelled = false;

    async function loadCoaches() {
      const { data } = await supabase
        .from('profile_roles')
        .select('profile_id, profiles(full_name, email)')
        .eq('role', 'coach')
        .eq('club_id', clubId);
      if (cancelled) return;
      const options = (data || []).map((row) => {
        const profile = row.profiles as { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
        const person = Array.isArray(profile) ? profile[0] : profile;
        const label = person?.full_name?.trim() || person?.email || row.profile_id;
        return { id: row.profile_id, label };
      });
      setCoaches(options);
    }

    void loadCoaches();
    return () => {
      cancelled = true;
    };
  }, [formData.club_id, userClubId, loading]);

  function updatePlayer(id: string, patch: Partial<RosterPlayer>) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, ...patch } : player)));
  }

  useEffect(() => {
    blockSubmit.current = false;
  }, [editing]);

  function beginEditing(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    blockSubmit.current = true;
    setEditing(true);
  }

  function cancelEditing() {
    if (savedForm) setFormData(savedForm);
    setPlayers(savedPlayers);
    setEditing(false);
    setError('');
    if (teamId) router.replace(`/admin/teams/${teamId}`);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blockSubmit.current || (teamId && !editing)) return;
    setSaving(true);
    setError('');
    const result = await saveTeam({
      ...formData,
      club_id: formData.club_id || userClubId,
      id: teamId,
    });
    if (result.error || !result.id) {
      setSaving(false);
      setError(result.error || 'Could not save the team');
      return;
    }

    if (teamId) {
      for (const player of players) {
        const original = savedPlayers.find((item) => item.id === player.id);
        if (original && samePlayer(original, player)) continue;
        const saved = await savePlayer({
          id: player.id,
          full_name: player.full_name,
          jersey_number: player.jersey_number,
          team_id: teamId,
          position: player.position,
          date_of_birth: player.date_of_birth,
        });
        if (saved.error) {
          setSaving(false);
          setError(saved.error);
          return;
        }
      }
      const draft = { ...formData, club_id: formData.club_id || userClubId || '' };
      const roster = [...players].sort((left, right) => left.jersey_number - right.jersey_number);
      setFormData(draft);
      setSavedForm(draft);
      setPlayers(roster);
      setSavedPlayers(roster);
      setSaving(false);
      setEditing(false);
      router.replace(`/admin/teams/${teamId}`);
      return;
    }

    setSaving(false);
    router.push(`/admin/teams/${result.id}`);
  }

  const title = teamId ? (formData.name || t('trke_team_edit', 'Edit team')) : t('trke_team_new', 'New team');
  const selectedClub = clubs.find((club) => club.id === (formData.club_id || userClubId)) || null;
  const lockedClub = selectedClub?.name || '';
  const inputClass = editing ? fieldClass : lockedFieldClass;
  const showEditButton = Boolean(teamId) && !editing;

  return (
    <FormScreen title={title} backHref="/admin/teams" backLabel={t('trke_back', 'Back')} wide={Boolean(teamId)}>
      {loading ? (
        <p>{t('trke_loading', 'Loading...')}</p>
      ) : missing ? (
        <p>{t('trke_not_found', 'This page does not exist')}</p>
      ) : (
        <>
        <form onSubmit={handleSubmit}>
          {error && <div className={errorClass}>{error}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>{t('trke_team_name', 'Team name')} *</label>
              <input required disabled={!editing} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className={inputClass} />
            </div>
            <div>
              <div className="mb-1 flex items-start justify-between gap-3">
                <label className="pt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{t('trke_team_fiba_short_name', 'FIBA short name')}</label>
                <div className="flex shrink-0 items-start gap-2">
                  {showEditButton && (
                    <button
                      type="button"
                      onClick={beginEditing}
                      aria-label={t('trke_edit', 'Edit')}
                      title={t('trke_edit', 'Edit')}
                      className="inline-flex items-center justify-center rounded bg-blue-500 p-2 text-white hover:bg-blue-700"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {selectedClub && (
                    <ClubLogo logoUrl={selectedClub.logo_url} clubName={selectedClub.name} size="sm" className="shrink-0" />
                  )}
                </div>
              </div>
              <input
                value={formData.fiba_short_name}
                maxLength={3}
                pattern="[A-Za-z0-9]{3}"
                autoCapitalize="characters"
                spellCheck={false}
                title={t('trke_team_fiba_short_name_hint', 'Optional. 3 letters or numbers.')}
                disabled={!editing}
                onChange={(event) => setFormData({ ...formData, fiba_short_name: event.target.value.toUpperCase() })}
                className={`${inputClass} uppercase`}
              />
              <p className={hintClass}>{t('trke_team_fiba_short_name_hint', 'Optional. 3 letters or numbers.')}</p>
            </div>
            {isPlatformAdmin ? (
              <div>
                <label className={labelClass}>{t('trke_team_club', 'Club')} *</label>
                <select
                  required
                  value={formData.club_id}
                  disabled={Boolean(teamId)}
                  onChange={(event) => setFormData({ ...formData, club_id: event.target.value, coach_id: '' })}
                  className={teamId ? lockedFieldClass : fieldClass}
                >
                  <option value="">{t('trke_team_club', 'Club')}</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
                {teamId && <p className={hintClass}>{t('trke_team_club_locked', 'Club cannot be changed when editing a team')}</p>}
              </div>
            ) : (
              <div>
                <label className={labelClass}>{t('trke_team_club', 'Club')}</label>
                <input disabled value={lockedClub} className={lockedFieldClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>{t('trke_team_category', 'Category')} *</label>
              <select required disabled={!editing} value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value as TeamCategory })} className={inputClass}>
                {TEAM_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('trke_team_gender', 'Gender')} *</label>
              <select required disabled={!editing} value={formData.gender} onChange={(event) => setFormData({ ...formData, gender: event.target.value as TeamGender })} className={inputClass}>
                {TEAM_GENDERS.map((gender) => (
                  <option key={gender.value} value={gender.value}>{gender.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('trke_team_coach', 'Coach')}</label>
              <select
                value={formData.coach_id}
                disabled={!editing}
                onChange={(event) => setFormData({ ...formData, coach_id: event.target.value })}
                className={inputClass}
              >
                <option value="">{t('trke_team_coach_none', 'No coach')}</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>{coach.label}</option>
                ))}
              </select>
              <p className={hintClass}>{t('trke_team_coach_hint', 'Optional. A user with the coach role in this club.')}</p>
            </div>
            <div>
              <label className={labelClass}>{t('trke_team_season', 'Season')} *</label>
              <select required disabled={!editing} value={formData.season_id} onChange={(event) => setFormData({ ...formData, season_id: event.target.value })} className={inputClass}>
                <option value="">{t('trke_team_season', 'Season')}</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>{season.name}{season.is_active ? ' (Active)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          {!showEditButton && (
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {teamId ? t('trke_save', 'Save') : t('trke_create', 'Create')}
              </button>
              <button
                type="button"
                onClick={() => (teamId ? cancelEditing() : router.push('/admin/teams'))}
                className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700"
              >
                {t('trke_cancel', 'Cancel')}
              </button>
            </div>
          )}
        </form>
        {teamId && (
          <section className="mt-8 border-t border-gray-200 pt-6 dark:border-white/10" aria-label={t('trke_view_players', 'View players')}>
            <h2 className="mb-3 text-lg font-semibold">{t('trke_view_players', 'View players')}</h2>
            {playersError ? (
              <p className="text-sm text-red-700 dark:text-red-300">{t('trke_team_players_error', 'Could not load players')}</p>
            ) : players.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('trke_team_no_players', 'This team has no players')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('trke_player_photo', 'Photo')}</th>
                      <th className="px-3 py-2 font-medium">{t('trke_player_jersey', 'Jersey number')}</th>
                      <th className="px-3 py-2 font-medium">{t('trke_player_name', 'Full name')}</th>
                      <th className="px-3 py-2 font-medium">{t('trke_player_position', 'Position')}</th>
                      <th className="px-3 py-2 font-medium">{t('trke_player_birth', 'Date of birth')}</th>
                      <th className="px-3 py-2 font-medium"><span className="sr-only">{t('trke_view', 'View')}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                    {players.map((player) => (
                      <tr key={player.id}>
                        <td className="px-3 py-2">
                          {player.avatar_url ? (
                            <Image src={player.avatar_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-300">{player.full_name.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              max={99}
                              required
                              aria-label={`${t('trke_player_jersey', 'Jersey number')} ${player.full_name}`}
                              value={player.jersey_number}
                              onChange={(event) => updatePlayer(player.id, { jersey_number: Number(event.target.value) })}
                              className={`${fieldClass} w-20`}
                            />
                          ) : (
                            player.jersey_number
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              required
                              aria-label={`${t('trke_player_name', 'Full name')} ${player.jersey_number}`}
                              value={player.full_name}
                              onChange={(event) => updatePlayer(player.id, { full_name: event.target.value })}
                              className={fieldClass}
                            />
                          ) : (
                            player.full_name
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              aria-label={`${t('trke_player_position', 'Position')} ${player.full_name}`}
                              value={player.position}
                              onChange={(event) => updatePlayer(player.id, { position: event.target.value })}
                              className={fieldClass}
                            />
                          ) : (
                            player.position || '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              type="date"
                              aria-label={`${t('trke_player_birth', 'Date of birth')} ${player.full_name}`}
                              value={player.date_of_birth}
                              onChange={(event) => updatePlayer(player.id, { date_of_birth: event.target.value })}
                              className={fieldClass}
                            />
                          ) : (
                            formatBirth(player.date_of_birth)
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <ViewLink href={`/admin/players/${player.id}`} label={`${t('trke_view', 'View')} ${player.full_name}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        </>
      )}
    </FormScreen>
  );
}
