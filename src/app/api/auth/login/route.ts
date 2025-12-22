import { NextResponse } from "next/server";
import { loginUser } from "../../../../lib/controllers/authController";

const isAuthError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("account is disabled") ||
    normalized.includes("inactive account") ||
    normalized.includes("inactive") ||
    normalized.includes("disabled")
  );
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await loginUser(email, password);

    return NextResponse.json(
      { success: true, user: result },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Internal Server Error";

    if (isAuthError(message)) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
