import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getSettings,
  updateSettings,
} from "../../../lib/controllers/settingsController";
import { createClient } from "../../../utils/supabase/server";

const trimString = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const coerceNumber = (value: unknown) => {
  if (value === null || typeof value === "undefined") {
    return value;
  }

  if (typeof value === "string" && value.trim() === "") {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

const SettingsSchema = z
  .object({
    store_name: z.preprocess(
      trimString,
      z.string().min(1, "Store name is required")
    ),
    store_address: z.preprocess(
      trimString,
      z.string().min(1, "Store address is required")
    ),
    store_phone: z.preprocess(
      trimString,
      z.string().min(1, "Store phone is required")
    ),
    currency_symbol: z.preprocess(
      trimString,
      z.string().min(1, "Currency symbol is required")
    ),
    receipt_footer: z.preprocess(trimString, z.string().optional()),
    receipt_header: z.preprocess(trimString, z.string().optional()),
    store_email: z.preprocess(
      emptyToUndefined,
      z.string().email("Invalid email address").optional()
    ),
    default_tax_rate: z
      .preprocess(
        coerceNumber,
        z
          .number({ invalid_type_error: "Tax rate must be a number" })
          .min(0, "Tax rate must be between 0 and 100")
          .max(100, "Tax rate must be between 0 and 100")
      )
      .optional(),
    tax_rate: z
      .preprocess(
        coerceNumber,
        z
          .number({ invalid_type_error: "Tax rate must be a number" })
          .min(0, "Tax rate must be between 0 and 100")
          .max(100, "Tax rate must be between 0 and 100")
      )
      .optional(),
    low_stock_threshold: z
      .preprocess(
        coerceNumber,
        z
          .number({
            invalid_type_error: "Low stock threshold must be a number",
          })
          .int("Low stock threshold must be a whole number")
          .min(0, "Low stock threshold must be 0 or higher")
      )
      .optional(),
    logo_url: z.preprocess(trimString, z.string().optional()),
  })
  .strict();

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export async function GET() {
  try {
    const result = await getSettings();

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to fetch settings");
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      void error;
      return NextResponse.json(
        { success: false, error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }

    const parsed = SettingsSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid settings payload";
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    const { tax_rate, ...rest } = parsed.data;
    const resolvedTaxRate =
      typeof rest.default_tax_rate !== "undefined"
        ? rest.default_tax_rate
        : tax_rate;

    const payload = {
      ...rest,
      ...(typeof resolvedTaxRate !== "undefined"
        ? { default_tax_rate: resolvedTaxRate }
        : {}),
    };

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

    const result = await updateSettings(payload, user.id);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "Failed to update settings");
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
