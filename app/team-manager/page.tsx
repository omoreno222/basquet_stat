'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChartColumn } from 'lucide-react';
import { SeasonMathLogo } from '@/components/SeasonMathLogo';
import { Profile, Game } from '@/lib/types';
import { Club } from '@/types/database';
import { ClubLogo } from '@/components/ClubLogo';
import { TeamManagerNavPills } from '@/components/NavPills';
import { userManagesClub } from '@/lib/live-access';
import { useLocaleTranslations } from '@/lib/use-locale-translations';

interface GameWithTeam extends Game {
  teams?: { 
    id: string; 
    name: string; 
    category: string; 
    season: string; 
    created_at: string;
    clubs?: Club;
  };
}

export default function TeamManagerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<{ role: string; club_id: string | null }[]>([]);
  const [games, setGames] = useState<GameWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useLocaleTranslations();

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

    // Check if user has team_manager or admin role (multi-role support)
    const { data: userRoles } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    setRoles(userRoles ?? []);
    const roles = userRoles?.map(r => r.role) || [profileData.role];
    const hasAccess = roles.includes('team_manager') || roles.includes('admin');

    if (!hasAccess) {
      router.push('/login');
      return;
    }

    setProfile(profileData);
    await loadGames();
    setLoading(false);
  }, [router]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  async function loadGames() {
    const { data } = await supabase
      .from('games')
      .select('*, teams(name, clubs(id, name, short_name, logo_url, primary_color, secondary_color))')
      .order('game_date', { ascending: false });

    if (data) {
      setGames(data);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-brand dark:bg-brand-dark text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center space-x-3">
              <SeasonMathLogo width={120} height={120} className="h-10 w-auto" />
              <span className="font-display text-lg font-semibold text-white">Team Manager</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {profile?.full_name || profile?.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <TeamManagerNavPills />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-2xl font-bold mb-4">Games</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {games.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No games available</li>
              ) : (
                games.map((game) => (
                  <li key={game.id} className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50">
                    <Link href={`/team-manager/games/${game.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          {game.teams?.clubs && (
                            <ClubLogo 
                              logoUrl={game.teams.clubs.logo_url} 
                              clubName={game.teams.clubs.name} 
                              size="sm"
                            />
                          )}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {game.teams?.name} vs {game.opponent_name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(game.game_date).toLocaleDateString()} - {game.venue || 'TBD'}
                            </p>
                            <p className="text-sm text-gray-500">
                              Score: {game.team_score} - {game.opponent_score}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-semibold rounded uppercase ${
                            game.status === 'live' ? 'text-green-800 bg-green-100' :
                            game.status === 'final' ? 'text-gray-800 bg-gray-100' :
                            'text-blue-800 bg-blue-100'
                          }`}>
                            {game.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <Link
                      href={`/games/eval/${game.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      {t('trke_eval_open', 'Evaluation')}
                    </Link>
                    {userManagesClub(roles, game.teams?.clubs?.id ?? null) ? (
                      <Link
                        href={`/team-manager/games/live/${game.id}`}
                        aria-label={t('trke_capture_open', 'Open the court')}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 dark:border-white/20 dark:bg-gray-950 dark:text-gray-100"
                      >
                        <ChartColumn className="h-5 w-5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
