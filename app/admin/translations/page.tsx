'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Translation } from '@/lib/types';
import { AdminNavbar } from '@/components/AdminNavbar';

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocale, setFilterLocale] = useState<string>('all');
  const [editingTranslation, setEditingTranslation] = useState<Translation | null>(null);
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

  function handleEdit(translation: Translation) {
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
    
    if (!editingTranslation) {
      setError('No translation selected');
      return;
    }
    
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
    return <div className="min-h-screen bg-gray-100 p-8 text-gray-900 dark:bg-gray-800 dark:text-gray-100">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <AdminNavbar />

      <div className="lg:pl-56">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4 px-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Translations</h1>
          <select
            value={filterLocale}
            onChange={(e) => setFilterLocale(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/20 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="all">All Languages</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="ca">Català</option>
          </select>
        </div>
        {error && (
          <div className="mb-4 px-4">
            <div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          </div>
        )}

        <div className="px-4 py-6 sm:px-0">
          <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
            <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-900">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {uniqueKeys.length} unique translation keys · {translations.length} total translations
              </p>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredTranslations.length === 0 ? (
                <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No translations found</li>
              ) : (
                filteredTranslations.map((trans) => (
                  <li key={trans.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                    {editingTranslation?.id === trans.id ? (
                      <div>
                        <div className="mb-2">
                          <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{trans.key}</span>
                          <span className="ml-2 rounded bg-indigo-100 px-2 py-1 text-xs font-semibold uppercase text-indigo-800 dark:bg-indigo-300 dark:text-indigo-950">
                            {trans.locale}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-white/20 dark:bg-gray-950 dark:text-gray-100"
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
                          <h3 className="font-mono text-sm text-gray-900 dark:text-gray-100">{trans.key}</h3>
                          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{trans.value}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold uppercase text-indigo-800 dark:bg-indigo-300 dark:text-indigo-950">
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
    </div>
  );
}
