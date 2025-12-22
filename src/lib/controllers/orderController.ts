import { supabase } from '../../lib/supabase';
import type {
  PurchaseOrder,
  PurchaseItem,
  Product,
  StockMovement,
} from '../../types';
import { TABLES } from '../../lib/constants';

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type PurchaseOrderInput = Pick<
  PurchaseOrder,
  'supplier_id' | 'reference_number' | 'expected_date' | 'notes' | 'created_by'
> & {
  order_date?: string;
};

type PurchaseItemInput = Pick<
  PurchaseItem,
  'product_id' | 'quantity' | 'unit_cost' | 'expiry_date'
> & {
  total_cost?: number;
};

type PurchaseOrderWithSupplier = PurchaseOrder & {
  supplier?: { name: string } | null;
};

type PurchaseOrderWithItems = PurchaseOrder & {
  purchase_items: PurchaseItem[];
};

type ReceiveGoodsResult = {
  order: PurchaseOrder;
  products: Product[];
  movements: StockMovement[];
};

type ProcessedReceiptItem = {
  product_id: string;
  previous_stock: number;
  previous_cost: number;
  movement_id: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const rollbackProcessedReceipts = async (
  processed: ProcessedReceiptItem[]
): Promise<string[]> => {
  const rollbackErrors: string[] = [];

  for (const item of [...processed].reverse()) {
    const { error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .update({
        stock_quantity: item.previous_stock,
        cost_price: item.previous_cost,
      })
      .eq('id', item.product_id);

    if (productError) {
      rollbackErrors.push(
        `Product ${item.product_id}: ${productError.message}`
      );
    }

    const { error: movementError } = await supabase
      .from(TABLES.STOCK_MOVEMENTS)
      .delete()
      .eq('id', item.movement_id);

    if (movementError) {
      rollbackErrors.push(
        `Stock movement ${item.movement_id}: ${movementError.message}`
      );
    }
  }

  return rollbackErrors;
};

export const getPurchaseOrders = async (): Promise<
  ControllerResult<PurchaseOrderWithSupplier[]>
> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select(`*, supplier:${TABLES.SUPPLIERS}(name)`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as PurchaseOrderWithSupplier[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch purchase orders'),
    };
  }
};

export const getPurchaseOrderById = async (
  id: string
): Promise<ControllerResult<PurchaseOrderWithItems>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select(`*, ${TABLES.PURCHASE_ITEMS}(*)`)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Purchase order not found');
    }

    return { success: true, data: data as PurchaseOrderWithItems };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch purchase order'),
    };
  }
};

