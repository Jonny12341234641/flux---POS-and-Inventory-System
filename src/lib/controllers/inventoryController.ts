import { supabase } from '../../lib/supabase';
import type {
  Category,
  Product,
  StockMovement,
  ActionResponse,
  PurchaseOrder,
  StockMovementWithDetails,
} from '../../types';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';

// Removed local ControllerResult definition

type CategoryInsert = Omit<Category, 'id' | 'created_at' | 'updated_at'>;
type CategoryUpdate = Partial<CategoryInsert>;
type ProductInsert = Omit<
  Product,
  'id' | 'created_at' | 'updated_at' | 'stock_quantity' | 'is_active'
> & {
  stock_quantity?: number;
  is_active?: boolean;
};
type ProductUpdate = Partial<ProductInsert>;

type RestockOrderItem = {
  product_id: string;
  product_name: string;
  current_stock: number;
  reorder_level: number;
  order_quantity: number;
  unit_cost: number;
  total_cost: number;
};

type RestockOrderDraft = {
  supplier_id: string;
  status: PurchaseOrder['status'];
  order_date: string;
  total_amount: number;
  items: RestockOrderItem[];
};

type ProductWithSupplier = Product & { supplier_id?: string | null };

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

const normalizeAuditDetails = (
  details: Record<string, unknown> | string | null
): string | null => {
  if (details === null || typeof details === 'undefined') {
    return null;
  }
  if (typeof details === 'string') {
    return details;
  }
  return JSON.stringify(details);
};

const logProductAudit = async (
  userId: string,
  details: string
): Promise<void> => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'PRODUCT_UPDATE',
      details: normalizeAuditDetails(details),
      ip_address: null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error(
      'Product audit log failed:',
      getErrorMessage(error, 'Audit log error')
    );
  }
};

const buildProductAuditMessages = (
  currentProduct: Product,
  updates: ProductUpdate,
  userId: string
) => {
  const messages: string[] = [];

  if (
    typeof updates.price !== 'undefined' &&
    updates.price !== currentProduct.price
  ) {
    messages.push(
      `Price changed from ${currentProduct.price} to ${updates.price} by User ${userId}`
    );
  }

  if (
    typeof updates.cost_price !== 'undefined' &&
    updates.cost_price !== currentProduct.cost_price
  ) {
    messages.push(
      `Cost price changed from ${currentProduct.cost_price} to ${updates.cost_price} by User ${userId}`
    );
  }

  if (
    typeof updates.name !== 'undefined' &&
    updates.name !== currentProduct.name
  ) {
    messages.push(
      `Name changed from ${currentProduct.name} to ${updates.name} by User ${userId}`
    );
  }

  if (
    typeof updates.stock_quantity !== 'undefined' &&
    updates.stock_quantity !== currentProduct.stock_quantity
  ) {
    messages.push(
      `Stock quantity changed from ${currentProduct.stock_quantity} to ${updates.stock_quantity} by User ${userId}`
    );
  }

  return messages;
};

