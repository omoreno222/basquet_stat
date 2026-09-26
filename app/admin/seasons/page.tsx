'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Season } from '@/types/database';
import Link from 'next/link';

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
  });
  const [error, setError] = useState('');

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

  function resetForm() {
    setFormData({ name: '', start_date: '', end_date: '', is_active: false });
    setEditingSeason(null);
    setShowForm(false);
    setError('');
  }

  function handleEdit(season: Season) {
    setEditingSeason(season);
    setFormData({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      is_active: season.is_active,
    });
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (editingSeason) {
      const { error: updateError } = await supabase
        .from('seasons')
        .update(formData)
        .eq('id', editingSeason.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('seasons')
        .insert([formData]);

      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    resetForm();
    loadSeasons();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this season? This will also delete all associated teams, players, and games.')) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert(`Error: ${deleteError.message}`);
      return;
    }

    loadSeasons();
  }

  async function toggleActive(season: Season) {
    if (!season.is_active) {
      await supabase
        .from('seasons')
        .update({ is_active: false })
        .neq('id', season.id);
    }

    const { error: updateError } = await supabase
      .from('seasons')
      .update({ is_active: !season.is_active })
      .eq('id', season.id);

    if (updateError) {
      alert(`Error: ${updateError.message}`);
      return;
    }

    loadSeasons();
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
            <div className="flex items-center">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Add Season
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {showForm && (
          <div className="mb-6 px-4">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold mb-4">
                {editingSeason ? 'Edit Season' : 'Create Season'}
              </h2>
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Set as Active</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingSeason ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                      <div className="flex items-center gap-2">
                        {season.is_active && (
                          <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => toggleActive(season)}
                          className={`px-3 py-1 text-xs font-semibold rounded ${
                            season.is_active 
                              ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' 
                              : 'bg-green-200 hover:bg-green-300 text-green-800'
                          }`}
                        >
                          {season.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(season)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(season.id)}
                          className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Delete
                        </button>
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
  );
}
