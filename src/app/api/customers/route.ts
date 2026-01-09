import { NextRequest, NextResponse } from "next/server";
import {
  createCustomer,
  getCustomers,
  searchCustomers,
} from "../../../lib/controllers/customerController";

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

const isDuplicatePhoneError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("phone") &&
      (normalized.includes("already") ||
        normalized.includes("exists") ||
        normalized.includes("duplicate") ||
        normalized.includes("unique"))) ||
    normalized.includes("unique constraint") ||
    normalized.includes("duplicate key") ||
    normalized.includes("23505")
  );
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    if (searchParams.has("query")) {
      const query = searchParams.get("query") ?? "";
      const limitParam = searchParams.get("limit");
      const minLoyaltyPointsParam = searchParams.get("min_loyalty_points");
      const createdAfterDate =
        searchParams.get("created_after_date") ?? undefined;
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
      const min_loyalty_points = minLoyaltyPointsParam
        ? Number.parseInt(minLoyaltyPointsParam, 10)
        : undefined;
      const result = await searchCustomers(query, {
        limit,
        min_loyalty_points,
        created_after_date: createdAfterDate,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Failed to search customers");
      }

      return NextResponse.json(
        { success: true, data: result.data ?? [] },
        { status: 200 }
      );
    }

    const page = parsePage(searchParams.get("page"));
    const result = await getCustomers(page);

    if (!result.success) {
      throw new Error(result.error ?? "Failed to fetch customers");
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      email,
      address,
      tax_id,
      address_street,
      address_city,
      address_state,
      address_zip,
      store_credit,
      tier_id,
    } = body ?? {};

    if (!isPresent(name) || !isPresent(phone)) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    const payload = {
      name,
      phone,
      email,
      address,
      tax_id,
      address_street,
      address_city,
      address_state,
      address_zip,
      store_credit,
      tier_id,
    };
    const result = await createCustomer(payload);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to create customer";

      if (isDuplicatePhoneError(message)) {
        return NextResponse.json(
          { error: "Customer with this phone number already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isDuplicatePhoneError(message)) {
      return NextResponse.json(
        { error: "Customer with this phone number already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
