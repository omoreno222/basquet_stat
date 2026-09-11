'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocale, setFilterLocale] = useState<string>('all');

  useEffect(() => {
    loadTranslations();
  }, []);

  async function loadTranslations() {
    const { data } = await supabase
      .from('translations')
      .select('*')
      .order('key');

    if (data) {
      setTranslations(data);
    }
    setLoading(false);
  }

  const filteredTranslations = filterLocale === 'all' 
    ? translations 
    : translations.filter(t => t.locale === filterLocale);

  const uniqueKeys = [...new Set(translations.map(t => t.key))];

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
              <h1 className="text-xl font-bold">Translations</h1>
            </div>
            <div className="flex items-center">
              <select
                value={filterLocale}
                onChange={(e) => setFilterLocale(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ca">Català</option>
              </select>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="p-4 bg-gray-50 border-b">
              <p className="text-sm text-gray-600">
                {uniqueKeys.length} unique translation keys
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {filteredTranslations.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No translations found</li>
              ) : (
                filteredTranslations.map((trans) => (
                  <li key={trans.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-mono text-gray-900">{trans.key}</h3>
                        <p className="text-sm text-gray-700 mt-1">{trans.value}</p>
                      </div>
                      <span className="ml-4 px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 rounded uppercase">
                        {trans.locale}
                      </span>
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
