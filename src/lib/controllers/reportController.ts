import { supabase } from '/lib/supabase';
import { ITEMS_PER_PAGE, TABLES } from '@/lib/constants';
import type { Product, Sale, ShiftSession, StockMovement } from '@/types';

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type StockMovementFilter = {
  productId?: string;
  type?: StockMovement['type'];
};

type StockMovementWithRelations = StockMovement & {
  product?: { name: string } | null;
  created_by_user?: { full_name: string } | null;
};

type ShiftHistoryRow = ShiftSession & {
  cashier?: { full_name: string } | null;
};

type PaymentBreakdown = {
  cash: number;
  card: number;
  bank_transfer: number;
};

type DailySalesReport = {
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  transactionCount: number;
  paymentBreakdown: PaymentBreakdown;
};

type SaleTotalsRow = Pick<
  Sale,
  'grand_total' | 'tax_total' | 'discount_total' | 'payment_method'
>;

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

export const getStockMovements = async (
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
        `*, product:${TABLES.PRODUCTS}(name), created_by_user:${TABLES.USERS}(full_name)`
      );

    if (filter?.productId) {
      query = query.eq('product_id', filter.productId);
    }

    if (filter?.type) {
      query = query.eq('type', filter.type);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      data: (data ?? []) as StockMovementWithRelations[],
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch stock movements'),
    };
  }
};

export const getDailySalesReport = async (
  date: string
): Promise<ControllerResult<DailySalesReport>> => {
  try {
    const { start, end } = getUtcDayRange(date);

    const { data, error } = await supabase
      .from(TABLES.SALES)
      .select('grand_total, tax_total, discount_total, payment_method')
      .eq('status', 'completed')
      .gte('created_at', start)
      .lt('created_at', end);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SaleTotalsRow[];
    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const paymentBreakdown: PaymentBreakdown = {
      cash: 0,
      card: 0,
      bank_transfer: 0,
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
      }
    }

    return {
      success: true,
      data: {
        totalRevenue,
        totalTax,
        totalDiscount,
        transactionCount: rows.length,
        paymentBreakdown,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch daily sales report'),
    };
  }
};

export const getShiftHistory = async (
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

export const getLowStockProducts = async (): Promise<
  ControllerResult<Product[]>
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
