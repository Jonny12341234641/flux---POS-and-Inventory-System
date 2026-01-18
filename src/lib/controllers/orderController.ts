import { supabase } from '../../lib/supabase';
import type {
  PurchaseOrder,
  PurchaseItem,
  Product,
  StockMovement,
} from '../../types';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type PurchaseOrderPaymentStatus = 'paid' | 'unpaid' | 'partial';

type PurchaseOrderInput = Pick<
  PurchaseOrder,
  'supplier_id' | 'reference_number' | 'expected_date' | 'notes' | 'created_by'
> & {
  order_date?: string;
  payment_status?: PurchaseOrderPaymentStatus;
};

type PurchaseItemInput = Pick<
  PurchaseItem,
  'product_id' | 'quantity' | 'unit_cost' | 'expiry_date'
> & {
  total_cost?: number;
};

type PurchaseOrderUpdateInput = Partial<PurchaseOrderInput>;

type ReceiveGoodsItemInput = Pick<PurchaseItem, 'product_id' | 'quantity'> & {
  unit_cost?: number;
  expiry_date?: string;
};

type ReturnGoodsItemInput = {
  product_id: string;
  quantity: number;
  reason?: string;
};

type PurchaseOrderWithSupplier = PurchaseOrder & {
  supplier?: { name: string } | null;
};

type PurchaseItemWithProduct = PurchaseItem & {
  product?: { name: string } | null;
};

type PurchaseOrderWithItems = PurchaseOrder & {
  supplier?: {
    name: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  purchase_items: PurchaseItemWithProduct[];
};

type ReceiveGoodsResult = {
  order: PurchaseOrder;
  products: Product[];
  movements: StockMovement[];
};

type ReturnGoodsResult = {
  order: PurchaseOrder;
  products: Product[];
  movements: StockMovement[];
  return_total: number;
};

type ProcessedReceiptItem = {
  product_id: string;
  previous_stock: number;
  previous_cost: number;
  movement_id: string;
};

type OrderMovementRow = Pick<
  StockMovement,
  'product_id' | 'type' | 'quantity_change'
>;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isMissingColumnError = (error: unknown, column: string) => {
  if (!error) {
    return false;
  }

  const message =
    typeof error === 'string'
      ? error
      : (error as { message?: string }).message ?? '';
  const normalized = message.toLowerCase();
  return normalized.includes('column') && normalized.includes(column.toLowerCase());
};

const normalizePurchaseItems = (items: PurchaseItemInput[]) => {
  const normalizedItems = items.map((item) => ({
    ...item,
    total_cost: item.quantity * item.unit_cost,
  }));

  const totalAmount = normalizedItems.reduce(
    (total, item) => total + item.total_cost,
    0
  );

  return { normalizedItems, totalAmount };
};

const ensureSupplierActive = async (supplierId: string) => {
  const { data, error } = await supabase
    .from(TABLES.SUPPLIERS)
    .select('id, is_active')
    .eq('id', supplierId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Supplier not found');
  }

  if (!data.is_active) {
    throw new Error('Cannot order from inactive supplier');
  }
};

const ensureProductsActive = async (productIds: string[]) => {
  if (!productIds.length) {
    return;
  }

  const { data, error } = await supabase
    .from(TABLES.PRODUCTS)
    .select('id, is_active')
    .in('id', productIds);

  if (error) {
    throw new Error(error.message);
  }

  const productMap = new Map(
    (data ?? []).map((product) => [product.id, product])
  );

  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }
    if (!product.is_active) {
      throw new Error('Cannot order discontinued product');
    }
  }
};

const updateProductStockSafely = async (
  productId: string,
  previousStock: number,
  update: Partial<Product>,
  productName?: string
) => {
  const { data, error } = await supabase
    .from(TABLES.PRODUCTS)
    .update(update)
    .eq('id', productId)
    .eq('stock_quantity', previousStock)
    .select('*');

  if (error) {
    throw new Error(error.message);
  }

  const updatedProduct = (data ?? [])[0];

  if (!updatedProduct) {
    const nameSuffix = productName ? ` for ${productName}` : '';
    throw new Error(`Inventory update conflict${nameSuffix}. Please retry`);
  }

  return updatedProduct as Product;
};

