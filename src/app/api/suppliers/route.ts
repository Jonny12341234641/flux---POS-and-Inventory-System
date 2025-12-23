import { NextRequest, NextResponse } from "next/server";

import {
  createSupplier,
  getSuppliers,
} from "../../../lib/controllers/supplierController";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const suppliers = await getSuppliers(active === "true");

    return NextResponse.json({ success: true, data: suppliers }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const supplier = await createSupplier(body);

    return NextResponse.json(
      { success: true, data: supplier },
      { status: 201 }
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002" &&
      "meta" in error &&
      (error as { meta?: { target?: string[] } }).meta?.target?.includes("name")
    ) {
      return NextResponse.json(
        { error: "Supplier with this name already exists" },
        { status: 409 }
      );
    }

    console.error("Failed to create supplier:", error);
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}
