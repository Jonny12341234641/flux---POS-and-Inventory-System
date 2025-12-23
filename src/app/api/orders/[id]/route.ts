import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import {
  cancelOrder,
  getPurchaseOrderById,
  receiveGoods,
} from "../../../../lib/controllers/orderController";

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

const isReceiveBadRequest = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already received") ||
    normalized.includes("cannot receive") ||
    normalized.includes("cancelled") ||
    normalized.includes("no purchase items") ||
    normalized.includes("not found")
  );
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
  void req;
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
    const result = await receiveGoods(id, user.id);

    if (!result.success) {
      throw new Error(result.error ?? "Failed to receive goods");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Goods received and inventory updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isReceiveBadRequest(message)) {
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