const getDuplicateBarcodes = (barcodes: string[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const barcode of barcodes) {
    if (seen.has(barcode)) {
      duplicates.add(barcode);
    } else {
      seen.add(barcode);
    }
  }

  return Array.from(duplicates);
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

export const getProducts = async (
  query = '',
  page = 1,
  filters?: { categoryId?: string; supplierId?: string; status?: string }
): Promise<ActionResponse<Product[]>> => {
  try {
    const trimmedQuery = query.trim();
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let request = supabase
      .from(TABLES.PRODUCTS)
      .select('*');

    if (filters?.categoryId) {
      request = request.eq('category_id', filters.categoryId);
    }
    if (filters?.supplierId) {
      request = request.eq('supplier_id', filters.supplierId);
    }
    if (filters?.status === 'active') {
      request = request.eq('is_active', true);
    } else if (filters?.status === 'inactive') {
      request = request.eq('is_active', false);
    } else {
      request = request.eq('is_active', true);
    }

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

    // 2. NEW FIX: If initial stock is added, create the first Batch automatically!
    const initialStock = Number(payload.stock_quantity);
    if (initialStock > 0) {
      const { error: batchError } = await supabase
        .from(TABLES.PRODUCT_BATCHES)
        .insert({
          product_id: product.id,
          quantity_initial: initialStock,
          quantity_remaining: initialStock,
          cost_price_at_purchase: product.cost_price,
          expiry_date: null,
        });

      if (batchError) {
        console.error('Failed to create initial batch:', batchError.message);
      }
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
  data: ProductUpdate,
  userId?: string
): Promise<ActionResponse<Product>> => {
  try {
    if (data.barcode) {
      await ensureBarcodeAvailable(data.barcode, id);
    }

    const shouldAudit =
      Boolean(userId) &&
      (typeof data.price !== 'undefined' ||
        typeof data.cost_price !== 'undefined' ||
        typeof data.name !== 'undefined' ||
        typeof data.stock_quantity !== 'undefined');

    let currentProduct: Product | null = null;
    if (shouldAudit) {
      const { data: existingProduct, error: existingError } = await supabase
        .from(TABLES.PRODUCTS)
        .select('*')
        .eq('id', id)
        .single();

      if (existingError || !existingProduct) {
        throw new Error(existingError?.message ?? 'Product not found');
      }

      currentProduct = existingProduct as Product;
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

    if (shouldAudit && currentProduct && userId) {
      const messages = buildProductAuditMessages(
        currentProduct,
        data,
        userId
      );
      if (messages.length > 0) {
        await logProductAudit(userId, messages.join('; '));
      }
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
  type: StockMovement['type'],
  reason: string,
  userId: string,
  unitCost?: number
): Promise<ActionResponse<{ movement: StockMovement; product: Product }>> => {
  try {
    if (type === 'purchase') {
      if (typeof unitCost !== 'number' || !Number.isFinite(unitCost)) {
        throw new Error('Unit cost is required for purchase adjustments');
      }
      if (quantityChange <= 0) {
        throw new Error('Purchase quantity must be greater than zero');
      }
    }

    const { data: product, error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error(productError?.message ?? 'Product not found');
    }

    const { data: movement, error: movementError } = await supabase
      .from(TABLES.STOCK_MOVEMENTS)
      .insert({
        product_id: productId,
        type,
        quantity_change: quantityChange,
        remarks: reason,
        created_by: userId,
      })
      .select('*')
      .single();

    if (movementError || !movement) {
      throw new Error(movementError?.message ?? 'Failed to log stock movement');
    }

    const currentStock = product.stock_quantity ?? 0;
    const newQuantity = currentStock + quantityChange;

    const updatePayload: Partial<Product> = {
      stock_quantity: newQuantity,
    };

    if (type === 'purchase' && typeof unitCost === 'number') {
      const currentCost = product.cost_price ?? 0;
      const newCost =
        (currentStock * currentCost + quantityChange * unitCost) /
        (currentStock + quantityChange);
      updatePayload.cost_price = newCost;
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from(TABLES.PRODUCTS)
      .update(updatePayload)
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

export const bulkImportProducts = async (
  products: ProductInsert[]
): Promise<ActionResponse<Product[]>> => {
  try {
    if (!products.length) {
      return { success: true, data: [] };
    }

    const barcodes = products.map((product) => product.barcode).filter(Boolean);
    if (barcodes.length !== products.length) {
      throw new Error('All products must include a barcode');
    }

    const duplicateBarcodes = getDuplicateBarcodes(barcodes);
    if (duplicateBarcodes.length > 0) {
      throw new Error(
        `Duplicate barcodes in import: ${duplicateBarcodes.join(', ')}`
      );
    }

    const uniqueBarcodes = Array.from(new Set(barcodes));
    const { data: existing, error: existingError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('barcode')
      .in('barcode', uniqueBarcodes);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingBarcodes = new Set(
      (existing ?? []).map((row) => row.barcode)
    );

    const payload = products.map((product) => ({
      ...product,
      stock_quantity: product.stock_quantity ?? 0,
      is_active: product.is_active ?? true,
    }));

    const { data, error } = await supabase
      .from(TABLES.PRODUCTS)
      .upsert(payload, { onConflict: 'barcode' })
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    const insertedCount = uniqueBarcodes.length - existingBarcodes.size;
    const updatedCount = existingBarcodes.size;

    return {
      success: true,
      data: (data ?? []) as Product[],
      message: `Imported ${insertedCount} new products, updated ${updatedCount} existing products.`,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Bulk import failed'),
    };
  }
};

export const getProductVariants = async (
  parentId: string
): Promise<ActionResponse<Product[]>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Product[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch product variants'),
    };
  }
};

export const getProductStockHistory = async (
  productId: string
): Promise<ActionResponse<StockMovementWithDetails[]>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.STOCK_MOVEMENTS)
      .select(`*, creator:${TABLES.USERS}(full_name)`)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as StockMovementWithDetails[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch stock history'),
    };
  }
};

export const generateRestockOrder = async (
  supplierId: string
): Promise<ActionResponse<RestockOrderDraft>> => {
  try {
    const lowStockResult = await getLowStockProducts();

    if (!lowStockResult.success || !lowStockResult.data) {
      throw new Error(lowStockResult.error ?? 'Failed to fetch low stock items');
    }

    const items = (lowStockResult.data as ProductWithSupplier[])
      .filter((product) => product.supplier_id === supplierId)
      .map((product) => {
        const orderQuantity = product.reorder_level - product.stock_quantity;
        const unitCost = product.cost_price ?? 0;

        return {
          product_id: product.id,
          product_name: product.name,
          current_stock: product.stock_quantity,
          reorder_level: product.reorder_level,
          order_quantity: orderQuantity,
          unit_cost: unitCost,
          total_cost: orderQuantity * unitCost,
        };
      })
      .filter((item) => item.order_quantity > 0);

    const totalAmount = items.reduce(
      (total, item) => total + item.total_cost,
      0
    );

    return {
      success: true,
      data: {
        supplier_id: supplierId,
        status: 'pending',
        order_date: new Date().toISOString(),
        total_amount: totalAmount,
        items,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to generate restock order'),
    };
  }
};
