import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type { ActionResponse, User, UserRow } from '../../types';

const PROFILE_SELECT =
  'id, username, full_name, role, status, last_login, created_at, updated_at';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

type UserPermissions = Record<string, unknown>;

type UserInsert = Pick<UserRow, 'username' | 'full_name' | 'role' | 'status'> & {
  email: string;
  password: string;
  permissions?: UserPermissions;
};

type UserUpdate = Partial<Pick<UserRow, 'full_name' | 'role' | 'status'>> & {
  permissions?: UserPermissions;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isDuplicateUsernameError = (error: unknown) => {
  if (!error) {
    return false;
  }

  const err = error as SupabaseErrorLike;
  if (err.code === '23505') {
    return true;
  }

  const message = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return message.includes('duplicate') || message.includes('unique');
};

const ensureUsernameAvailable = async (username: string) => {
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select('id')
    .eq('username', username)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.length > 0) {
    throw new Error('Username is already taken');
  }
};

const normalizeAuditDetails = (
  details: Record<string, unknown> | string | null
): string | null => {
  if (details === null || typeof details === 'undefined') {
    return null;
  }

  if (typeof details === 'string') {
    return details;
  }

  return JSON.stringify(details);
};

const logUserAction = async (
  actorId: string,
  action: string,
  details?: Record<string, unknown> | string | null
): Promise<void> => {
  try {
    const { error } = await supabase.from(TABLES.AUDIT_LOGS).insert({
      user_id: actorId,
      action,
      details: normalizeAuditDetails(details ?? null),
      ip_address: null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error(
      'User audit log failed:',
      getErrorMessage(error, 'Audit log error')
    );
  }
};

export const getUsers = async (
  page = 1
): Promise<ActionResponse<User[]>> => {
  try {
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select(PROFILE_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as User[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch users'),
    };
  }
};

export const getUserById = async (
  id: string
): Promise<ActionResponse<User>> => {
  try {
    if (!id) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select(PROFILE_SELECT)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'User not found');
    }

    return { success: true, data: data as User };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch user'),
    };
  }
};

export const createUser = async (
  data: UserInsert,
  actorId: string
): Promise<ActionResponse<User>> => {
  try {
    const username = data.username?.trim();
    const fullName = data.full_name?.trim();
    const email = data.email?.trim();
    const password = data.password;
    const trimmedActorId = actorId?.trim();

    // --- Validation ---
    if (!username) throw new Error('Username is required');
    if (!fullName) throw new Error('Full name is required');
    if (!email) throw new Error('Email is required');
    if (!password || !PASSWORD_REGEX.test(password)) {
      throw new Error(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number'
      );
    }
    if (!data.role) throw new Error('User role is required');
    if (!trimmedActorId) throw new Error('Actor ID is required');

    // 1. Ensure username is unique in our DB before trying Auth
    await ensureUsernameAvailable(username);

    // 2. COMMERCIAL GRADE: Create Identity in Supabase Auth first
    // We use supabaseAdmin because standard clients cannot create other users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: { full_name: fullName, username: username }
    });

    if (authError || !authUser.user) {
      throw new Error(authError?.message ?? "Failed to create authentication account");
    }

    // 3. Insert into Public Users Table using the SAME ID
    const payload = {
      id: authUser.user.id, // <--- CRITICAL: Link Auth ID to DB ID
      username,
      full_name: fullName,
      role: data.role,
      status: data.status,
      permissions: data.permissions,
      // created_at will be auto-set by DB
    };

    const { data: newUser, error: dbError } = await supabase
      .from(TABLES.USERS)
      .insert(payload)
      .select(PROFILE_SELECT)
      .single();

    // Rollback: If DB insert fails, delete the Auth user to prevent "orphans"
    if (dbError || !newUser) {
      try {
        const { error: rollbackError } =
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

        if (rollbackError) {
          throw new Error(rollbackError.message);
        }
      } catch (rollbackError) {
        console.error(
          'CRITICAL: Failed to rollback auth user after user insert failure:',
          {
            userId: authUser.user.id,
            error: getErrorMessage(rollbackError, 'Rollback failed'),
          }
        );
      }
      
      if (isDuplicateUsernameError(dbError)) {
        throw new Error('Username is already taken');
      }
      throw new Error(dbError?.message ?? 'Failed to create user profile');
    }

    await logUserAction(trimmedActorId, 'USER_CREATE', {
      target_user_id: authUser.user.id,
      role: data.role,
      status: data.status,
    });

    return { success: true, data: newUser as User };

  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create user'),
    };
  }
};

export const updateUser = async (
  id: string,
  data: UserUpdate,
  actorId: string
): Promise<ActionResponse<User>> => {
  try {
    if (!id) {
      throw new Error('User ID is required');
    }
    const trimmedActorId = actorId?.trim();
    if (!trimmedActorId) {
      throw new Error('Actor ID is required');
    }

    const hasUpdates = Object.values(data).some(
      (value) => typeof value !== 'undefined'
    );

    if (!hasUpdates) {
      throw new Error('No user updates provided');
    }

    const payload: UserUpdate = { ...data };

    if (typeof data.full_name !== 'undefined') {
      const trimmedName = data.full_name.trim();
      if (!trimmedName) {
        throw new Error('Full name is required');
      }
      payload.full_name = trimmedName;
    }

    const { data: user, error } = await supabase
      .from(TABLES.USERS)
      .update(payload)
      .eq('id', id)
      .select(PROFILE_SELECT)
      .single();

    if (error || !user) {
      throw new Error(error?.message ?? 'Failed to update user');
    }

    await logUserAction(trimmedActorId, 'USER_UPDATE', {
      target_user_id: id,
      updates: payload,
    });

    if (payload.status === 'inactive') {
      const { error: signOutError } =
        await supabaseAdmin.auth.admin.signOut(id);

      if (signOutError) {
        throw new Error(
          signOutError.message ?? 'Failed to revoke user sessions'
        );
      }
    }

    return { success: true, data: user as User };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update user'),
    };
  }
};

export const deleteUser = async (
  id: string,
  actorId: string
): Promise<ActionResponse<User>> => {
  try {
    if (!id) {
      throw new Error('User ID is required');
    }
    const trimmedActorId = actorId?.trim();
    if (!trimmedActorId) {
      throw new Error('Actor ID is required');
    }

    const { data, error } = await supabase
      .from(TABLES.USERS)
      .update({ status: 'inactive' })
      .eq('id', id)
      .select(PROFILE_SELECT)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to deactivate user');
    }

    await logUserAction(trimmedActorId, 'USER_DEACTIVATE', {
      target_user_id: id,
      status: 'inactive',
    });

    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(id);

    if (signOutError) {
      throw new Error(
        signOutError.message ?? 'Failed to revoke user sessions'
      );
    }

    return { success: true, data: data as User };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to deactivate user'),
    };
  }
};
