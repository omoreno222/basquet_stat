import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserRoles } from '@/app/admin/actions';

// Mock Resend
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
    };
  },
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => 
      name === 'sb-access-token' 
        ? { value: 'mock-access-token' } 
        : undefined
    ),
  })),
}));

// Mock auth-server
vi.mock('@/lib/auth-server', () => ({
  assertAdmin: vi.fn(),
  assertClubAdmin: vi.fn(),
}));

// Mock Supabase client
const mockRpcImpl = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpcImpl,
  })),
}));

// Mock service Supabase (should NOT be used for RPC)
vi.mock('@/lib/supabase', () => ({
  getServerSupabase: vi.fn(() => ({
    rpc: vi.fn(),
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  })),
}));

describe('updateUserRoles', () => {
  let mockAssertAdmin: any;
  let mockServiceSupabase: any;
  let mockCreateClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    // Get the mocked functions
    const authServer = await import('@/lib/auth-server');
    mockAssertAdmin = authServer.assertAdmin as any;
    
    const supabaseLib = await import('@/lib/supabase');
    mockServiceSupabase = supabaseLib.getServerSupabase() as any;
    
    const supabaseJs = await import('@supabase/supabase-js');
    mockCreateClient = supabaseJs.createClient as any;
    
    // Default: assertAdmin succeeds
    mockAssertAdmin.mockResolvedValue({ error: null, userId: 'admin-id' });
    
    // Default: RPC succeeds
    mockRpcImpl.mockResolvedValue({ 
      data: { success: true }, 
      error: null 
    });
  });

  it('should call assertAdmin before making RPC call', async () => {
    await updateUserRoles('user-id', ['admin'], 'club-id');

    expect(mockAssertAdmin).toHaveBeenCalledOnce();
  });

  it('should reject if caller is not admin', async () => {
    mockAssertAdmin.mockResolvedValueOnce({ 
      error: 'Unauthorized', 
      userId: null 
    });

    const result = await updateUserRoles('user-id', ['admin'], 'club-id');

    expect(result.error).toBe('Unauthorized');
    expect(mockRpcImpl).not.toHaveBeenCalled();
    expect(mockServiceSupabase.rpc).not.toHaveBeenCalled();
  });

  it('should call update_user_roles_safe RPC with correct arguments', async () => {
    await updateUserRoles('user-123', ['admin', 'team_manager'], 'club-456');

    expect(mockRpcImpl).toHaveBeenCalledWith('update_user_roles_safe', {
      p_user_id: 'user-123',
      p_roles: ['admin', 'team_manager'],
      p_club_id: 'club-456',
    });
  });

  it('should NOT use service-role client for RPC', async () => {
    await updateUserRoles('user-id', ['admin'], 'club-id');

    // Verify the user-scoped client was used
    expect(mockRpcImpl).toHaveBeenCalled();
    
    // Verify the service-role client was NOT used
    expect(mockServiceSupabase.rpc).not.toHaveBeenCalled();
  });

  it('should handle SQL function error response in JSON', async () => {
    mockRpcImpl.mockResolvedValueOnce({ 
      data: { error: 'Cannot remove your own admin role' }, 
      error: null 
    });

    const result = await updateUserRoles('user-id', ['team_manager'], 'club-id');

    expect(result.error).toBe('Cannot remove your own admin role');
  });

  it('should handle RPC error', async () => {
    mockRpcImpl.mockResolvedValueOnce({ 
      data: null, 
      error: { message: 'Database error' } 
    });

    const result = await updateUserRoles('user-id', ['admin'], 'club-id');

    expect(result.error).toBe('Database error');
  });

  it('should validate empty roles array before calling RPC', async () => {
    const result = await updateUserRoles('user-id', [], 'club-id');

    expect(result.error).toBe('At least one role must be selected');
    expect(mockRpcImpl).not.toHaveBeenCalled();
  });

  it('should pass null club_id when undefined is provided', async () => {
    await updateUserRoles('user-123', ['admin']);

    expect(mockRpcImpl).toHaveBeenCalledWith('update_user_roles_safe', {
      p_user_id: 'user-123',
      p_roles: ['admin'],
      p_club_id: null,
    });
  });

  it('should return success when function returns success', async () => {
    mockRpcImpl.mockResolvedValueOnce({ 
      data: { success: true }, 
      error: null 
    });

    const result = await updateUserRoles('user-id', ['admin'], 'club-id');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should handle club not found error from SQL function', async () => {
    mockRpcImpl.mockResolvedValueOnce({ 
      data: { error: 'Club not found' }, 
      error: null 
    });

    const result = await updateUserRoles('user-id', ['team_manager'], 'invalid-club-id');

    expect(result.error).toBe('Club not found');
  });

  it('should handle user not found error from SQL function', async () => {
    mockRpcImpl.mockResolvedValueOnce({ 
      data: { error: 'User not found' }, 
      error: null 
    });

    const result = await updateUserRoles('invalid-user-id', ['player'], 'club-id');

    expect(result.error).toBe('User not found');
  });
});
