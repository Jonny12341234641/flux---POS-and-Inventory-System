import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { returnGoodsToSupplier } from "../../../../../lib/controllers/orderController";
import type { PurchaseItem } from "../../../../../types";

type ReturnGoodsItemInput = Pick<PurchaseItem, "product_id" | "quantity"> & {
  reason?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isReturnBadRequest = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("return requires") ||
    normalized.includes("cannot return") ||
    normalized.includes("return quantity") ||
    normalized.includes("no received quantity") ||
    normalized.includes("no purchase items") ||
    normalized.includes("more than received") ||
    normalized.includes("insufficient stock") ||
    normalized.includes("not found")
  );
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

    let body: { items?: ReturnGoodsItemInput[] };

    try {
      body = (await req.json()) as { items?: ReturnGoodsItemInput[] };
    } catch (parseError) {
      void parseError;
      return NextResponse.json(
        { success: false, error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }

    const { items } = body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one item is required" },
        { status: 400 }
      );
    }

    const { id } = params;
    const result = await returnGoodsToSupplier(id, items, user.id);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to return goods");
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isReturnBadRequest(message)) {
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
