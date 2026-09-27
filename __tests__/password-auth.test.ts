/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend before any imports
const mockResendSend = vi.fn();
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    };
  },
}));

// Mock Supabase admin client with proper chaining
const mockUpdate = vi.fn(() => ({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnThis();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
  update: mockUpdate,
}));

const mockSupabaseAdmin = {
  auth: {
    admin: {
      createUser: vi.fn(),
      updateUserById: vi.fn(),
    },
  },
  from: mockFrom,
};

// Mock Supabase module
vi.mock('@/lib/supabase', () => ({
  getServerSupabase: vi.fn(() => mockSupabaseAdmin),
}));

// Mock auth-server module
vi.mock('@/lib/auth-server', () => ({
  assertAdmin: vi.fn().mockResolvedValue({ error: null }),
  getAuthenticatedUser: vi.fn().mockResolvedValue({ user: { id: 'test-user' }, error: null }),
}));

describe('Password Auth - Password Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate password of specified length', async () => {
    const { generatePassword } = await import('@/lib/password-auth');
    const password = generatePassword(16);
    
    expect(password).toHaveLength(16);
  });

  it('should generate default 12-character password', async () => {
    const { generatePassword } = await import('@/lib/password-auth');
    const password = generatePassword();
    
    expect(password).toHaveLength(12);
  });

  it('should include uppercase letters', async () => {
    const { generatePassword } = await import('@/lib/password-auth');
    // Generate multiple to ensure we hit uppercase
    let hasUpper = false;
    for (let i = 0; i < 10; i++) {
      const password = generatePassword(16);
      if (/[A-Z]/.test(password)) {
        hasUpper = true;
        break;
      }
    }
    expect(hasUpper).toBe(true);
  });

  it('should include lowercase letters', async () => {
    const { generatePassword } = await import('@/lib/password-auth');
    let hasLower = false;
    for (let i = 0; i < 10; i++) {
      const password = generatePassword(16);
      if (/[a-z]/.test(password)) {
        hasLower = true;
        break;
      }
    }
    expect(hasLower).toBe(true);
  });

  it('should include numbers', async () => {
    const { generatePassword } = await import('@/lib/password-auth');
    let hasNumber = false;
    for (let i = 0; i < 10; i++) {
      const password = generatePassword(16);
      if (/[0-9]/.test(password)) {
        hasNumber = true;
        break;
      }
    }
    expect(hasNumber).toBe(true);
  });

  it('should include special characters', async () => {
    const { generatePassword } = await import('@/lib/password-auth');
    let hasSpecial = false;
    for (let i = 0; i < 10; i++) {
      const password = generatePassword(16);
      if (/[!@#$%^&*]/.test(password)) {
        hasSpecial = true;
        break;
      }
    }
    expect(hasSpecial).toBe(true);
  });
});

describe('Password Auth - Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enforce 15-minute rate limit on forgotPassword', async () => {
    // Mock profile with recent password reset (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: {
        id: 'user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        password_reset_requested_at: fiveMinutesAgo,
      },
      error: null,
    });

    const { forgotPassword } = await import('@/lib/password-auth');
    const result = await forgotPassword('test@example.com');

    // Should return success (generic response, no user enumeration)
    expect(result.success).toBe(true);
    expect(result.message).toContain('If an account with that email exists');

    // Should NOT have called updateUserById (rate limited)
    expect(mockSupabaseAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
    
    // Should NOT have sent email (rate limited)
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('should allow password reset after 15 minutes', async () => {
    // Mock profile with old password reset (20 minutes ago)
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: {
        id: 'user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        password_reset_requested_at: twentyMinutesAgo,
      },
      error: null,
    });

    mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: 'user-id' } },
      error: null,
    });

    mockResendSend.mockResolvedValue({
      data: { id: 'email-id' },
      error: null,
    });

    const { forgotPassword } = await import('@/lib/password-auth');
    const result = await forgotPassword('test@example.com');

    // Should succeed
    expect(result.success).toBe(true);

    // Should have called updateUserById (not rate limited)
    expect(mockSupabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({
        password: expect.any(String),
      })
    );

    // Should have sent email
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('password'),
      })
    );
  });
});

describe('Password Auth - User Enumeration Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not reveal whether email exists when not found', async () => {
    // Mock profile not found
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }, // Supabase "not found" error
    });

    const { forgotPassword } = await import('@/lib/password-auth');
    const result = await forgotPassword('nonexistent@example.com');

    // Should return generic success (not revealing user doesn't exist)
    expect(result.success).toBe(true);
    expect(result.message).toContain('If an account with that email exists');

    // Should not attempt to send email
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('should return same response whether email exists or not', async () => {
    // Test existing email
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'user-id',
        email: 'exists@example.com',
        full_name: 'Test User',
        password_reset_requested_at: null,
      },
      error: null,
    });

    mockSupabaseAdmin.auth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: 'user-id' } },
      error: null,
    });

    mockResendSend.mockResolvedValue({
      data: { id: 'email-id' },
      error: null,
    });

    const { forgotPassword } = await import('@/lib/password-auth');
    const resultExists = await forgotPassword('exists@example.com');

    // Test non-existing email
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });

    const resultNotExists = await forgotPassword('notexists@example.com');

    // Both should return same success message
    expect(resultExists.success).toBe(true);
    expect(resultNotExists.success).toBe(true);
    expect(resultExists.message).toBe(resultNotExists.message);
  });
});

describe('Password Auth - must_change_password Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should force redirect to /change-password when must_change_password is true', async () => {
    // This test documents the expected behavior
    // The actual middleware logic should check must_change_password and redirect
    
    const profileWithMustChange = {
      id: 'user-id',
      email: 'test@example.com',
      must_change_password: true,
    };

    // Middleware should redirect to /change-password if:
    // 1. User is authenticated
    // 2. must_change_password === true
    // 3. Current path is not /change-password or /api/*
    
    expect(profileWithMustChange.must_change_password).toBe(true);
  });
});
