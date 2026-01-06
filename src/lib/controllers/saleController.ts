import { supabase } from '../../lib/supabase';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type {
  Product,
  Sale,
  SaleItem,
  StockMovement,
  ActionResponse,
  SaleWithDetails,
} from '../../types';

// Removed local ControllerResult

type SalePaymentMethod = Exclude<Sale['payment_method'], 'split'>;

type SalePaymentInput = {
  amount: number;
  method: SalePaymentMethod;
  reference_id?: string;
};

type SaleInput = {
  payment_method: Sale['payment_method'];
  amount_paid: number;
  customer_id?: string | null;
  discount_total?: number;
  payments?: SalePaymentInput[];
};

type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxAmount?: number;
};

type DateRange = {
  from?: string;
  to?: string;
};

// SaleWithRelations replaced by the global SaleWithDetails (logic is similar)
// But we can keep SaleWithRelations locally if we want strictly those 2 relations,
// or just use SaleWithDetails which is more robust.
// For now, I'll update the alias to match the logic:
type SaleWithRelations = SaleWithDetails;

type SaleWithItems = Sale & {
  sale_items: SaleItem[];
};

type SaleResult = {
  sale: Sale;
  items: SaleItem[];
};

type ProductStockRow = Pick<Product, 'id' | 'name' | 'stock_quantity'>;

type ProcessedMovement = {
  product_id: string;
  previous_stock: number;
  movement_id: string;
};

type SaleItemComputed = SaleItemInput & {
  subTotal: number;
  discount: number;
  taxAmount: number;
};

type CreateSalePayload = {
  saleData: SaleInput;
  items: SaleItemInput[];
  userId: string;
};

type CreateSaleBody = SaleInput & {
  items: SaleItemInput[];
  userId?: string;
  cashier_id?: string;
};

const SALE_PAYMENTS_TABLE = 'sale_payments';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const generateReceiptNumber = () => {
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `REC-${Date.now()}-${suffix}`;
};

const calculateTotals = (items: SaleItemInput[]) => {
  const computedItems: SaleItemComputed[] = items.map((item) => {
    const discount = item.discount ?? 0;
    const taxAmount = item.taxAmount ?? 0;
    const subTotal = item.unitPrice * item.quantity;

    return {
      ...item,
      discount,
      taxAmount,
      subTotal,
    };
  });

  const subTotal = computedItems.reduce((sum, item) => sum + item.subTotal, 0);
  const taxTotal = computedItems.reduce((sum, item) => sum + item.taxAmount, 0);

  return { subTotal, taxTotal, computedItems };
};

