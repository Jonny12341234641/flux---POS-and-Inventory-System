import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSale } from '../saleController';
import { supabase } from '../../supabase';
import { TABLES } from '../../constants';

// Mock Supabase
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Sale Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSale', () => {
    it('should calculate totals and process sale successfully', async () => {
      // Input Data
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
          unitPrice: 10, // Subtotal: 20
          discount: 0,
          taxAmount: 0,
        },
      ];

      // Mock Data
      const mockProduct = { id: 'prod-1', name: 'Test Product', stock_quantity: 50 };
      const createdSale = { id: 'sale-1', ...saleData };
      const createdItems = [{ id: 'item-1', sale_id: 'sale-1', ...items[0] }];
      const createdMovement = { id: 'mov-1' };

      // Mock Chain Setup
      const mockSelect = vi.fn();
      const mockInsert = vi.fn();
      const mockUpdate = vi.fn();
      const mockEq = vi.fn();
      const mockIn = vi.fn();
      const mockSingle = vi.fn();

      // Default return values for the chain
      mockSelect.mockReturnThis();
      mockInsert.mockReturnThis();
      mockUpdate.mockReturnThis();
      mockEq.mockReturnThis();
      mockIn.mockResolvedValue({ data: [mockProduct], error: null });
      mockSingle.mockResolvedValue({ data: {}, error: null }); // Default fallback

      (supabase.from as any).mockImplementation((table: string) => {
        switch (table) {
          case TABLES.PRODUCTS:
            return {
              select: mockSelect,
              in: mockIn,
              update: mockUpdate, // For stock update
              eq: mockEq,
            };
          case TABLES.SALES:
            return {
              insert: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: createdSale, error: null })
                })
              })
            };
          case TABLES.SALE_ITEMS:
            return {
              insert: () => ({
                select: vi.fn().mockResolvedValue({ data: createdItems, error: null })
              })
            };
          case TABLES.STOCK_MOVEMENTS:
            return {
              insert: () => ({
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: createdMovement, error: null })
                })
              })
            };
          default:
            return { select: mockSelect };
        }
      });

      const result = await createSale({ saleData, items, userId });

      // Assertions
      expect(result.success).toBe(true);
      if (result.success) {
        // Check Sale Creation
        expect(result.data?.sale).toEqual(createdSale);
        
        // Check specific calls
        // 1. Stock Check
        expect(mockIn).toHaveBeenCalledWith('id', ['prod-1']);
        
        // 2. Product Stock Update (50 - 2 = 48)
        expect(mockUpdate).toHaveBeenCalledWith({ stock_quantity: 48 });
      }
    });

    it('should fail if insufficient stock', async () => {
      const userId = 'user-1';
      const saleData = { payment_method: 'cash' as const, amount_paid: 100 };
      const items = [{ productId: 'prod-1', quantity: 10, unitPrice: 10 }];

      // Mock Product with low stock
      const mockProduct = { id: 'prod-1', name: 'Test Product', stock_quantity: 5 }; // Only 5 in stock

      const mockIn = vi.fn().mockResolvedValue({ data: [mockProduct], error: null });
      const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
      
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await createSale({ saleData, items, userId });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient stock');
    });
  });
});
