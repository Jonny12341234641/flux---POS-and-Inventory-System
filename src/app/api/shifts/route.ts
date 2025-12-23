import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentShift, openShift } from "@/lib/controllers/shiftController";

type OpenShiftPayload = {
  starting_cash?: number | string;
};

const parseStartingCash = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isOpenShiftConflict = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("open shift") && normalized.includes("already");
};

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await getCurrentShift(user.id);

    if (!result.success) {
      throw new Error(result.error ?? "Failed to fetch current shift");
    }

    return NextResponse.json(
      { success: true, data: result.data ?? null },
      { status: 200 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isOpenShiftConflict(message)) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as OpenShiftPayload;
    const startingCash = parseStartingCash(body?.starting_cash);

    if (startingCash === null || startingCash < 0) {
      return NextResponse.json(
        { success: false, error: "starting_cash must be a non-negative number" },
        { status: 400 }
      );
    }

    const result = await openShift(user.id, startingCash);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to open shift");
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Internal Server Error");

    if (isOpenShiftConflict(message)) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
