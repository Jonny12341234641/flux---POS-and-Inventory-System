import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCategories, createCategory, createProduct, adjustStock } from '../inventoryController';
import { supabase } from '../../supabase';
import { TABLES } from '../../constants';

// Mock supabase client
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Inventory Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories', () => {
    it('should return categories when fetch is successful', async () => {
      const mockData = [{ id: '1', name: 'Test Category', is_active: true }];
      
      // Chain mocks: from -> select -> eq -> order
      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      
      (supabase.from as any).mockImplementation(mockFrom);

      const result = await getCategories();

      expect(supabase.from).toHaveBeenCalledWith(TABLES.CATEGORIES);
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
      expect(mockOrder).toHaveBeenCalledWith('name');
      expect(result).toEqual({ success: true, data: mockData });
    });

    it('should return error when fetch fails', async () => {
      const mockError = { message: 'DB Error' };
      
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      
      (supabase.from as any).mockImplementation(mockFrom);

      const result = await getCategories();

      expect(result).toEqual({ success: false, error: 'DB Error' });
    });
  });

  describe('createCategory', () => {
    it('should create a category successfully', async () => {
        const newCategory = { name: 'New Cat', description: 'Desc' };
        const createdCategory = { id: '1', ...newCategory, is_active: true };

        const mockSingle = vi.fn().mockResolvedValue({ data: createdCategory, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

        (supabase.from as any).mockImplementation(mockFrom);

        const result = await createCategory(newCategory);

        expect(supabase.from).toHaveBeenCalledWith(TABLES.CATEGORIES);
        expect(mockInsert).toHaveBeenCalledWith({ ...newCategory, is_active: true });
        expect(result).toEqual({ success: true, data: createdCategory });
    });
  });

  describe('createProduct', () => {
    it('should fail if barcode already exists', async () => {
        const productData = { 
            name: 'Prod', 
            barcode: '12345', 
            category_id: '1', 
            price: 10, 
            cost_price: 5, 
            unit: 'pcs', 
            reorder_level: 5 
        };

        // Mock barcode check returning an existing ID
        const mockLimit = vi.fn().mockResolvedValue({ data: [{ id: 'existing-id' }], error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: mockLimit }) });
        
        (supabase.from as any).mockImplementation(() => ({ select: mockSelect }));

        const result = await createProduct(productData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Barcode already used');
    });

    it('should create product if barcode is unique', async () => {
        const productData = { 
            name: 'Prod', 
            barcode: 'UNIQUE', 
            category_id: '1', 
            price: 10, 
            cost_price: 5, 
            unit: 'pcs', 
            reorder_level: 5 
        };
        const createdProduct = { id: 'p1', ...productData, stock_quantity: 0, is_active: true };

        // 1. Mock Barcode Check (Empty data = unique)
        const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
        
        // 2. Mock Insert
        const mockSingle = vi.fn().mockResolvedValue({ data: createdProduct, error: null });
        const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === TABLES.PRODUCTS) {
                // We need to distinguish between the SELECT (check) and INSERT calls
                // This simple mock setup assumes the first call is the check logic in the controller
                return {
                    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: mockLimit }) }),
                    insert: mockInsert
                };
            }
            return {};
        });

        const result = await createProduct(productData);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(createdProduct);
    });
  });

  describe('adjustStock', () => {
    it('should update stock and log movement', async () => {
        const productId = 'prod-1';
        const change = 10;
        const reason = 'Restock';
        const userId = 'admin';

        const mockProduct = { id: productId, stock_quantity: 50 };
        const updatedProduct = { ...mockProduct, stock_quantity: 60 };
        const mockMovement = { id: 'mov-1', type: 'adjustment', quantity_change: 10 };

        // 1. Get Product
        const mockSingleProd = vi.fn().mockResolvedValue({ data: mockProduct, error: null });
        
        // 2. Insert Movement
        const mockSingleMov = vi.fn().mockResolvedValue({ data: mockMovement, error: null });
        
        // 3. Update Product
        const mockSingleUpdate = vi.fn().mockResolvedValue({ data: updatedProduct, error: null });

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === TABLES.PRODUCTS) {
                return {
                    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingleProd }) }),
                    update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingleUpdate }) }) })
                };
            }
            if (table === TABLES.STOCK_MOVEMENTS) {
                return {
                    insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingleMov }) })
                };
            }
            return {};
        });

        const result = await adjustStock(productId, change, reason, userId);

        expect(result.success).toBe(true);
        expect(result.data?.product.stock_quantity).toBe(60);
        expect(supabase.from).toHaveBeenCalledWith(TABLES.STOCK_MOVEMENTS);
    });
  });
});

