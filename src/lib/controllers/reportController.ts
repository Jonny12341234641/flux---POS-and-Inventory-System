import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Product,
  Sale,
  SaleItem,
  ShiftSession,
  StockMovement,
} from '../../types';

type PaginationMeta = {
  current_page: number;
  total_pages: number;
  total_items: number;
};

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationMeta;
};

type StockMovementFilter = {
  productId?: string;
  type?: StockMovement['type'];
};

type StockMovementWithRelations = StockMovement & {
  product?: { name: string } | null;
  user?: { name: string } | null;
  quantity: number;
  reason?: string | null;
};

type ShiftHistoryRow = ShiftSession & {
  cashier?: { full_name: string } | null;
};

type PaymentBreakdown = {
  cash: number;
  card: number;
  bank_transfer: number;
  split: number;
};

type SalesReport = {
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalRefunds: number;
  netRevenue: number;
  transactionCount: number;
  paymentBreakdown: PaymentBreakdown;
};

type ProfitReport = {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  profitMargin: number;
};

type TopSellerRow = {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  total_revenue: number;
};

type ExpiringBatch = {
  product_name: string;
  batch_number: string | null;
  expiry_date: string;
  cost_value: number;
};

type SaleTotalsRow = Pick<
  Sale,
  'grand_total' | 'tax_total' | 'discount_total' | 'payment_method'
>;

type ReturnRequestRow = {
  refund_amount?: number | string | null;
};

type SaleItemWithProduct = SaleItem & {
  product?: { id: string; name: string; cost_price?: number | string | null } | null;
  batch_id?: string | null;
};

