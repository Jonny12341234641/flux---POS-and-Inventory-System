import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { closeShift } from "../../../../../lib/controllers/shiftController";

type CloseShiftPayload = {
  ending_cash?: number;
  notes?: string;
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shiftId = id;
    const body = (await req.json()) as CloseShiftPayload;
    const { ending_cash, notes } = body ?? {};

    if (!shiftId) {
      return NextResponse.json({ error: "Shift id is required" }, { status: 400 });
    }

    if (!isNumber(ending_cash) || ending_cash < 0) {
      return NextResponse.json(
        { error: "ending_cash must be a non-negative number" },
        { status: 400 }
      );
    }

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { error: "notes must be a string" },
        { status: 400 }
      );
    }

    const result = await closeShift(shiftId, ending_cash, notes);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to close shift");
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
