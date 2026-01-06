import { supabase } from '../../lib/supabase';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type {
  Customer,
  Product,
  ProductBatch,
  Promotion,
  ReturnRequest,
  Sale,
  SaleItem,
  SalePayment,
  StockMovement,
  ActionResponse,
  SaleWithDetails,
} from '../../types';

// Removed local ControllerResult

type SalePaymentMethod = Exclude<Sale['payment_method'], 'split'>;
type SalePaymentMethodOrLoyalty = Sale['payment_method'] | 'loyalty';

type SalePaymentInput = {
  amount: number;
  method: SalePaymentMethod;
  reference_id?: string;
};

type SaleInput = {
  payment_method: SalePaymentMethodOrLoyalty;
  amount_paid: number;
  customer_id?: string | null;
  discount_total?: number;
  promo_code?: string;
  approval_code?: string;
  manager_id?: string;
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
  payments: SalePayment[];
};

type ProductStockRow = Pick<Product, 'id' | 'name' | 'stock_quantity'>;

type ProductPricingRow = Pick<
  Product,
  'id' | 'name' | 'stock_quantity' | 'price' | 'tax_rate'
>;

type ProductBatchRow = Pick<
  ProductBatch,
  'id' | 'product_id' | 'quantity_remaining' | 'expiry_date' | 'created_at'
>;

type BatchDeduction = {
  batch_id: string;
  quantity: number;
  previous_remaining: number;
};

