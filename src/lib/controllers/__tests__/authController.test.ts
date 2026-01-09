import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser, logoutUser } from '../authController';
import { SupabaseClient } from '@supabase/supabase-js';

// Define types for our mocks to make TS happy
type MockSupabase = {
  auth: {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

describe('Auth Controller', () => {
  let mockSupabase: MockSupabase;

  beforeEach(() => {
    // 1. Create a fresh mock client for every test
    mockSupabase = {
      auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        updateUser: vi.fn(),
        resetPasswordForEmail: vi.fn(),
      },
      from: vi.fn(),
    };
  });

  describe('loginUser', () => {
    it('should login user successfully', async () => {
      const email = 'test@example.com';
      const password = 'password';
      const userId = 'user-123';
      const mockSession = { user: { id: userId, email } };
      
      const mockProfile = { 
        id: userId, 
        username: 'testuser', 
        full_name: 'Test User', 
        role: 'admin', 
        status: 'active',
        last_login: '2023-01-01',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      const mockShift = { id: 'shift-1' };

      // Mock auth.signInWithPassword
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      } as any);

      // Mock DB chained calls
      // We need to handle:
      // 1. fetchUserProfile -> from('users').select().eq().single()
      // 2. fetchActiveShiftId -> from('shift_sessions').select().eq().eq().order().limit()
      // 3. update last_login -> from('users').update().eq()
      // 4. logAuthEvent -> from('audit_logs').insert()

      const mockSingle = vi.fn().mockResolvedValue({ data: mockProfile, error: null });
      const mockLimit = vi.fn().mockResolvedValue({ data: [mockShift], error: null });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn(); // Flexible mock for .eq()

      // Define behavior for .eq() chains
      mockEq.mockImplementation(() => ({
        single: mockSingle,     // For user profile
        eq: mockEq,             // For chained .eq() in shift fetch
        order: mockOrder,       // For shift fetch
        update: vi.fn(),        // For updates
      }));

      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      // Main .from() router
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return { select: mockSelect, update: mockUpdate } as any;
        if (table === 'shift_sessions') return { select: mockSelect } as any;
        if (table === 'audit_logs') return { insert: mockInsert } as any;
        return {} as any;
      });

      // --- EXECUTE ---
      // Pass the mock client explicitly!
      const result = await loginUser(mockSupabase as unknown as SupabaseClient, email, password);

      // --- ASSERT ---
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({ email, password });
      expect(result.email).toBe(email);
      expect(result.id).toBe(userId);
      expect(result.active_shift_id).toBe('shift-1');
    });
  });

  describe('logoutUser', () => {
    it('should logout user successfully', async () => {
      // Mock getSession for the audit log check
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: '123' } } },
        error: null
      } as any);

      mockSupabase.auth.signOut.mockResolvedValue({ error: null } as any);
      
      // Mock the audit log insert
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      } as any);

      // Pass the mock client explicitly!
      const result = await logoutUser(mockSupabase as unknown as SupabaseClient);

      expect(result).toEqual({ success: true });
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });
});