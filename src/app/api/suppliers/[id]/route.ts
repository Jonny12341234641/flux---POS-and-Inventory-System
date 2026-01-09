import { NextResponse } from "next/server";
import {
  deleteSupplier,
  getSupplierById,
  updateSupplier,
} from "../../../../lib/controllers/supplierController";
import { createClient } from "../../../../utils/supabase/server";

type SupplierUpdatePayload = {
  name?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  tax_id?: string;
  payment_terms?: string;
  lead_time_days?: number;
  moq?: number;
  website?: string;
  notes?: string;
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

const isDuplicateNameError = (message?: string): boolean =>
  Boolean(message && message.toLowerCase().includes("exists"));

const isNotFoundError = (message?: string): boolean => {
  if (!message) {
    return false;
  }
  return message.toLowerCase().includes("not found");
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
};

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  void req;
  try {
    const { id } = params;
    const result = await getSupplierById(id);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to fetch supplier";
      if (isNotFoundError(message)) {
        return NextResponse.json(
          { success: false, error: "Supplier not found" },
          { status: 404 }
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
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Failed to fetch supplier") },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as SupplierUpdatePayload;
    const {
      name,
      phone,
      email,
      contact_person,
      address,
      tax_id,
      payment_terms,
      website,
      notes,
    } = body ?? {};
    const lead_time_days = parseOptionalNumber(body?.lead_time_days);
    const moq = parseOptionalNumber(body?.moq);

    const result = await updateSupplier(id, {
      name,
      phone,
      email,
      contact_person,
      address,
      tax_id,
      payment_terms,
      lead_time_days,
      moq,
      website,
      notes,
    }, user.id);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to update supplier";
      if (isDuplicateNameError(message)) {
        return NextResponse.json(
          { success: false, error: "Supplier with this name already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: message },
        { status: isNotFoundError(message) ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Failed to update supplier");
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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  void req;
  try {
    const { id } = params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await deleteSupplier(id, user.id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to deactivate supplier" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Failed to deactivate supplier") },
      { status: 500 }
    );
  }
}
