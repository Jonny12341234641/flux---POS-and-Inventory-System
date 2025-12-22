import { supabase } from "../..//lib/supabase";
import type { User } from "../../types";

type UserProfileRow = Pick<
  User,
  "id" | "username" | "full_name" | "role" | "status" | "last_login"
>;

type AuthenticatedUser = UserProfileRow & {
  email: string;
};

const PROFILE_SELECT = "id, username, full_name, role, status, last_login";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const buildAuthenticatedUser = (
  profile: UserProfileRow,
  email: string,
  lastLogin?: string
): AuthenticatedUser => ({
  id: profile.id,
  username: profile.username,
  full_name: profile.full_name,
  role: profile.role,
  status: profile.status,
  last_login: lastLogin ?? profile.last_login,
  email,
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

    const loginTimestamp = new Date();
    const { error: updateError } = await supabase
      .from("users")
      .update({ last_login: loginTimestamp.toISOString() })
      .eq("id", userId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return buildAuthenticatedUser(
      profile,
      session.user.email ?? email,
      loginTimestamp.toISOString()
    );
  } catch (error) {
    throw new Error(getErrorMessage(error, "Login failed"));
  }
};

export const logoutUser = async (): Promise<{ success: true }> => {
  try {
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
      throw new Error(error.message);
    }

    const session = data.session;
    if (!session?.user) {
      return null;
    }

    const profile = await fetchUserProfile(session.user.id);

    return buildAuthenticatedUser(profile, session.user.email ?? "");
  } catch (error) {
    throw new Error(getErrorMessage(error, "Failed to fetch current user"));
  }
};

const checkUserRole = async (userId: string): Promise<User["role"]> => {
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
