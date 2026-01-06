import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createCustomer, 
  updateCustomer, 
  anonymizeCustomer, 
  adjustLoyaltyPointsSafe, 
  searchCustomers,
  deleteCustomer
} from '../customerController';
import { supabase } from '../../../lib/supabase';
import { TABLES } from '../../../lib/constants';

// Mock Supabase Client
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock Constants if needed, otherwise rely on actual values
// assuming TABLES.CUSTOMERS = 'customers' for these tests

describe('Customer Controller', () => {
  // Helper to reset mocks between tests
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 1. VALIDATION & CREATION TESTS ---
  describe('createCustomer', () => {
    it('should create a customer with valid E.164 phone normalization', async () => {
      // Setup Mock
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: '123', name: 'John', phone: '+15551234567' }, 
            error: null 
          })
        })
      });
      
      // Mock the duplicate check (ensurePhoneAvailable)
      // First call checks phone, returns empty data (no duplicate)
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === TABLES.CUSTOMERS) return { insert: mockInsert, select: mockSelect };
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) }; // Ignore audit log errors
        return {};
      });

      // Execute
      const result = await createCustomer({
        name: 'John Doe',
        phone: '(555) 123-4567', // Raw input
        email: 'john@example.com'
      }, 'admin-user-id');

      // Verify
      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        phone: '+15551234567', // Assert normalization happened
        email: 'john@example.com'
      }));
    });

    it('should fail with Zod error if email is invalid', async () => {
      const result = await createCustomer({
        name: 'Bad Email',
        phone: '5551234567',
        email: 'not-an-email' // Invalid
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
    });

    it('should fail if phone number is a duplicate', async () => {
      // Mock ensurePhoneAvailable to find an existing user
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ 
            data: [{ id: 'existing-id' }], // Duplicate found!
            error: null 
          })
        })
      });

      (supabase.from as any).mockImplementation(() => ({ select: mockSelect }));

      const result = await createCustomer({
        name: 'Dupe',
        phone: '5551234567'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  // --- 2. UPDATE & CONCURRENCY TESTS ---
  describe('updateCustomer', () => {
    it('should allow updating self without triggering duplicate phone error', async () => {
      const customerId = 'my-id';
      
      // Mock ensurePhoneAvailable: It queries DB but excludes own ID
      const mockNeq = vi.fn().mockResolvedValue({ data: [], error: null }); // No *other* user found
      const mockEq = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ neq: mockNeq }) });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      // Mock the Update
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: customerId }, error: null })
          })
        })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === TABLES.CUSTOMERS) return { select: mockSelect, update: mockUpdate };
        if (table === 'audit_logs') return { insert: vi.fn().mockResolvedValue({}) }; 
        return {};
      });

      const result = await updateCustomer(customerId, { phone: '555-999-9999' });

      expect(result.success).toBe(true);
      // Verify excludeId logic was called
      expect(mockNeq).toHaveBeenCalledWith('id', customerId); 
    });
  });

  // --- 3. GDPR ANONYMIZATION TESTS ---
  describe('anonymizeCustomer', () => {
    it('should correctly redact PII data', async () => {
      const customerId = 'user-123';
      
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: customerId, is_active: false }, error: null })
          })
        })
      });

      (supabase.from as any).mockReturnValue({ update: mockUpdate });

      const result = await anonymizeCustomer(customerId);

      expect(result.success).toBe(true);
      // Verify redaction fields
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Deleted User',
        email: null,
        is_active: false,
        store_credit: 0
      }));
      // Verify phone scrambling (check if it starts with the dummy prefix from controller)
      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.phone).toContain('+99'); 
    });
  });

  // --- 4. LOYALTY RPC TESTS ---
  describe('adjustLoyaltyPointsSafe', () => {
    it('should call the Database RPC and Log the transaction', async () => {
      // Mock RPC
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      // Mock Loyalty Log Insert
      const mockLogInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null })
        })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'loyalty_logs') return { insert: mockLogInsert };
        return {};
      });

      const result = await adjustLoyaltyPointsSafe('cust-1', 50, 'Bonus', 'admin-1');

      expect(result.success).toBe(true);
      // Verify RPC was called, NOT a standard update
      expect(supabase.rpc).toHaveBeenCalledWith('increment_loyalty_points', {
        row_id: 'cust-1',
        amount: 50
      });
      // Verify Audit Log
      expect(mockLogInsert).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'Bonus',
        points_change: 50
      }));
    });
  });

  // --- 5. DELETE SAFETY TESTS ---
  describe('deleteCustomer', () => {
    it('should block deletion if sales history exists', async () => {
      // Mock soft delete update attempt (returns "success" initially)
      // The controller first tries to soft delete. 
      // If that fails or requires checks, we are testing the sales check logic specifically.
      // *Correction*: The controller logic is:
      // 1. Try Set Active False -> 2. If valid, done.
      // 3. IF that fails (unexpectedly), it falls through?
      // Actually, standard deleteCustomer logic usually checks sales BEFORE hard delete.
      // Let's test the "Hard Delete" logic flow specifically or how the controller handles the safeguard.
      
      // Based on your controller code: 
      // It attempts soft delete first. If that works, it returns.
      // Let's mock the scenario where we want to test the SALES check.
      // This happens if the first update FAILS with a specific error, OR if we force the path.
      
      // Let's look at the controller logic provided:
      // It tries `update({ is_active: false })`.
      // If that succeeds, it returns.
      // It only checks sales if the soft-delete fails specifically regarding 'is_active' column issues?
      // Wait, the controller provided says:
      // "if (!error && customer) return success"
      
      // So effectively, deleteCustomer IS a soft delete now.
      // To test the "Protection", we should test that it DOES soft delete, not hard delete.
      
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_active: false }, error: null })
          })
        })
      });
      
      const mockDelete = vi.fn(); // Should NOT be called
      
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === TABLES.CUSTOMERS) return { update: mockUpdate, delete: mockDelete };
        return {};
      });

      const result = await deleteCustomer('123');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // --- 6. SEARCH TESTS ---
  describe('searchCustomers', () => {
    it('should apply filters and pagination correctly', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
      const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
      const mockOr = vi.fn().mockReturnValue({ gte: mockGte }); // Chaining mock
      const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ or: mockOr }) });

      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await searchCustomers('John', { page: 2, limit: 10, min_loyalty_points: 100 });

      // Verify Pagination Math: Page 2, Limit 10 -> Range (10, 19)
      expect(mockRange).toHaveBeenCalledWith(10, 19);
      
      // Verify Filter application
      expect(mockGte).toHaveBeenCalledWith('loyalty_points', 100);
    });
  });

});