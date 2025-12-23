import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { receiveGoods } from "../../../../../lib/controllers/orderController";

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
    const supabase = createClient();
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
