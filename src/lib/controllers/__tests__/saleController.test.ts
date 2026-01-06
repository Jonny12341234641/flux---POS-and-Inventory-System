import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSale } from '../saleController';
import { supabase } from '../../supabase';
import { TABLES } from '../../constants';

// 1. Setup the Mock for Supabase including RPCs (Database Functions)
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGt = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
    rpc: vi.fn(), // We must mock the RPC function handler
  },
}));

describe('Sale Controller (Commercial Grade)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 2. Setup Default "Happy Path" Chain
    // This allows the chain: .from().select().eq().single() to work without crashing
    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockDelete.mockReturnThis();
    mockEq.mockReturnThis();
    mockIn.mockReturnThis();
    mockGt.mockReturnThis();
    mockOrder.mockReturnThis();
    mockLimit.mockReturnThis();
    
    // Connect the global mockRpc to the imported supabase client
    (supabase.rpc as any) = mockRpc;
  });

  describe('createSale', () => {
    it('should process a sale successfully with Shift, Batches, and RPCs', async () => {
      const userId = 'user-1';
      const saleData = {
        payment_method: 'cash' as const,
        amount_paid: 100,
        discount_total: 0,
      };
      const items = [
        {
          productId: 'prod-1',
          quantity: 2,
          unitPrice: 10,
          discount: 0,
          taxAmount: 0,
        },
      ];

      // --- MOCK DATA ---
      const mockShift = { id: 'shift-1', status: 'open' };
      const mockProduct = { 
        id: 'prod-1', 
        name: 'Test Product', 
        stock_quantity: 50, 
        price: 10, // Server-side price enforcement
        tax_rate: 0 
      };
      const mockBatch = {
        id: 'batch-1',
        product_id: 'prod-1',
        quantity_remaining: 100,
        expiry_date: null,
        created_at: '2024-01-01'
      };
      const createdSale = { id: 'sale-1', receipt_number: 'INV-2024-1001', ...saleData };

      // --- SPECIFIC MOCK RESPONSES ---

      // 1. Mock Database Functions (RPCs)
      mockRpc.mockImplementation((fnName, args) => {
        if (fnName === 'next_receipt_number') return { data: 1001, error: null };
        if (fnName === 'deduct_product_stock') return { data: true, error: null }; // Success!
        if (fnName === 'increment_loyalty_points') return { data: null, error: null };
        return { data: null, error: null };
      });

      // 2. Mock Table Queries
      (supabase.from as any).mockImplementation((table: string) => {
        // A. Check Open Shift
        if (table === TABLES.SHIFT_SESSIONS) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    // Return our fake open shift
                    then: (resolve: any) => resolve({ data: [mockShift], error: null }) 
                  })
                })
              })
            })
          };
        }

        // B. Fetch Products (Price Check)
        if (table === TABLES.PRODUCTS) {
           return {
             select: () => ({
               in: () => ({
                  // Return our fake product with price
                 then: (resolve: any) => resolve({ data: [mockProduct], error: null })
               })
             }),
             update: mockUpdate // Used if we need to rollback (rare in success test)
           };
        }

        // C. Fetch Batches (FIFO)
        if (table === TABLES.PRODUCT_BATCHES) {
          return {
            select: () => ({
              in: () => ({
                gt: () => ({
                  order: () => ({
                     // Return our fake batch
                    then: (resolve: any) => resolve({ data: [mockBatch], error: null })
                  })
                })
              })
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    then: (resolve: any) => resolve({ data: [{id: 'batch-1'}], error: null })
                  })
                })
              })
            })
          };
        }

        // D. Insert Sale Header
        if (table === TABLES.SALES) {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: createdSale, error: null })
              })
            })
          };
        }
        
        // E. Fallback for Sale Items, Payments, Movements
        return {
          insert: () => ({
            select: () => Promise.resolve({ data: [], error: null }) // Generic success
          }),
          select: mockSelect
        };
      });

      // --- RUN TEST ---
      const result = await createSale({ saleData, items, userId });

      // --- ASSERTIONS ---
      expect(result.success).toBe(true);
      
      // Verify RPCs were called
      expect(mockRpc).toHaveBeenCalledWith('next_receipt_number');
      expect(mockRpc).toHaveBeenCalledWith('deduct_product_stock', {
        product_id: 'prod-1',
        quantity: 2
      });

      // Verify Batch was updated (FIFO logic)
      expect(supabase.from).toHaveBeenCalledWith(TABLES.PRODUCT_BATCHES);
      // The update should reduce batch quantity (100 - 2 = 98)
      expect(mockUpdate).toHaveBeenCalledWith({ quantity_remaining: 98 });
    });

    it('should fail if no open shift exists', async () => {
      const userId = 'user-1';
      const saleData = { payment_method: 'cash' as const, amount_paid: 100 };
      const items = [{ productId: 'prod-1', quantity: 1, unitPrice: 10 }];

      // Mock "Shift Not Found"
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === TABLES.SHIFT_SESSIONS) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    then: (resolve: any) => resolve({ data: [], error: null }) // Empty array = No shift
                  })
                })
              })
            })
          };
        }
        return { select: mockSelect };
      });

      const result = await createSale({ saleData, items, userId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No open shift found');
    });
  });
});