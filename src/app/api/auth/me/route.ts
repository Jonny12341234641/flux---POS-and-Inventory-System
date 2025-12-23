export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/controllers/authController";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, user: null },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, user: null }, { status: 500 });
  }
}
