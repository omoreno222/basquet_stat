'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ClubLogo } from '@/components/ClubLogo';
import { uploadClubLogo, removeClubLogo } from '../actions';
import { AdminNavPills } from '@/components/NavPills';

interface Club {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    primary_color: '#1e40af',
    secondary_color: '#f97316',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from('clubs')
      .select('*')
      .order('name');

    if (data) setClubs(data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({ name: '', short_name: '', primary_color: '#1e40af', secondary_color: '#f97316' });
    setEditingClub(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  }

  function handleEdit(club: Club) {
    setEditingClub(club);
    setFormData({
      name: club.name,
      short_name: club.short_name || '',
      primary_color: club.primary_color,
      secondary_color: club.secondary_color,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const submitData = {
      ...formData,
      short_name: formData.short_name || null,
    };

    if (editingClub) {
      const { error: updateError } = await supabase
        .from('clubs')
        .update(submitData)
        .eq('id', editingClub.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess('Club updated successfully');
    } else {
      const { error: insertError } = await supabase
        .from('clubs')
        .insert([submitData]);

      if (insertError) {
        setError(insertError.message);
        return;
      }
      setSuccess('Club created successfully');
    }

    resetForm();
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this club? This will also delete all associated teams, players, and games.')) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('clubs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert(`Error: ${deleteError.message}`);
      return;
    }

    loadData();
  }

  async function handleLogoUpload(clubId: string, file: File) {
    setUploadingLogo(clubId);
    setError('');
    setSuccess('');

    const result = await uploadClubLogo(clubId, file);
    setUploadingLogo(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Logo uploaded successfully');
    loadData();
  }

  async function handleLogoRemove(clubId: string) {
    if (!confirm('Are you sure you want to remove this logo?')) {
      return;
    }

    setError('');
    setSuccess('');

    const result = await removeClubLogo(clubId);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Logo removed successfully');
    loadData();
  }

  function triggerFileInput(clubId: string) {
    fileInputRefs.current[clubId]?.click();
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-brand dark:bg-brand-dark text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Clubs</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Add Club
              </button>
            </div>
          </div>
        </div>
      </nav>
      <AdminNavPills />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {(error || success) && (
          <div className="mb-4 px-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-100 text-green-700 rounded">
                {success}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="mb-6 px-4">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold mb-4">
                {editingClub ? 'Edit Club' : 'Create Club'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Club Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Junior Warriors Basketball Club"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Short Name
                    </label>
                    <input
                      type="text"
                      value={formData.short_name}
                      onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="JWB"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Color
                    </label>
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Color
                    </label>
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-10"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingClub ? 'Update' : 'Create'}
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
              {clubs.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No clubs found</li>
              ) : (
                clubs.map((club) => (
                  <li key={club.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <ClubLogo 
                          logoUrl={club.logo_url} 
                          clubName={club.name} 
                          size="md"
                        />
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {club.name}
                            {club.short_name && (
                              <span className="ml-2 text-sm text-gray-500">({club.short_name})</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Primary:</span>
                              <div 
                                className="w-6 h-6 rounded border border-gray-300" 
                                style={{ backgroundColor: club.primary_color }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Secondary:</span>
                              <div 
                                className="w-6 h-6 rounded border border-gray-300" 
                                style={{ backgroundColor: club.secondary_color }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[club.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(club.id, file);
                          }}
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          className="hidden"
                        />
                        <button
                          onClick={() => triggerFileInput(club.id)}
                          disabled={uploadingLogo === club.id}
                          className="bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap disabled:opacity-50"
                        >
                          {uploadingLogo === club.id ? 'Uploading...' : club.logo_url ? 'Change Logo' : 'Add Logo'}
                        </button>
                        {club.logo_url && (
                          <button
                            onClick={() => handleLogoRemove(club.id)}
                            className="bg-orange-500 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(club)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(club.id)}
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
