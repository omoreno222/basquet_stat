'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GameStatus, KitColor } from '@/types/database';
import { DEFAULT_OPPONENT_COLOR, OPPONENT_JERSEY_COLORS, normalizeHexColor } from '@/lib/colors';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { saveGame } from '../actions';
import { FormScreen, checkTextClass, errorClass, fieldClass, hintClass, labelClass } from '../form-screen';

interface ClubColors {
  primary_color: string;
  secondary_color: string;
}

interface TeamOption {
  id: string;
  name: string;
  club_id: string;
  seasons?: { name: string } | { name: string }[] | null;
  clubs?: ClubColors | ClubColors[] | null;
}

function seasonLabel(seasons: TeamOption['seasons']) {
  if (!seasons) return '';
  return Array.isArray(seasons) ? seasons[0]?.name : seasons.name;
}

function clubColors(clubs: TeamOption['clubs']) {
  if (!clubs) return null;
  return Array.isArray(clubs) ? clubs[0] ?? null : clubs;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function captureReturnPath(gameId: string | undefined, returnTo: string | undefined) {
  if (!gameId || !returnTo) return null;
  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) return null;
  const pathname = returnTo.split('?')[0]?.split('#')[0] ?? '';
  if (pathname !== `/team-manager/games/${gameId}/capture`) return null;
  return pathname;
}

export function GameForm({ gameId, returnTo }: { gameId?: string; returnTo?: string }) {
  const router = useRouter();
  const { t } = useLocaleTranslations();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [formData, setFormData] = useState({
    team_id: '',
    opponent_name: '',
    is_home: true,
    venue: '',
    game_date: '',
    status: 'scheduled' as GameStatus,
    official: true,
    kit_color: 'primary' as KitColor,
    opponent_color: DEFAULT_OPPONENT_COLOR,
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

      let teamsQuery = supabase.from('teams').select('id, name, club_id, seasons(name), clubs(primary_color, secondary_color)').order('name');
      if (!platformAdmin && clubAdmin?.club_id) {
        teamsQuery = teamsQuery.eq('club_id', clubAdmin.club_id);
      }

      const [teamsData, gameData] = await Promise.all([
        teamsQuery,
        gameId
          ? supabase.from('games').select('*').eq('id', gameId).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelled) return;
      if (teamsData.data) setTeams(teamsData.data);

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
            kit_color: gameData.data.kit_color === 'secondary' ? 'secondary' : 'primary',
            opponent_color: normalizeHexColor(gameData.data.opponent_color),
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

  const doneHref = captureReturnPath(gameId, returnTo) ?? '/admin/games';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await saveGame({
      ...formData,
      id: gameId,
    });
    setSaving(false);
    if (result.error || !result.id) {
      setError(result.error || 'Could not save the game');
      return;
    }
    router.push(doneHref);
  }
  const title = gameId ? t('trke_game_edit', 'Edit game') : t('trke_game_new', 'New game');
  const selectedTeam = teams.find((team) => team.id === formData.team_id);
  const selectedClub = clubColors(selectedTeam?.clubs);
  const kitOptions: { value: KitColor; label: string; color: string }[] = selectedClub
    ? [
        { value: 'primary', label: t('trke_club_primary_color', 'Primary color'), color: selectedClub.primary_color },
        { value: 'secondary', label: t('trke_club_secondary_color', 'Secondary color'), color: selectedClub.secondary_color },
      ]
    : [];

  return (
    <FormScreen title={title} backHref={doneHref} backLabel={t('trke_back', 'Back')}>
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
              <select
                required
                value={formData.team_id}
                onChange={(event) => setFormData({ ...formData, team_id: event.target.value })}
                className={fieldClass}
              >
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
            <div className="md:col-span-2">
              <span className={labelClass}>{t('trke_game_kit_color', 'Jersey color')} *</span>
              {kitOptions.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {kitOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 ${formData.kit_color === option.value ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300 dark:border-gray-700'}`}
                    >
                      <input
                        type="radio"
                        name="kit_color"
                        required
                        value={option.value}
                        checked={formData.kit_color === option.value}
                        onChange={() => setFormData({ ...formData, kit_color: option.value })}
                      />
                      <span className="h-6 w-6 rounded border border-gray-300 dark:border-white/20" style={{ backgroundColor: option.color }} />
                      <span className={checkTextClass}>{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className={hintClass}>{t('trke_game_kit_color_hint', 'Select a team to choose one of its club colors')}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <span className={labelClass}>{t('trke_game_away_color', 'Visitor color')} *</span>
              <div className="flex flex-wrap items-center gap-2">
                {OPPONENT_JERSEY_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={swatch}
                    aria-pressed={formData.opponent_color === swatch}
                    onClick={() => setFormData({ ...formData, opponent_color: swatch })}
                    className={`h-9 w-9 rounded-full border border-gray-300 dark:border-white/20 ${formData.opponent_color === swatch ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
                <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-gray-300 dark:border-white/20">
                  <span className="sr-only">{t('trke_game_away_color', 'Visitor color')}</span>
                  <input
                    type="color"
                    value={formData.opponent_color}
                    onChange={(event) => setFormData({ ...formData, opponent_color: normalizeHexColor(event.target.value) })}
                    className="absolute -inset-2 h-14 w-14 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
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
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('trke_game_possession_auto', 'The app calculates possession.')}</p>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {gameId ? t('trke_update', 'Update') : t('trke_create', 'Create')}
            </button>
            <button type="button" onClick={() => router.push(doneHref)} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">
              {t('trke_cancel', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </FormScreen>
  );
}
