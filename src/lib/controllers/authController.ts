import { supabase } from "../../lib/supabase";
import type { ShiftSession, User, UserRow } from "../../types"; // Import UserRow

// explicit fields to select (excluding password_hash)
const PROFILE_SELECT = "id, username, full_name, role, status, last_login, created_at, updated_at";
const SHIFT_SELECT = "id, start_time, status";

type UserProfileRow = Pick<
  UserRow, // Use UserRow here to match DB source truth
  "id" | "username" | "full_name" | "role" | "status" | "last_login" | "created_at" | "updated_at"
>;

type ShiftSessionRow = Pick<ShiftSession, "id" | "status" | "start_time">;

type AuthenticatedUser = User & {
  email: string;
  is_active: boolean;
  active_shift_id?: string | null;
};

type AuthAuditAction = "LOGIN" | "LOGOUT" | "PASSWORD_CHANGE";
type AuthAuditDetails = Record<string, unknown> | string | null;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const buildAuthenticatedUser = (
  profile: UserProfileRow,
  email: string,
  lastLogin?: string,
  activeShiftId?: string | null
): AuthenticatedUser => ({
  id: profile.id,
  username: profile.username,
  full_name: profile.full_name,
  role: profile.role,
  status: profile.status,
  last_login: lastLogin ?? profile.last_login,
  email,
  created_at: profile.created_at ?? new Date().toISOString(), // Fix: use real date
  updated_at: profile.updated_at ?? '',
  is_active: profile.status === "active",
  active_shift_id: activeShiftId ?? null
});

const fetchUserProfile = async (userId: string): Promise<UserProfileRow> => {
  const { data, error } = await supabase
    .from("users")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "User profile not found");
  }

  return data as UserProfileRow;
};

const fetchActiveShiftId = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("shift_sessions")
    .select(SHIFT_SELECT)
    .eq("user_id", userId)
    .eq("status", "open")
    .order("start_time", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const activeShift = (data ?? [])[0] as ShiftSessionRow | undefined;
  return activeShift?.id ?? null;
};

const normalizeAuditDetails = (details: AuthAuditDetails): string | null => {
  if (details === null || typeof details === "undefined") {
    return null;
  }

  if (typeof details === "string") {
    return details;
  }

  return JSON.stringify(details);
};

const logAuthEvent = async (
  userId: string,
  action: AuthAuditAction,
  details: AuthAuditDetails
): Promise<void> => {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      details: normalizeAuditDetails(details),
      ip_address: null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Auth audit log failed:", getErrorMessage(error, "Audit log error"));
  }
};

export const loginUser = async (
  email: string,
  password: string
): Promise<AuthenticatedUser> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new Error(error?.message ?? "Invalid login credentials");
    }

    const session = data.session;
    const userId = session.user.id;
    const profile = await fetchUserProfile(userId);

    if (profile.status === "inactive") {
      await supabase.auth.signOut();
      throw new Error("Account is disabled");
    }

    const activeShiftId = await fetchActiveShiftId(userId);
    const loginTimestamp = new Date();
    // Update last_login
    const { error: updateError } = await supabase
      .from("users")
      .update({ last_login: loginTimestamp.toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update last_login:", updateError.message);
    }

    await logAuthEvent(userId, "LOGIN", {
      method: "password",
      active_shift_id: activeShiftId,
    });

    return buildAuthenticatedUser(
      profile,
      session.user.email ?? email,
      loginTimestamp.toISOString(),
      activeShiftId
    );
  } catch (error) {
    throw new Error(getErrorMessage(error, "Login failed"));
  }
};

export const logoutUser = async (): Promise<{ success: true }> => {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session lookup failed:", sessionError.message);
    }

    const userId = sessionData?.session?.user?.id;
    if (userId) {
      await logAuthEvent(userId, "LOGOUT", { reason: "user_request" });
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  } catch (error) {
    throw new Error(getErrorMessage(error, "Logout failed"));
  }
};

export const getCurrentUser = async (): Promise<AuthenticatedUser | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Session error:", error.message);
      return null;
    }

    const session = data.session;
    if (!session?.user) {
      return null;
    }

    const profile = await fetchUserProfile(session.user.id);
    if (profile.status === "inactive") {
      await supabase.auth.signOut();
      return null;
    }

    const activeShiftId = await fetchActiveShiftId(profile.id);

    return buildAuthenticatedUser(
      profile,
      session.user.email ?? "",
      undefined,
      activeShiftId
    );
  } catch (error) {
    console.error("Get current user failed:", error);
    return null;
  }
};

export const changePassword = async (
  newPassword: string
): Promise<{ success: true }> => {
  try {
    const trimmedPassword = newPassword?.trim();
    if (!trimmedPassword) {
      throw new Error("New password is required");
    }

    const { data, error } = await supabase.auth.updateUser({
      password: trimmedPassword,
    });

    if (error) {
      throw new Error(error.message);
    }

    const userId = data.user?.id;
    if (userId) {
      await logAuthEvent(userId, "PASSWORD_CHANGE", {
        method: "self_service",
      });
    }

    return { success: true };
  } catch (error) {
    throw new Error(getErrorMessage(error, "Failed to change password"));
  }
};

export const requestPasswordReset = async (
  email: string
): Promise<{ success: true }> => {
  try {
    const trimmedEmail = email?.trim();
    if (!trimmedEmail) {
      throw new Error("Email is required");
    }

    if (typeof window === "undefined") {
      throw new Error("Password reset requires a browser session");
    }

    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error) {
    throw new Error(getErrorMessage(error, "Failed to request password reset"));
  }
};

export const checkUserRole = async (userId: string): Promise<User["role"]> => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !data?.role) {
      throw new Error(error?.message ?? "User role not found");
    }

    return data.role;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Failed to check user role"));
  }
};
