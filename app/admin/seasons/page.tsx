'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Season } from '@/types/database';
import Link from 'next/link';

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeasons();
  }, []);

  async function loadSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });

    if (data) {
      setSeasons(data);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Seasons</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {seasons.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No seasons found</li>
              ) : (
                seasons.map((season) => (
                  <li key={season.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{season.name}</h3>
                        <p className="text-sm text-gray-500">
                          {season.start_date} to {season.end_date}
                        </p>
                      </div>
                      {season.is_active && (
                        <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                          Active
                        </span>
                      )}
                    </div>
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