type ProcessedMovement = {
  product_id: string;
  previous_stock: number;
  movement_ids: string[];
  batch_updates: { batch_id: string; previous_remaining: number }[];
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

const MAX_DISCOUNT_PERCENT = 10;
const PROMOTIONS_TABLE = 'promotions';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const generateReceiptNumber = async () => {
  const { data, error } = await supabase.rpc('next_receipt_number');

  if (error) {
    throw new Error(error.message);
  }

  const sequenceValue = Array.isArray(data)
    ? data[0]
    : data;
  const sequence =
    typeof sequenceValue === 'object' && sequenceValue !== null
      ? Number((sequenceValue as { nextval?: number | string }).nextval)
      : Number(sequenceValue);

  if (!Number.isFinite(sequence)) {
    throw new Error('Failed to generate receipt number');
  }

  const year = new Date().getFullYear();
  return `INV-${year}-${sequence}`;
};

const generateReturnNumber = () => {
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `RET-${Date.now()}-${suffix}`;
};

const isBatchExpired = (expiryDate?: string | null, now = Date.now()) => {
  if (!expiryDate) {
    return false;
  }
  const expiryTime = Date.parse(expiryDate);
  return Number.isFinite(expiryTime) && expiryTime < now;
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

  if (payments.length > 0 && saleData.payment_method === 'loyalty') {
    throw new Error('Loyalty payments cannot be split');
  }

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
  const paymentMethod: SaleInput['payment_method'] =
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
    for (const batch of [...item.batch_updates].reverse()) {
      const { error: batchError } = await supabase
        .from(TABLES.PRODUCT_BATCHES)
        .update({ quantity_remaining: batch.previous_remaining })
        .eq('id', batch.batch_id);

      if (batchError) {
        rollbackErrors.push(`Batch ${batch.batch_id}: ${batchError.message}`);
      }
    }

    const { error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .update({ stock_quantity: item.previous_stock })
      .eq('id', item.product_id);

    if (productError) {
      rollbackErrors.push(`Product ${item.product_id}: ${productError.message}`);
    }

    for (const movementId of item.movement_ids) {
      const { error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .delete()
        .eq('id', movementId);

      if (movementError) {
        rollbackErrors.push(
          `Stock movement ${movementId}: ${movementError.message}`
        );
      }
    }
  }

  return rollbackErrors;
};

const cleanupSaleRecord = async (
  saleId: string,
  note: string
): Promise<string[]> => {
  const cleanupErrors: string[] = [];

  const { error: saleError } = await supabase
    .from(TABLES.SALES)
    .update({ status: 'voided', notes: note })
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
            promo_code: payload.promo_code,
            approval_code: payload.approval_code,
            manager_id: payload.manager_id,
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
  let createdSale: Sale | null = null;

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

    const { data: shiftSessions, error: shiftError } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'open')
      .limit(1);

    if (shiftError) {
      throw new Error(shiftError.message);
    }

    if (!shiftSessions || shiftSessions.length === 0) {
      throw new Error('No open shift found. Please clock in.');
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));

    const { data: products, error: productError } = await supabase
      .from(TABLES.PRODUCTS)
      .select('id, name, stock_quantity, price, tax_rate')
      .in('id', productIds);

    if (productError || !products) {
      throw new Error(productError?.message ?? 'Failed to fetch products');
    }

    const productMap = new Map<string, ProductPricingRow>(
      (products as ProductPricingRow[]).map((product) => [product.id, product])
    );

    const computedItems: SaleItemComputed[] = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for ${product.name}`);
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Invalid price for ${product.name}`);
      }

      const discount = Number(item.discount ?? 0);
      if (!Number.isFinite(discount) || discount < 0) {
        throw new Error(`Invalid discount for ${product.name}`);
      }

      const subTotal = unitPrice * quantity;
      if (discount > subTotal) {
        throw new Error(`Discount exceeds price for ${product.name}`);
      }

      const taxRate = Number(product.tax_rate ?? 0);
      const taxAmount =
        Number.isFinite(taxRate) && taxRate > 0
          ? Math.max(subTotal - discount, 0) * taxRate
          : 0;

      return {
        ...item,
        quantity,
        unitPrice,
        discount,
        taxAmount,
        subTotal,
      };
    });

    const itemsByProduct = new Map<string, SaleItemComputed[]>();
    const productQuantities = new Map<string, number>();

    for (const item of computedItems) {
      const currentQuantity = productQuantities.get(item.productId) ?? 0;
      productQuantities.set(item.productId, currentQuantity + item.quantity);

      const existingItems = itemsByProduct.get(item.productId);
      if (existingItems) {
        existingItems.push(item);
      } else {
        itemsByProduct.set(item.productId, [item]);
      }
    }

    const { data: batches, error: batchError } = await supabase
      .from(TABLES.PRODUCT_BATCHES)
      .select('id, product_id, quantity_remaining, expiry_date, created_at')
      .in('product_id', productIds)
      .gt('quantity_remaining', 0)
      .order('created_at', { ascending: true });

    if (batchError) {
      throw new Error(batchError.message);
    }

    const batchesByProduct = new Map<string, ProductBatchRow[]>();
    for (const batch of (batches ?? []) as ProductBatchRow[]) {
      const existingBatches = batchesByProduct.get(batch.product_id);
      if (existingBatches) {
        existingBatches.push(batch);
      } else {
        batchesByProduct.set(batch.product_id, [batch]);
      }
    }

    const batchPlans = new Map<string, BatchDeduction[]>();
    const now = Date.now();

    for (const [productId, requiredQuantity] of productQuantities) {
      const product = productMap.get(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const productBatches = batchesByProduct.get(productId) ?? [];
      let remaining = requiredQuantity;
      const deductions: BatchDeduction[] = [];

      for (const batch of productBatches) {
        if (remaining <= 0) {
          break;
        }

        const available = Number(batch.quantity_remaining ?? 0);
        if (!Number.isFinite(available) || available <= 0) {
          continue;
        }

        if (isBatchExpired(batch.expiry_date, now)) {
          throw new Error(
            `Insufficient stock for ${product.name} (expired batch)`
          );
        }

        const deductQuantity = Math.min(available, remaining);
        deductions.push({
          batch_id: batch.id,
          quantity: deductQuantity,
          previous_remaining: available,
        });
        remaining -= deductQuantity;
      }

      if (remaining > 0 || deductions.length === 0) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      batchPlans.set(productId, deductions);
    }

    const subTotal = computedItems.reduce((sum, item) => sum + item.subTotal, 0);
    const itemDiscountTotal = computedItems.reduce(
      (sum, item) => sum + item.discount,
      0
    );
    const taxTotal = computedItems.reduce((sum, item) => sum + item.taxAmount, 0);

    const manualDiscount = Number(saleData.discount_total ?? 0);
    if (!Number.isFinite(manualDiscount) || manualDiscount < 0) {
      throw new Error('Invalid discount total');
    }

    const promoCode =
      typeof saleData.promo_code === 'string'
        ? saleData.promo_code.trim()
        : '';
    let promoDiscount = 0;

    if (promoCode) {
      const { data: promotionData, error: promotionError } = await supabase
        .from(PROMOTIONS_TABLE)
        .select('*')
        .eq('code', promoCode)
        .single();

      if (promotionError || !promotionData) {
        throw new Error(promotionError?.message ?? 'Invalid promotion code');
      }

      const promotion = promotionData as Promotion;

      if (!promotion.is_active) {
        throw new Error('Promotion is not active');
      }

      const startDate = new Date(promotion.start_date);
      if (Number.isFinite(startDate.getTime()) && startDate > new Date()) {
        throw new Error('Promotion has not started yet');
      }

      const endDate = new Date(promotion.end_date);
      if (Number.isFinite(endDate.getTime()) && endDate < new Date()) {
        throw new Error('Promotion has ended');
      }

      const minOrderValue = Number(promotion.min_order_value ?? 0);
      if (Number.isFinite(minOrderValue) && minOrderValue > 0) {
        if (subTotal < minOrderValue) {
          throw new Error('Order does not meet promotion minimum value');
        }
      }

      const promoValue = Number(promotion.value ?? 0);
      if (!Number.isFinite(promoValue) || promoValue < 0) {
        throw new Error('Invalid promotion value');
      }

      promoDiscount =
        promotion.type === 'percentage'
          ? (subTotal * promoValue) / 100
          : promoValue;
      promoDiscount = Math.min(promoDiscount, subTotal);
    }

    const manualDiscountTotal = itemDiscountTotal + manualDiscount;
    const discountPercent =
      subTotal > 0 ? (manualDiscountTotal / subTotal) * 100 : 0;

    if (discountPercent > MAX_DISCOUNT_PERCENT) {
      const hasOverride =
        typeof saleData.approval_code === 'string' &&
        saleData.approval_code.trim().length > 0
          ? true
          : typeof saleData.manager_id === 'string' &&
            saleData.manager_id.trim().length > 0;

      if (!hasOverride) {
        throw new Error('Discount exceeds manager approval limit');
      }
    }

    const discountTotal = manualDiscountTotal + promoDiscount;
    const grandTotal = subTotal + taxTotal - discountTotal;

    if (grandTotal < 0) {
      throw new Error('Discount exceeds order total');
    }

    const paymentSummary = normalizeSalePayments(saleData);
    const changeGiven = paymentSummary.amountPaid - grandTotal;

    if (saleData.payment_method === 'loyalty') {
      const customerId = saleData.customer_id;
      if (!customerId) {
        throw new Error('Customer is required for loyalty payments');
      }

      const { data: customerData, error: customerError } = await supabase
        .from(TABLES.CUSTOMERS)
        .select('id, loyalty_points')
        .eq('id', customerId)
        .single();

      if (customerError || !customerData) {
        throw new Error(customerError?.message ?? 'Customer not found');
      }

      const loyaltyCustomer = customerData as Pick<
        Customer,
        'id' | 'loyalty_points'
      >;
      const availablePoints = Number(loyaltyCustomer.loyalty_points ?? 0);
      const pointsNeeded = Math.ceil(paymentSummary.amountPaid);

      if (!Number.isFinite(availablePoints) || availablePoints < pointsNeeded) {
        throw new Error('Insufficient loyalty points');
      }
    }

    const receiptNumber = await generateReceiptNumber();

    const { data: sale, error: saleError } = await supabase
      .from(TABLES.SALES)
      .insert({
        receipt_number: receiptNumber,
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

    createdSale = sale as Sale;

    let insertedPaymentsData: SalePayment[] = [];

    if (paymentSummary.payments.length > 0) {
      const paymentsToInsert = paymentSummary.payments.map((payment) => ({
        sale_id: createdSale!.id,
        amount: payment.amount,
        method: payment.method,
        reference_id: payment.reference_id ?? null,
      }));

      const { data: insertedPayments, error: paymentsError } = await supabase
        .from(TABLES.SALE_PAYMENTS)
        .insert(paymentsToInsert)
        .select('*');

      if (paymentsError) {
        throw new Error(paymentsError.message);
      }

      if (insertedPayments) {
        insertedPaymentsData = insertedPayments as SalePayment[];
      }
    }

    const itemsToInsert = computedItems.map((item) => ({
      sale_id: createdSale!.id,
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
      throw new Error(itemsError.message);
    }

    for (const [productId, quantity] of productQuantities) {
      const product = productMap.get(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const { data: deductionResult, error: deductionError } =
        await supabase.rpc('deduct_product_stock', {
          product_id: productId,
          quantity,
        });

      if (deductionError) {
        throw new Error(deductionError.message);
      }

      const deductionSucceeded = Array.isArray(deductionResult)
        ? deductionResult.length > 0
        : typeof deductionResult === 'number'
          ? deductionResult > 0
          : typeof deductionResult === 'boolean'
            ? deductionResult
            : Boolean(deductionResult);

      if (!deductionSucceeded) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const processedEntry: ProcessedMovement = {
        product_id: productId,
        previous_stock: product.stock_quantity,
        movement_ids: [],
        batch_updates: [],
      };

      const batchPlan = batchPlans.get(productId) ?? [];
      for (const plan of batchPlan) {
        const newRemaining = plan.previous_remaining - plan.quantity;
        const { data: updatedBatch, error: batchUpdateError } = await supabase
          .from(TABLES.PRODUCT_BATCHES)
          .update({ quantity_remaining: newRemaining })
          .eq('id', plan.batch_id)
          .eq('quantity_remaining', plan.previous_remaining)
          .select('id');

        if (batchUpdateError) {
          processed.push(processedEntry);
          throw new Error(batchUpdateError.message);
        }

        if (!updatedBatch || updatedBatch.length === 0) {
          processed.push(processedEntry);
          throw new Error(`Inventory update conflict for ${product.name}`);
        }

        processedEntry.batch_updates.push({
          batch_id: plan.batch_id,
          previous_remaining: plan.previous_remaining,
        });
      }

      const productItems = itemsByProduct.get(productId) ?? [];
      for (const item of productItems) {
        const { data: movement, error: movementError } = await supabase
          .from(TABLES.STOCK_MOVEMENTS)
          .insert({
            product_id: productId,
            type: 'sale',
            quantity_change: -Math.abs(item.quantity),
            reference_id: createdSale.id,
            created_by: userId,
          })
          .select('*')
          .single();

        if (movementError || !movement) {
          processed.push(processedEntry);
          throw new Error(
            movementError?.message ??
              `Failed to log stock movement for ${product.name}`
          );
        }

        processedEntry.movement_ids.push(movement.id);
      }

      processed.push(processedEntry);
    }

    let loyaltyMessage: string | undefined;
    const customerId = saleData.customer_id ?? null;

    if (customerId) {
      const newPoints = Math.floor(grandTotal / 10);
      let pointsDelta = newPoints;

      if (saleData.payment_method === 'loyalty') {
        const pointsRedeemed = Math.ceil(paymentSummary.amountPaid);
        pointsDelta = newPoints - pointsRedeemed;
      }

      if (pointsDelta !== 0) {
        const { error: loyaltyError } = await supabase.rpc(
          'increment_loyalty_points',
          {
            row_id: customerId,
            amount: pointsDelta,
          }
        );

        if (loyaltyError) {
          loyaltyMessage = `Loyalty update failed: ${loyaltyError.message}`;
        }
      }
    }

    return {
      success: true,
      data: {
        sale: createdSale,
        items: (insertedItems ?? []) as SaleItem[],
        payments: insertedPaymentsData,
      },
      ...(loyaltyMessage ? { message: loyaltyMessage } : {}),
    };
  } catch (error) {
    const rollbackNotes: string[] = [];
    const baseMessage = getErrorMessage(error, 'Failed to process sale');

    if (processed.length > 0) {
      const rollbackErrors = await rollbackProcessedMovements(processed);
      if (rollbackErrors.length > 0) {
        rollbackNotes.push(`Rollback issues: ${rollbackErrors.join('; ')}`);
      }
    }

    if (createdSale) {
      const cleanupErrors = await cleanupSaleRecord(createdSale.id, baseMessage);
      if (cleanupErrors.length > 0) {
        rollbackNotes.push(`Cleanup failed: ${cleanupErrors.join('; ')}`);
      }
    }

    if (rollbackNotes.length > 0) {
      return {
        success: false,
        error: `${baseMessage}. ${rollbackNotes.join(' ')}`,
      };
    }

    return {
      success: false,
      error: baseMessage,
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
    const receiptNumber = await generateReceiptNumber();

    const { data: draftSale, error: saleError } = await supabase
      .from(TABLES.SALES)
      .insert({
        receipt_number: receiptNumber,
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
      const cleanupErrors = await cleanupSaleRecord(
        draftSale.id,
        itemsError.message
      );
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
        payments: [],
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

export const processReturn = async (
  saleId: string,
  itemIds: string[]
): Promise<
  ActionResponse<{
    request: ReturnRequest;
    refundAmount: number;
    movements: StockMovement[];
  }>
> => {
  const processed: ProcessedMovement[] = [];
  let returnRequest: ReturnRequest | null = null;

  try {
    if (!saleId) {
      throw new Error('Sale ID is required');
    }

    if (!itemIds.length) {
      throw new Error('Return requires at least one item');
    }

    const { data: sale, error: saleError } = await supabase
      .from(TABLES.SALES)
      .select('id, cashier_id')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      throw new Error(saleError?.message ?? 'Sale not found');
    }

    const { data: saleItems, error: saleItemsError } = await supabase
      .from(TABLES.SALE_ITEMS)
      .select('*')
      .eq('sale_id', saleId)
      .in('id', itemIds);

    if (saleItemsError) {
      throw new Error(saleItemsError.message);
    }

    const items = (saleItems ?? []) as SaleItem[];
    if (items.length !== itemIds.length) {
      throw new Error('One or more return items are invalid');
    }

    const refundAmount = items.reduce(
      (total, item) => total + item.sub_total + item.tax_amount - item.discount,
      0
    );

    const returnQuantities = new Map<string, number>();
    for (const item of items) {
      returnQuantities.set(
        item.product_id,
        (returnQuantities.get(item.product_id) ?? 0) + item.quantity
      );
    }

    const productIds = Array.from(returnQuantities.keys());
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

    const { data: createdRequest, error: requestError } = await supabase
      .from(TABLES.RETURN_REQUESTS)
      .insert({
        sale_id: saleId,
        return_number: generateReturnNumber(),
        status: 'pending',
        refund_amount: refundAmount,
        reason: 'Customer return',
        restock_items: true,
      })
      .select('*')
      .single();

    if (requestError || !createdRequest) {
      throw new Error(requestError?.message ?? 'Failed to create return request');
    }

    returnRequest = createdRequest as ReturnRequest;

    const movements: StockMovement[] = [];

    for (const [productId, quantity] of returnQuantities) {
      const product = productMap.get(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      const previousStock = product.stock_quantity;
      const newQuantity = previousStock + quantity;

      const { data: updatedProducts, error: stockError } = await supabase
        .from(TABLES.PRODUCTS)
        .update({ stock_quantity: newQuantity })
        .eq('id', productId)
        .eq('stock_quantity', previousStock)
        .select('id');

      if (stockError) {
        throw new Error(
          stockError.message || `Failed to update stock for ${product.name}`
        );
      }

      if (!updatedProducts || updatedProducts.length === 0) {
        throw new Error(`Inventory update conflict for ${product.name}`);
      }

      const { data: movement, error: movementError } = await supabase
        .from(TABLES.STOCK_MOVEMENTS)
        .insert({
          product_id: productId,
          type: 'return',
          quantity_change: Math.abs(quantity),
          reference_id: saleId,
          created_by: sale.cashier_id,
        })
        .select('*')
        .single();

      if (movementError || !movement) {
        await supabase
          .from(TABLES.PRODUCTS)
          .update({ stock_quantity: previousStock })
          .eq('id', productId);

        throw new Error(
          movementError?.message ??
            `Failed to log stock movement for ${product.name}`
        );
      }

      processed.push({
        product_id: productId,
        previous_stock: previousStock,
        movement_ids: [movement.id],
        batch_updates: [],
      });

      movements.push(movement as StockMovement);
    }

    const { data: completedRequest, error: completedError } = await supabase
      .from(TABLES.RETURN_REQUESTS)
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('id', returnRequest.id)
      .select('*')
      .single();

    if (completedError || !completedRequest) {
      throw new Error(
        completedError?.message ?? 'Failed to finalize return request'
      );
    }

    return {
      success: true,
      data: {
        request: completedRequest as ReturnRequest,
        refundAmount,
        movements,
      },
    };
  } catch (error) {
    const rollbackNotes: string[] = [];

    if (processed.length > 0) {
      const rollbackErrors = await rollbackProcessedMovements(processed);
      if (rollbackErrors.length > 0) {
        rollbackNotes.push(`Stock rollback issues: ${rollbackErrors.join('; ')}`);
      }
    }

    if (returnRequest) {
      const { error: requestRollbackError } = await supabase
        .from(TABLES.RETURN_REQUESTS)
        .update({ status: 'rejected' })
        .eq('id', returnRequest.id);

      if (requestRollbackError) {
        rollbackNotes.push(
          `Return request rollback failed: ${requestRollbackError.message}`
        );
      }
    }

    const baseMessage = getErrorMessage(error, 'Failed to process return');

    if (rollbackNotes.length > 0) {
      return {
        success: false,
        error: `${baseMessage}. ${rollbackNotes.join(' ')}`,
      };
    }

    return { success: false, error: baseMessage };
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
        movement_ids: [movement.id],
        batch_updates: [],
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
): Promise<ActionResponse<SaleWithDetails>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SALES)
      .select(`*, ${TABLES.SALE_ITEMS}(*), ${TABLES.SALE_PAYMENTS}(*)`)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Sale not found');
    }

    return { success: true, data: data as SaleWithDetails };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch sale'),
    };
  }
};
