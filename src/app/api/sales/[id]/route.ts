import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { getSaleById, refundSale } from '../../../../lib/controllers/saleController';

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

    return NextResponse.json(
      { success: true, data: result.data },
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
