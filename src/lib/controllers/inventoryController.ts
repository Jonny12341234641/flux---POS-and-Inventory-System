import { supabase } from '../../lib/supabase';
import type { Category, Product, StockMovement, Supplier, ActionResponse } from '../../types';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';

// Removed local ControllerResult definition

type CategoryInsert = Omit<Category, 'id' | 'created_at' | 'updated_at'>;
type CategoryUpdate = Partial<CategoryInsert>;
type SupplierInsert = Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'is_active'> & {
  is_active?: boolean;
};
type SupplierUpdate = Partial<SupplierInsert>;
type ProductInsert = Omit<
  Product,
  'id' | 'created_at' | 'updated_at' | 'stock_quantity' | 'is_active'
> & {
  stock_quantity?: number;
  is_active?: boolean;
};
type ProductUpdate = Partial<ProductInsert>;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const ensureBarcodeAvailable = async (
  barcode?: string,
  excludeProductId?: string
) => {
  if (!barcode) {
    return;
  }

  let query = supabase
    .from(TABLES.PRODUCTS)
    .select('id')
    .eq('barcode', barcode);

  if (excludeProductId) {
    query = query.neq('id', excludeProductId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.length > 0) {
    throw new Error('Barcode already used');
  }
};

export const getCategories = async (): Promise<ActionResponse<Category[]>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Category[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch categories'),
    };
  }
};

export const createCategory = async (
  data: CategoryInsert
): Promise<ActionResponse<Category>> => {
  try {
    const payload: CategoryInsert = {
      ...data,
      is_active: data.is_active ?? true,
    };

    const { data: category, error } = await supabase
      .from(TABLES.CATEGORIES)
      .insert(payload)
      .select('*')
      .single();

    if (error || !category) {
      throw new Error(error?.message ?? 'Failed to create category');
    }

    return { success: true, data: category as Category };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create category'),
    };
  }
};

export const updateCategory = async (
  id: string,
  data: CategoryUpdate
): Promise<ActionResponse<Category>> => {
  try {
    const { data: category, error } = await supabase
      .from(TABLES.CATEGORIES)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !category) {
      throw new Error(error?.message ?? 'Failed to update category');
    }

    return { success: true, data: category as Category };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update category'),
    };
  }
};

export const deleteCategory = async (
  id: string
): Promise<ActionResponse<Category>> => {
  try {
    const { data: category, error } = await supabase
      .from(TABLES.CATEGORIES)
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !category) {
      throw new Error(error?.message ?? 'Failed to delete category');
    }

    return { success: true, data: category as Category };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete category'),
    };
  }
};

export const getSuppliers = async (): Promise<ActionResponse<Supplier[]>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Supplier[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch suppliers'),
    };
  }
};

export const createSupplier = async (
  data: SupplierInsert
): Promise<ActionResponse<Supplier>> => {
  try {
    const payload: SupplierInsert = {
      ...data,
      is_active: data.is_active ?? true,
    };

    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .insert(payload)
      .select('*')
      .single();

    if (error || !supplier) {
      throw new Error(error?.message ?? 'Failed to create supplier');
    }

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create supplier'),
    };
  }
};

export const updateSupplier = async (
  id: string,
  data: SupplierUpdate
): Promise<ActionResponse<Supplier>> => {
  try {
    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !supplier) {
      throw new Error(error?.message ?? 'Failed to update supplier');
    }

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update supplier'),
    };
  }
};

export const deleteSupplier = async (
  id: string
): Promise<ActionResponse<Supplier>> => {
  try {
    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !supplier) {
      throw new Error(error?.message ?? 'Failed to delete supplier');
    }

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete supplier'),
    };
  }
};

export const getProducts = async (
  query = '',
  page = 1
): Promise<ActionResponse<Product[]>> => {
  try {
    const trimmedQuery = query.trim();
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let request = supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('is_active', true);

    if (trimmedQuery) {
      const search = `%${trimmedQuery}%`;
      request = request.or(`name.ilike.${search},barcode.ilike.${search}`);
    }

    const { data, error } = await request
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Product[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch products'),
    };
  }
};

export const getProductById = async (
  id: string
): Promise<ActionResponse<Product>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Product not found');
    }

    return { success: true, data: data as Product };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch product'),
    };
  }
};

export const getLowStockProducts = async (): Promise<
  ActionResponse<Product[]>
> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message);
    }

    const lowStock = (data ?? []).filter(
      (product) => product.stock_quantity <= product.reorder_level
    );

    return { success: true, data: lowStock as Product[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch low stock products'),
    };
  }
};

export const createProduct = async (
  data: ProductInsert
): Promise<ActionResponse<Product>> => {
  try {
    await ensureBarcodeAvailable(data.barcode);

    const payload: ProductInsert = {
      ...data,
      stock_quantity: data.stock_quantity ?? 0,
      is_active: data.is_active ?? true,
    };

    const { data: product, error } = await supabase
      .from(TABLES.PRODUCTS)
      .insert(payload)
      .select('*')
      .single();

    if (error || !product) {
      throw new Error(error?.message ?? 'Failed to create product');
    }

    return { success: true, data: product as Product };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create product'),
    };
  }
};

export const updateProduct = async (
  id: string,
  data: ProductUpdate
): Promise<ActionResponse<Product>> => {
  try {
    if (data.barcode) {
      await ensureBarcodeAvailable(data.barcode, id);
    }

    const { data: product, error } = await supabase
      .from(TABLES.PRODUCTS)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !product) {
      throw new Error(error?.message ?? 'Failed to update product');
    }

    return { success: true, data: product as Product };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update product'),
    };
  }
};

export const deleteProduct = async (
  id: string
): Promise<ActionResponse<Product>> => {
  try {
    const { data: product, error } = await supabase
      .from(TABLES.PRODUCTS)
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !product) {
      throw new Error(error?.message ?? 'Failed to delete product');
    }

    return { success: true, data: product as Product };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete product'),
    };
  }
};

export const adjustStock = async (
  productId: string,
  quantityChange: number,
  reason: string,
  userId: string
): Promise<ActionResponse<{ movement: StockMovement; product: Product }>> => {
  try {
    const { data: product, error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error(productError?.message ?? 'Product not found');
    }

    const movementType: StockMovement['type'] =
      quantityChange < 0 ? 'damage' : 'adjustment';

    const { data: movement, error: movementError } = await supabase
      .from(TABLES.STOCK_MOVEMENTS)
      .insert({
        product_id: productId,
        type: movementType,
        quantity_change: quantityChange,
        remarks: reason,
        created_by: userId,
      })
      .select('*')
      .single();

    if (movementError || !movement) {
      throw new Error(movementError?.message ?? 'Failed to log stock movement');
    }

    const newQuantity = product.stock_quantity + quantityChange;
    const { data: updatedProduct, error: updateError } = await supabase
      .from(TABLES.PRODUCTS)
      .update({ stock_quantity: newQuantity })
      .eq('id', productId)
      .select('*')
      .single();

    if (updateError || !updatedProduct) {
      throw new Error(updateError?.message ?? 'Failed to update stock quantity');
    }

    return {
      success: true,
      data: {
        movement: movement as StockMovement,
        product: updatedProduct as Product,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to adjust stock'),
    };
  }
};