'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Club, Team, TeamCategory, TeamGender } from '@/types/database';
import { AdminNavbar } from '@/components/AdminNavbar';
import { ClubLogo } from '@/components/ClubLogo';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { Plus } from 'lucide-react';
import { DeleteButton, EditLink, ViewLink } from '../row-actions';

interface TeamWithRelations extends Team {
  seasons?: { name: string };
  clubs?: Club;
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

export default function TeamsPage() {
  const { t } = useLocaleTranslations();
  const [teams, setTeams] = useState<TeamWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      setError('Failed to load user roles');
      setLoading(false);
      return;
    }

    const platformAdmin = roles?.some((role) => role.role === 'admin' && role.club_id === null) || false;
    const clubAdmin = roles?.find((role) => (role.role === 'club_admin' || role.role === 'admin') && role.club_id !== null);

    let teamsQuery = supabase
      .from('teams')
      .select('*, seasons(name), clubs(id, name, short_name, logo_url, primary_color, secondary_color)')
      .order('name');

    if (!platformAdmin && clubAdmin?.club_id) {
      teamsQuery = teamsQuery.eq('club_id', clubAdmin.club_id);
    }

    const { data } = await teamsQuery;
    if (data) setTeams(data);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('trke_team_delete_confirm', 'Are you sure you want to delete this team? This will also delete all associated players and games.'))) {
      return;
    }

    const { error: deleteError } = await supabase.from('teams').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    loadData();
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-8 text-gray-900 dark:bg-gray-800 dark:text-gray-100">{t('trke_loading', 'Loading...')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <AdminNavbar />
      <div className="lg:pl-56">
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 px-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Teams</h1>
            <Link href="/admin/teams/new" className="inline-flex items-center gap-2 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('trke_add_team', 'Add team')}
            </Link>
          </div>
          {error && <div className="mb-4 px-4"><div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div></div>}
          <div className="px-4 py-6 sm:px-0">
            <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {teams.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No teams found</li>
                ) : (
                  teams.map((team) => (
                    <li key={team.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          {team.clubs && (
                            <ClubLogo
                              logoUrl={team.clubs.logo_url}
                              clubName={team.clubs.name}
                              size="sm"
                              className="!size-[50px] shrink-0"
                            />
                          )}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              <Link
                                href={`/admin/teams/${team.id}`}
                                className="text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                              >
                                {team.name}
                              </Link>
                              {team.fiba_short_name && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({team.fiba_short_name})</span>}
                            </h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {team.clubs?.name && <span>Club: {team.clubs.name} • </span>}
                              <span>Season: {team.seasons?.name || 'N/A'}</span>
                              {team.category && <span> • {TEAM_CATEGORIES.find((category) => category.value === team.category)?.label}</span>}
                              {team.gender && <span> • {TEAM_GENDERS.find((gender) => gender.value === team.gender)?.label}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <ViewLink href={`/admin/teams/${team.id}`} label={`${t('trke_view_players', 'View players')} ${team.name}`} />
                          <EditLink href={`/admin/teams/${team.id}?edit=1`} label={`${t('trke_edit', 'Edit')} ${team.name}`} />
                          <DeleteButton label={`${t('trke_delete', 'Delete')} ${team.name}`} onClick={() => handleDelete(team.id)} />
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
