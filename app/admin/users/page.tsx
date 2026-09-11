'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/database';
import Link from 'next/link';
import { createUser, updateUserRole, linkParentToPlayer, unlinkParentFromPlayer } from '../actions';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [parentLinks, setParentLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'player' as UserRole,
  });
  const [linkFormData, setLinkFormData] = useState({
    parent_id: '',
    player_id: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersData, playersData, linksData] = await Promise.all([
      supabase.from('profiles').select('*').order('email'),
      supabase.from('players').select('*').order('full_name'),
      supabase.from('parent_player_links').select('*, profiles(full_name, email), players(full_name, jersey_number)'),
    ]);

    if (usersData.data) setUsers(usersData.data);
    if (playersData.data) setPlayers(playersData.data);
    if (linksData.data) setParentLinks(linksData.data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({ email: '', password: '', full_name: '', role: 'player' });
    setEditingUser(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  }

  function handleEditRole(user: any) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      role: user.role,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (editingUser) {
      const result = await updateUserRole(editingUser.id, formData.role);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('User role updated successfully');
    } else {
      if (!formData.password || formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      const result = await createUser(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('User created successfully');
    }

    resetForm();
    loadData();
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const result = await linkParentToPlayer(linkFormData.parent_id, linkFormData.player_id);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Parent linked to player successfully');
    setLinkFormData({ parent_id: '', player_id: '' });
    setShowLinkForm(false);
    loadData();
  }

  async function handleUnlink(parentId: string, playerId: string) {
    if (!confirm('Are you sure you want to remove this parent-player link?')) {
      return;
    }

    const result = await unlinkParentFromPlayer(parentId, playerId);
    if (result.error) {
      alert(`Error: ${result.error}`);
      return;
    }

    loadData();
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const parentUsers = users.filter(u => u.role === 'parent');

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-blue-500 hover:text-blue-700 mr-4">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Users</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLinkForm(true)}
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Link Parent
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Add User
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
                {editingUser ? 'Edit User Role' : 'Create User'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!editingUser && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="admin">Admin</option>
                      <option value="team_manager">Team Manager</option>
                      <option value="coach">Coach</option>
                      <option value="parent">Parent</option>
                      <option value="player">Player</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingUser ? 'Update Role' : 'Create User'}
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

        {showLinkForm && (
          <div className="mb-6 px-4">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold mb-4">Link Parent to Player</h2>
              <form onSubmit={handleLinkSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parent *
                    </label>
                    <select
                      required
                      value={linkFormData.parent_id}
                      onChange={(e) => setLinkFormData({ ...linkFormData, parent_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select a parent</option>
                      {parentUsers.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.full_name || parent.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Player *
                    </label>
                    <select
                      required
                      value={linkFormData.player_id}
                      onChange={(e) => setLinkFormData({ ...linkFormData, player_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select a player</option>
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.jersey_number} {player.full_name}
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
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLinkForm(false);
                      setLinkFormData({ parent_id: '', player_id: '' });
                    }}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="px-4 py-6 sm:px-0 space-y-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h3 className="text-lg font-medium">All Users</h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <li className="px-6 py-4 text-gray-500">No users found</li>
              ) : (
                users.map((user) => (
                  <li key={user.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {user.full_name || user.email}
                        </h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-semibold text-purple-800 bg-purple-100 rounded uppercase">
                          {user.role}
                        </span>
                        <button
                          onClick={() => handleEditRole(user)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Edit Role
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {parentLinks.length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-medium">Parent-Player Links</h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {parentLinks.map((link: any) => (
                  <li key={link.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Parent: {link.profiles?.full_name || link.profiles?.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          Player: #{link.players?.jersey_number} {link.players?.full_name}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnlink(link.parent_id, link.player_id)}
                        className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Unlink
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
