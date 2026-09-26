'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Game, GameStatus } from '@/types/database';
import Link from 'next/link';

export default function GamesPage() {
  const [games, setGames] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [formData, setFormData] = useState({
    team_id: '',
    opponent_name: '',
    is_home: true,
    venue: '',
    game_date: '',
    status: 'scheduled' as GameStatus,
    official: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [gamesData, teamsData] = await Promise.all([
      supabase.from('games').select('*, teams(name, seasons(name))').order('game_date', { ascending: false }),
      supabase.from('teams').select('*, seasons(name)').order('name'),
    ]);

    if (gamesData.data) setGames(gamesData.data);
    if (teamsData.data) setTeams(teamsData.data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      team_id: '',
      opponent_name: '',
      is_home: true,
      venue: '',
      game_date: '',
      status: 'scheduled',
      official: true,
    });
    setEditingGame(null);
    setShowForm(false);
    setError('');
  }

  function handleEdit(game: any) {
    setEditingGame(game);
    const gameDate = new Date(game.game_date);
    const localDate = new Date(gameDate.getTime() - gameDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    
    setFormData({
      team_id: game.team_id,
      opponent_name: game.opponent_name,
      is_home: game.is_home,
      venue: game.venue || '',
      game_date: localDate,
      status: game.status,
      official: game.official ?? true,
    });
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const submitData = {
      ...formData,
      venue: formData.venue || null,
      game_date: new Date(formData.game_date).toISOString(),
    };

    if (editingGame) {
      const { error: updateError } = await supabase
        .from('games')
        .update(submitData)
        .eq('id', editingGame.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('games')
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
    if (!confirm('Are you sure you want to delete this game?')) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('games')
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
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Games</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Add Game
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
                {editingGame ? 'Edit Game' : 'Create Game'}
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
                      Opponent Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.opponent_name}
                      onChange={(e) => setFormData({ ...formData, opponent_name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Game Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.game_date}
                      onChange={(e) => setFormData({ ...formData, game_date: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue
                    </label>
                    <input
                      type="text"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="e.g. Main Sports Center"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as GameStatus })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_home}
                        onChange={(e) => setFormData({ ...formData, is_home: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Home Game</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.official}
                        onChange={(e) => setFormData({ ...formData, official: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Official Competition</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingGame ? 'Update' : 'Create'}
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
              {games.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No games found</li>
              ) : (
                games.map((game) => (
                  <li key={game.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {game.teams?.name} vs {game.opponent_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(game.game_date).toLocaleString()} - {game.venue || 'TBD'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {game.is_home ? 'Home' : 'Away'} · {game.official ? 'Official' : 'Friendly'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded uppercase ${
                          game.status === 'live' ? 'text-green-800 bg-green-100' :
                          game.status === 'final' ? 'text-gray-800 bg-gray-100' :
                          'text-blue-800 bg-blue-100'
                        }`}>
                          {game.status}
                        </span>
                        <button
                          onClick={() => handleEdit(game)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(game.id)}
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
