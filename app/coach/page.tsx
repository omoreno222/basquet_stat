'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Profile, Player } from '@/lib/types';

interface PlayerWithTeam extends Player {
  teams?: { name: string };
}

export default function CoachDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [players, setPlayers] = useState<PlayerWithTeam[]>([]);
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

    // Check if user has coach role (multi-role support)
    const { data: userRoles } = await supabase
      .from('profile_roles')
      .select('role')
      .eq('profile_id', user.id);

    const roles = userRoles?.map(r => r.role) || [profileData.role];
    const hasCoachRole = roles.includes('coach');

    if (!hasCoachRole) {
      router.push('/login');
      return;
    }

    setProfile(profileData);
    await loadPlayers();
    setLoading(false);
  }, [router]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*, teams(name)')
      .order('jersey_number');

    if (data) {
      setPlayers(data);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
              <Image 
                src="/images/seasonmath-logo.png" 
                alt="SeasonMath" 
                width={120} 
                height={120}
                className="h-10 w-auto"
              />
              <span className="text-lg font-semibold text-white">Coach</span>
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

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-2xl font-bold mb-4">Team Roster</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {players.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No players found</li>
              ) : (
                players.map((player) => (
                  <li key={player.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          #{player.jersey_number} {player.full_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {player.position || 'No position'} - {player.teams?.name}
                        </p>
                      </div>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        View Stats
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
          
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-yellow-800">
              Coach view: Read-only access to all players and team statistics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
