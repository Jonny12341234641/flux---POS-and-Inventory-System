import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser, logoutUser } from '../authController';
import { supabase } from '../../supabase';

vi.mock('../../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Auth Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        last_login: '2023-01-01'
      };

      // Mock signInWithPassword
      (supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock user profile fetch
      const mockSingle = vi.fn().mockResolvedValue({ data: mockProfile, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      
      // Mock update last_login
      // Note: In the controller, the update call chain is: supabase.from('users').update({...}).eq('id', userId)
      // The fetch call chain is: supabase.from('users').select(...).eq('id', userId).single()
      
      // We need a mock implementation that handles both chains
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      });

      const result = await loginUser(email, password);

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email, password });
      expect(result.email).toBe(email);
      expect(result.id).toBe(userId);
    });
  });

  describe('logoutUser', () => {
      it('should logout user successfully', async () => {
          (supabase.auth.signOut as any).mockResolvedValue({ error: null });
          const result = await logoutUser();
          expect(result).toEqual({ success: true });
          expect(supabase.auth.signOut).toHaveBeenCalled();
      });
  });
});
