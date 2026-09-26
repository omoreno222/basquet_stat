'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Player, Team } from '@/types/database';
import Link from 'next/link';
import Image from 'next/image';
import { uploadPlayerAvatar, removePlayerAvatar } from '../actions';

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    jersey_number: '',
    team_id: '',
    position: '',
    date_of_birth: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [playersData, teamsData] = await Promise.all([
      supabase.from('players').select('*, teams(name, seasons(name))').order('full_name'),
      supabase.from('teams').select('*, seasons(name)').order('name'),
    ]);

    if (playersData.data) setPlayers(playersData.data);
    if (teamsData.data) setTeams(teamsData.data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({ full_name: '', jersey_number: '', team_id: '', position: '', date_of_birth: '' });
    setEditingPlayer(null);
    setShowForm(false);
    setError('');
  }

  function handleEdit(player: any) {
    setEditingPlayer(player);
    setFormData({
      full_name: player.full_name,
      jersey_number: player.jersey_number.toString(),
      team_id: player.team_id,
      position: player.position || '',
      date_of_birth: player.date_of_birth || '',
    });
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const submitData = {
      ...formData,
      jersey_number: parseInt(formData.jersey_number),
      position: formData.position || null,
      date_of_birth: formData.date_of_birth || null,
    };

    if (editingPlayer) {
      const { error: updateError } = await supabase
        .from('players')
        .update(submitData)
        .eq('id', editingPlayer.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('players')
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
    if (!confirm('Are you sure you want to delete this player?')) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert(`Error: ${deleteError.message}`);
      return;
    }

    loadData();
  }

  async function handleAvatarUpload(playerId: string, file: File) {
    setUploadingAvatar(playerId);
    setError('');
    setSuccess('');

    const result = await uploadPlayerAvatar(playerId, file);
    setUploadingAvatar(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Avatar uploaded successfully');
    loadData();
  }

  async function handleAvatarRemove(playerId: string) {
    if (!confirm('Are you sure you want to remove this avatar?')) {
      return;
    }

    setError('');
    setSuccess('');

    const result = await removePlayerAvatar(playerId);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Avatar removed successfully');
    loadData();
  }

  function triggerFileInput(playerId: string) {
    fileInputRefs.current[playerId]?.click();
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
              <h1 className="text-xl font-bold">Players</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      </nav>

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
                {editingPlayer ? 'Edit Player' : 'Create Player'}
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
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Jersey Number *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="99"
                      value={formData.jersey_number}
                      onChange={(e) => setFormData({ ...formData, jersey_number: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team *
                    </label>
                    <select
                      required
                      value={formData.team_id}
                      onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select a team</option>
                      {teams.map((team: any) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.seasons?.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Position
                    </label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="e.g. Guard, Forward"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingPlayer ? 'Update' : 'Create'}
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
              {players.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No players found</li>
              ) : (
                players.map((player) => (
                  <li key={player.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {player.avatar_url ? (
                            <Image
                              src={player.avatar_url}
                              alt={player.full_name}
                              width={48}
                              height={48}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 text-lg font-medium">
                                {player.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            #{player.jersey_number} {player.full_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Team: {player.teams?.name || 'N/A'}
                          </p>
                          {player.position && (
                            <p className="text-sm text-gray-500">
                              Position: {player.position}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={(el) => (fileInputRefs.current[player.id] = el)}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAvatarUpload(player.id, file);
                          }}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                        />
                        <button
                          onClick={() => triggerFileInput(player.id)}
                          disabled={uploadingAvatar === player.id}
                          className="bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap disabled:opacity-50"
                        >
                          {uploadingAvatar === player.id ? 'Uploading...' : player.avatar_url ? 'Change Photo' : 'Add Photo'}
                        </button>
                        {player.avatar_url && (
                          <button
                            onClick={() => handleAvatarRemove(player.id)}
                            className="bg-orange-500 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(player)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(player.id)}
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
