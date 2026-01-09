import { NextResponse } from "next/server";
import {
  deleteProduct,
  getProductById,
  updateProduct,
} from "../../../../../lib/controllers/inventoryController";
import { createClient } from "../../../../../utils/supabase/server";

const isDuplicateBarcodeError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("barcode") &&
      (normalized.includes("already") ||
        normalized.includes("exists") ||
        normalized.includes("duplicate") ||
        normalized.includes("used"))) ||
    normalized.includes("unique constraint") ||
    normalized.includes("duplicate key")
  );
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  try {
    const { id } = await params;
    const result = await getProductById(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await req.json();
    } catch (e) {
      void e;
      return NextResponse.json(
        { success: false, error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await updateProduct(id, body, user.id);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to update product";
      if (isDuplicateBarcodeError(message)) {
        return NextResponse.json(
          { error: "Barcode already in use" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");
    if (isDuplicateBarcodeError(message)) {
      return NextResponse.json(
        { error: "Barcode already in use" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  try {
    const { id } = await params;
    const result = await deleteProduct(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Internal Server Error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Product deactivated successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
