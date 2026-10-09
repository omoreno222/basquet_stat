'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/database';
import { getRoleBadgeClasses, getRoleTranslationKey } from '@/lib/profile-utils';
import { AdminNavbar } from '@/components/AdminNavbar';
import { useLocaleTranslations } from '@/lib/use-locale-translations';
import { linkParentToPlayer, linkPlayerAccount, unlinkParentFromPlayer, unlinkPlayerAccount } from '../actions';
import { EditLink } from '../row-actions';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  roles?: UserRole[];
  club_id?: string | null;
  avatar_url: string | null;
}

interface PlayerWithTeam {
  id: string;
  full_name: string;
  jersey_number: number;
  user_id?: string | null;
  teams?: { name: string };
  profiles?: { email: string; full_name: string | null };
}

interface ParentLink {
  id: string;
  parent_id: string;
  player_id: string;
  players?: { full_name: string; jersey_number: number };
  profiles?: { full_name: string | null; email: string };
}

export default function UsersPage() {
  const { t } = useLocaleTranslations();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [players, setPlayers] = useState<PlayerWithTeam[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showPlayerLinkForm, setShowPlayerLinkForm] = useState(false);
  const [linkFormData, setLinkFormData] = useState({ parent_id: '', player_id: '' });
  const [playerLinkFormData, setPlayerLinkFormData] = useState({ player_id: '', user_id: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);
    if (params.get('emailFailed') === '1') {
      setSuccess('User created but email failed. Use Reset Password to send credentials.');
      params.delete('emailFailed');
      const next = params.toString();
      window.history.replaceState(null, '', next ? `/admin/users?${next}` : '/admin/users');
    }
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: currentUserRoles, error: rolesError } = await supabase
      .from('profile_roles')
      .select('role, club_id')
      .eq('profile_id', user.id);

    if (rolesError) {
      setError('Failed to load user roles');
      setLoading(false);
      return;
    }

    const platformAdmin = currentUserRoles?.some((role) => role.role === 'admin' && role.club_id === null) || false;
    const clubAdminRole = currentUserRoles?.find((role) => (role.role === 'club_admin' || role.role === 'admin') && role.club_id !== null);

    const { data: usersData } = await supabase.from('profiles').select('*').order('email');
    const { data: rolesData } = await supabase
      .from('profile_roles')
      .select('profile_id, role, club_id, clubs(id, name, short_name, logo_url, primary_color, secondary_color)');

    const usersWithRoles = usersData?.map((profile) => {
      const userRoles = rolesData?.filter((role) => role.profile_id === profile.id) || [];
      const primaryRole = userRoles[0];
      return {
        ...profile,
        roles: userRoles.map((role) => role.role) || [profile.role],
        club_id: primaryRole?.club_id || null,
      } as UserWithRoles;
    }).filter((profile) => {
      if (platformAdmin) return true;
      if (!clubAdminRole?.club_id) return false;
      return profile.club_id === clubAdminRole.club_id;
    }) || [];

    setUsers(usersWithRoles);

    let playersQuery = supabase.from('players').select('*, teams(name), profiles(email, full_name)').order('full_name');
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

  async function handleLinkSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    if (!confirm('Are you sure you want to remove this parent-player link?')) return;
    const result = await unlinkParentFromPlayer(parentId, playerId);
    if (result.error) {
      setError(result.error);
      return;
    }
    loadData();
  }

  async function handlePlayerLinkSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    if (!confirm('Are you sure you want to unlink this player account?')) return;
    const result = await unlinkPlayerAccount(playerId);
    if (result.error) {
      setError(result.error);
      return;
    }
    loadData();
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const name = (user.full_name || '').toLowerCase();
      return name.includes(query) || user.email.toLowerCase().includes(query);
    });
  }, [users, searchQuery]);

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-8 text-gray-900 dark:bg-gray-800 dark:text-gray-100">{t('trke_loading', 'Loading...')}</div>;
  }

  const parentUsers = users.filter((user) => user.roles?.includes('parent') || user.role === 'parent');

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800">
      <AdminNavbar />
      <div className="lg:pl-56">
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Users</h1>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowLinkForm(true)} className="rounded bg-purple-500 px-4 py-2 font-bold text-white hover:bg-purple-700">
                Link Parent
              </button>
              <button type="button" onClick={() => setShowPlayerLinkForm(true)} className="rounded bg-orange-500 px-4 py-2 font-bold text-white hover:bg-orange-700">
                Link Player Account
              </button>
              <Link href="/admin/users/new" className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
                {t('trke_add_user', 'Add user')}
              </Link>
            </div>
          </div>
          {(error || success) && (
            <div className="mb-4 px-4">
              {error && <div className="rounded bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div>}
              {success && <div className="rounded bg-green-100 p-3 text-green-700 dark:bg-green-950 dark:text-green-200">{success}</div>}
            </div>
          )}

          {showLinkForm && (
            <div className="mb-6 px-4">
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-bold">Link Parent to Player</h2>
                <form onSubmit={handleLinkSubmit}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Parent *</label>
                      <select required value={linkFormData.parent_id} onChange={(event) => setLinkFormData({ ...linkFormData, parent_id: event.target.value })} className="w-full rounded border px-3 py-2">
                        <option value="">Select a parent</option>
                        {parentUsers.map((parent) => (
                          <option key={parent.id} value={parent.id}>{parent.full_name || parent.email}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Player *</label>
                      <select required value={linkFormData.player_id} onChange={(event) => setLinkFormData({ ...linkFormData, player_id: event.target.value })} className="w-full rounded border px-3 py-2">
                        <option value="">Select a player</option>
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>#{player.jersey_number} {player.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="submit" className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700">Link</button>
                    <button type="button" onClick={() => { setShowLinkForm(false); setLinkFormData({ parent_id: '', player_id: '' }); }} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showPlayerLinkForm && (
            <div className="mb-6 px-4">
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-4 text-lg font-bold">Link Player to User Account</h2>
                <p className="mb-4 text-sm text-gray-600">Link a player record to a user account. This allows the player to log in and see their own stats and their team&apos;s data.</p>
                <form onSubmit={handlePlayerLinkSubmit}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Player *</label>
                      <select required value={playerLinkFormData.player_id} onChange={(event) => setPlayerLinkFormData({ ...playerLinkFormData, player_id: event.target.value })} className="w-full rounded border px-3 py-2">
                        <option value="">Select a player</option>
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>#{player.jersey_number} {player.full_name} ({player.teams?.name || 'No team'})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">User Account *</label>
                      <select required value={playerLinkFormData.user_id} onChange={(event) => setPlayerLinkFormData({ ...playerLinkFormData, user_id: event.target.value })} className="w-full rounded border px-3 py-2">
                        <option value="">Select a user</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="submit" className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700">Link</button>
                    <button type="button" onClick={() => { setShowPlayerLinkForm(false); setPlayerLinkFormData({ player_id: '', user_id: '' }); }} className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="space-y-6 px-4 py-6 sm:px-0">
            <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-gray-900">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  All Users
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    {searchQuery.trim() ? `${filteredUsers.length} of ${users.length}` : users.length}
                  </span>
                </h3>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or email"
                  aria-label="Search users by name or email"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 sm:w-72 dark:border-white/20 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {users.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No users found</li>
                ) : filteredUsers.length === 0 ? (
                  <li className="px-6 py-4 text-gray-500 dark:text-gray-400">No users match your search</li>
                ) : (
                  filteredUsers.map((user) => (
                    <li key={user.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          {user.avatar_url ? (
                            <Image src={user.avatar_url} alt={user.full_name || user.email} width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <span className="text-lg font-medium text-gray-500 dark:text-gray-300">{(user.full_name || user.email).charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{user.full_name || user.email}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex flex-wrap gap-1">
                            {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((role) => (
                              <span key={role} className={getRoleBadgeClasses(role)}>
                                {t(getRoleTranslationKey(role), role.replace('_', ' '))}
                              </span>
                            ))}
                          </div>
                          <EditLink href={`/admin/users/${user.id}`} label={`${t('trke_edit', 'Edit')} ${user.full_name || user.email}`} />
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {parentLinks.length > 0 && (
              <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-gray-900">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Parent-Player Links</h3>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-white/10">
                  {parentLinks.map((link) => (
                    <li key={link.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Parent: {link.profiles?.full_name || link.profiles?.email}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Player: #{link.players?.jersey_number} {link.players?.full_name}</p>
                        </div>
                        <button type="button" onClick={() => handleUnlink(link.parent_id, link.player_id)} className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-700">
                          Unlink
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {players.some((player) => player.user_id) && (
              <div className="overflow-hidden bg-white shadow sm:rounded-md dark:bg-gray-900 dark:ring-1 dark:ring-white/10">
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-gray-900">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Player Account Links</h3>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-white/10">
                  {players.filter((player) => player.user_id).map((player) => (
                    <li key={player.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Player: #{player.jersey_number} {player.full_name}
                            {player.teams && ` (${player.teams.name})`}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Account: {player.profiles?.full_name || player.profiles?.email || player.user_id}</p>
                        </div>
                        <button type="button" onClick={() => handlePlayerUnlink(player.id)} className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-700">
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
    </div>
  );
}
