'use client';

import { ClubLogo } from '@/components/ClubLogo';

export default function AdminClubsDemoPage() {
  const clubs = [
    { id: '1', name: 'SeasonMath Demo Club', short_name: 'SMC', logo_url: '/images/seasonmath-logo.png', teams_count: 5 },
    { id: '2', name: 'Barcelona Basketball', short_name: 'FCB', logo_url: null, teams_count: 12 },
    { id: '3', name: 'Real Madrid Baloncesto', short_name: 'RMB', logo_url: null, teams_count: 10 },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Clubs</h1>
          <button className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold">
            + New Club
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <div key={club.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500 transition-colors">
              <div className="flex items-start gap-4">
                <ClubLogo
                  logoUrl={club.logo_url}
                  clubName={club.name}
                  size="lg"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{club.name}</h3>
                  <p className="text-sm text-gray-400 mb-3">{club.short_name}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">{club.teams_count} teams</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium">
                  Edit
                </button>
                <button className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium">
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
