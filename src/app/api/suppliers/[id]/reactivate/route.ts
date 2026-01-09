import { NextResponse } from "next/server";
import { reactivateSupplier } from "../../../../../lib/controllers/supplierController";
import { createClient } from "../../../../../utils/supabase/server";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export async function PATCH(
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await reactivateSupplier(id, user.id);

    if (!result.success || !result.data) {
      const message = result.error ?? "Failed to reactivate supplier";
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error, "Failed to reactivate supplier"),
      },
      { status: 500 }
    );
  }
}
