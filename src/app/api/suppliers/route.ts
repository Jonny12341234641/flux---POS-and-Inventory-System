import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import {
  createSupplier,
  getSuppliers,
} from "../../../lib/controllers/supplierController";

type SupplierPayload = {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  payment_terms?: string;
  lead_time_days?: number;
  moq?: number;
  website?: string;
  notes?: string;
};

const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || typeof value === "undefined") {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isDuplicateNameError = (message: string): boolean =>
  message.toLowerCase().includes("exists");

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);
    const query = searchParams.get("query")?.trim() || undefined;
    const activeParam = searchParams.get("active");
    const onlyActive = activeParam ? activeParam !== "false" : true;

    const result = await getSuppliers(page, limit, query, onlyActive);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to fetch suppliers" },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Failed to fetch suppliers") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SupplierPayload>;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Supplier name is required" },
        { status: 400 }
      );
    }

    const payload: SupplierPayload = {
      name,
      contact_person: body?.contact_person,
      phone: body?.phone,
      email: body?.email,
      address: body?.address,
      tax_id: body?.tax_id,
      payment_terms: body?.payment_terms,
      lead_time_days: parseOptionalNumber(body?.lead_time_days),
      moq: parseOptionalNumber(body?.moq),
      website: body?.website,
      notes: body?.notes,
    };

    const result = await createSupplier(payload, user.id);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to create supplier";
      const status = isDuplicateNameError(message) ? 409 : 400;
      return NextResponse.json(
        { success: false, error: message },
        { status }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Failed to create supplier");
    if (isDuplicateNameError(message)) {
      return NextResponse.json(
        { success: false, error: "Supplier with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
