'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GameOperatorStint, GameStatus } from '@/types/database';
import { operatorRoleValues } from '@/lib/form-schemas';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { saveGame } from '../actions';
import { FormScreen, checkTextClass, errorClass, fieldClass, labelClass } from '../form-screen';

interface TeamOption {
  id: string;
  name: string;
  club_id: string;
  seasons?: { name: string } | { name: string }[] | null;
}

interface RecorderOption {
  id: string;
  label: string;
  clubIds: string[];
  allClubs: boolean;
}

interface OperatorStintRow extends Pick<GameOperatorStint, 'id' | 'slot' | 'user_id' | 'started_at' | 'ended_at'> {
  label: string;
}

function seasonLabel(seasons: TeamOption['seasons']) {
  if (!seasons) return '';
  return Array.isArray(seasons) ? seasons[0]?.name : seasons.name;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function GameForm({ gameId }: { gameId?: string }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [recorders, setRecorders] = useState<RecorderOption[]>([]);
  const [stints, setStints] = useState<OperatorStintRow[]>([]);
  const [formData, setFormData] = useState({
    team_id: '',
    opponent_name: '',
    is_home: true,
    venue: '',
    game_date: '',
    status: 'scheduled' as GameStatus,
    official: true,
    single_recorder: false,
    slot_a_user_id: '',
    slot_b_user_id: '',
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

      let teamsQuery = supabase.from('teams').select('id, name, club_id, seasons(name)').order('name');
      if (!platformAdmin && clubAdmin?.club_id) {
        teamsQuery = teamsQuery.eq('club_id', clubAdmin.club_id);
      }

      const [teamsData, gameData, roleData, stintData] = await Promise.all([
        teamsQuery,
        gameId
          ? supabase.from('games').select('*').eq('id', gameId).single()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('profile_roles').select('profile_id, club_id, role').in('role', [...operatorRoleValues]),
        gameId
          ? supabase.from('game_operator_stints').select('id, slot, user_id, started_at, ended_at').eq('game_id', gameId).order('started_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;
      if (teamsData.data) setTeams(teamsData.data);

      const roleRows = roleData.data || [];
      const recorderIds = [...new Set(roleRows.map((role) => role.profile_id))];
      let recorderOptions: RecorderOption[] = [];
      if (recorderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', recorderIds);
        recorderOptions = (profiles || []).map((profile) => {
          const clubs = roleRows.filter((role) => role.profile_id === profile.id);
          return {
            id: profile.id,
            label: profile.full_name || profile.email,
            clubIds: clubs.map((role) => role.club_id).filter((clubId): clubId is string => Boolean(clubId)),
            allClubs: clubs.some((role) => role.role === 'admin' && role.club_id === null),
          };
        });
      }
      if (cancelled) return;
      setRecorders(recorderOptions);

      const stintRows = stintData.data || [];
      const stintUserIds = [...new Set(stintRows.map((stint) => stint.user_id))];
      const missingNameIds = stintUserIds.filter((id) => !recorderOptions.some((person) => person.id === id));
      const extraNames = new Map<string, string>();
      if (missingNameIds.length > 0) {
        const { data: extraProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', missingNameIds);
        extraProfiles?.forEach((profile) => {
          extraNames.set(profile.id, profile.full_name || profile.email);
        });
      }
      if (cancelled) return;
      setStints(stintRows.map((stint) => ({
        ...stint,
        slot: stint.slot === 'b' ? 'b' : 'a',
        label: recorderOptions.find((person) => person.id === stint.user_id)?.label || extraNames.get(stint.user_id) || '—',
      })));

      if (gameId) {
        if (gameData.error || !gameData.data) {
          setMissing(true);
        } else {
          setFormData({
            team_id: gameData.data.team_id,
            opponent_name: gameData.data.opponent_name,
            is_home: gameData.data.is_home,
            venue: gameData.data.venue || '',
            game_date: toLocalInput(gameData.data.game_date),
            status: gameData.data.status,
            official: gameData.data.official ?? true,
            single_recorder: gameData.data.single_recorder ?? false,
            slot_a_user_id: gameData.data.slot_a_user_id || '',
            slot_b_user_id: gameData.data.single_recorder ? '' : (gameData.data.slot_b_user_id || ''),
          });
        }
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await saveGame({
      ...formData,
      id: gameId,
      slot_a_user_id: formData.slot_a_user_id,
      slot_b_user_id: formData.single_recorder ? null : formData.slot_b_user_id,
    });
    setSaving(false);
    if (result.error || !result.id) {
      const message = result.error || 'Could not save the game';
      if (message.includes('OPERATOR_CLOCK')) {
        setError(t('trke_operator_clock_running', 'Stop the clock before changing operators.'));
      } else if (message.includes('OPERATOR_FINAL')) {
        setError(t('trke_operator_final', 'Operators cannot be changed after the game has ended.'));
      } else {
        setError(message);
      }
      return;
    }
    router.push('/admin/games');
  }

  const title = gameId ? t('trke_game_edit', 'Edit game') : t('trke_game_new', 'New game');
  const selectedTeam = teams.find((team) => team.id === formData.team_id);
  const teamRecorders = recorders.filter((person) => (
    person.allClubs || (selectedTeam ? person.clubIds.includes(selectedTeam.club_id) : false)
  ));

  function chooseTeam(teamId: string) {
    const team = teams.find((item) => item.id === teamId);
    const allowed = new Set(recorders.filter((person) => (
      person.allClubs || (team ? person.clubIds.includes(team.club_id) : false)
    )).map((person) => person.id));
    setFormData({
      ...formData,
      team_id: teamId,
      slot_a_user_id: allowed.has(formData.slot_a_user_id) ? formData.slot_a_user_id : '',
      slot_b_user_id: allowed.has(formData.slot_b_user_id) ? formData.slot_b_user_id : '',
    });
  }

  return (
    <FormScreen title={title} backHref="/admin/games" backLabel={t('trke_back', 'Back')}>
      {loading ? (
        <p>{t('trke_loading', 'Loading...')}</p>
      ) : missing ? (
        <p>{t('trke_not_found', 'This page does not exist')}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className={errorClass}>{error}</div>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>{t('trke_game_team', 'Team')} *</label>
              <select required value={formData.team_id} onChange={(event) => chooseTeam(event.target.value)} className={fieldClass}>
                <option value="">{t('trke_game_team', 'Team')}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name} ({seasonLabel(team.seasons)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('trke_game_opponent', 'Opponent name')} *</label>
              <input required value={formData.opponent_name} onChange={(event) => setFormData({ ...formData, opponent_name: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_game_date', 'Game date and time')} *</label>
              <input required type="datetime-local" value={formData.game_date} onChange={(event) => setFormData({ ...formData, game_date: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_game_venue', 'Venue')}</label>
              <input value={formData.venue} onChange={(event) => setFormData({ ...formData, venue: event.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('trke_game_status', 'Status')} *</label>
              <select required value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as GameStatus })} className={fieldClass}>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input type="checkbox" checked={formData.is_home} onChange={(event) => setFormData({ ...formData, is_home: event.target.checked })} className="mr-2" />
                <span className={checkTextClass}>{t('trke_game_home', 'Home game')}</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={formData.official} onChange={(event) => setFormData({ ...formData, official: event.target.checked })} className="mr-2" />
                <span className={checkTextClass}>{t('trke_game_official', 'Official competition')}</span>
              </label>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex items-center md:col-span-2">
              <input
                type="checkbox"
                checked={formData.single_recorder}
                onChange={(event) => setFormData({
                  ...formData,
                  single_recorder: event.target.checked,
                  slot_b_user_id: event.target.checked ? '' : formData.slot_b_user_id,
                })}
                className="mr-2"
              />
              <span className={checkTextClass}>{t('trke_game_single_recorder', 'One recorder')}</span>
            </label>
            <div>
              <label className={labelClass}>{t('trke_operator_a', 'Operator A')} *</label>
              <select
                required
                value={formData.slot_a_user_id}
                onChange={(event) => setFormData({ ...formData, slot_a_user_id: event.target.value })}
                className={fieldClass}
              >
                <option value="">{t('trke_operator_a', 'Operator A')}</option>
                {teamRecorders.map((person) => (
                  <option key={person.id} value={person.id}>{person.label}</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('trke_game_slot_a_help', 'Clock (start, stop, next period). Made and missed 1, 2 and 3 point shots on the court; free throws green or red on the free-throw line. Fouls by type, with a player counter that warns at 5. Substitutions, which produce minutes. Starting lineup, synced live to operator B. Opponent score.')}</p>
            </div>
            {formData.single_recorder ? null : (
              <div>
                <label className={labelClass}>{t('trke_operator_b', 'Operator B')} *</label>
                <select
                  required
                  value={formData.slot_b_user_id}
                  onChange={(event) => setFormData({ ...formData, slot_b_user_id: event.target.value })}
                  className={fieldClass}
                >
                  <option value="">{t('trke_operator_b', 'Operator B')}</option>
                  {teamRecorders.map((person) => (
                    <option key={person.id} value={person.id}>{person.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('trke_game_slot_b_help', 'Rebounds, assists, turnovers and steals.')}</p>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 md:col-span-2">{t('trke_game_possession_auto', 'The app calculates possession.')}</p>
            {stints.length > 0 && (
              <div className="md:col-span-2">
                <h2 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t('trke_operator_log', 'Operator log')}</h2>
                <ul className="divide-y divide-gray-200 text-sm text-gray-600 dark:divide-white/10 dark:text-gray-300">
                  {stints.map((stint) => (
                    <li key={stint.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span>
                        {stint.slot === 'a' ? t('trke_operator_a', 'Operator A') : t('trke_operator_b', 'Operator B')}
                        {' · '}
                        {stint.label}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {t('trke_operator_since', 'Since')} {new Date(stint.started_at).toLocaleString()}
                        {' · '}
                        {stint.ended_at
                          ? `${t('trke_operator_until', 'Until')} ${new Date(stint.ended_at).toLocaleString()}`
                          : t('trke_operator_current', 'Current')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {gameId ? t('trke_update', 'Update') : t('trke_create', 'Create')}
            </button>
            <button type="button" onClick={() => router.push('/admin/games')} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">
              {t('trke_cancel', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </FormScreen>
  );
}
