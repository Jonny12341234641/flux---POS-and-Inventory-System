import { NextResponse } from "next/server";

import { createClient } from "../../../../utils/supabase/server";
import {
  getDailySalesReport,
  getLowStockProducts,
} from "../../../../lib/controllers/reportController";

export const dynamic = "force-dynamic";

const getTodayDateString = (): string => {
  const isoDate = new Date().toISOString();
  const [datePart] = isoDate.split("T");

  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error("Invalid date format");
  }

  return datePart;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const dateString = getTodayDateString();

    const salesReport = await getDailySalesReport(supabase, dateString);
    if (!salesReport.success || !salesReport.data) {
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }

    const lowStock = await getLowStockProducts(supabase);
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
