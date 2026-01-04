import { NextResponse } from "next/server";
import {
  deleteCustomer,
  getCustomerById,
  updateCustomer,
} from "../../../../lib/controllers/customerController";

type CustomerUpdatePayload = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
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
    const result = await getCustomerById(id);

    if (!result.success || !result.data) {
      if (isNotFoundError(result.error)) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch customer" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch customer" },
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
    const body = (await req.json()) as CustomerUpdatePayload;
    const { name, phone, email, address, tax_id } = body ?? {};

    const result = await updateCustomer(id, {
      name,
      phone,
      email,
      address,
      tax_id,
    });

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to update customer";
      if (isDuplicatePhoneError(message)) {
        return NextResponse.json(
          { error: "Customer with this phone number already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Failed to update customer");
    if (isDuplicatePhoneError(message)) {
      return NextResponse.json(
        { error: "Customer with this phone number already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: message },
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
    const result = await deleteCustomer(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete customer" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Customer deactivated successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
