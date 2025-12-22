import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/constants';
import type { Supplier } from '../../types';

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SupplierInsert = {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
};

type SupplierUpdate = Partial<
  Pick<Supplier, 'name' | 'contact_person' | 'phone' | 'email' | 'address' | 'tax_id'>
>;

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

const isDuplicateNameError = (error: unknown) => {
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

const normalizeOptionalString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const ensureNameAvailable = async (
  name: string,
  excludeSupplierId?: string
) => {
  let query = supabase.from(TABLES.SUPPLIERS).select('id').eq('name', name);

  if (excludeSupplierId) {
    query = query.neq('id', excludeSupplierId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.length > 0) {
    throw new Error('Supplier with this name already exists');
  }
};

export const getSuppliers = async (
  onlyActive?: boolean
): Promise<ControllerResult<Supplier[]>> => {
  try {
    let query = supabase.from(TABLES.SUPPLIERS).select('*');

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('name');

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Supplier[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch suppliers'),
    };
  }
};

export const getSupplierById = async (
  id: string
): Promise<ControllerResult<Supplier>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Supplier not found');
    }

    return { success: true, data: data as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch supplier'),
    };
  }
};

export const createSupplier = async (
  data: SupplierInsert
): Promise<ControllerResult<Supplier>> => {
  try {
    const name = data.name?.trim();

    if (!name) {
      throw new Error('Supplier name is required');
    }

    await ensureNameAvailable(name);

    const payload = {
      name,
      contact_person: normalizeOptionalString(data.contact_person),
      phone: normalizeOptionalString(data.phone),
      email: normalizeOptionalString(data.email),
      address: normalizeOptionalString(data.address),
      tax_id: normalizeOptionalString(data.tax_id),
      is_active: true,
    };

    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .insert(payload)
      .select('*')
      .single();

    if (error || !supplier) {
      if (isDuplicateNameError(error)) {
        throw new Error('Supplier with this name already exists');
      }
      throw new Error(error?.message ?? 'Failed to create supplier');
    }

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create supplier'),
    };
  }
};

export const updateSupplier = async (
  id: string,
  data: SupplierUpdate
): Promise<ControllerResult<Supplier>> => {
  try {
    const hasUpdates = Object.values(data).some(
      (value) => typeof value !== 'undefined'
    );

    if (!hasUpdates) {
      throw new Error('No supplier updates provided');
    }

    const payload: SupplierUpdate = { ...data };

    if (typeof data.name !== 'undefined') {
      const trimmedName = data.name.trim();

      if (!trimmedName) {
        throw new Error('Supplier name is required');
      }

      await ensureNameAvailable(trimmedName, id);
      payload.name = trimmedName;
    }

    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !supplier) {
      if (isDuplicateNameError(error)) {
        throw new Error('Supplier with this name already exists');
      }
      throw new Error(error?.message ?? 'Failed to update supplier');
    }

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update supplier'),
    };
  }
};

export const deleteSupplier = async (
  id: string
): Promise<ControllerResult<Supplier>> => {
  try {
    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !supplier) {
      throw new Error(error?.message ?? 'Failed to delete supplier');
    }

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete supplier'),
    };
  }
};
