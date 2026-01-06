import { supabase } from '../../lib/supabase';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type { ActionResponse, User, UserRow } from '../../types';

const PROFILE_SELECT =
  'id, username, full_name, role, status, last_login, created_at, updated_at';

type UserInsert = Pick<UserRow, 'username' | 'full_name' | 'role' | 'status'>;

type UserUpdate = Partial<Pick<UserRow, 'full_name' | 'role' | 'status'>>;

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
  data: UserInsert
): Promise<ActionResponse<User>> => {
  try {
    const username = data.username?.trim();
    const fullName = data.full_name?.trim();

    if (!username) {
      throw new Error('Username is required');
    }

    if (!fullName) {
      throw new Error('Full name is required');
    }

    if (!data.role) {
      throw new Error('User role is required');
    }

    if (!data.status) {
      throw new Error('User status is required');
    }

    await ensureUsernameAvailable(username);

    const payload: UserInsert = {
      username,
      full_name: fullName,
      role: data.role,
      status: data.status,
    };

    const { data: user, error } = await supabase
      .from(TABLES.USERS)
      .insert(payload)
      .select(PROFILE_SELECT)
      .single();

    if (error || !user) {
      if (isDuplicateUsernameError(error)) {
        throw new Error('Username is already taken');
      }
      throw new Error(error?.message ?? 'Failed to create user');
    }

    return { success: true, data: user as User };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create user'),
    };
  }
};

export const updateUser = async (
  id: string,
  data: UserUpdate
): Promise<ActionResponse<User>> => {
  try {
    if (!id) {
      throw new Error('User ID is required');
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

    return { success: true, data: user as User };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update user'),
    };
  }
};

export const deleteUser = async (
  id: string
): Promise<ActionResponse<User>> => {
  try {
    if (!id) {
      throw new Error('User ID is required');
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

    return { success: true, data: data as User };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to deactivate user'),
    };
  }
};
