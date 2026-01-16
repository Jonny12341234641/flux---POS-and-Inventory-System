import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import {
  deleteUser,
  getUserById,
  updateUser,
} from "../../../../lib/controllers/userController";

type UserRole = "admin" | "cashier";

type UpdateUserBody = {
  name?: unknown;
  full_name?: unknown;
  role?: unknown;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ADMIN_ROLE: UserRole = "admin";

const parseTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseRole = (value: unknown): UserRole | undefined => {
  if (value === "admin" || value === "cashier") {
    return value;
  }
  return undefined;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const result = await getUserById(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to fetch user" },
        { status: 500 }
      );
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

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: roleData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (roleError) {
      return NextResponse.json(
        { success: false, error: "Failed to verify user role" },
        { status: 500 }
      );
    }

    if (roleData?.role !== ADMIN_ROLE) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as UpdateUserBody;
    const name = parseTrimmedString(body?.name);
    const fullName = parseTrimmedString(body?.full_name);
    const resolvedName = fullName ?? name;
    const role = parseRole(body?.role);

    const payload: { full_name?: string; role?: UserRole } = {};

    if (typeof resolvedName !== "undefined") {
      payload.full_name = resolvedName;
    }

    if (typeof role !== "undefined") {
      payload.role = role;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const result = await updateUser(id, payload, session.user.id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to update user" },
        { status: 500 }
      );
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

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: roleData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (roleError) {
      return NextResponse.json(
        { success: false, error: "Failed to verify user role" },
        { status: 500 }
      );
    }

    if (roleData?.role !== ADMIN_ROLE) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const result = await deleteUser(id, session.user.id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to delete user" },
        { status: 500 }
      );
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
