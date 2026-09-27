'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Team, Club, TeamCategory, TeamGender } from '@/types/database';
import Link from 'next/link';
import { ClubLogo } from '@/components/ClubLogo';

interface TeamWithRelations extends Team {
  seasons?: { name: string };
  clubs?: Club;
}

const TEAM_CATEGORIES: { value: TeamCategory; label: string }[] = [
  { value: 'premini', label: 'PreMini' },
  { value: 'mini', label: 'Mini' },
  { value: 'infantil', label: 'Infantil' },
  { value: 'cadete', label: 'Cadete' },
  { value: 'junior', label: 'Junior' },
  { value: 'sub22', label: 'Sub-22' },
  { value: 'senior', label: 'Senior' },
];

const TEAM_GENDERS: { value: TeamGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'mixed', label: 'Mixed' },
];

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithRelations[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    season_id: '',
    club_id: '',
    category: 'senior' as TeamCategory,
    gender: 'mixed' as TeamGender,
  });
  const [error, setError] = useState('');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userClubId, setUserClubId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user is platform admin or club admin
    const { data: roles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      console.error('Error loading roles:', rolesError);
      setError('Failed to load user roles');
      setLoading(false);
      return;
    }

    const platformAdmin = roles?.some(r => r.role === 'admin' && r.club_id === null) || false;
    const clubAdmin = roles?.find(r => (r.role === 'club_admin' || r.role === 'admin') && r.club_id !== null);

    setIsPlatformAdmin(platformAdmin);
    setUserClubId(clubAdmin?.club_id || null);

    // Load teams based on access
    let teamsQuery = supabase
      .from('teams')
      .select('*, seasons(name), clubs(id, name, short_name, logo_url, primary_color, secondary_color)')
      .order('name');

    if (!platformAdmin && clubAdmin?.club_id) {
      teamsQuery = teamsQuery.eq('club_id', clubAdmin.club_id);
    }

    const [teamsData, seasonsData, clubsData] = await Promise.all([
      teamsQuery,
      supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      platformAdmin 
        ? supabase.from('clubs').select('*').order('name')
        : clubAdmin?.club_id 
          ? supabase.from('clubs').select('*').eq('id', clubAdmin.club_id)
          : Promise.resolve({ data: [] }),
    ]);

    if (teamsData.data) setTeams(teamsData.data);
    if (seasonsData.data) setSeasons(seasonsData.data);
    if (clubsData.data) setClubs(clubsData.data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({ 
      name: '', 
      season_id: '', 
      club_id: userClubId || '',
      category: 'senior',
      gender: 'mixed',
    });
    setEditingTeam(null);
    setShowForm(false);
    setError('');
  }

  function handleEdit(team: TeamWithRelations) {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      season_id: team.season_id,
      club_id: team.club_id || '',
      category: team.category || 'senior',
      gender: team.gender || 'mixed',
    });
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const finalClubId = formData.club_id || userClubId || null;
    
    if (!finalClubId) {
      setError('Club is required. Please select a club.');
      return;
    }

    const submitData = {
      ...formData,
      club_id: finalClubId,
    };

    if (editingTeam) {
      // Don't allow changing club_id in edit mode
      if (submitData.club_id !== editingTeam.club_id) {
        setError('Cannot change team club. Delete and recreate the team if needed.');
        return;
      }
      
      const { error: updateError } = await supabase
        .from('teams')
        .update(submitData)
        .eq('id', editingTeam.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('teams')
        .insert([submitData]);

      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    resetForm();
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this team? This will also delete all associated players and games.')) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert(`Error: ${deleteError.message}`);
      return;
    }

    loadData();
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
              <h1 className="text-xl font-bold">Teams</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Add Team
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
                {editingTeam ? 'Edit Team' : 'Create Team'}
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
                      Team Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  {isPlatformAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Club *
                      </label>
                      <select
                        required
                        value={formData.club_id}
                        onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
                        disabled={!!editingTeam}
                        className={`w-full border rounded px-3 py-2 ${editingTeam ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Select a club</option>
                        {clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                      {editingTeam && (
                        <p className="text-xs text-gray-500 mt-1">
                          Club cannot be changed when editing a team
                        </p>
                      )}
                    </div>
                  )}
                  {!isPlatformAdmin && userClubId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Club
                      </label>
                      <input
                        type="text"
                        disabled
                        value={clubs.find(c => c.id === userClubId)?.name || ''}
                        className="w-full border rounded px-3 py-2 bg-gray-100"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as TeamCategory })}
                      className="w-full border rounded px-3 py-2"
                    >
                      {TEAM_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender *
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as TeamGender })}
                      className="w-full border rounded px-3 py-2"
                    >
                      {TEAM_GENDERS.map((gen) => (
                        <option key={gen.value} value={gen.value}>
                          {gen.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Season *
                    </label>
                    <select
                      required
                      value={formData.season_id}
                      onChange={(e) => setFormData({ ...formData, season_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select a season</option>
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name} {season.is_active && '(Active)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingTeam ? 'Update' : 'Create'}
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
              {teams.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No teams found</li>
              ) : (
                teams.map((team) => (
                  <li key={team.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {team.clubs && (
                          <ClubLogo 
                            logoUrl={team.clubs.logo_url} 
                            clubName={team.clubs.name} 
                            size="sm"
                          />
                        )}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{team.name}</h3>
                          <div className="text-sm text-gray-500">
                            {team.clubs?.name && <span>Club: {team.clubs.name} • </span>}
                            <span>Season: {team.seasons?.name || 'N/A'}</span>
                            {team.category && <span> • {TEAM_CATEGORIES.find(c => c.value === team.category)?.label}</span>}
                            {team.gender && <span> • {TEAM_GENDERS.find(g => g.value === team.gender)?.label}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(team)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(team.id)}
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
