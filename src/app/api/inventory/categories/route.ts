import { NextRequest, NextResponse } from "next/server";

import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../../../../lib/controllers/inventoryController";

const isPresent = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  return true;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isDuplicateNameError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("name") &&
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
  void req;
  try {
    const result = await getCategories();

    if (!result.success) {
      throw new Error(result.error ?? "Failed to fetch categories");
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
    const { name, color_code, description } = body ?? {};

    if (!isPresent(name)) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const payload = { name, color_code, description };
    const result = await createCategory(payload);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to create category";
      if (isDuplicateNameError(message)) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
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

    if (isDuplicateNameError(message)) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, color_code, description } = body ?? {};

    if (!isPresent(id)) {
      return NextResponse.json(
        { error: "Category id is required" },
        { status: 400 }
      );
    }

    const updates = { name, color_code, description };
    const result = await updateCategory(id, updates);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to update category";
      if (isDuplicateNameError(message)) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
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
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isDuplicateNameError(message)) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (!isPresent(id)) {
      return NextResponse.json(
        { error: "Category id is required" },
        { status: 400 }
      );
    }

    const result = await deleteCategory(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Category deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
