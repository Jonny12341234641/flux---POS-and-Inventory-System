import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import {
  cancelOrder,
  getPurchaseOrderById,
  updatePurchaseOrder,
} from "../../../../lib/controllers/orderController";
import type { PurchaseItem, PurchaseOrder } from "../../../../types";

type PurchaseItemInput = Pick<
  PurchaseItem,
  "product_id" | "quantity" | "unit_cost" | "expiry_date"
> & {
  total_cost?: number;
};

type PurchaseOrderUpdatePayload = Partial<
  Pick<
    PurchaseOrder,
    | "supplier_id"
    | "reference_number"
    | "expected_date"
    | "notes"
    | "order_date"
    | "payment_status"
  >
>;

type UpdatePurchaseOrderBody = PurchaseOrderUpdatePayload & {
  items?: PurchaseItemInput[];
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
};

const isNotFoundError = (message?: string): boolean => {
  if (!message) {
    return false;
  }
  return message.toLowerCase().includes("not found");
};

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  void req;
  try {
    const { id } = params;
    const result = await getPurchaseOrderById(id);

    if (!result.success || !result.data) {
      const message = result.error ?? "Purchase order not found";

      if (isNotFoundError(message)) {
        return NextResponse.json(
          { success: false, error: message },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = (await req.json()) as UpdatePurchaseOrderBody;
    const {
      items,
      supplier_id,
      reference_number,
      expected_date,
      notes,
      order_date,
      payment_status,
    } = body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one item is required" },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item: any) => ({
      product_id: item.product_id ?? item.productId,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost ?? item.unitCost),
      expiry_date: item.expiry_date ?? item.expiryDate,
    }));

    const hasInvalidItems = normalizedItems.some(
      (item) =>
        !item.product_id ||
        !Number.isFinite(item.quantity) ||
        !Number.isFinite(item.unit_cost)
    );

    if (hasInvalidItems) {
      return NextResponse.json(
        { success: false, error: "Invalid items payload" },
        { status: 400 }
      );
    }

    const orderUpdates: PurchaseOrderUpdatePayload = {
      supplier_id,
      reference_number,
      expected_date,
      notes,
      order_date,
      payment_status,
    };

    const result = await updatePurchaseOrder(id, normalizedItems, orderUpdates);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to update purchase order");
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  void req;
  try {
    const { id } = params;
    const result = await cancelOrder(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to cancel order" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Order cancelled successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Failed to cancel order") },
      { status: 400 }
    );
  }
}
