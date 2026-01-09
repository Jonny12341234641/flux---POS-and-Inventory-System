import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import {
  createPurchaseOrder,
  getPurchaseOrders,
} from "../../../lib/controllers/orderController";

const isPresent = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  return true;
};

export async function GET() {
  try {
    const result = await getPurchaseOrders();

    if (!result.success) {
      throw new Error(result.error ?? "Failed to fetch purchase orders");
    }

    return NextResponse.json(
      { success: true, data: result.data ?? [] },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const { supplier_id, expected_date, notes, reference_number, items } =
      body ?? {};

    if (!isPresent(supplier_id)) {
      return NextResponse.json(
        { success: false, error: "supplier_id is required" },
        { status: 400 }
      );
    }

    const normalizedItems = Array.isArray(items)
      ? items.map((item: any) => ({
          product_id: item.product_id ?? item.productId,
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost ?? item.unitCost),
          expiry_date: item.expiry_date ?? item.expiryDate,
        }))
      : [];

    if (normalizedItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one item is required" },
        { status: 400 }
      );
    }

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

    const orderData = {
      supplier_id,
      expected_date,
      notes,
      reference_number,
      created_by: user.id,
    };

    const result = await createPurchaseOrder(orderData, normalizedItems);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to create purchase order");
    }

    return NextResponse.json(
      { success: true, data: { id: result.data.id } },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