const normalizeSalePayments = (saleData: SaleInput) => {
  const payments = Array.isArray(saleData.payments) ? saleData.payments : [];

  if (!payments.length) {
    if (saleData.payment_method === 'split') {
      throw new Error('Split payments require at least one payment entry');
    }

    return {
      payments: [] as SalePaymentInput[],
      amountPaid: saleData.amount_paid,
      paymentMethod: saleData.payment_method,
    };
  }

  const normalized = payments.map((payment, index) => {
    const amount = Number(payment.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Payment ${index + 1} has an invalid amount`);
    }

    if (
      payment.method !== 'cash' &&
      payment.method !== 'card' &&
      payment.method !== 'bank_transfer'
    ) {
      throw new Error(`Payment ${index + 1} has an invalid method`);
    }

    const referenceId =
      typeof payment.reference_id === 'string'
        ? payment.reference_id.trim()
        : undefined;

    return {
      amount,
      method: payment.method,
      reference_id: referenceId || undefined,
    };
  });

  const amountPaid = normalized.reduce((sum, payment) => sum + payment.amount, 0);
  const methods = new Set(normalized.map((payment) => payment.method));
  const paymentMethod: Sale['payment_method'] =
    methods.size > 1 ? 'split' : normalized[0].method;

  return {
    payments: normalized,
    amountPaid,
    paymentMethod,
  };
};

const rollbackProcessedMovements = async (
  processed: ProcessedMovement[]
): Promise<string[]> => {
  const rollbackErrors: string[] = [];

  for (const item of [...processed].reverse()) {
    const { error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .update({ stock_quantity: item.previous_stock })
      .eq('id', item.product_id);

    if (productError) {
      rollbackErrors.push(`Product ${item.product_id}: ${productError.message}`);
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

const cleanupSaleRecord = async (saleId: string): Promise<string[]> => {
  const cleanupErrors: string[] = [];

  const { error: itemsError } = await supabase
    .from(TABLES.SALE_ITEMS)
    .delete()
    .eq('sale_id', saleId);

  if (itemsError) {
    cleanupErrors.push(`Sale items: ${itemsError.message}`);
  }

  const { error: paymentsError } = await supabase
    .from(SALE_PAYMENTS_TABLE)
    .delete()
    .eq('sale_id', saleId);

  if (paymentsError) {
    cleanupErrors.push(`Sale payments: ${paymentsError.message}`);
  }

  const { error: saleError } = await supabase
    .from(TABLES.SALES)
    .delete()
    .eq('id', saleId);

  if (saleError) {
    cleanupErrors.push(`Sale header: ${saleError.message}`);
  }

  return cleanupErrors;
};

const resolveCreateSaleArgs = (
  saleDataOrPayload: SaleInput | CreateSalePayload,
  items?: SaleItemInput[],
  userId?: string
) => {
  if (
    typeof items === 'undefined' &&
    typeof userId === 'undefined' &&
    'items' in saleDataOrPayload
  ) {
    const payload = saleDataOrPayload as CreateSalePayload & CreateSaleBody;
    const saleData =
      'saleData' in payload && payload.saleData
        ? payload.saleData
        : {
            payment_method: payload.payment_method,
            amount_paid: payload.amount_paid,
            customer_id: payload.customer_id,
            discount_total: payload.discount_total,
            payments: payload.payments,
          };

    return {
      saleData,
      items: payload.items ?? [],
      userId: payload.userId ?? payload.cashier_id ?? '',
    };
  }

  return {
    saleData: saleDataOrPayload as SaleInput,
    items: items ?? [],
    userId: userId ?? '',
  };
};

export const createSale = async (
  saleDataOrPayload: SaleInput | CreateSalePayload,
  itemsInput?: SaleItemInput[],
  userIdInput?: string
): Promise<ActionResponse<SaleResult>> => {
  const processed: ProcessedMovement[] = [];

  try {
    const { saleData, items, userId } = resolveCreateSaleArgs(
      saleDataOrPayload,
      itemsInput,
      userIdInput
    );

    if (!items.length) {
      throw new Error('Sale requires at least one item');
    }

    if (!userId) {
      throw new Error('Cashier ID is required');
    }

    const { subTotal, taxTotal, computedItems } = calculateTotals(items);
    const discountTotal = saleData.discount_total ?? 0;
    const grandTotal = subTotal + taxTotal - discountTotal;
    const paymentSummary = normalizeSalePayments(saleData);
    const changeGiven = paymentSummary.amountPaid - grandTotal;

    const productIds = Array.from(new Set(items.map((item) => item.productId)));

    const { data: products, error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('id, name, stock_quantity')
      .in('id', productIds);

    if (productError || !products) {
      throw new Error(productError?.message ?? 'Failed to fetch products');
    }

    const productMap = new Map<string, ProductStockRow>(
      (products as ProductStockRow[]).map((product) => [product.id, product])
    );

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    const { data: sale, error: saleError } = await supabase
      .from(TABLES.SALES)
      .insert({
        receipt_number: generateReceiptNumber(),
        cashier_id: userId,
        customer_id: saleData.customer_id ?? null,
        sub_total: subTotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        grand_total: grandTotal,
        payment_method: paymentSummary.paymentMethod,
        amount_paid: paymentSummary.amountPaid,
        change_given: changeGiven,
        status: 'completed',
      })
      .select('*')
      .single();

    if (saleError || !sale) {
      throw new Error(saleError?.message ?? 'Failed to create sale');
    }

    const createdSale = sale as Sale;

    if (paymentSummary.payments.length > 0) {
      const paymentsToInsert = paymentSummary.payments.map((payment) => ({
        sale_id: createdSale.id,
        amount: payment.amount,
        method: payment.method,
        reference_id: payment.reference_id ?? null,
      }));

      const { error: paymentsError } = await supabase
        .from(SALE_PAYMENTS_TABLE)
        .insert(paymentsToInsert);

      if (paymentsError) {
        const cleanupErrors = await cleanupSaleRecord(createdSale.id);
        const cleanupNote = cleanupErrors.length
          ? ` Cleanup failed: ${cleanupErrors.join('; ')}`
          : '';
        throw new Error(`${paymentsError.message}.${cleanupNote}`);
      }
    }

    const itemsToInsert = computedItems.map((item) => ({
      sale_id: createdSale.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      sub_total: item.subTotal,
      discount: item.discount,
      tax_amount: item.taxAmount,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from(TABLES.SALE_ITEMS)
      .insert(itemsToInsert)
      .select('*');

    if (itemsError) {
      const cleanupErrors = await cleanupSaleRecord(createdSale.id);
      const cleanupNote = cleanupErrors.length
        ? ` Cleanup failed: ${cleanupErrors.join('; ')}`
        : '';
      throw new Error(`${itemsError.message}.${cleanupNote}`);
    }

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const previousStock = product.stock_quantity;
      const newQuantity = previousStock - item.quantity;

      const { error: updateError } = await supabase
        .from(TABLES.PRODUCTS)
        .update({ stock_quantity: newQuantity })
        .eq('id', product.id);

      if (updateError) {
        throw new Error(
          updateError.message || `Failed to update stock for ${product.name}`
        );
      }

      const { data: movement, error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .insert({
          product_id: product.id,
          type: 'sale',
          quantity_change: -Math.abs(item.quantity),
          reference_id: createdSale.id,
          created_by: userId,
        })
        .select('*')
        .single();

      if (movementError || !movement) {
        await supabase
          .from(TABLES.PRODUCTS)
          .update({ stock_quantity: previousStock })
          .eq('id', product.id);

        throw new Error(
          movementError?.message ??
            `Failed to log stock movement for ${product.name}`
        );
      }

      processed.push({
        product_id: product.id,
        previous_stock: previousStock,
        movement_id: movement.id,
      });

      productMap.set(product.id, {
        ...product,
        stock_quantity: newQuantity,
      });
    }

    return {
      success: true,
      data: {
        sale: createdSale,
        items: (insertedItems ?? []) as SaleItem[],
      },
    };
  } catch (error) {
    if (processed.length > 0) {
      const rollbackErrors = await rollbackProcessedMovements(processed);
      if (rollbackErrors.length > 0) {
        return {
          success: false,
          error: `${getErrorMessage(
            error,
            'Failed to process sale'
          )}. Rollback issues: ${rollbackErrors.join('; ')}`,
        };
      }
    }

    return {
      success: false,
      error: getErrorMessage(error, 'Failed to process sale'),
    };
  }
};

export const saveDraft = async (
  saleData: SaleInput,
  items: SaleItemInput[],
  userId: string
): Promise<ActionResponse<SaleResult>> => {
  try {
    if (!items.length) {
      throw new Error('Draft requires at least one item');
    }

    if (!userId) {
      throw new Error('Cashier ID is required');
    }

    const { subTotal, taxTotal, computedItems } = calculateTotals(items);
    const discountTotal = saleData.discount_total ?? 0;
    const grandTotal = subTotal + taxTotal - discountTotal;
    const changeGiven = saleData.amount_paid - grandTotal;

    const { data: draftSale, error: saleError } = await supabase
      .from(TABLES.SALES)
      .insert({
        receipt_number: generateReceiptNumber(),
        cashier_id: userId,
        customer_id: saleData.customer_id ?? null,
        sub_total: subTotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        grand_total: grandTotal,
        payment_method: saleData.payment_method,
        amount_paid: saleData.amount_paid,
        change_given: changeGiven,
        status: 'draft',
      })
      .select('*')
      .single();

    if (saleError || !draftSale) {
      throw new Error(saleError?.message ?? 'Failed to save draft');
    }

    const itemsToInsert = computedItems.map((item) => ({
      sale_id: draftSale.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      sub_total: item.subTotal,
      discount: item.discount,
      tax_amount: item.taxAmount,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from(TABLES.SALE_ITEMS)
      .insert(itemsToInsert)
      .select('*');

    if (itemsError) {
      const cleanupErrors = await cleanupSaleRecord(draftSale.id);
      const cleanupNote = cleanupErrors.length
        ? ` Cleanup failed: ${cleanupErrors.join('; ')}`
        : '';
      throw new Error(`${itemsError.message}.${cleanupNote}`);
    }

    return {
      success: true,
      data: {
        sale: draftSale as Sale,
        items: (insertedItems ?? []) as SaleItem[],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to save draft'),
    };
  }
};

export const getDrafts = async (): Promise<ActionResponse<Sale[]>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SALES)
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Sale[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch drafts'),
    };
  }
};

export const refundSale = async (
  saleId: string,
  userId: string
): Promise<ActionResponse<{ sale: Sale; movements: StockMovement[] }>> => {
  const processed: ProcessedMovement[] = [];
  let previousStatus: Sale['status'] | null = null;
  let statusUpdated = false;

  try {
    if (!saleId) {
      throw new Error('Sale ID is required');
    }

    if (!userId) {
      throw new Error('Cashier ID is required');
    }

    const { data: existingSale, error: saleFetchError } = await supabase
      .from(TABLES.SALES)
      .select('id, status')
      .eq('id', saleId)
      .single();

    if (saleFetchError || !existingSale) {
      throw new Error(saleFetchError?.message ?? 'Sale not found');
    }

    if (existingSale.status === 'refunded') {
      throw new Error('Sale already refunded');
    }

    previousStatus = existingSale.status;

    const { data: updatedSale, error: updateError } = await supabase
      .from(TABLES.SALES)
      .update({ status: 'refunded' })
      .eq('id', saleId)
      .select('*')
      .single();

    if (updateError || !updatedSale) {
      throw new Error(updateError?.message ?? 'Failed to update sale status');
    }

    statusUpdated = true;

    const { data: saleItems, error: itemsError } = await supabase
      .from(TABLES.SALE_ITEMS)
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const items = (saleItems ?? []) as SaleItem[];
    if (!items.length) {
      throw new Error('No sale items found for this sale');
    }

    const productIds = Array.from(new Set(items.map((item) => item.product_id)));
    const { data: products, error: productsError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('id, name, stock_quantity')
      .in('id', productIds);

    if (productsError || !products) {
      throw new Error(productsError?.message ?? 'Failed to fetch products');
    }

    const productMap = new Map<string, ProductStockRow>(
      (products as ProductStockRow[]).map((product) => [product.id, product])
    );

    const movements: StockMovement[] = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error(`Product ${item.product_id} not found`);
      }

      const previousStock = product.stock_quantity;
      const newQuantity = previousStock + item.quantity;

      const { error: stockError } = await supabase
        .from(TABLES.PRODUCTS)
        .update({ stock_quantity: newQuantity })
        .eq('id', product.id);

      if (stockError) {
        throw new Error(
          stockError.message || `Failed to update stock for ${product.name}`
        );
      }

      const { data: movement, error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .insert({
          product_id: product.id,
          type: 'return',
          quantity_change: Math.abs(item.quantity),
          reference_id: saleId,
          created_by: userId,
        })
        .select('*')
        .single();

      if (movementError || !movement) {
        await supabase
          .from(TABLES.PRODUCTS)
          .update({ stock_quantity: previousStock })
          .eq('id', product.id);

        throw new Error(
          movementError?.message ??
            `Failed to log stock movement for ${product.name}`
        );
      }

      processed.push({
        product_id: product.id,
        previous_stock: previousStock,
        movement_id: movement.id,
      });

      movements.push(movement as StockMovement);
      productMap.set(product.id, {
        ...product,
        stock_quantity: newQuantity,
      });
    }

    return {
      success: true,
      data: { sale: updatedSale as Sale, movements },
    };
  } catch (error) {
    const rollbackNotes: string[] = [];

    if (processed.length > 0) {
      const rollbackErrors = await rollbackProcessedMovements(processed);
      if (rollbackErrors.length > 0) {
        rollbackNotes.push(`Stock rollback issues: ${rollbackErrors.join('; ')}`);
      }
    }

    if (statusUpdated && previousStatus) {
      const { error: statusRollbackError } = await supabase
        .from(TABLES.SALES)
        .update({ status: previousStatus })
        .eq('id', saleId);

      if (statusRollbackError) {
        rollbackNotes.push(
          `Status rollback failed: ${statusRollbackError.message}`
        );
      }
    }

    const baseMessage = getErrorMessage(error, 'Failed to refund sale');

    if (rollbackNotes.length > 0) {
      return {
        success: false,
        error: `${baseMessage}. ${rollbackNotes.join(' ')}`,
      };
    }

    return { success: false, error: baseMessage };
  }
};

export const getSales = async (
  page = 1,
  dateRange?: DateRange
): Promise<ActionResponse<SaleWithRelations[]>> => {
  try {
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from(TABLES.SALES)
      .select(
        `*, cashier:${TABLES.USERS}(full_name), customer:${TABLES.CUSTOMERS}(name)`
      );

    if (dateRange?.from) {
      query = query.gte('created_at', dateRange.from);
    }

    if (dateRange?.to) {
      query = query.lte('created_at', dateRange.to);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as SaleWithRelations[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch sales'),
    };
  }
};

export const getSaleById = async (
  id: string
): Promise<ActionResponse<SaleWithItems>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SALES)
      .select(`*, ${TABLES.SALE_ITEMS}(*)`)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Sale not found');
    }

    return { success: true, data: data as SaleWithItems };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch sale'),
    };
  }
};
