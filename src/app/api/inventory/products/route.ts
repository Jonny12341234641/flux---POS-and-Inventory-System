import { NextRequest, NextResponse } from "next/server";
import {
  createProduct,
  getProducts,
} from "../../../../lib/controllers/inventoryController";

const isDuplicateBarcodeError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("barcode") &&
      (normalized.includes("already") ||
        normalized.includes("exists") ||
        normalized.includes("duplicate"))) ||
    normalized.includes("unique constraint") ||
    normalized.includes("duplicate key")
  );
};

const isPresent = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  return true;
};

const parsePage = (value: string | null): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query") ?? "";
    const page = parsePage(searchParams.get("page"));

    const result = await getProducts(query, page);

    if (!result.success) {
      throw new Error(result.error ?? "Failed to fetch products");
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data ?? [],
        pagination: { page },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      barcode,
      name,
      category_id,
      price,
      cost_price,
      stock_quantity,
      reorder_level,
      unit,
      image_url,
    } = body ?? {};

    if (
      !isPresent(barcode) ||
      !isPresent(name) ||
      price === null ||
      price === undefined ||
      cost_price === null ||
      cost_price === undefined
    ) {
      return NextResponse.json(
        { error: "Barcode, name, price, and cost price are required" },
        { status: 400 }
      );
    }

    const payload = {
      barcode,
      name,
      category_id,
      price,
      cost_price,
      stock_quantity,
      reorder_level,
      unit: isPresent(unit) ? unit : "pcs",
      image_url,
    };

    const result = await createProduct(payload);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to create product";
      if (isDuplicateBarcodeError(message)) {
        return NextResponse.json(
          { error: "Product with this barcode already exists" },
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
      { status: 201 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isDuplicateBarcodeError(message)) {
      return NextResponse.json(
        { error: "Product with this barcode already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
