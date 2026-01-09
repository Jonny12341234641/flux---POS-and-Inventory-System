import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { receiveGoods } from "../../../../../lib/controllers/orderController";
import type { PurchaseItem } from "../../../../../types";

type ReceiveGoodsItemInput = Pick<PurchaseItem, "product_id" | "quantity"> & {
  unit_cost?: number;
  expiry_date?: string;
};

const isAlreadyReceivedError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("already received");
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

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
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;
    let body: { items?: ReceiveGoodsItemInput[] } = {};

    try {
      body = (await req.json()) as { items?: ReceiveGoodsItemInput[] };
    } catch (parseError) {
      void parseError;
      body = {};
    }

    const { items } = body ?? {};

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "items must be an array" },
        { status: 400 }
      );
    }

    const result = await receiveGoods(id, user.id, items ?? []);

    if (!result.success) {
      throw new Error(result.error ?? "Failed to receive goods");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Stock received and inventory updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isAlreadyReceivedError(message)) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
