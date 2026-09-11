'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PlayerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
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

    if (!profileData || profileData.role !== 'player') {
      router.push('/login');
      return;
    }

    setProfile(profileData);
    await loadPlayerData(user.id);
    setLoading(false);
  }

  async function loadPlayerData(userId: string) {
    const { data } = await supabase
      .from('players')
      .select('*, teams(name)')
      .eq('user_id', userId)
      .single();

    if (data) {
      setPlayerData(data);
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
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold">BasquetStat - Player</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {profile.full_name || profile.email}</span>
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
          {playerData ? (
            <>
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-lg font-medium">{playerData.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Jersey Number</p>
                    <p className="text-lg font-medium">#{playerData.jersey_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Position</p>
                    <p className="text-lg font-medium">{playerData.position || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Team</p>
                    <p className="text-lg font-medium">{playerData.teams?.name}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Your Statistics</h2>
                <p className="text-gray-500">Statistics will appear here after games are played</p>
              </div>
            </>
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <p className="text-gray-500">No player profile linked to this account</p>
            </div>
          )}
          
          <div className="mt-6 bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-green-800">
              Player view: Read-only access to your own statistics only (RLS enforced)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
