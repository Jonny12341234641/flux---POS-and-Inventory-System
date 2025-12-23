import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createSale } from '@/lib/controllers/saleController';

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
  payment_method: 'cash' | 'card' | 'bank_transfer';
  amount_paid: number;
  discount_total?: number;
  customer_id?: string | null;
  items?: SaleItemPayload[];
};

const isInsufficientStock = (message: string) =>
  message.toLowerCase().includes('insufficient stock');

export async function POST(request: Request) {
  try {
    const supabase = createClient();
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
    } = body ?? {};

    const normalizedItems = Array.isArray(items)
      ? items.map((item) => ({
          productId: item.product_id ?? item.productId,
          quantity: item.quantity,
          unitPrice: item.unit_price ?? item.unitPrice,
          discount: item.discount,
          taxAmount: item.tax_amount ?? item.taxAmount,
        }))
      : [];

    const payload = {
      payment_method,
      amount_paid,
      discount_total,
      customer_id,
      items: normalizedItems,
    };

    const result = await createSale(payload, payload.items, user.id);

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
