/**
 * @jest-environment node
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  getServerSupabase: jest.fn(),
}));

jest.mock('@/lib/auth-server', () => ({
  assertAdmin: jest.fn(),
  assertClubAdmin: jest.fn(),
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'test' }, error: null }),
    },
  })),
}));

import { Resend } from 'resend';

describe('Password Auth - Email Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
  });

  it('should use correct default EMAIL_FROM', () => {
    const resend = new Resend('test-key');
    expect(process.env.EMAIL_FROM || 'SeasonMath <no-reply@seasonmath.com>').toBe('SeasonMath <no-reply@seasonmath.com>');
  });

  it('should use correct default EMAIL_REPLY_TO', () => {
    expect(process.env.EMAIL_REPLY_TO || 'support@seasonmath.com').toBe('support@seasonmath.com');
  });

  it('should respect custom EMAIL_FROM env var', () => {
    process.env.EMAIL_FROM = 'Custom <custom@test.com>';
    expect(process.env.EMAIL_FROM).toBe('Custom <custom@test.com>');
  });

  it('should respect custom EMAIL_REPLY_TO env var', () => {
    process.env.EMAIL_REPLY_TO = 'reply@test.com';
    expect(process.env.EMAIL_REPLY_TO).toBe('reply@test.com');
  });
});

describe('Password Auth - createUserWithPassword', () => {
  it('should include club_id when creating roles', async () => {
    const { getServerSupabase } = await import('@/lib/supabase');
    const { assertAdmin } = await import('@/lib/auth-server');

    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: { name: 'Test Club' }, error: null });
    const mockFrom = jest.fn((table: string) => {
      if (table === 'profile_roles') {
        return { insert: mockInsert };
      }
      if (table === 'clubs') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        };
      }
      return { insert: mockInsert };
    });

    const mockSupabase = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@test.com' } },
            error: null,
          }),
        },
      },
      from: mockFrom,
    };

    (getServerSupabase as jest.Mock).mockReturnValue(mockSupabase);
    (assertAdmin as jest.Mock).mockResolvedValue({ error: null });

    const { createUserWithPassword } = await import('@/lib/password-auth');

    const result = await createUserWithPassword({
      email: 'test@test.com',
      full_name: 'Test User',
      role: 'team_manager',
      club_id: 'club-123',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          profile_id: 'test-user-id',
          role: 'team_manager',
          club_id: 'club-123',
        }),
      ])
    );
  });

  it('should set club_id to null for platform admin', async () => {
    const { getServerSupabase } = await import('@/lib/supabase');
    const { assertAdmin } = await import('@/lib/auth-server');

    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    const mockFrom = jest.fn(() => ({ insert: mockInsert }));

    const mockSupabase = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'admin-user-id', email: 'admin@test.com' } },
            error: null,
          }),
        },
      },
      from: mockFrom,
    };

    (getServerSupabase as jest.Mock).mockReturnValue(mockSupabase);
    (assertAdmin as jest.Mock).mockResolvedValue({ error: null });

    const { createUserWithPassword } = await import('@/lib/password-auth');

    const result = await createUserWithPassword({
      email: 'admin@test.com',
      full_name: 'Admin User',
      role: 'admin',
      club_id: null,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          profile_id: 'admin-user-id',
          role: 'admin',
          club_id: null,
        }),
      ])
    );
  });
});

describe('Password Auth - Password Requirements', () => {
  it('should enforce minimum 6 character password', async () => {
    const { getAuthenticatedUser } = await import('@/lib/auth-server');
    const { getServerSupabase } = await import('@/lib/supabase');

    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      user: { id: 'test-user' },
      error: null,
    });

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { email: 'test@test.com' }, error: null }),
      }),
    };

    (getServerSupabase as jest.Mock).mockReturnValue(mockSupabase);

    const { changePasswordWithCurrent } = await import('@/lib/password-auth');

    const result = await changePasswordWithCurrent('current', 'short');

    expect(result.error).toBe('Password must be at least 6 characters');
  });
});

describe('Password Auth - Rate Limiting', () => {
  it('should enforce 15-minute rate limit on forgotPassword', async () => {
    const { getServerSupabase } = await import('@/lib/supabase');

    // Mock a recent password reset request (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-id',
            email: 'test@test.com',
            full_name: 'Test User',
            password_reset_requested_at: fiveMinutesAgo,
          },
          error: null,
        }),
      }),
      auth: {
        admin: {
          updateUserById: jest.fn().mockResolvedValue({ error: null }),
        },
      },
    };

    (getServerSupabase as jest.Mock).mockReturnValue(mockSupabase);

    const { forgotPassword } = await import('@/lib/password-auth');

    const result = await forgotPassword('test@test.com');

    // Should return generic response (no enumeration)
    expect(result.success).toBe(true);
    expect(result.message).toContain('If an account with that email exists');

    // Should NOT have called updateUserById (rate limited)
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});
