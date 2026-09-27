'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { changePasswordWithCurrent } from '@/lib/password-auth';
import Image from 'next/image';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    async function checkMustChangePassword() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password, role')
        .eq('id', user.id)
        .single();

      if (profile) {
        setMustChange(profile.must_change_password || false);
        
        // If they don't need to change password, redirect to their dashboard
        if (!profile.must_change_password) {
          const roleRoutes: Record<string, string> = {
            admin: '/admin',
            club_admin: '/admin',
            team_manager: '/team-manager',
            coach: '/coach',
            parent: '/parent',
            player: '/player',
          };
          const defaultRoute = roleRoutes[profile.role] || '/admin';
          router.push(defaultRoute);
        }
      }
    }

    checkMustChangePassword();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords must match');
      return;
    }

    setLoading(true);

    const result = await changePasswordWithCurrent(currentPassword, newPassword);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Password changed successfully - redirect to dashboard
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (profile) {
      const roleRoutes: Record<string, string> = {
        admin: '/admin',
        club_admin: '/admin',
        team_manager: '/team-manager',
        coach: '/coach',
        parent: '/parent',
        player: '/player',
      };
      const defaultRoute = roleRoutes[profile.role] || '/admin';
      router.push(defaultRoute);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <Image 
            src="/images/seasonmath-logo.png" 
            alt="SeasonMath" 
            width={120} 
            height={120}
            className="h-12 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {mustChange ? 'Change Password Required' : 'Change Password'}
          </h1>
          {mustChange && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              For security, you must change your password before continuing
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              At least 6 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>

        {!mustChange && (
          <button
            onClick={() => router.back()}
            className="w-full mt-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
