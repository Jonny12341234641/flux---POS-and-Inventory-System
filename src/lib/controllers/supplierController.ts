import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/constants';
import type { ActionResponse, Supplier, PaginatedResponse } from '../../types';

type SupplierInsert = {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  payment_terms?: string;
  lead_time_days?: number;
  moq?: number;
  website?: string;
  notes?: string;
};

type SupplierUpdate = Partial<
  Pick<
    Supplier,
    | 'name'
    | 'contact_person'
    | 'phone'
    | 'email'
    | 'address'
    | 'tax_id'
    | 'payment_terms'
    | 'lead_time_days'
    | 'moq'
    | 'website'
    | 'notes'
  >
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

const logAudit = (action: string, details: string, userId: string) => {
  supabase
    .from(TABLES.AUDIT_LOGS)
    .insert({
      user_id: userId,
      action,
      details,
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) {
        console.error('Audit Log Failed:', error);
      }
    });
};

export const getSuppliers = async (
  page = 1,
  limit = 10,
  searchQuery?: string,
  onlyActive = true
): Promise<ActionResponse<PaginatedResponse<Supplier>>> => {
  try {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
    const offset = (safePage - 1) * safeLimit;

    let query = supabase
      .from(TABLES.SUPPLIERS)
      .select('*', { count: 'exact' });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const trimmedQuery = searchQuery?.trim();
    if (trimmedQuery) {
      const term = `%${trimmedQuery}%`;
      query = query.or(
        `name.ilike.${term},contact_person.ilike.${term},email.ilike.${term}`
      );
    }

    const { data, error, count } = await query
      .order('name')
      .range(offset, offset + safeLimit - 1);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      data: {
        success: true,
        data: (data ?? []) as Supplier[],
        metadata: {
          current_page: safePage,
          total_pages: Math.ceil((count ?? 0) / safeLimit),
          total_items: count ?? 0,
          items_per_page: safeLimit,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch suppliers'),
    };
  }
};

export const getSupplierById = async (
  id: string
): Promise<ActionResponse<Supplier>> => {
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
  data: SupplierInsert,
  userId: string
): Promise<ActionResponse<Supplier>> => {
  try {
    const name = data.name?.trim();

    if (!name) {
      throw new Error('Supplier name is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    await ensureNameAvailable(name);

    const payload = {
      name,
      contact_person: normalizeOptionalString(data.contact_person),
      phone: normalizeOptionalString(data.phone),
      email: normalizeOptionalString(data.email),
      address: normalizeOptionalString(data.address),
      tax_id: normalizeOptionalString(data.tax_id),
      payment_terms: normalizeOptionalString(data.payment_terms),
      lead_time_days:
        typeof data.lead_time_days === 'number' ? data.lead_time_days : null,
      moq: typeof data.moq === 'number' ? data.moq : null,
      website: normalizeOptionalString(data.website),
      notes: normalizeOptionalString(data.notes),
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

    logAudit('SUPPLIER_CREATE', `Created supplier: ${supplier.name}`, userId);
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
  data: SupplierUpdate,
  userId: string
): Promise<ActionResponse<Supplier>> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

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

    logAudit('SUPPLIER_UPDATE', `Updated supplier: ${supplier.name}`, userId);
    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update supplier'),
    };
  }
};

export const deleteSupplier = async (
  id: string,
  userId: string
): Promise<ActionResponse<Supplier>> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { count, error: checkError } = await supabase
      .from(TABLES.PURCHASE_ORDERS)
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id)
      .in('status', ['pending', 'partially_received']);

    if (checkError) {
      throw new Error(checkError.message);
    }

    if (count && count > 0) {
      throw new Error(
        `Cannot delete: This supplier has ${count} active Purchase Orders.`
      );
    }

    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !supplier) {
      throw new Error(error?.message ?? 'Failed to delete supplier');
    }

    logAudit('SUPPLIER_DELETE', `Soft deleted supplier: ${supplier.name}`, userId);
    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete supplier'),
    };
  }
};

export const reactivateSupplier = async (
  id: string,
  userId: string
): Promise<ActionResponse<Supplier>> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data: supplier, error } = await supabase
      .from(TABLES.SUPPLIERS)
      .update({ is_active: true })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !supplier) {
      throw new Error(error?.message ?? 'Failed to reactivate');
    }

    logAudit(
      'SUPPLIER_REACTIVATE',
      `Reactivated supplier: ${supplier.name}`,
      userId
    );

    return { success: true, data: supplier as Supplier };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to reactivate supplier'),
    };
  }
};
