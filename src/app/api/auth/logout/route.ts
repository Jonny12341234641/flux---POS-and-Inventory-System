import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/controllers/authController";

export async function POST() {
  try {
    await logoutUser();

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