export const createPurchaseOrder = async (
  orderData: PurchaseOrderInput,
  items: PurchaseItemInput[]
): Promise<ControllerResult<PurchaseOrderWithItems>> => {
  try {
    if (!items.length) {
      throw new Error('Purchase order requires at least one item');
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      total_cost: item.quantity * item.unit_cost,
    }));

    const totalAmount = normalizedItems.reduce(
      (total, item) => total + item.total_cost,
      0
    );

    const payload = {
      supplier_id: orderData.supplier_id,
      reference_number: orderData.reference_number,
      expected_date: orderData.expected_date,
      notes: orderData.notes,
      created_by: orderData.created_by,
      total_amount: totalAmount,
      status: 'pending' as PurchaseOrder['status'],
      ...(orderData.order_date ? { order_date: orderData.order_date } : {}),
    };

    const { data: order, error: orderError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .insert(payload)
      .select('*')
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Failed to create purchase order');
    }

    const itemsToInsert = normalizedItems.map((item) => ({
      purchase_order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
      expiry_date: item.expiry_date,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from(TABLES.PURCHASE_ITEMS)
      .insert(itemsToInsert)
      .select('*');

    if (itemsError) {
      const { error: cleanupError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .delete()
        .eq('id', order.id);

      if (cleanupError) {
        throw new Error(
          `Failed to add items. Cleanup failed: ${cleanupError.message}`
        );
      }

      throw new Error(itemsError.message);
    }

    return {
      success: true,
      data: {
        ...(order as PurchaseOrder),
        purchase_items: (insertedItems ?? []) as PurchaseItem[],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create purchase order'),
    };
  }
};

export const receiveGoods = async (
  orderId: string,
  userId: string
): Promise<ControllerResult<ReceiveGoodsResult>> => {
  const processed: ProcessedReceiptItem[] = [];

  try {
    const { data: order, error: orderError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Purchase order not found');
    }

    if (order.status === 'received') {
      throw new Error('Purchase order already received');
    }

    if (order.status === 'cancelled') {
      throw new Error('Cannot receive a cancelled purchase order');
    }

    const { data: items, error: itemsError } = await supabase
      .from(TABLES.PURCHASE_ITEMS)
      .select('*')
      .eq('purchase_order_id', orderId);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    if (!items || items.length === 0) {
      throw new Error('No purchase items found for this order');
    }

    const productIds = Array.from(
      new Set(items.map((item) => item.product_id))
    );

    const { data: products, error: productsError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .in('id', productIds);

    if (productsError || !products) {
      throw new Error(productsError?.message ?? 'Failed to fetch products');
    }

    const productMap = new Map<string, Product>(
      (products as Product[]).map((product) => [product.id, product])
    );

    const updatedProducts: Product[] = [];
    const movements: StockMovement[] = [];

    for (const item of items as PurchaseItem[]) {
      const currentProduct = productMap.get(item.product_id);

      if (!currentProduct) {
        throw new Error(`Product ${item.product_id} not found`);
      }

      const previousStock = currentProduct.stock_quantity;
      const previousCost = currentProduct.cost_price;
      const newQuantity = previousStock + item.quantity;

      const { data: updatedProduct, error: updateError } = await supabase
        .from(TABLES.PRODUCTS)
        .update({
          stock_quantity: newQuantity,
          cost_price: item.unit_cost,
        })
        .eq('id', currentProduct.id)
        .select('*')
        .single();

      if (updateError || !updatedProduct) {
        throw new Error(
          updateError?.message ??
            `Failed to update product ${currentProduct.name}`
        );
      }

      const { data: movement, error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .insert({
          product_id: currentProduct.id,
          type: 'purchase',
          quantity_change: item.quantity,
          reference_id: orderId,
          created_by: userId,
        })
        .select('*')
        .single();

      if (movementError || !movement) {
        const { error: rollbackError } = await supabase
          .from(TABLES.PRODUCTS)
          .update({
            stock_quantity: previousStock,
            cost_price: previousCost,
          })
          .eq('id', currentProduct.id);

        if (rollbackError) {
          throw new Error(
            `Failed to log stock movement for ${currentProduct.name}. ` +
              `Rollback failed: ${rollbackError.message}`
          );
        }

        throw new Error(
          movementError?.message ??
            `Failed to log stock movement for ${currentProduct.name}`
        );
      }

      processed.push({
        product_id: currentProduct.id,
        previous_stock: previousStock,
        previous_cost: previousCost,
        movement_id: movement.id,
      });

      productMap.set(currentProduct.id, updatedProduct as Product);
      updatedProducts.push(updatedProduct as Product);
      movements.push(movement as StockMovement);
    }

    const { data: updatedOrder, error: statusError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .update({ status: 'received' })
      .eq('id', orderId)
      .select('*')
      .single();

    if (statusError || !updatedOrder) {
      throw new Error(
        statusError?.message ?? 'Failed to update purchase order status'
      );
    }

    return {
      success: true,
      data: {
        order: updatedOrder as PurchaseOrder,
        products: updatedProducts,
        movements,
      },
    };
  } catch (error) {
    if (processed.length > 0) {
      const rollbackErrors = await rollbackProcessedReceipts(processed);
      if (rollbackErrors.length > 0) {
        return {
          success: false,
          error: `${getErrorMessage(
            error,
            'Failed to receive goods'
          )}. Rollback issues: ${rollbackErrors.join('; ')}`,
        };
      }
    }

    return {
      success: false,
      error: getErrorMessage(error, 'Failed to receive goods'),
    };
  }
};

export const cancelOrder = async (
  id: string
): Promise<ControllerResult<PurchaseOrder>> => {
  try {
    const { data: order, error: orderError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select('id, status')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Purchase order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be cancelled');
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updatedOrder) {
      throw new Error(updateError?.message ?? 'Failed to cancel purchase order');
    }

    return { success: true, data: updatedOrder as PurchaseOrder };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to cancel purchase order'),
    };
  }
};
