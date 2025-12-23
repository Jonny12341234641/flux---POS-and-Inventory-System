import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { getStockMovements } from "../../../../lib/controllers/reportController";
import type { StockMovement } from "../../../../types";

export const dynamic = "force-dynamic";

function parsePage(pageParam: string | null): number {
  const parsed = Number.parseInt(pageParam ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

function normalizeOptionalParam(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const STOCK_MOVEMENT_TYPES: ReadonlyArray<StockMovement["type"]> = [
  "sale",
  "purchase",
  "return",
  "adjustment",
  "damage",
];

function normalizeStockMovementType(
  value: string | null
): StockMovement["type"] | undefined {
  const normalized = normalizeOptionalParam(value);
  if (!normalized) {
    return undefined;
  }
  return STOCK_MOVEMENT_TYPES.includes(normalized as StockMovement["type"])
    ? (normalized as StockMovement["type"])
    : undefined;
}

export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get("page"));
    const type = normalizeStockMovementType(searchParams.get("type"));
    const productId = normalizeOptionalParam(searchParams.get("productId"));

    const data = await getStockMovements(page, { type, productId });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
