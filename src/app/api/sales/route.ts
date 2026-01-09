import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';
import { createSale, getSales } from '../../../lib/controllers/saleController';

type SaleItemPayload = {
  product_id?: string;
  productId?: string;
  quantity: number;
  unit_price?: number;
  unitPrice?: number;
  discount?: number;
  tax_amount?: number;
  taxAmount?: number;
};

type SalePayload = {
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'split';
  amount_paid: number;
  discount_total?: number;
  customer_id?: string | null;
  items?: SaleItemPayload[];
  payments?: {
    amount: number;
    method: 'cash' | 'card' | 'bank_transfer';
    reference_id?: string;
  }[];
  promo_code?: string;
  approval_code?: string;
  manager_id?: string;
};

type NormalizedSaleItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxAmount?: number;
};

const isInsufficientStock = (message: string) =>
  message.toLowerCase().includes('insufficient stock');

const isPaymentMethod = (
  value: unknown
): value is SalePayload['payment_method'] =>
  value === 'cash' ||
  value === 'card' ||
  value === 'bank_transfer' ||
  value === 'split';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get('page');
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const parsedPage = pageParam ? Number(pageParam) : 1;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const dateRange = from || to ? { from, to } : undefined;

    const result = await getSales(page, dateRange);

    if (!result.success) {
      throw new Error(result.error ?? 'Failed to fetch sales');
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch sales';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<SalePayload>;
    const {
      payment_method,
      amount_paid,
      discount_total,
      customer_id,
      items,
      payments,
      promo_code,
      approval_code,
      manager_id,
    } = body ?? {};

    if (!isPaymentMethod(payment_method)) {
      return NextResponse.json(
        { error: 'Invalid payment_method' },
        { status: 400 }
      );
    }

    if (!isNumber(amount_paid)) {
      return NextResponse.json(
        { error: 'Invalid amount_paid' },
        { status: 400 }
      );
    }

    if (discount_total !== undefined && !isNumber(discount_total)) {
      return NextResponse.json(
        { error: 'Invalid discount_total' },
        { status: 400 }
      );
    }

    const normalizedItems = Array.isArray(items)
      ? items.map((item) => ({
          productId: item.product_id ?? item.productId,
          quantity: item.quantity,
          unitPrice: item.unit_price ?? item.unitPrice,
          discount: item.discount,
          taxAmount: item.tax_amount ?? item.taxAmount,
        }))
      : [];

    const hasInvalidItems = normalizedItems.some(
      (item) =>
        !item.productId ||
        !isNumber(item.quantity) ||
        !isNumber(item.unitPrice) ||
        (item.discount !== undefined && !isNumber(item.discount)) ||
        (item.taxAmount !== undefined && !isNumber(item.taxAmount))
    );

    if (hasInvalidItems) {
      return NextResponse.json(
        { error: 'Invalid items payload' },
        { status: 400 }
      );
    }

    const saleData = {
      payment_method,
      amount_paid,
      discount_total,
      customer_id,
      payments,
      promo_code,
      approval_code,
      manager_id,
    };

    const result = await createSale(
      saleData,
      normalizedItems as NormalizedSaleItem[],
      user.id
    );

    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Failed to process sale');
    }

    return NextResponse.json(result.data.sale, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to process sale';
    const status = isInsufficientStock(message) ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