type ProductBatchRow = {
  id: string;
  batch_number: string | null;
  expiry_date: string;
  quantity_remaining: number | string;
  cost_price_at_purchase?: number | string | null;
  product?: { name: string; cost_price?: number | string | null } | null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const parseAmount = (value: unknown, label: string) => {
  if (value === null || typeof value === 'undefined') {
    return 0;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} is invalid`);
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`${label} is invalid`);
    }
    return numericValue;
  }

  throw new Error(`${label} is invalid`);
};

const getUtcDayRange = (date: string) => {
  const trimmed = date?.trim();
  if (!trimmed) {
    throw new Error('Date is required');
  }

  const parts = trimmed.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }

  const [year, month, day] = parts;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('Date is invalid');
  }

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Date is invalid');
  }

  return { start: start.toISOString(), end: end.toISOString() };
};

const getUtcDateRange = (startDate: string, endDate: string) => {
  const startRange = getUtcDayRange(startDate);
  const endRange = getUtcDayRange(endDate);

  if (
    new Date(startRange.start).getTime() > new Date(endRange.start).getTime()
  ) {
    throw new Error('Start date must be on or before end date');
  }

  return { start: startRange.start, end: endRange.end };
};

const isMissingTableError = (error: unknown, tableName: string) => {
  if (!error) {
    return false;
  }

  const message =
    typeof error === 'string'
      ? error
      : (error as { message?: string }).message ?? '';
  const normalized = message.toLowerCase();
  return (
    normalized.includes('does not exist') &&
    normalized.includes(tableName.toLowerCase())
  );
};

const RETURN_REQUESTS_TABLE = TABLES.RETURN_REQUESTS;
const PRODUCT_BATCHES_TABLE = TABLES.PRODUCT_BATCHES;

export const getStockMovements = async (
  supabase: SupabaseClient,
  page = 1,
  filter?: StockMovementFilter
): Promise<ControllerResult<StockMovementWithRelations[]>> => {
  try {
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from(TABLES.STOCK_MOVEMENTS)
      .select(
        `*, product:${TABLES.PRODUCTS}(name), created_by_user:${TABLES.USERS}(full_name)`,
        { count: 'exact' }
      );

    if (filter?.productId) {
      query = query.eq('product_id', filter.productId);
    }

    if (filter?.type) {
      query = query.eq('type', filter.type);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const rawData = (data ?? []) as any[];
    const totalItems = typeof count === 'number' ? count : rawData.length;
    const movements = rawData.map((item) => {
      const normalizedProduct = Array.isArray(item.product)
        ? item.product[0]
        : item.product ?? null;
      const createdByUser = Array.isArray(item.created_by_user)
        ? item.created_by_user[0]
        : item.created_by_user;
      const userName =
        typeof createdByUser?.full_name === 'string'
          ? createdByUser.full_name
          : null;
      const quantityValue =
        typeof item.quantity_change !== 'undefined'
          ? Number(item.quantity_change)
          : Number(item.quantity);
      const quantity = Number.isFinite(quantityValue) ? quantityValue : 0;
      const reason =
        typeof item.remarks === 'string' && item.remarks.trim()
          ? item.remarks
          : typeof item.reason === 'string' && item.reason.trim()
            ? item.reason
            : null;
      const {
        created_by_user: _created_by_user,
        product: _product,
        ...rest
      } = item;

      return {
        ...rest,
        product: normalizedProduct,
        user: userName ? { name: userName } : null,
        quantity,
        reason,
      };
    });

    return {
      success: true,
      data: movements as StockMovementWithRelations[],
      pagination: {
        current_page: safePage,
        total_pages: Math.ceil(totalItems / ITEMS_PER_PAGE),
        total_items: totalItems,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch stock movements'),
    };
  }
};

export const getSalesReport = async (
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<ControllerResult<SalesReport>> => {
  try {
    const { start, end } = getUtcDateRange(startDate, endDate);

    const { data: salesData, error: salesError } = await supabase
      .from(TABLES.SALES)
      .select('grand_total, tax_total, discount_total, payment_method')
      .eq('status', 'completed')
      .gte('created_at', start)
      .lt('created_at', end);

    if (salesError) {
      throw new Error(salesError.message);
    }

    const rows = (salesData ?? []) as SaleTotalsRow[];
    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const paymentBreakdown: PaymentBreakdown = {
      cash: 0,
      card: 0,
      bank_transfer: 0,
      split: 0,
    };

    for (const row of rows) {
      const saleTotal = parseAmount(row.grand_total, 'Sale total');
      const taxTotal = parseAmount(row.tax_total, 'Sale tax');
      const discountTotal = parseAmount(row.discount_total, 'Sale discount');

      totalRevenue += saleTotal;
      totalTax += taxTotal;
      totalDiscount += discountTotal;

      if (row.payment_method === 'cash') {
        paymentBreakdown.cash += saleTotal;
      } else if (row.payment_method === 'card') {
        paymentBreakdown.card += saleTotal;
      } else if (row.payment_method === 'bank_transfer') {
        paymentBreakdown.bank_transfer += saleTotal;
      } else if (row.payment_method === 'split') {
        paymentBreakdown.split += saleTotal;
      }
    }

    const { data: refundData, error: refundError } = await supabase
      .from(RETURN_REQUESTS_TABLE)
      .select('refund_amount')
      .eq('status', 'approved')
      .gte('created_at', start)
      .lt('created_at', end);

    if (refundError) {
      throw new Error(refundError.message);
    }

    let totalRefunds = 0;
    for (const refund of (refundData ?? []) as ReturnRequestRow[]) {
      totalRefunds += parseAmount(refund.refund_amount, 'Refund amount');
    }

    const netRevenue = totalRevenue - totalRefunds;

    return {
      success: true,
      data: {
        totalRevenue,
        totalTax,
        totalDiscount,
        totalRefunds,
        netRevenue,
        transactionCount: rows.length,
        paymentBreakdown,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch sales report'),
    };
  }
};

export const getDailySalesReport = async (
  supabase: SupabaseClient,
  date: string
): Promise<ControllerResult<SalesReport>> => {
  const report = await getSalesReport(supabase, date, date);
  if (!report.success) {
    return {
      success: false,
      error: report.error ?? 'Failed to fetch daily sales report',
    };
  }
  return report;
};

export const getProfitSummary = async (
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<ControllerResult<ProfitReport>> => {
  try {
    const { start, end } = getUtcDateRange(startDate, endDate);

    const { data, error } = await supabase
      .from(TABLES.SALE_ITEMS)
      .select(
        `*, product:${TABLES.PRODUCTS}(id, name, cost_price), sale:${TABLES.SALES}!inner(created_at, status)`
      )
      .eq('sale.status', 'completed')
      .gte('sale.created_at', start)
      .lt('sale.created_at', end);

    if (error) {
      throw new Error(error.message);
    }

    const rawItems = (data ?? []) as any[];
    const items = rawItems.map((item) => ({
      ...item,
      product: Array.isArray(item.product) ? item.product[0] : item.product,
      sale: Array.isArray(item.sale) ? item.sale[0] : item.sale,
    })) as SaleItemWithProduct[];

    const batchIds = new Set<string>();

    for (const item of items) {
      if (item.batch_id) {
        batchIds.add(item.batch_id);
      }
    }

    const batchCostMap = new Map<string, number>();

    if (batchIds.size > 0) {
      const { data: batchData, error: batchError } = await supabase
        .from(PRODUCT_BATCHES_TABLE)
        .select('id, cost_price_at_purchase')
        .in('id', Array.from(batchIds));

      if (batchError) {
        if (!isMissingTableError(batchError, PRODUCT_BATCHES_TABLE)) {
          throw new Error(batchError.message);
        }
      } else {
        for (const batch of batchData ?? []) {
          const batchRow = batch as { id: string; cost_price_at_purchase?: unknown };
          const cost = parseAmount(
            batchRow.cost_price_at_purchase,
            'Batch cost'
          );
          batchCostMap.set(batchRow.id, cost);
        }
      }
    }

    let totalRevenue = 0;
    let totalCOGS = 0;

    for (const item of items) {
      const quantity = parseAmount(item.quantity, 'Sale item quantity');
      const lineRevenue = parseAmount(item.sub_total, 'Sale item revenue');
      const productCost = parseAmount(item.product?.cost_price, 'Product cost');
      const batchCost = item.batch_id
        ? batchCostMap.get(item.batch_id)
        : undefined;
      const unitCost =
        typeof batchCost === 'number' && Number.isFinite(batchCost)
          ? batchCost
          : productCost;

      totalRevenue += lineRevenue;
      totalCOGS += quantity * unitCost;
    }

    const grossProfit = totalRevenue - totalCOGS;
    const profitMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      success: true,
      data: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        profitMargin,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch profit summary'),
    };
  }
};

export const getTopSellingProducts = async (
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  limit = 10
): Promise<ControllerResult<TopSellerRow[]>> => {
  try {
    const { start, end } = getUtcDateRange(startDate, endDate);
    const safeLimit = limit > 0 ? limit : 10;

    const { data, error } = await supabase
      .from(TABLES.SALE_ITEMS)
      .select(
        `product_id, quantity, sub_total, product:${TABLES.PRODUCTS}(id, name), sale:${TABLES.SALES}!inner(created_at, status)`
      )
      .eq('sale.status', 'completed')
      .gte('sale.created_at', start)
      .lt('sale.created_at', end);

    if (error) {
      throw new Error(error.message);
    }

    const items = (data ?? []) as any[];
    const totals = new Map<string, TopSellerRow>();

    for (const item of items) {
      const productId = item.product_id;
      if (!productId) {
        continue;
      }

      const quantity = parseAmount(item.quantity, 'Sale item quantity');
      const revenue = parseAmount(item.sub_total, 'Sale item revenue');
      const existing = totals.get(productId);

      if (existing) {
        existing.quantity_sold += quantity;
        existing.total_revenue += revenue;
      } else {
        const productObj = Array.isArray(item.product)
          ? item.product[0]
          : item.product;
        totals.set(productId, {
          product_id: productId,
          product_name: productObj?.name ?? 'Unknown product',
          quantity_sold: quantity,
          total_revenue: revenue,
        });
      }
    }

    const sorted = Array.from(totals.values())
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, safeLimit);

    return { success: true, data: sorted };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch top selling products'),
    };
  }
};

export const getExpiringBatchReport = async (
  supabase: SupabaseClient,
  daysThreshold = 7
): Promise<ControllerResult<ExpiringBatch[]>> => {
  try {
    const safeThreshold =
      Number.isFinite(daysThreshold) && daysThreshold > 0
        ? Math.floor(daysThreshold)
        : 0;
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + safeThreshold);
    const targetIso = targetDate.toISOString();

    const { data, error } = await supabase
      .from(PRODUCT_BATCHES_TABLE)
      .select(
        `id, batch_number, expiry_date, quantity_remaining, cost_price_at_purchase, product:${TABLES.PRODUCTS}(name, cost_price)`
      )
      .lte('expiry_date', targetIso)
      .gt('quantity_remaining', 0)
      .order('expiry_date', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rawRows = (data ?? []) as any[];
    const rows = rawRows.map((row) => ({
      ...row,
      product: Array.isArray(row.product) ? row.product[0] : row.product,
    })) as ProductBatchRow[];

    const batches = rows.map((batch) => {
      const quantityRemaining = parseAmount(
        batch.quantity_remaining,
        'Batch quantity'
      );
      const unitCost = parseAmount(
        typeof batch.cost_price_at_purchase !== 'undefined'
          ? batch.cost_price_at_purchase
          : batch.product?.cost_price,
        'Batch cost'
      );

      return {
        product_name: batch.product?.name ?? 'Unknown product',
        batch_number: batch.batch_number ?? null,
        expiry_date: batch.expiry_date,
        cost_value: quantityRemaining * unitCost,
      };
    });

    return { success: true, data: batches };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch expiring batch report'),
    };
  }
};

export const getShiftHistory = async (
  supabase: SupabaseClient,
  page = 1
): Promise<ControllerResult<ShiftHistoryRow[]>> => {
  try {
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select(`*, cashier:${TABLES.USERS}(full_name)`)
      .eq('status', 'closed')
      .order('end_time', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as ShiftHistoryRow[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch shift history'),
    };
  }
};

export const getShiftDiscrepancyReport = async (
  supabase: SupabaseClient,
  page = 1
): Promise<ControllerResult<ShiftHistoryRow[]>> => {
  try {
    const history = await getShiftHistory(supabase, page);

    if (!history.success || !history.data) {
      return {
        success: false,
        error: history.error ?? 'Failed to fetch shift discrepancy report',
      };
    }

    const tolerance = 1;
    const discrepancies = history.data
      .map((row) => ({
        row,
        difference: parseAmount(
          typeof row.difference === 'undefined' ? 0 : row.difference,
          'Shift difference'
        ),
      }))
      .filter(({ difference }) => Math.abs(difference) >= tolerance)
      .sort(
        (a, b) =>
          Math.abs(b.difference) - Math.abs(a.difference)
      )
      .map(({ row }) => row);

    return { success: true, data: discrepancies };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch shift discrepancy report'),
    };
  }
};

export const getLowStockProducts = async (
  supabase: SupabaseClient
): Promise<ControllerResult<Product[]>> => {
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
