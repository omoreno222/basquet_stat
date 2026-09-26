'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Locale } from '@/types/database';
import Link from 'next/link';

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocale, setFilterLocale] = useState<string>('all');
  const [editingTranslation, setEditingTranslation] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

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

  function handleEdit(translation: any) {
    setEditingTranslation(translation);
    setEditValue(translation.value);
    setError('');
  }

  function cancelEdit() {
    setEditingTranslation(null);
    setEditValue('');
    setError('');
  }

  async function handleSave() {
    setError('');
    
    if (!editValue.trim()) {
      setError('Value cannot be empty');
      return;
    }

    const { error: updateError } = await supabase
      .from('translations')
      .update({ value: editValue })
      .eq('id', editingTranslation.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    cancelEdit();
    loadTranslations();
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
        {error && (
          <div className="mb-4 px-4">
            <div className="p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          </div>
        )}

        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="p-4 bg-gray-50 border-b">
              <p className="text-sm text-gray-600">
                {uniqueKeys.length} unique translation keys · {translations.length} total translations
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {filteredTranslations.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No translations found</li>
              ) : (
                filteredTranslations.map((trans) => (
                  <li key={trans.id} className="px-6 py-4 hover:bg-gray-50">
                    {editingTranslation?.id === trans.id ? (
                      <div>
                        <div className="mb-2">
                          <span className="text-sm font-mono text-gray-900">{trans.key}</span>
                          <span className="ml-2 px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 rounded uppercase">
                            {trans.locale}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 border rounded px-3 py-2"
                            autoFocus
                          />
                          <button
                            onClick={handleSave}
                            className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-mono text-gray-900">{trans.key}</h3>
                          <p className="text-sm text-gray-700 mt-1">{trans.value}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 rounded uppercase">
                            {trans.locale}
                          </span>
                          <button
                            onClick={() => handleEdit(trans)}
                            className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
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
