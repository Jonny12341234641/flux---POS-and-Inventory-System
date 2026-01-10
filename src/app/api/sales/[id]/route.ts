import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { getSaleById, refundSale } from '../../../../lib/controllers/saleController';
import type { Sale, SaleItem } from '../../../../types';

type SaleItemWithProduct = SaleItem & {
  product?: { name?: string | null } | null;
  product_name?: string | null;
};

type SaleDetailsRecord = Sale & {
  cashier?: { full_name?: string | null; name?: string | null; [key: string]: unknown } | null;
  sale_items?: SaleItemWithProduct[];
  items?: SaleItemWithProduct[];
  total_amount?: number;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isNotFoundError = (message: string): boolean =>
  message.toLowerCase().includes('not found');

const isRefundError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already refunded') ||
    normalized.includes('cashier id is required') ||
    normalized.includes('sale id is required') ||
    normalized.includes('not found')
  );
};

const normalizeSaleDetails = (sale: SaleDetailsRecord) => {
  const cashierRecord =
    sale.cashier && typeof sale.cashier === 'object' ? sale.cashier : null;
  const resolvedCashierName =
    typeof cashierRecord?.full_name === 'string'
      ? cashierRecord.full_name
      : typeof cashierRecord?.name === 'string'
        ? cashierRecord.name
        : '';
  const cashier = cashierRecord
    ? {
        ...cashierRecord,
        ...(resolvedCashierName ? { name: resolvedCashierName } : {}),
      }
    : resolvedCashierName
      ? { name: resolvedCashierName }
      : undefined;

  const saleItems = Array.isArray(sale.sale_items)
    ? sale.sale_items
    : Array.isArray(sale.items)
      ? sale.items
      : [];
  const items = saleItems.map((item) => {
    const productName =
      typeof item.product?.name === 'string'
        ? item.product.name
        : typeof item.product_name === 'string'
          ? item.product_name
          : '';
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
    const unitPrice = Number.isFinite(item.unit_price) ? item.unit_price : 0;
    const computedTotal = quantity * unitPrice;
    const total =
      Number.isFinite(item.sub_total) && item.sub_total !== 0
        ? item.sub_total
        : computedTotal;

    return {
      id: item.id,
      product_id: item.product_id,
      product_name: productName,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total,
    };
  });

  const totalAmount =
    Number.isFinite(sale.total_amount)
      ? sale.total_amount
      : Number.isFinite(sale.grand_total)
        ? sale.grand_total
        : undefined;
  const resolvedCashier = cashier ?? sale.cashier;

  return {
    ...sale,
    ...(resolvedCashier ? { cashier: resolvedCashier } : {}),
    items,
    ...(typeof totalAmount !== 'undefined' ? { total_amount: totalAmount } : {}),
  };
};

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const result = await getSaleById(id);

    if (!result.success || !result.data) {
      const message = result.error ?? 'Sale not found';

      if (isNotFoundError(message)) {
        return NextResponse.json(
          { success: false, error: message },
          { status: 404 }
        );
      }

      throw new Error(message);
    }

    const normalized = normalizeSaleDetails(result.data as SaleDetailsRecord);

    return NextResponse.json(
      { success: true, data: normalized },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const result = await refundSale(id, user.id);

    if (!result.success) {
      const message = result.error ?? 'Failed to refund sale';
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Sale refunded successfully' },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, 'Internal Server Error');

    if (isRefundError(message)) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
