import { NextResponse } from "next/server";
import {
  deleteSupplier,
  getSupplierById,
  updateSupplier,
} from "../../../../lib/controllers/supplierController";

type SupplierUpdatePayload = {
  name?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  tax_id?: string;
};

const isDuplicateNameError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (typeof error === "string") {
    const normalized = error.toLowerCase();
    return (
      normalized.includes("supplier with this name already exists") ||
      ((normalized.includes("duplicate") || normalized.includes("unique")) &&
        normalized.includes("name"))
    );
  }

  if (error instanceof Error) {
    return isDuplicateNameError(error.message);
  }

  if (typeof error === "object") {
    if (
      "code" in error &&
      (error as { code?: string }).code === "P2002" &&
      "meta" in error &&
      (error as { meta?: { target?: string[] } }).meta?.target?.includes("name")
    ) {
      return true;
    }

    if (
      "message" in error &&
      typeof (error as { message?: string }).message === "string"
    ) {
      return isDuplicateNameError((error as { message?: string }).message);
    }

    if (
      "details" in error &&
      typeof (error as { details?: string }).details === "string"
    ) {
      return isDuplicateNameError((error as { details?: string }).details);
    }
  }

  return false;
};

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
      if (isNotFoundError(result.error)) {
        return NextResponse.json(
          { error: "Supplier not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch supplier" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch supplier" },
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
    const body = (await req.json()) as SupplierUpdatePayload;
    const { name, phone, email, contact_person, address, tax_id } = body ?? {};

    const result = await updateSupplier(id, {
      name,
      phone,
      email,
      contact_person,
      address,
      tax_id,
    });

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to update supplier";
      if (isDuplicateNameError(message)) {
        return NextResponse.json(
          { error: "Supplier with this name already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to update supplier" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    if (isDuplicateNameError(error)) {
      return NextResponse.json(
        { error: "Supplier with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to update supplier") },
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
    const result = await deleteSupplier(id);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to deactivate supplier" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Supplier deactivated successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to deactivate supplier" },
      { status: 500 }
    );
  }
}
