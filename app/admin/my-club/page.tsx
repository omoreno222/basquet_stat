'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ClubLogo } from '@/components/ClubLogo';
import { uploadClubLogo, removeClubLogo } from '../actions';

interface Club {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

export default function MyClubPage() {
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    primary_color: '#1e40af',
    secondary_color: '#f97316',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase
      .from('profile_roles')
      .select('club_id')
      .eq('user_id', user.id)
      .in('role', ['club_admin', 'admin'])
      .single();

    if (!roles || !roles.club_id) {
      setError('No club assigned');
      setLoading(false);
      return;
    }

    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', roles.club_id)
      .single();

    if (clubData) {
      setClub(clubData);
      setFormData({
        name: clubData.name,
        short_name: clubData.short_name || '',
        primary_color: clubData.primary_color,
        secondary_color: clubData.secondary_color,
      });
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!club) return;

    setError('');
    setSuccess('');
    setSaving(true);

    const submitData = {
      name: formData.name,
      short_name: formData.short_name || null,
      primary_color: formData.primary_color,
      secondary_color: formData.secondary_color,
    };

    const { error: updateError } = await supabase
      .from('clubs')
      .update(submitData)
      .eq('id', club.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess('Club settings updated successfully');
    loadData();
  }

  async function handleLogoUpload(file: File) {
    if (!club) return;

    setUploadingLogo(true);
    setError('');
    setSuccess('');

    const result = await uploadClubLogo(club.id, file);
    setUploadingLogo(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Logo uploaded successfully');
    loadData();
  }

  async function handleLogoRemove() {
    if (!club) return;

    if (!confirm('Are you sure you want to remove the logo?')) {
      return;
    }

    setError('');
    setSuccess('');

    const result = await removeClubLogo(club.id);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Logo removed successfully');
    loadData();
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
                  ← Back
                </Link>
                <h1 className="text-xl font-bold">My Club</h1>
              </div>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white shadow rounded-lg p-6">
              <p className="text-gray-600">{error || 'No club found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
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
              <h1 className="text-xl font-bold">My Club</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
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

        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4">Club Logo</h2>
              <div className="flex items-center gap-4">
                <ClubLogo 
                  logoUrl={club.logo_url} 
                  clubName={club.name} 
                  size="lg"
                />
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    {uploadingLogo ? 'Uploading...' : club.logo_url ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {club.logo_url && (
                    <button
                      onClick={handleLogoRemove}
                      className="bg-orange-500 hover:bg-orange-700 text-white px-4 py-2 rounded"
                    >
                      Remove Logo
                    </button>
                  )}
                  <p className="text-xs text-gray-500">
                    Accepts PNG, JPG, WebP, or SVG (max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <h2 className="text-lg font-bold mb-4">Club Details</h2>
              <div className="space-y-4">
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
                  <p className="text-xs text-gray-500 mt-1">
                    Optional short abbreviation (max 10 characters)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-16 h-10 border rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="flex-1 border rounded px-3 py-2 font-mono text-sm"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-16 h-10 border rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="flex-1 border rounded px-3 py-2 font-mono text-sm"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
