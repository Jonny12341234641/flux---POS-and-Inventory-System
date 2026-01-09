import { NextResponse } from "next/server";
import { logoutUser } from "../../../../lib/controllers/authController";
import { createClient } from "../../../../utils/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await logoutUser(supabase);

    return NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to logout";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
