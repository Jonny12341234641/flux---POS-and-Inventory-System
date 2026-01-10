import { NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";
import { createUser, getUsers } from "../../../lib/controllers/userController";

type UserRole = "admin" | "cashier";

type CreateUserBody = {
  name?: unknown;
  full_name?: unknown;
  email?: unknown;
  role?: unknown;
  password?: unknown;
};

const ADMIN_ROLE: UserRole = "admin";

const parsePage = (value: string | null): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
};

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

const getUsernameFromEmail = (email: string): string => {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  const localPart = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  return localPart.trim();
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePage(searchParams.get("page"));
    const result = await getUsers(page);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to fetch users" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data ?? [] },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
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

    const body = (await req.json()) as CreateUserBody;
    const name = parseTrimmedString(body?.name);
    const fullName = parseTrimmedString(body?.full_name);
    const resolvedName = fullName ?? name;
    const email = parseTrimmedString(body?.email);
    const role = parseRole(body?.role);
    const password = parseTrimmedString(body?.password);

    if (!resolvedName || !email || !role || !password) {
      return NextResponse.json(
        { success: false, error: "Invalid user payload" },
        { status: 400 }
      );
    }

    const username = getUsernameFromEmail(email);
    if (!username) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    const payload = {
      username,
      full_name: resolvedName,
      email,
      role,
      password,
      status: "active" as const,
    };

    const result = await createUser(payload, session.user.id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to create user" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
