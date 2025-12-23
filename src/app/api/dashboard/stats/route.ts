import { NextResponse } from "next/server";

import { createClient } from "../../../../utils/supabase/server";
import {
  getDailySalesReport,
  getLowStockProducts,
} from "../../../../lib/controllers/reportController";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const dateString = new Date().toISOString().split("T")[0];

    const salesReport = await getDailySalesReport(dateString);
    if (!salesReport.success || !salesReport.data) {
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }

    const lowStock = await getLowStockProducts();
    if (!lowStock.success || !lowStock.data) {
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          dailyRevenue: salesReport.data.totalRevenue,
          transactionCount: salesReport.data.transactionCount,
          lowStockCount: lowStock.data.length,
          alerts: lowStock.data,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
