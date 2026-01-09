export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/controllers/authController";
import { createClient } from "../../../../utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

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