const fetchPurchaseReceiptTotals = async (orderId: string) => {
  const { data, error } = await supabase
    .from(TABLES.STOCK_MOVEMENTS)
    .select('product_id, quantity_change')
    .eq('reference_id', orderId)
    .eq('type', 'purchase');

  if (error) {
    throw new Error(error.message);
  }

  const totals = new Map<string, number>();

  for (const row of (data ?? []) as Pick<
    StockMovement,
    'product_id' | 'quantity_change'
  >[]) {
    const quantity = Number(row.quantity_change) || 0;
    totals.set(
      row.product_id,
      (totals.get(row.product_id) ?? 0) + Math.abs(quantity)
    );
  }

  return totals;
};

const fetchOrderMovementTotals = async (orderId: string) => {
  const { data, error } = await supabase
    .from(TABLES.STOCK_MOVEMENTS)
    .select('product_id, type, quantity_change')
    .eq('reference_id', orderId)
    .in('type', ['purchase', 'return']);

  if (error) {
    throw new Error(error.message);
  }

  const received = new Map<string, number>();
  const returned = new Map<string, number>();

  for (const row of (data ?? []) as OrderMovementRow[]) {
    const quantity = Number(row.quantity_change) || 0;
    if (row.type === 'purchase') {
      received.set(
        row.product_id,
        (received.get(row.product_id) ?? 0) + Math.abs(quantity)
      );
    }
    if (row.type === 'return') {
      returned.set(
        row.product_id,
        (returned.get(row.product_id) ?? 0) + Math.abs(quantity)
      );
    }
  }

  return { received, returned };
};

const insertPurchaseOrder = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_ORDERS)
    .insert(payload)
    .select('*')
    .single();

  if (!error && data) {
    return data as PurchaseOrder;
  }

  if (error && isMissingColumnError(error, 'payment_status')) {
    // Retry without payment_status if the column doesn't exist.
    const { payment_status, ...fallbackPayload } = payload;
    const { data: fallbackData, error: fallbackError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .insert(fallbackPayload)
      .select('*')
      .single();

    if (fallbackError || !fallbackData) {
      throw new Error(
        fallbackError?.message ?? 'Failed to create purchase order'
      );
    }

    return fallbackData as PurchaseOrder;
  }

  throw new Error(error?.message ?? 'Failed to create purchase order');
};

const updatePurchaseOrderReturnSummary = async (
  order: PurchaseOrder,
  returnItems: ReturnGoodsItemInput[],
  returnTotal: number
) => {
  const itemSummary = returnItems
    .map((item) => `${item.product_id}:${item.quantity}`)
    .join(', ');
  const note = `Return to supplier (${new Date().toISOString()}): ${itemSummary}. Total: ${returnTotal}`;
  const updatedNotes = order.notes ? `${order.notes}\n${note}` : note;

  const updatePayload: Record<string, unknown> = {
    notes: updatedNotes,
  };

  const orderRecord = order as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(orderRecord, 'return_total')) {
    const existingReturnTotal = Number(orderRecord.return_total ?? 0);
    if (Number.isFinite(existingReturnTotal)) {
      updatePayload.return_total = existingReturnTotal + returnTotal;
    }
  }

  const { data, error } = await supabase
    .from(TABLES.PURCHASE_ORDERS)
    .update(updatePayload)
    .eq('id', order.id)
    .select('*')
    .single();

  if (error || !data) {
    if (
      error &&
      'return_total' in updatePayload &&
      isMissingColumnError(error, 'return_total')
    ) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .update({ notes: updatedNotes })
        .eq('id', order.id)
        .select('*')
        .single();

      if (fallbackError || !fallbackData) {
        throw new Error(
          fallbackError?.message ?? 'Failed to update purchase order'
        );
      }

      return fallbackData as PurchaseOrder;
    }

    throw new Error(error?.message ?? 'Failed to update purchase order');
  }

  return data as PurchaseOrder;
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

