'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { forgotPassword } from '@/lib/password-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Store token in cookie for middleware with SameSite=Lax
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=3600; SameSite=Lax`;
        
        // Get user role and redirect
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          throw new Error(`Profile error: ${profileError.message}`);
        }

        if (profile) {
          const roleRoutes: Record<string, string> = {
            admin: '/admin',
            club_admin: '/admin',
            team_manager: '/team-manager',
            coach: '/coach',
            parent: '/parent',
            player: '/player',
          };
          router.push(roleRoutes[profile.role] || '/');
        } else {
          throw new Error('No profile found for user');
        }
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await forgotPassword(forgotEmail);
    setLoading(false);

    if (result.success) {
      setSuccess(result.message || 'If an account exists, a password reset email has been sent.');
      setForgotEmail('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 5000);
    } else {
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image 
            src="/images/seasonmath-logo.png" 
            alt="SeasonMath" 
            width={200} 
            height={200}
            priority
            className="h-auto"
          />
        </div>
        <h2 className="text-xl mb-6 text-center text-gray-600">Sign In</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {!showForgotPassword ? (
          <>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="email@basquet.local"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>

              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Reset Password</h3>
              <p className="text-sm text-gray-600 mb-4">
                Enter your email address and we&apos;ll send you a password reset link.
              </p>
            </div>
            <form onSubmit={handleForgotPassword}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="forgot-email">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="email@basquet.local"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setSuccess('');
                    setForgotEmail('');
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </>
        )}

        <div className="mt-6 text-sm text-gray-600">
          <p className="font-semibold mb-2">Demo Accounts:</p>
          <ul className="space-y-1">
            <li>Admin: <span className="font-mono">oscar@basquet.local</span> / basquet2024</li>
            <li>Team Manager: <span className="font-mono">manager@basquet.local</span> / basquet2024</li>
            <li>Team Manager: <span className="font-mono">pere.alier@basquet.local</span> / basquet2024</li>
            <li>Coach: <span className="font-mono">coach@basquet.local</span> / basquet2024</li>
            <li>Parent: <span className="font-mono">parent@basquet.local</span> / basquet2024</li>
            <li>Player: <span className="font-mono">player@basquet.local</span> / basquet2024</li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            💡 For dual-tablet tests: Use <span className="font-mono">oscar</span> + <span className="font-mono">pere.alier</span> or <span className="font-mono">manager</span> + <span className="font-mono">pere.alier</span>
          </p>
        </div>
      </div>
    </div>
  );
}
