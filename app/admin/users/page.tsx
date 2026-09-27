'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { UserRole, Club } from '@/types/database';
import Link from 'next/link';
import Image from 'next/image';
import { createUserWithPassword, resetUserPassword } from '@/lib/password-auth';
import { updateUserRoles, linkParentToPlayer, unlinkParentFromPlayer, uploadProfileAvatar, removeProfileAvatar, linkPlayerAccount, unlinkPlayerAccount } from '../actions';
import { AdminNavPills } from '@/components/NavPills';
import { Player } from '@/lib/types';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  roles?: UserRole[];
  club_id?: string | null;
  avatar_url: string | null;
  clubs?: Club;
}

interface PlayerWithTeam extends Player {
  user_id?: string | null;
  teams?: { name: string };
  profiles?: { email: string; full_name: string | null };
}

interface ParentLink {
  id: string;
  parent_id: string;
  player_id: string;
  players?: PlayerWithTeam;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [players, setPlayers] = useState<PlayerWithTeam[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showPlayerLinkForm, setShowPlayerLinkForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    roles: ['player'] as UserRole[],
    club_id: '',
  });
  const [linkFormData, setLinkFormData] = useState({
    parent_id: '',
    player_id: '',
  });
  const [playerLinkFormData, setPlayerLinkFormData] = useState({
    player_id: '',
    user_id: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userClubId, setUserClubId] = useState<string | null>(null);

  const availableRoles: UserRole[] = ['admin', 'club_admin', 'team_manager', 'coach', 'parent', 'player'];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user is platform admin or club admin
    const { data: currentUserRoles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      console.error('Error loading roles:', rolesError);
      setError('Failed to load user roles');
      setLoading(false);
      return;
    }

    const platformAdmin = currentUserRoles?.some(r => r.role === 'admin' && r.club_id === null) || false;
    const clubAdminRole = currentUserRoles?.find(r => (r.role === 'club_admin' || r.role === 'admin') && r.club_id !== null);

    setIsPlatformAdmin(platformAdmin);
    setUserClubId(clubAdminRole?.club_id || null);

    // Load users with their profile_roles
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('email');

    // Load profile_roles for each user (with club info)
    const { data: rolesData } = await supabase
      .from('profile_roles')
      .select('profile_id, role, club_id, clubs(id, name, short_name, logo_url, primary_color, secondary_color)');

    // Merge roles into users and filter by club if needed
    const usersWithRoles = usersData?.map(u => {
      const userRoles = rolesData?.filter(r => r.profile_id === u.id) || [];
      const primaryRole = userRoles[0];
      return {
        ...u,
        roles: userRoles.map(r => r.role) || [u.role],
        club_id: primaryRole?.club_id || null,
        clubs: primaryRole?.clubs || null,
      } as UserWithRoles;
    }).filter(u => {
      // Filter by club if not platform admin
      if (platformAdmin) return true;
      if (!clubAdminRole?.club_id) return false;
      return u.club_id === clubAdminRole.club_id;
    }) || [];

    setUsers(usersWithRoles);

    // Load clubs
    const clubsQuery = platformAdmin
      ? supabase.from('clubs').select('*').order('name')
      : clubAdminRole?.club_id
        ? supabase.from('clubs').select('*').eq('id', clubAdminRole.club_id)
        : null;

    if (clubsQuery) {
      const { data: clubsData } = await clubsQuery;
      if (clubsData) setClubs(clubsData);
    }

    // Load other data (filter players by club if needed)
    let playersQuery = supabase
      .from('players')
      .select('*, teams(name), profiles(email, full_name)')
      .order('full_name');

    if (!platformAdmin && clubAdminRole?.club_id) {
      playersQuery = playersQuery.eq('club_id', clubAdminRole.club_id);
    }

    const [playersData, linksData] = await Promise.all([
      playersQuery,
      supabase.from('parent_player_links').select('*, profiles(full_name, email), players(full_name, jersey_number)'),
    ]);

    if (playersData.data) setPlayers(playersData.data);
    if (linksData.data) setParentLinks(linksData.data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({ 
      email: '', 
      full_name: '', 
      roles: ['player'],
      club_id: userClubId || '',
    });
    setEditingUser(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  }

  function handleEditRole(user: UserWithRoles) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      roles: user.roles || [user.role],
      // Default to empty (force explicit choice) or current club being managed
      club_id: isPlatformAdmin ? '' : (userClubId || ''),
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function toggleRole(role: UserRole) {
    setFormData(prev => {
      const roles = prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.roles.length === 0) {
      setError('At least one role must be selected');
      return;
    }

    if (editingUser) {
      const result = await updateUserRoles(editingUser.id, formData.roles, formData.club_id || null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess('User roles updated successfully');
    } else {
      const result = await createUserWithPassword({ 
        email: formData.email,
        full_name: formData.full_name,
        role: formData.roles[0],
        roles: formData.roles,
        club_id: formData.club_id || null,
      });
      if (result.error) {
        setError(result.error);
        if (result.emailFailed) {
          setSuccess('User created but email failed. Use Reset Password button to send credentials.');
        }
        return;
      }
      setSuccess('User created successfully. Welcome email sent with temporary password.');
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

  async function handleResetPassword(user: UserWithRoles) {
    if (!confirm(`Reset password for ${user.full_name || user.email}? They will receive an email with a temporary password.`)) {
      return;
    }

    setError('');
    setSuccess('');

    const result = await resetUserPassword(user.id, user.club_id);
    if (result.error) {
      setError(result.error);
      if (result.emailFailed) {
        setSuccess('Password reset but email failed. Try again.');
      }
      return;
    }

    setSuccess(`Password reset email sent to ${user.email}`);
  }

  async function handlePlayerLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const result = await linkPlayerAccount(playerLinkFormData.player_id, playerLinkFormData.user_id);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Player account linked successfully');
    setPlayerLinkFormData({ player_id: '', user_id: '' });
    setShowPlayerLinkForm(false);
    loadData();
  }

  async function handlePlayerUnlink(playerId: string) {
    if (!confirm('Are you sure you want to unlink this player account?')) {
      return;
    }

    const result = await unlinkPlayerAccount(playerId);
    if (result.error) {
      alert(`Error: ${result.error}`);
      return;
    }

    loadData();
  }

  async function handleAvatarUpload(userId: string, file: File) {
    setUploadingAvatar(userId);
    setError('');
    setSuccess('');

    const result = await uploadProfileAvatar(userId, file);
    setUploadingAvatar(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Avatar uploaded successfully');
    loadData();
  }

  async function handleAvatarRemove(userId: string) {
    if (!confirm('Are you sure you want to remove this avatar?')) {
      return;
    }

    setError('');
    setSuccess('');

    const result = await removeProfileAvatar(userId);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Avatar removed successfully');
    loadData();
  }

  function triggerFileInput(userId: string) {
    fileInputRefs.current[userId]?.click();
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  // Filter users who have the parent role (multi-role support)
  const parentUsers = users.filter(u => u.roles?.includes('parent') || u.role === 'parent');

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-brand dark:bg-brand-dark text-white shadow-sm">
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
                onClick={() => setShowPlayerLinkForm(true)}
                className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
              >
                Link Player Account
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
                {editingUser ? 'Edit User Roles' : 'Create User'}
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
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      {isPlatformAdmin && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Club
                          </label>
                          <select
                            value={formData.club_id}
                            onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
                            className="w-full border rounded px-3 py-2"
                          >
                            <option value="">No club (platform admin only)</option>
                            {clubs.map((club) => (
                              <option key={club.id} value={club.id}>
                                {club.name}
                              </option>
                            ))}
                          </select>
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
                    </>
                  )}
                  {editingUser && isPlatformAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Club
                      </label>
                      <select
                        value={formData.club_id}
                        onChange={(e) => setFormData({ ...formData, club_id: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="">No club (admin role only)</option>
                        {clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Club for non-admin roles. Admin role ignores this setting.
                      </p>
                    </div>
                  )}
                  {editingUser && !isPlatformAdmin && userClubId && (
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
                      Roles * (select at least one)
                    </label>
                    <div className="space-y-2 border rounded px-3 py-2">
                      {availableRoles.map((role) => (
                        <label key={role} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.roles.includes(role)}
                            onChange={() => toggleRole(role)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm capitalize">
                            {role.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingUser ? 'Update Roles' : 'Create User'}
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

        {showPlayerLinkForm && (
          <div className="mb-6 px-4">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold mb-4">Link Player to User Account</h2>
              <p className="text-sm text-gray-600 mb-4">
                Link a player record to a user account. This allows the player to log in and see their own stats and their team&apos;s data.
              </p>
              <form onSubmit={handlePlayerLinkSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Player *
                    </label>
                    <select
                      required
                      value={playerLinkFormData.player_id}
                      onChange={(e) => setPlayerLinkFormData({ ...playerLinkFormData, player_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select a player</option>
                      {players.map((player) => {
                        const team = (player as PlayerWithTeam).teams;
                        return (
                          <option key={player.id} value={player.id}>
                            #{player.jersey_number} {player.full_name} ({team?.name || 'No team'})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Account *
                    </label>
                    <select
                      required
                      value={playerLinkFormData.user_id}
                      onChange={(e) => setPlayerLinkFormData({ ...playerLinkFormData, user_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select a user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email}
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
                      setShowPlayerLinkForm(false);
                      setPlayerLinkFormData({ player_id: '', user_id: '' });
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
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.full_name || user.email}
                              width={48}
                              height={48}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 text-lg font-medium">
                                {(user.full_name || user.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {user.full_name || user.email}
                          </h3>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((role) => (
                            <span 
                              key={role}
                              className="px-2 py-1 text-xs font-semibold text-purple-800 bg-purple-100 rounded uppercase"
                            >
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[user.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAvatarUpload(user.id, file);
                          }}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                        />
                        <button
                          onClick={() => triggerFileInput(user.id)}
                          disabled={uploadingAvatar === user.id}
                          className="bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap disabled:opacity-50"
                        >
                          {uploadingAvatar === user.id ? 'Uploading...' : user.avatar_url ? 'Change Photo' : 'Add Photo'}
                        </button>
                        {user.avatar_url && (
                          <button
                            onClick={() => handleAvatarRemove(user.id)}
                            className="bg-orange-500 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          onClick={() => handleEditRole(user)}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
                        >
                          Edit Roles
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="bg-yellow-500 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
                        >
                          Reset Password
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
                {parentLinks.map((link) => (
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

          {players.filter(p => p.user_id).length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-medium">Player Account Links</h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {players.filter(p => p.user_id).map((player) => {
                  const linkedProfile = (player as PlayerWithTeam).profiles;
                  const team = (player as PlayerWithTeam).teams;
                  return (
                    <li key={player.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Player: #{player.jersey_number} {player.full_name}
                            {team && ` (${team.name})`}
                          </p>
                          <p className="text-sm text-gray-500">
                            Account: {linkedProfile?.full_name || linkedProfile?.email || player.user_id}
                          </p>
                        </div>
                        <button
                          onClick={() => handlePlayerUnlink(player.id)}
                          className="bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Unlink
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