export const getPurchaseOrders = async (
  page = 1,
  limit = ITEMS_PER_PAGE
): Promise<ControllerResult<PurchaseOrderWithSupplier[]>> => {
  try {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? limit : ITEMS_PER_PAGE;
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    const { data, error } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select(`*, supplier:${TABLES.SUPPLIERS}(name)`)
      .order('created_at', { ascending: false })
      .range(from, to);

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
      .select(
        `*, supplier:${TABLES.SUPPLIERS}(name, contact_person, phone, email), ${TABLES.PURCHASE_ITEMS}(*, product:${TABLES.PRODUCTS}(name))`
      )
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

    await ensureSupplierActive(orderData.supplier_id);

    const productIds = Array.from(new Set(items.map((item) => item.product_id)));
    await ensureProductsActive(productIds);

    const { normalizedItems, totalAmount } = normalizePurchaseItems(items);

    const payload = {
      supplier_id: orderData.supplier_id,
      reference_number: orderData.reference_number,
      expected_date: orderData.expected_date,
      notes: orderData.notes,
      created_by: orderData.created_by,
      total_amount: totalAmount,
      status: 'pending' as PurchaseOrder['status'],
      payment_status: orderData.payment_status ?? 'unpaid',
      ...(orderData.order_date ? { order_date: orderData.order_date } : {}),
    };

    const order = await insertPurchaseOrder(payload);

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

export const updatePurchaseOrder = async (
  orderId: string,
  items: PurchaseItemInput[],
  orderUpdates: PurchaseOrderUpdateInput = {}
): Promise<ControllerResult<PurchaseOrderWithItems>> => {
  let existingItems: PurchaseItem[] = [];

  try {
    if (!items.length) {
      throw new Error('Purchase order requires at least one item');
    }

    const { data: order, error: orderError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Purchase order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be updated');
    }

    const { data: receiptMovements, error: receiptError } = await supabase
      .from(TABLES.STOCK_MOVEMENTS)
      .select('id')
      .eq('reference_id', orderId)
      .eq('type', 'purchase')
      .limit(1);

    if (receiptError) {
      throw new Error(receiptError.message);
    }

    if (receiptMovements && receiptMovements.length > 0) {
      throw new Error('Cannot edit a purchase order with received items');
    }

    const supplierId = orderUpdates.supplier_id ?? order.supplier_id;
    await ensureSupplierActive(supplierId);

    const productIds = Array.from(new Set(items.map((item) => item.product_id)));
    await ensureProductsActive(productIds);

    const { normalizedItems, totalAmount } = normalizePurchaseItems(items);

    const { data: existingItemsData, error: existingItemsError } =
      await supabase
        .from(TABLES.PURCHASE_ITEMS)
        .select('*')
        .eq('purchase_order_id', orderId);

    if (existingItemsError) {
      throw new Error(existingItemsError.message);
    }

    existingItems = (existingItemsData ?? []) as PurchaseItem[];

    const { error: deleteError } = await supabase
      .from(TABLES.PURCHASE_ITEMS)
      .delete()
      .eq('purchase_order_id', orderId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const itemsToInsert = normalizedItems.map((item) => ({
      purchase_order_id: orderId,
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
      if (existingItems.length > 0) {
        const { error: rollbackError } = await supabase
          .from(TABLES.PURCHASE_ITEMS)
          .insert(existingItems);

        if (rollbackError) {
          throw new Error(
            `Failed to update items. Rollback failed: ${rollbackError.message}`
          );
        }
      }

      throw new Error(itemsError.message);
    }

    const updatePayload: Record<string, unknown> = {
      total_amount: totalAmount,
    };

    if (typeof orderUpdates.reference_number !== 'undefined') {
      updatePayload.reference_number = orderUpdates.reference_number;
    }
    if (typeof orderUpdates.expected_date !== 'undefined') {
      updatePayload.expected_date = orderUpdates.expected_date;
    }
    if (typeof orderUpdates.notes !== 'undefined') {
      updatePayload.notes = orderUpdates.notes;
    }
    if (typeof orderUpdates.order_date !== 'undefined') {
      updatePayload.order_date = orderUpdates.order_date;
    }
    if (typeof orderUpdates.supplier_id !== 'undefined') {
      updatePayload.supplier_id = orderUpdates.supplier_id;
    }
    if (typeof orderUpdates.payment_status !== 'undefined') {
      updatePayload.payment_status = orderUpdates.payment_status;
    }

    let { data: updatedOrder, error: updateError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .update(updatePayload)
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (updateError && isMissingColumnError(updateError, 'payment_status')) {
      const { payment_status, ...fallbackPayload } = updatePayload;
      const fallbackResult = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .update(fallbackPayload)
        .eq('id', orderId)
        .eq('status', 'pending')
        .select('*')
        .single();
      updatedOrder = fallbackResult.data;
      updateError = fallbackResult.error;
    }

    if (updateError || !updatedOrder) {
      const rollbackNotes: string[] = [];

      const { error: deleteNewError } = await supabase
        .from(TABLES.PURCHASE_ITEMS)
        .delete()
        .eq('purchase_order_id', orderId);

      if (deleteNewError) {
        rollbackNotes.push(`Cleanup failed: ${deleteNewError.message}`);
      }

      if (existingItems.length > 0) {
        const { error: restoreError } = await supabase
          .from(TABLES.PURCHASE_ITEMS)
          .insert(existingItems);
        if (restoreError) {
          rollbackNotes.push(`Restore failed: ${restoreError.message}`);
        }
      }

      const baseMessage =
        updateError?.message ?? 'Failed to update purchase order';

      if (rollbackNotes.length > 0) {
        throw new Error(`${baseMessage}. ${rollbackNotes.join(' ')}`);
      }

      throw new Error(baseMessage);
    }

    return {
      success: true,
      data: {
        ...(updatedOrder as PurchaseOrder),
        purchase_items: (insertedItems ?? []) as PurchaseItem[],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update purchase order'),
    };
  }
};

export const receiveGoods = async (
  orderId: string,
  userId: string,
  receivedItems: ReceiveGoodsItemInput[] = []
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

    const purchaseItems = items as PurchaseItem[];
    const purchaseItemMap = new Map<string, PurchaseItem>(
      purchaseItems.map((item) => [item.product_id, item])
    );

    const receivedTotals = await fetchPurchaseReceiptTotals(orderId);
    const receiptQueue: ReceiveGoodsItemInput[] = [];
    const receiptTotals = new Map<string, number>();

    if (receivedItems.length > 0) {
      for (const receipt of receivedItems) {
        const orderItem = purchaseItemMap.get(receipt.product_id);

        if (!orderItem) {
          throw new Error(
            `Cannot receive product ${receipt.product_id} not found on this order`
          );
        }

        const quantity = Number(receipt.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Cannot receive a non-positive quantity');
        }

        const alreadyReceived = receivedTotals.get(receipt.product_id) ?? 0;
        const remaining = orderItem.quantity - alreadyReceived;

        if (remaining <= 0) {
          throw new Error('Purchase order already received');
        }

        const batchReceived = receiptTotals.get(receipt.product_id) ?? 0;
        if (batchReceived + quantity > remaining) {
          throw new Error(
            `Cannot receive more than remaining quantity for product ${receipt.product_id}`
          );
        }

        receiptTotals.set(receipt.product_id, batchReceived + quantity);

        receiptQueue.push({
          product_id: receipt.product_id,
          quantity,
          unit_cost:
            typeof receipt.unit_cost === 'number'
              ? receipt.unit_cost
              : orderItem.unit_cost,
          expiry_date:
            typeof receipt.expiry_date !== 'undefined'
              ? receipt.expiry_date
              : orderItem.expiry_date,
        });
      }
    } else {
      for (const item of purchaseItems) {
        const alreadyReceived = receivedTotals.get(item.product_id) ?? 0;
        const remaining = item.quantity - alreadyReceived;

        if (remaining <= 0) {
          continue;
        }

        receiptTotals.set(item.product_id, remaining);

        receiptQueue.push({
          product_id: item.product_id,
          quantity: remaining,
          unit_cost: item.unit_cost,
          expiry_date: item.expiry_date,
        });
      }
    }

    if (receiptQueue.length === 0) {
      throw new Error('Purchase order already received');
    }

    const receiptProductIds = Array.from(
      new Set(receiptQueue.map((item) => item.product_id))
    );

    const { data: products, error: productsError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .in('id', receiptProductIds);

    if (productsError || !products) {
      throw new Error(productsError?.message ?? 'Failed to fetch products');
    }

    const productMap = new Map<string, Product>(
      (products as Product[]).map((product) => [product.id, product])
    );

    const updatedProducts: Product[] = [];
    const movements: StockMovement[] = [];

    for (const receipt of receiptQueue) {
      const currentProduct = productMap.get(receipt.product_id);

      if (!currentProduct) {
        throw new Error(`Product ${receipt.product_id} not found`);
      }

      const previousStock = currentProduct.stock_quantity ?? 0;
      const previousCost = currentProduct.cost_price ?? 0;
      const incomingQty = receipt.quantity;
      const incomingCost = Number(receipt.unit_cost ?? 0);

      if (!Number.isFinite(incomingCost)) {
        throw new Error(
          `Cannot receive invalid unit cost for ${currentProduct.name}`
        );
      }

      const newQuantity = previousStock + incomingQty;
      const weightedCost =
        newQuantity > 0
          ? (previousStock * previousCost + incomingQty * incomingCost) /
            newQuantity
          : incomingCost;

      const updatedProduct = await updateProductStockSafely(
        currentProduct.id,
        previousStock,
        {
          stock_quantity: newQuantity,
          cost_price: weightedCost,
        },
        currentProduct.name
      );

      const { data: movement, error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .insert({
          product_id: currentProduct.id,
          type: 'purchase',
          quantity_change: incomingQty,
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

      // 3. (NEW) CREATE THE BATCH RECORD
      // This is the "Box" that holds this specific shipment
      const { error: batchError } = await supabase
        .from(TABLES.PRODUCT_BATCHES)
        .insert({
          product_id: currentProduct.id,
          quantity_initial: incomingQty,
          quantity_remaining: incomingQty, // Initially, full amount is available
          cost_price_at_purchase: incomingCost,
          expiry_date: receipt.expiry_date ?? null,
          created_at: new Date().toISOString(),
        });

      if (batchError) {
        console.error('Failed to create batch:', batchError.message);
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

    const totalReceivedByProduct = new Map(receivedTotals);
    for (const [productId, receivedNow] of receiptTotals.entries()) {
      totalReceivedByProduct.set(
        productId,
        (totalReceivedByProduct.get(productId) ?? 0) + receivedNow
      );
    }

    const isFullyReceived = purchaseItems.every((item) => {
      const totalReceived = totalReceivedByProduct.get(item.product_id) ?? 0;
      return totalReceived >= item.quantity;
    });

    let updatedOrder = order as PurchaseOrder;

    if (isFullyReceived && order.status !== 'received') {
      const { data: statusData, error: statusError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .update({ status: 'received' })
        .eq('id', orderId)
        .eq('status', 'pending')
        .select('*');

      if (statusError) {
        throw new Error(
          statusError?.message ?? 'Failed to update purchase order status'
        );
      }

      const statusUpdated = (statusData ?? [])[0];
      if (statusUpdated) {
        updatedOrder = statusUpdated as PurchaseOrder;
      } else {
        const { data: refreshedOrder, error: refreshError } = await supabase
          .from(TABLES.PURCHASE_ORDERS)
          .select('*')
          .eq('id', orderId)
          .single();

        if (refreshError || !refreshedOrder) {
          throw new Error(
            refreshError?.message ?? 'Failed to refresh purchase order status'
          );
        }

        updatedOrder = refreshedOrder as PurchaseOrder;
      }
    }

    return {
      success: true,
      data: {
        order: updatedOrder,
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

export const returnGoodsToSupplier = async (
  orderId: string,
  items: ReturnGoodsItemInput[],
  userId: string
): Promise<ControllerResult<ReturnGoodsResult>> => {
  const processed: ProcessedReceiptItem[] = [];

  try {
    if (!items.length) {
      throw new Error('Return requires at least one item');
    }

    const { data: order, error: orderError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Purchase order not found');
    }

    if (order.status === 'cancelled') {
      throw new Error('Cannot return goods for a cancelled purchase order');
    }

    const { data: purchaseItems, error: itemsError } = await supabase
      .from(TABLES.PURCHASE_ITEMS)
      .select('*')
      .eq('purchase_order_id', orderId);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    if (!purchaseItems || purchaseItems.length === 0) {
      throw new Error('No purchase items found for this order');
    }

    const purchaseItemMap = new Map<string, PurchaseItem>(
      (purchaseItems as PurchaseItem[]).map((item) => [item.product_id, item])
    );

    const { received, returned } = await fetchOrderMovementTotals(orderId);
    const returnTotals = new Map<string, number>();
    const productIds = new Set<string>();
    let returnTotal = 0;

    for (const item of items) {
      const orderItem = purchaseItemMap.get(item.product_id);
      if (!orderItem) {
        throw new Error(`Product ${item.product_id} not found on purchase order`);
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Return quantity must be greater than zero');
      }

      const receivedQty = received.get(item.product_id) ?? 0;
      const returnedQty = returned.get(item.product_id) ?? 0;
      const returnable = receivedQty - returnedQty;

      if (returnable <= 0) {
        throw new Error('No received quantity available to return');
      }

      const batchReturned = returnTotals.get(item.product_id) ?? 0;
      if (batchReturned + quantity > returnable) {
        throw new Error(
          `Cannot return more than received quantity for product ${item.product_id}`
        );
      }

      returnTotals.set(item.product_id, batchReturned + quantity);
      productIds.add(item.product_id);
      returnTotal += quantity * orderItem.unit_cost;
    }

    const { data: products, error: productsError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('*')
      .in('id', Array.from(productIds));

    if (productsError || !products) {
      throw new Error(productsError?.message ?? 'Failed to fetch products');
    }

    const productMap = new Map<string, Product>(
      (products as Product[]).map((product) => [product.id, product])
    );

    const updatedProducts: Product[] = [];
    const movements: StockMovement[] = [];

    for (const item of items) {
      const currentProduct = productMap.get(item.product_id);

      if (!currentProduct) {
        throw new Error(`Product ${item.product_id} not found`);
      }

      const quantity = Number(item.quantity);
      const previousStock = currentProduct.stock_quantity ?? 0;
      const previousCost = currentProduct.cost_price ?? 0;
      const newQuantity = previousStock - quantity;

      if (newQuantity < 0) {
        throw new Error(
          `Insufficient stock to return ${currentProduct.name}`
        );
      }

      const updatedProduct = await updateProductStockSafely(
        currentProduct.id,
        previousStock,
        { stock_quantity: newQuantity },
        currentProduct.name
      );

      const { data: movement, error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .insert({
          product_id: currentProduct.id,
          type: 'return',
          quantity_change: -Math.abs(quantity),
          reference_id: orderId,
          remarks: item.reason ?? null,
          created_by: userId,
        })
        .select('*')
        .single();

      if (movementError || !movement) {
        const { error: rollbackError } = await supabase
          .from(TABLES.PRODUCTS)
          .update({ stock_quantity: previousStock })
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

    const updatedOrder = await updatePurchaseOrderReturnSummary(
      order as PurchaseOrder,
      items,
      returnTotal
    );

    return {
      success: true,
      data: {
        order: updatedOrder,
        products: updatedProducts,
        movements,
        return_total: returnTotal,
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
            'Failed to return goods'
          )}. Rollback issues: ${rollbackErrors.join('; ')}`,
        };
      }
    }

    return {
      success: false,
      error: getErrorMessage(error, 'Failed to return goods'),
    };
  }
};

export const updatePurchaseOrderPaymentStatus = async (
  id: string,
  status: PurchaseOrderPaymentStatus
): Promise<ControllerResult<PurchaseOrder>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .update({ payment_status: status })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      if (error && isMissingColumnError(error, 'payment_status')) {
        throw new Error('Payment status tracking is not configured');
      }
      throw new Error(error?.message ?? 'Failed to update payment status');
    }

    return { success: true, data: data as PurchaseOrder };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update payment status'),
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
